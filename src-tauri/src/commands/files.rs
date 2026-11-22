use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use tauri::{State, WebviewWindow};

use crate::commands::error::CommandError;
use crate::db::{self, AppState};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreDatabaseResult {
    restored_path: String,
    safety_backup_path: String,
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), CommandError> {
    write_text_file_inner(path, contents).map_err(map_text_file_write_error)
}

fn write_text_file_inner(path: String, contents: String) -> Result<(), String> {
    let path = validate_text_export_path(&path)?;

    std::fs::write(&path, contents).map_err(|err| format!("无法写入文件：{err}"))
}

fn map_text_file_write_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择 CSV 导出文件位置" => "CSV_EXPORT_PATH_REQUIRED",
        "文本导出文件必须使用 CSV 扩展名" => "CSV_EXPORT_EXTENSION_INVALID",
        _ if message.starts_with("无法写入文件：") => "FILE_WRITE_FAILED",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

fn validate_text_export_path(path: &str) -> Result<PathBuf, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("请选择 CSV 导出文件位置".to_string());
    }

    let path = PathBuf::from(trimmed_path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if !extension.eq_ignore_ascii_case("csv") {
        return Err("文本导出文件必须使用 CSV 扩展名".to_string());
    }

    Ok(path)
}

#[tauri::command]
pub fn get_database_path(state: State<'_, AppState>) -> String {
    state.db_path.display().to_string()
}

#[tauri::command]
pub fn backup_database(state: State<'_, AppState>, path: String) -> Result<String, CommandError> {
    backup_database_inner(state, path).map_err(map_backup_error)
}

fn backup_database_inner(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let path = PathBuf::from(path.trim());

    if path.as_os_str().is_empty() {
        return Err("请选择备份保存位置".to_string());
    }

    if path == state.db_path {
        return Err("备份文件不能覆盖当前正在使用的数据库".to_string());
    }

    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    backup_database_with_connection(&conn, &path)?;

    Ok(path.display().to_string())
}

fn map_backup_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择备份保存位置" => "BACKUP_PATH_REQUIRED",
        "备份文件不能覆盖当前正在使用的数据库" => "BACKUP_TARGET_IS_CURRENT_DB",
        "备份路径包含无法识别的字符" => "BACKUP_PATH_INVALID",
        _ if message.starts_with("无法覆盖已有备份文件：") => "BACKUP_OVERWRITE_FAILED",
        _ if message.starts_with("无法备份数据库：") => "BACKUP_FAILED",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn restore_database(
    state: State<'_, AppState>,
    path: String,
) -> Result<RestoreDatabaseResult, CommandError> {
    let source_path = PathBuf::from(path.trim());

    if source_path.as_os_str().is_empty() {
        return Err(CommandError::new(
            "RESTORE_SOURCE_REQUIRED",
            "请选择要恢复的备份文件",
        ));
    }

    if !source_path.exists() {
        return Err(CommandError::new(
            "RESTORE_SOURCE_NOT_FOUND",
            "备份文件不存在",
        ));
    }

    if source_path == state.db_path {
        return Err(CommandError::new(
            "RESTORE_SOURCE_IS_CURRENT_DB",
            "不能选择当前正在使用的数据库作为恢复来源",
        ));
    }

    validate_backup_database(&source_path).map_err(map_restore_error)?;

    let safety_backup_path = next_restore_safety_backup_path(&state.db_path);
    let mut current_conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    // Keep all database commands out while the live file and connection are replaced.
    backup_database_with_connection(&current_conn, &safety_backup_path)
        .map_err(map_restore_error)?;

    replace_database_file(&source_path, &state.db_path).map_err(map_restore_error)?;

    let next_conn = Connection::open(&state.db_path)
        .map_err(|err| map_restore_error(format!("无法重新打开数据库：{err}")))?;
    db::configure_connection(&next_conn).map_err(map_restore_error)?;

    *current_conn = next_conn;

    Ok(RestoreDatabaseResult {
        restored_path: state.db_path.display().to_string(),
        safety_backup_path: safety_backup_path.display().to_string(),
    })
}

