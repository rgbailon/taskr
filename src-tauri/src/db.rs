use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    fs,
    path::Path,
    time::Duration,
};

/// Keeps a single workspace payload within a bound the UI can save quickly.
pub const MAX_PAYLOAD_BYTES: usize = 8 * 1024 * 1024;

/// Opens (and, if needed, creates) the Tasker SQLite database.
pub fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }

    let connection = Connection::open(path)
        .map_err(|error| format!("Could not open {}: {error}", path.display()))?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(database_error)?;
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;",
        )
        .map_err(database_error)?;
    initialize(&connection)?;
    Ok(connection)
}

fn initialize(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY NOT NULL,
                position INTEGER NOT NULL,
                data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                project_id TEXT,
                status TEXT NOT NULL,
                scheduled_date TEXT,
                due_date TEXT,
                completed_at TEXT,
                position INTEGER NOT NULL,
                data TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
            CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
            CREATE INDEX IF NOT EXISTS tasks_schedule_idx ON tasks(scheduled_date);
            CREATE TABLE IF NOT EXISTS activities (
                id TEXT PRIMARY KEY NOT NULL,
                at TEXT NOT NULL,
                position INTEGER NOT NULL,
                data TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS activities_at_idx ON activities(at);
            PRAGMA user_version = 1;",
        )
        .map_err(database_error)
}

pub fn parse_payload(raw: &str) -> Result<Value, String> {
    if raw.len() > MAX_PAYLOAD_BYTES {
        return Err("Workspace data is larger than the 8 MB safety limit.".into());
    }
    let value: Value = serde_json::from_str(raw)
        .map_err(|error| format!("Workspace data is not valid JSON: {error}"))?;
    validate(&value)?;
    Ok(value)
}

pub fn validate(value: &Value) -> Result<(), String> {
    if !value.is_object() {
        return Err("Workspace data must be a JSON object.".into());
    }
    if value.get("version").and_then(Value::as_u64) != Some(1) {
        return Err("Unsupported workspace format version.".into());
    }
    for key in ["projects", "tasks", "activities"] {
        if value.get(key).and_then(Value::as_array).is_none() {
            return Err(format!("Workspace data is missing the \"{key}\" list."));
        }
    }
    for key in ["profile", "preferences"] {
        if value.get(key).map(Value::is_object) != Some(true) {
            return Err(format!("Workspace data is missing \"{key}\"."));
        }
    }
    if let Some(focus) = value.get("focusTaskId") {
        if !focus.is_null() && !focus.is_string() {
            return Err("Workspace focusTaskId must be a task id or null.".into());
        }
    }

    let mut project_ids = HashSet::new();
    for project in value["projects"].as_array().expect("validated projects") {
        let id = require_id(project, "project")?;
        if !project_ids.insert(id.to_string()) {
            return Err(format!("Duplicate project id: {id}"));
        }
    }

    let mut task_ids = HashSet::new();
    for task in value["tasks"].as_array().expect("validated tasks") {
        let id = require_id(task, "task")?;
        if !task_ids.insert(id.to_string()) {
            return Err(format!("Duplicate task id: {id}"));
        }
        match task.get("status").and_then(Value::as_str) {
            Some("inbox" | "todo" | "in_progress" | "done") => {}
            _ => return Err(format!("Task {id} has an unsupported status.")),
        }
    }

    let mut activity_ids = HashSet::new();
    for activity in value["activities"].as_array().expect("validated activities") {
        let id = require_id(activity, "activity")?;
        if !activity_ids.insert(id.to_string()) {
            return Err(format!("Duplicate activity id: {id}"));
        }
        if activity.get("at").and_then(Value::as_str).is_none() {
            return Err(format!("Activity {id} is missing its timestamp."));
        }
    }

    Ok(())
}

fn require_id<'a>(value: &'a Value, kind: &str) -> Result<&'a str, String> {
    value
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
        .ok_or_else(|| format!("A {kind} is missing its id."))
}

