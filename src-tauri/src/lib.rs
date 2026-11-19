mod db;

use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const LEGACY_WORKSPACE_FILE: &str = "workspace.json";
const DATABASE_FILE: &str = "tasker.db";
const EXPORT_DIR: &str = "exports";

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the app data folder: {error}"))
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join(DATABASE_FILE))
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Export path has no parent folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;

    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents)
        .map_err(|error| format!("Could not write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Could not replace {}: {error}", path.display()))?;
    Ok(())
}

#[tauri::command]
fn load_workspace(app: AppHandle) -> Result<Option<String>, String> {
    let mut connection = db::open(&database_path(&app)?)?;

    if db::load(&connection)?.is_none() {
        let legacy = app_data_root(&app)?.join(LEGACY_WORKSPACE_FILE);
        db::import_legacy(&mut connection, &legacy)?;
    }

    Ok(db::load(&connection)?.map(|snapshot| snapshot.to_string()))
}

#[tauri::command]
fn save_workspace(app: AppHandle, data: String) -> Result<(), String> {
    let snapshot = db::parse_payload(&data)?;
    let mut connection = db::open(&database_path(&app)?)?;
    db::save(&mut connection, &snapshot)
}

#[tauri::command]
fn export_workspace(app: AppHandle, data: String) -> Result<String, String> {
    db::parse_payload(&data)?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let export_path = app_data_root(&app)?
        .join(EXPORT_DIR)
        .join(format!("tasker-export-{stamp}.json"));
    write_atomic(&export_path, &data)?;
    Ok(export_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn storage_location(app: AppHandle) -> Result<String, String> {
    Ok(database_path(&app)?.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub struct TerminalState {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
}

#[tauri::command]
fn terminal_start(app: AppHandle, state: State<TerminalState>) -> Result<(), String> {
    let mut child_guard = state.child.lock().map_err(|error| error.to_string())?;
    if child_guard.is_some() {
        return Ok(());
    }

    let data_dir = app_data_root(&app)?;
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Could not create {}: {error}", data_dir.display()))?;

    let profile_path = data_dir.join("tasker-shell.ps1");
    if !profile_path.exists() {
        let profile = include_str!("tasker-shell.ps1");
        fs::write(&profile_path, profile)
            .map_err(|error| format!("Could not write {}: {error}", profile_path.display()))?;
    }

    let mut command = Command::new("powershell.exe");
    command
        .args(["-NoLogo", "-NoExit"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&data_dir);

    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not start PowerShell: {error}"))?;

    let stdin = child.stdin.take().ok_or("PowerShell stdin unavailable.")?;
    let stdout = child.stdout.take().ok_or("PowerShell stdout unavailable.")?;
    let stderr = child.stderr.take().ok_or("PowerShell stderr unavailable.")?;

    *child_guard = Some(child);
    *state.stdin.lock().map_err(|error| error.to_string())? = Some(stdin);

    let app_stdout = app.clone();
    std::thread::spawn(move || {
        let mut reader = stdout;
        let mut buffer = [0u8; 2048];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let text = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = app_stdout.emit("terminal-output", text);
                }
                Err(_) => break,
            }
        }
    });

    let app_stderr = app.clone();
    std::thread::spawn(move || {
        let mut reader = stderr;
        let mut buffer = [0u8; 2048];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let text = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = app_stderr.emit("terminal-output", text);
                }
                Err(_) => break,
            }
        }
    });

    let profile_path_string = profile_path.to_string_lossy().to_string();
    if let Some(stdin) = state.stdin.lock().map_err(|error| error.to_string())?.as_mut() {
        let _ = stdin.write_all(format!(". '{profile_path_string}'\r\n").as_bytes());
        let _ = stdin.flush();
    }

    Ok(())
}

#[tauri::command]
fn terminal_write(state: State<TerminalState>, data: String) -> Result<(), String> {
    let mut guard = state.stdin.lock().map_err(|error| error.to_string())?;
    if let Some(stdin) = guard.as_mut() {
        let normalized = data.replace("\r\n", "\n").replace('\r', "\r\n");
        let final_data = if normalized.ends_with('\n') && !normalized.ends_with("\r\n") {
            normalized.replace('\n', "\r\n")
        } else {
            normalized
        };
        stdin
            .write_all(final_data.as_bytes())
            .map_err(|error| format!("Could not write to PowerShell: {error}"))?;
        stdin
            .flush()
            .map_err(|error| format!("Could not flush PowerShell input: {error}"))?;
    }
    Ok(())
}

#[tauri::command]
fn terminal_stop(state: State<TerminalState>) -> Result<(), String> {
    if let Some(mut child) = state.child.lock().map_err(|error| error.to_string())?.take() {
        let _ = child.kill();
    }
    state.stdin.lock().map_err(|error| error.to_string())?.take();
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(TerminalState {
            child: Mutex::new(None),
            stdin: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            export_workspace,
            storage_location,
            terminal_start,
            terminal_write,
            terminal_stop
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tasker");
}