fn map_restore_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择要恢复的备份文件" => "RESTORE_SOURCE_REQUIRED",
        "备份文件不存在" => "RESTORE_SOURCE_NOT_FOUND",
        "不能选择当前正在使用的数据库作为恢复来源" => {
            "RESTORE_SOURCE_IS_CURRENT_DB"
        }
        _ if message.starts_with("无法打开备份文件")
            || message.starts_with("无法校验备份文件")
            || message.starts_with("备份文件完整性校验失败")
            || message == "备份文件存在外键错误"
            || message == "备份文件不是当前版本的订单管理数据库" =>
        {
            "RESTORE_BACKUP_INVALID"
        }
        _ if message.starts_with("无法准备恢复数据库")
            || message.starts_with("无法暂存当前数据库")
            || message.starts_with("无法替换旧数据库文件")
            || message.starts_with("无法恢复数据库")
            || message.starts_with("数据库已恢复")
            || message.starts_with("无法重新打开数据库")
            || message.starts_with("failed to") =>
        {
            "RESTORE_FAILED"
        }
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn print_current_window(
    window: WebviewWindow,
    orientation: Option<String>,
) -> Result<(), CommandError> {
    set_print_orientation(orientation.as_deref().unwrap_or("landscape"));
    window
        .print()
        .map_err(|err| map_print_error(format!("无法打开打印面板：{err}")))
}

fn map_print_error(message: String) -> CommandError {
    let code = if message.starts_with("无法打开打印面板：") {
        "PRINT_DIALOG_FAILED"
    } else {
        "INTERNAL_ERROR"
    };

    CommandError::new(code, message)
}

#[cfg(target_os = "macos")]
fn set_print_orientation(orientation: &str) {
    use objc2_app_kit::{NSPaperOrientation, NSPrintInfo};

    let print_info = NSPrintInfo::sharedPrintInfo();
    let paper_orientation = if orientation == "portrait" {
        NSPaperOrientation::Portrait
    } else {
        NSPaperOrientation::Landscape
    };
    print_info.setOrientation(paper_orientation);
}

#[cfg(not(target_os = "macos"))]
fn set_print_orientation(_orientation: &str) {}

fn validate_backup_database(path: &Path) -> Result<(), String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|err| format!("无法打开备份文件：{err}"))?;

    let integrity: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|err| format!("无法校验备份文件完整性：{err}"))?;
    if integrity != "ok" {
        return Err(format!("备份文件完整性校验失败：{integrity}"));
    }

    let mut foreign_key_stmt = conn
        .prepare("PRAGMA foreign_key_check")
        .map_err(|err| format!("无法校验备份文件外键：{err}"))?;
    let foreign_key_errors = foreign_key_stmt
        .query_map([], |_| Ok(()))
        .map_err(|err| format!("无法校验备份文件外键：{err}"))?
        .count();
    if foreign_key_errors > 0 {
        return Err("备份文件存在外键错误".to_string());
    }

    const REQUIRED_TABLES: &[&str] = &[
        "customers",
        "products",
        "customer_products",
        "orders",
        "order_items",
        "number_sequences",
        "inventory_stocks",
        "order_inventory_stocks",
        "inventory_movements",
        "delivery_notes",
        "delivery_note_items",
        "customer_inventory_batches",
        "customer_inventory_stocks",
        "customer_inventory_movements",
        "customer_inventory_delivery_notes",
        "customer_inventory_delivery_note_price_groups",
        "customer_inventory_delivery_note_items",
    ];
    let mut table_stmt = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1")
        .map_err(|err| format!("无法校验备份文件结构：{err}"))?;
    let mut table_count = 0;
    for name in REQUIRED_TABLES {
        if table_stmt
            .exists([name])
            .map_err(|err| format!("无法校验备份文件结构：{err}"))?
        {
            table_count += 1;
        }
    }
    if table_count != REQUIRED_TABLES.len() {
        return Err("备份文件不是当前版本的订单管理数据库".to_string());
    }

    Ok(())
}

fn backup_database_with_connection(conn: &Connection, path: &Path) -> Result<(), String> {
    if path.exists() {
        std::fs::remove_file(path).map_err(|err| format!("无法覆盖已有备份文件：{err}"))?;
    }

    let path_text = path
        .to_str()
        .ok_or_else(|| "备份路径包含无法识别的字符".to_string())?;

    conn.execute("VACUUM main INTO ?1", [path_text])
        .map_err(|err| format!("无法备份数据库：{err}"))?;

    Ok(())
}