/// Replaces the stored workspace inside one transaction.
pub fn save(connection: &mut Connection, snapshot: &Value) -> Result<(), String> {
    validate(snapshot)?;
    let transaction = connection.transaction().map_err(database_error)?;

    transaction
        .execute("DELETE FROM tasks", [])
        .map_err(database_error)?;
    transaction
        .execute("DELETE FROM projects", [])
        .map_err(database_error)?;
    transaction
        .execute("DELETE FROM activities", [])
        .map_err(database_error)?;

    {
        let mut insert = transaction
            .prepare("INSERT INTO projects (id, position, data) VALUES (?1, ?2, ?3)")
            .map_err(database_error)?;
        for (position, project) in snapshot["projects"]
            .as_array()
            .expect("validated projects")
            .iter()
            .enumerate()
        {
            insert
                .execute(params![
                    project["id"].as_str().unwrap_or_default(),
                    position as i64,
                    project.to_string()
                ])
                .map_err(database_error)?;
        }
    }

    {
        let mut insert = transaction
            .prepare(
                "INSERT INTO tasks (
                    id, project_id, status, scheduled_date, due_date, completed_at, position, data
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )
            .map_err(database_error)?;
        for (position, task) in snapshot["tasks"]
            .as_array()
            .expect("validated tasks")
            .iter()
            .enumerate()
        {
            insert
                .execute(params![
                    task["id"].as_str().unwrap_or_default(),
                    task.get("projectId").and_then(Value::as_str),
                    task["status"].as_str().unwrap_or_default(),
                    task.get("scheduledDate").and_then(Value::as_str),
                    task.get("dueDate").and_then(Value::as_str),
                    task.get("completedAt").and_then(Value::as_str),
                    position as i64,
                    task.to_string()
                ])
                .map_err(database_error)?;
        }
    }

    {
        let mut insert = transaction
            .prepare("INSERT INTO activities (id, at, position, data) VALUES (?1, ?2, ?3, ?4)")
            .map_err(database_error)?;
        for (position, activity) in snapshot["activities"]
            .as_array()
            .expect("validated activities")
            .iter()
            .enumerate()
        {
            insert
                .execute(params![
                    activity["id"].as_str().unwrap_or_default(),
                    activity["at"].as_str().unwrap_or_default(),
                    position as i64,
                    activity.to_string()
                ])
                .map_err(database_error)?;
        }
    }

    put_meta(&transaction, "version", &snapshot["version"])?;
    put_meta(&transaction, "profile", &snapshot["profile"])?;
    put_meta(&transaction, "preferences", &snapshot["preferences"])?;
    put_meta(
        &transaction,
        "focusTaskId",
        &snapshot.get("focusTaskId").cloned().unwrap_or(Value::Null),
    )?;
    put_meta(
        &transaction,
        "createdAt",
        &snapshot.get("createdAt").cloned().unwrap_or(Value::Null),
    )?;

    transaction.commit().map_err(database_error)
}

pub fn load(connection: &Connection) -> Result<Option<Value>, String> {
    let Some(version) = read_meta(connection, "version")? else {
        return Ok(None);
    };

    Ok(Some(json!({
        "version": version,
        "profile": read_meta(connection, "profile")?.unwrap_or_else(default_profile),
        "projects": read_records(connection, "SELECT data FROM projects ORDER BY position ASC")?,
        "tasks": read_records(connection, "SELECT data FROM tasks ORDER BY position ASC")?,
        "activities": read_records(connection, "SELECT data FROM activities ORDER BY position ASC")?,
        "preferences": read_meta(connection, "preferences")?.unwrap_or_else(default_preferences),
        "focusTaskId": read_meta(connection, "focusTaskId")?.unwrap_or(Value::Null),
        "createdAt": read_meta(connection, "createdAt")?.unwrap_or_else(|| json!("")),
    })))
}

pub fn reset(connection: &mut Connection) -> Result<(), String> {
    let transaction = connection.transaction().map_err(database_error)?;
    for table in ["tasks", "projects", "activities", "meta"] {
        transaction
            .execute(&format!("DELETE FROM {table}"), [])
            .map_err(database_error)?;
    }
    transaction.commit().map_err(database_error)
}

