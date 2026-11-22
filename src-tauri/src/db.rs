use rusqlite::Connection;
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
}

pub fn init(app: &AppHandle) -> Result<AppState, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("failed to resolve app data directory: {err}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|err| format!("failed to create app data directory: {err}"))?;

    let db_path = app_data_dir.join("order-manager.sqlite");
    let conn =
        Connection::open(&db_path).map_err(|err| format!("failed to open database: {err}"))?;

    configure_connection(&conn)?;

    Ok(AppState {
        conn: Mutex::new(conn),
        db_path,
    })
}

pub fn configure_connection(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        ",
    )
    .map_err(|err| format!("failed to configure database: {err}"))?;

    conn.execute_batch(include_str!("db/migrations/001_init.sql"))
        .map_err(|err| format!("failed to run database migrations: {err}"))?;

    Ok(())
}
