mod db;

use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

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
fn reset_workspace(app: AppHandle) -> Result<(), String> {
    let mut connection = db::open(&database_path(&app)?)?;
    db::reset(&mut connection)
}

#[tauri::command]
fn storage_location(app: AppHandle) -> Result<String, String> {
    Ok(database_path(&app)?.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            export_workspace,
            reset_workspace,
            storage_location
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tasker");
}