/// Imports the pre-database workspace.json once, then keeps it as a backup.
pub fn import_legacy(connection: &mut Connection, path: &Path) -> Result<bool, String> {
    if load(connection)?.is_some() || !path.exists() {
        return Ok(false);
    }

    let raw = fs::read_to_string(path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    let snapshot = parse_payload(&raw)?;
    save(connection, &snapshot)?;

    let backup = path.with_extension("json.migrated");
    if let Err(error) = fs::rename(path, &backup) {
        eprintln!(
            "Tasker imported {} but could not rename it to {}: {error}",
            path.display(),
            backup.display()
        );
    }
    Ok(true)
}

fn default_profile() -> Value {
    json!({ "name": "", "role": "", "workspace": "Tasker" })
}

fn default_preferences() -> Value {
    json!({ "focusMinutes": 25, "breakMinutes": 5 })
}

fn put_meta(connection: &Connection, key: &str, value: &Value) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value.to_string()],
        )
        .map_err(database_error)?;
    Ok(())
}

fn read_meta(connection: &Connection, key: &str) -> Result<Option<Value>, String> {
    let raw = connection
        .query_row("SELECT value FROM meta WHERE key = ?1", [key], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(database_error)?;

    raw.map(|text| {
        serde_json::from_str(&text)
            .map_err(|error| format!("Stored workspace metadata is corrupt: {error}"))
    })
    .transpose()
}

fn read_records(connection: &Connection, sql: &str) -> Result<Vec<Value>, String> {
    let mut statement = connection.prepare(sql).map_err(database_error)?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(database_error)?;
    let mut records = Vec::new();
    for row in rows {
        let raw = row.map_err(database_error)?;
        records.push(
            serde_json::from_str(&raw)
                .map_err(|error| format!("Stored workspace record is corrupt: {error}"))?,
        );
    }
    Ok(records)
}

fn database_error(error: rusqlite::Error) -> String {
    format!("Local database error: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn memory() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        initialize(&connection).expect("create schema");
        connection
    }

    fn sample_workspace() -> Value {
        json!({
            "version": 1,
            "profile": { "name": "Maya Chen", "role": "Developer", "workspace": "Maya's space" },
            "projects": [
                {
                    "id": "project-1",
                    "name": "API platform",
                    "description": "Endpoints",
                    "color": "#3B9F93",
                    "milestone": "Ship v2",
                    "milestoneDue": "2026-12-01",
                    "notes": "",
                    "createdAt": "2026-01-01T09:00:00.000Z"
                }
            ],
            "tasks": [
                {
                    "id": "task-1",
                    "title": "Add cursor pagination",
                    "description": "Return stable pages",
                    "projectId": "project-1",
                    "status": "in_progress",
                    "priority": "high",
                    "estimateMin": 45,
                    "dueDate": "2026-11-21",
                    "scheduledDate": "2026-11-19",
                    "scheduledTime": "09:30",
                    "criteria": [{ "id": "criterion-1", "text": "Add a cursor", "done": false }],
                    "notes": "Keep the shape stable.",
                    "createdAt": "2026-01-01T09:00:00.000Z",
                    "updatedAt": "2026-01-02T09:00:00.000Z",
                    "completedAt": null,
                    "focusedMinutes": 25
                },
                {
                    "id": "task-2",
                    "title": "Capture a loose idea",
                    "description": "",
                    "projectId": null,
                    "status": "inbox",
                    "priority": "normal",
                    "estimateMin": 15,
                    "dueDate": null,
                    "scheduledDate": null,
                    "scheduledTime": null,
                    "criteria": [],
                    "notes": "",
                    "createdAt": "2026-01-01T10:00:00.000Z",
                    "updatedAt": "2026-01-01T10:00:00.000Z",
                    "completedAt": null,
                    "focusedMinutes": 0
                }
            ],
            "activities": [
                {
                    "id": "activity-1",
                    "at": "2026-01-02T09:00:00.000Z",
                    "kind": "focus",
                    "text": "Focus session completed",
                    "subject": "Add cursor pagination",
                    "taskId": "task-1",
                    "projectId": "project-1",
                    "minutes": 25
                }
            ],
            "preferences": { "focusMinutes": 25, "breakMinutes": 5 },
            "focusTaskId": "task-1",
            "createdAt": "2026-01-01T09:00:00.000Z"
        })
    }

    fn scratch_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("tasker-db-test-{nanos}"))
    }

    #[test]
    fn round_trips_workspace_data() {
        let mut connection = memory();
        save(&mut connection, &sample_workspace()).expect("save");
        let loaded = load(&connection).expect("load").expect("workspace");

        assert_eq!(loaded["version"], 1);
        assert_eq!(loaded["profile"]["name"], "Maya Chen");
        assert_eq!(loaded["preferences"]["focusMinutes"], 25);
        assert_eq!(loaded["focusTaskId"], "task-1");
        assert_eq!(loaded["createdAt"], "2026-01-01T09:00:00.000Z");
        assert_eq!(loaded["projects"].as_array().unwrap().len(), 1);
        assert_eq!(loaded["tasks"].as_array().unwrap().len(), 2);
        assert_eq!(loaded["tasks"][0]["title"], "Add cursor pagination");
        assert_eq!(loaded["tasks"][0]["criteria"][0]["text"], "Add a cursor");
        assert_eq!(loaded["tasks"][1]["status"], "inbox");
        assert_eq!(loaded["activities"][0]["kind"], "focus");
        assert_eq!(loaded["activities"][0]["minutes"], 25);
    }

    #[test]
    fn save_replaces_the_previous_snapshot() {
        let mut connection = memory();
        save(&mut connection, &sample_workspace()).expect("first save");

        let mut smaller = sample_workspace();
        smaller["tasks"] = json!([sample_workspace()["tasks"][1].clone()]);
        smaller["activities"] = json!([]);
        save(&mut connection, &smaller).expect("second save");

        let loaded = load(&connection).expect("load").expect("workspace");
        assert_eq!(loaded["tasks"].as_array().unwrap().len(), 1);
        assert_eq!(loaded["tasks"][0]["id"], "task-2");
        assert_eq!(loaded["activities"].as_array().unwrap().len(), 0);
        assert_eq!(loaded["projects"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn rejects_invalid_payloads() {
        assert!(parse_payload("{not json").is_err());
        assert!(parse_payload("[]").is_err());
        assert!(parse_payload(r#"{"version":2,"projects":[],"tasks":[],"activities":[],"profile":{},"preferences":{}}"#).is_err());
        assert!(parse_payload(r#"{"version":1,"projects":[],"tasks":[]}"#).is_err());

        let mut duplicate = sample_workspace();
        duplicate["tasks"][1]["id"] = json!("task-1");
        assert!(parse_payload(&duplicate.to_string()).is_err());

        let mut bad_status = sample_workspace();
        bad_status["tasks"][0]["status"] = json!("archived");
        assert!(parse_payload(&bad_status.to_string()).is_err());
    }

    #[test]
    fn keeps_existing_data_when_a_save_is_rejected() {
        let mut connection = memory();
        save(&mut connection, &sample_workspace()).expect("save");

        let mut broken = sample_workspace();
        broken["version"] = json!(2);
        assert!(save(&mut connection, &broken).is_err());

        let loaded = load(&connection).expect("load").expect("workspace");
        assert_eq!(loaded["tasks"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn resets_every_table() {
        let mut connection = memory();
        save(&mut connection, &sample_workspace()).expect("save");
        reset(&mut connection).expect("reset");
        assert!(load(&connection).expect("load").is_none());
    }

    #[test]
    fn imports_legacy_json_once() {
        let directory = scratch_dir();
        fs::create_dir_all(&directory).expect("scratch dir");
        let database = directory.join("tasker.db");
        let legacy = directory.join("workspace.json");
        fs::write(&legacy, sample_workspace().to_string()).expect("legacy file");

        let mut connection = open(&database).expect("open database");
        assert!(import_legacy(&mut connection, &legacy).expect("import"));
        assert!(!legacy.exists(), "legacy file should be renamed");
        assert!(legacy.with_extension("json.migrated").exists());

        let loaded = load(&connection).expect("load").expect("workspace");
        assert_eq!(loaded["tasks"].as_array().unwrap().len(), 2);

        assert!(!import_legacy(&mut connection, &legacy).expect("second import"));

        drop(connection);
        let _ = fs::remove_dir_all(&directory);
    }
}