fn replace_database_file(source_path: &Path, target_path: &Path) -> Result<(), String> {
    let temp_restore_path =
        target_path.with_file_name(format!(".order-manager-restore-{}.tmp", timestamp()));
    let backup_current_path =
        target_path.with_file_name(format!(".order-manager-current-{}.tmp", timestamp()));

    if temp_restore_path.exists() {
        std::fs::remove_file(&temp_restore_path)
            .map_err(|err| format!("无法清理临时恢复文件：{err}"))?;
    }

    std::fs::copy(source_path, &temp_restore_path)
        .map_err(|err| format!("无法准备恢复数据库：{err}"))?;

    if target_path.exists() {
        std::fs::rename(target_path, &backup_current_path)
            .map_err(|err| format!("无法暂存当前数据库：{err}"))?;
    }

    remove_sidecar_files(target_path)?;

    if let Err(err) = std::fs::rename(&temp_restore_path, target_path) {
        if backup_current_path.exists() {
            let _ = std::fs::rename(&backup_current_path, target_path);
        }

        return Err(format!("无法恢复数据库：{err}"));
    }

    if backup_current_path.exists() {
        std::fs::remove_file(&backup_current_path)
            .map_err(|err| format!("数据库已恢复，但无法清理临时旧库：{err}"))?;
    }

    Ok(())
}

fn remove_sidecar_files(path: &Path) -> Result<(), String> {
    for extension in ["-wal", "-shm"] {
        let file_path = PathBuf::from(format!("{}{}", path.display(), extension));

        if file_path.exists() {
            std::fs::remove_file(&file_path)
                .map_err(|err| format!("无法替换旧数据库文件：{err}"))?;
        }
    }

    Ok(())
}

fn next_restore_safety_backup_path(db_path: &Path) -> PathBuf {
    let timestamp = timestamp();
    next_restore_safety_backup_path_for_timestamp(db_path, &timestamp)
}

