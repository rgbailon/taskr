use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const WORKSPACE_FILE: &str = "workspace.json";
const EXPORT_DIR: &str = "exports";
const MAX_PAYLOAD_BYTES: usize = 8 * 1024 * 1024;

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the app data folder: {error}"))
}

fn workspace_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join(WORKSPACE_FILE))
}

fn validate_payload(data: &str) -> Result<(), String> {
    if data.len() > MAX_PAYLOAD_BYTES {
        return Err("Workspace data is larger than the 8 MB safety limit.".into());
    }
    let value: serde_json::Value =
        serde_json::from_str(data).map_err(|error| format!("Workspace data is not valid JSON: {error}"))?;
    if !value.is_object() {
        return Err("Workspace data must be a JSON object.".into());
    }
    if value.get("version").and_then(|version| version.as_u64()) != Some(1) {
        return Err("Unsupported workspace format version.".into());
    }
    Ok(())
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Workspace path has no parent folder.".to_string())?;
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
    let path = workspace_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let metadata = fs::metadata(&path)
        .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
    if metadata.len() as usize > MAX_PAYLOAD_BYTES {
        return Err("Saved workspace is larger than the supported size.".into());
    }
    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    validate_payload(&contents)?;
    Ok(Some(contents))
}

#[tauri::command]
fn save_workspace(app: AppHandle, data: String) -> Result<(), String> {
    validate_payload(&data)?;
    write_atomic(&workspace_path(&app)?, &data)
}

#[tauri::command]
fn export_workspace(app: AppHandle, data: String) -> Result<String, String> {
    validate_payload(&data)?;
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
    let path = workspace_path(&app)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not reset {}: {error}", path.display()))?;
    }
    Ok(())
}

#[tauri::command]
fn storage_location(app: AppHandle) -> Result<String, String> {
    Ok(workspace_path(&app)?.to_string_lossy().into_owned())
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

#[cfg(test)]
mod tests {
    use super::validate_payload;

    #[test]
    fn accepts_a_versioned_object() {
        assert!(validate_payload(r#"{"version":1,"tasks":[]}"#).is_ok());
    }

    #[test]
    fn rejects_invalid_json() {
        assert!(validate_payload("{not json").is_err());
    }

    #[test]
    fn rejects_an_unknown_version() {
        assert!(validate_payload(r#"{"version":2}"#).is_err());
    }

    #[test]
    fn rejects_an_array_payload() {
        assert!(validate_payload("[]").is_err());
    }
}