fn next_restore_safety_backup_path_for_timestamp(db_path: &Path, timestamp: &str) -> PathBuf {
    let first_path =
        db_path.with_file_name(format!("order-manager-before-restore-{timestamp}.sqlite"));

    if !first_path.exists() {
        return first_path;
    }

    for suffix in 2.. {
        let candidate = db_path.with_file_name(format!(
            "order-manager-before-restore-{timestamp}-{suffix}.sqlite"
        ));

        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("unbounded restore safety backup suffix search should always return")
}

fn timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "unknown-time".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "order-manager-{name}-{}-{}",
            std::process::id(),
            timestamp()
        ));

        std::fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn create_app_database(path: &Path, customer_id: &str, customer_name: &str) {
        let conn = Connection::open(path).expect("open database");
        db::configure_connection(&conn).expect("configure database");
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES (?1, ?2)",
            [customer_id, customer_name],
        )
        .expect("insert customer");
    }

    fn customer_name(path: &Path) -> String {
        let conn = Connection::open(path).expect("open database");
        conn.query_row(
            "SELECT customer_name FROM customers ORDER BY id LIMIT 1",
            [],
            |row| row.get(0),
        )
        .expect("read customer")
    }

    #[test]
    fn restore_safety_backup_path_never_overwrites_same_second_backup() {
        let dir = temp_dir("restore-safety-name");
        let db_path = dir.join("order-manager.sqlite");
        let timestamp = "1782198055";
        let first_path = next_restore_safety_backup_path_for_timestamp(&db_path, timestamp);

        assert_eq!(
            first_path.file_name().and_then(|value| value.to_str()),
            Some("order-manager-before-restore-1782198055.sqlite")
        );

        std::fs::write(&first_path, b"existing backup").expect("create first backup");
        let second_path = next_restore_safety_backup_path_for_timestamp(&db_path, timestamp);

        assert_eq!(
            second_path.file_name().and_then(|value| value.to_str()),
            Some("order-manager-before-restore-1782198055-2.sqlite")
        );
    }

    #[test]
    fn validates_backup_database_before_restore() {
        let dir = temp_dir("restore-validation");
        let invalid_path = dir.join("not-a-backup.sqlite");
        std::fs::write(&invalid_path, b"not a sqlite database").expect("write invalid backup");

        let error = validate_backup_database(&invalid_path)
            .expect_err("should reject invalid backup database");

        assert!(
            error.contains("无法校验备份文件") || error.contains("无法打开备份文件"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn maps_restore_errors_to_stable_codes() {
        assert_eq!(
            map_restore_error("请选择要恢复的备份文件".to_string()),
            CommandError::new("RESTORE_SOURCE_REQUIRED", "请选择要恢复的备份文件")
        );
        assert_eq!(
            map_restore_error("备份文件不是当前版本的订单管理数据库".to_string()),
            CommandError::new(
                "RESTORE_BACKUP_INVALID",
                "备份文件不是当前版本的订单管理数据库"
            )
        );
        assert_eq!(
            map_restore_error("无法恢复数据库：permission denied".to_string()),
            CommandError::new("RESTORE_FAILED", "无法恢复数据库：permission denied")
        );
        assert_eq!(
            map_restore_error("unexpected error".to_string()),
            CommandError::new("INTERNAL_ERROR", "unexpected error")
        );
    }

    #[test]
    fn rejects_backup_database_with_missing_required_table() {
        let dir = temp_dir("restore-missing-table");
        let backup_path = dir.join("backup.sqlite");
        create_app_database(&backup_path, "CUS-001", "测试客户");

        let conn = Connection::open(&backup_path).expect("open backup");
        conn.execute("DROP TABLE customer_inventory_stocks", [])
            .expect("drop required table");

        let error = validate_backup_database(&backup_path)
            .expect_err("should reject backup with missing table");

        assert_eq!(error, "备份文件不是当前版本的订单管理数据库");
    }

    #[test]
    fn replace_database_file_restores_backup_and_removes_sidecars() {
        let dir = temp_dir("restore-replace");
        let current_path = dir.join("order-manager.sqlite");
        let backup_path = dir.join("backup.sqlite");

        create_app_database(&current_path, "CUS-001", "当前客户");
        create_app_database(&backup_path, "CUS-002", "备份客户");
        std::fs::write(format!("{}-wal", current_path.display()), b"wal")
            .expect("write wal sidecar");
        std::fs::write(format!("{}-shm", current_path.display()), b"shm")
            .expect("write shm sidecar");

        validate_backup_database(&backup_path).expect("backup should be valid");
        replace_database_file(&backup_path, &current_path).expect("replace database");

        assert_eq!(customer_name(&current_path), "备份客户");
        assert!(!PathBuf::from(format!("{}-wal", current_path.display())).exists());
        assert!(!PathBuf::from(format!("{}-shm", current_path.display())).exists());
        assert!(
            backup_path.exists(),
            "restore should not consume source backup"
        );
    }

    #[test]
    fn backup_database_with_connection_refuses_to_leave_invalid_backup() {
        let dir = temp_dir("backup-copy");
        let source_path = dir.join("source.sqlite");
        let backup_path = dir.join("backup.sqlite");
        create_app_database(&source_path, "CUS-001", "测试客户");

        let conn = Connection::open(&source_path).expect("open source");
        backup_database_with_connection(&conn, &backup_path).expect("backup database");

        validate_backup_database(&backup_path).expect("backup should validate");
        assert_eq!(customer_name(&backup_path), "测试客户");
    }

    #[test]
    fn validates_csv_export_path() {
        assert_eq!(
            validate_text_export_path(" /tmp/orders.CSV ").expect("valid csv path"),
            PathBuf::from("/tmp/orders.CSV")
        );
        assert_eq!(
            validate_text_export_path(" ").expect_err("blank path should fail"),
            "请选择 CSV 导出文件位置"
        );
        assert_eq!(
            validate_text_export_path("/tmp/orders.txt").expect_err("non-csv path should fail"),
            "文本导出文件必须使用 CSV 扩展名"
        );
    }

    #[test]
    fn maps_text_file_write_errors_to_stable_codes() {
        let cases = [
            ("请选择 CSV 导出文件位置", "CSV_EXPORT_PATH_REQUIRED"),
            (
                "文本导出文件必须使用 CSV 扩展名",
                "CSV_EXPORT_EXTENSION_INVALID",
            ),
            ("无法写入文件：权限不足", "FILE_WRITE_FAILED"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_text_file_write_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_text_file_write_error("unexpected export error".to_string()),
            CommandError::new("INTERNAL_ERROR", "unexpected export error")
        );
    }

    #[test]
    fn maps_backup_errors_to_stable_codes() {
        let cases = [
            ("请选择备份保存位置", "BACKUP_PATH_REQUIRED"),
            (
                "备份文件不能覆盖当前正在使用的数据库",
                "BACKUP_TARGET_IS_CURRENT_DB",
            ),
            ("备份路径包含无法识别的字符", "BACKUP_PATH_INVALID"),
            ("无法覆盖已有备份文件：权限不足", "BACKUP_OVERWRITE_FAILED"),
            ("无法备份数据库：磁盘空间不足", "BACKUP_FAILED"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_backup_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_backup_error("failed to lock database connection".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to lock database connection")
        );
    }

    #[test]
    fn maps_print_errors_to_stable_codes() {
        assert_eq!(
            map_print_error("无法打开打印面板：系统拒绝请求".to_string()),
            CommandError::new("PRINT_DIALOG_FAILED", "无法打开打印面板：系统拒绝请求")
        );
        assert_eq!(
            map_print_error("unexpected print error".to_string()),
            CommandError::new("INTERNAL_ERROR", "unexpected print error")
        );
    }
}
