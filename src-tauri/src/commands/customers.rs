use calamine::{open_workbook_auto, Data, Reader};
use rusqlite::{params, Connection, Params};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use tauri::State;

use crate::commands::error::CommandError;
use crate::db::AppState;

const CUSTOMER_SELECT_COLUMNS: &str = "
       id,
       customer_name,
       phone,
       customer_address,
       default_pricing_tax_included,
       bridge_processing_fee_tax_included_x100,
       powder_processing_fee_tax_included_x100,
       billet_processing_fee_tax_included_x100,
       oxidation_processing_fee_tax_included_x100,
       electrophoresis_processing_fee_tax_included_x100,
       bridge_processing_fee_tax_excluded_x100,
       powder_processing_fee_tax_excluded_x100,
       billet_processing_fee_tax_excluded_x100,
       oxidation_processing_fee_tax_excluded_x100,
       electrophoresis_processing_fee_tax_excluded_x100,
       special_pricing_keyword,
       special_bridge_processing_fee_tax_included_x100,
       special_powder_processing_fee_tax_included_x100,
       special_billet_processing_fee_tax_included_x100,
       special_oxidation_processing_fee_tax_included_x100,
       special_electrophoresis_processing_fee_tax_included_x100,
       special_bridge_processing_fee_tax_excluded_x100,
       special_powder_processing_fee_tax_excluded_x100,
       special_billet_processing_fee_tax_excluded_x100,
       special_oxidation_processing_fee_tax_excluded_x100,
       special_electrophoresis_processing_fee_tax_excluded_x100,
       created_at,
       updated_at
";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerSummary {
    id: String,
    customer_name: String,
    phone: String,
    customer_address: String,
    default_pricing_tax_included: bool,
    bridge_processing_fee_tax_included_x100: i64,
    powder_processing_fee_tax_included_x100: i64,
    billet_processing_fee_tax_included_x100: i64,
    oxidation_processing_fee_tax_included_x100: i64,
    electrophoresis_processing_fee_tax_included_x100: i64,
    bridge_processing_fee_tax_excluded_x100: i64,
    powder_processing_fee_tax_excluded_x100: i64,
    billet_processing_fee_tax_excluded_x100: i64,
    oxidation_processing_fee_tax_excluded_x100: i64,
    electrophoresis_processing_fee_tax_excluded_x100: i64,
    special_pricing_keyword: String,
    special_bridge_processing_fee_tax_included_x100: i64,
    special_powder_processing_fee_tax_included_x100: i64,
    special_billet_processing_fee_tax_included_x100: i64,
    special_oxidation_processing_fee_tax_included_x100: i64,
    special_electrophoresis_processing_fee_tax_included_x100: i64,
    special_bridge_processing_fee_tax_excluded_x100: i64,
    special_powder_processing_fee_tax_excluded_x100: i64,
    special_billet_processing_fee_tax_excluded_x100: i64,
    special_oxidation_processing_fee_tax_excluded_x100: i64,
    special_electrophoresis_processing_fee_tax_excluded_x100: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCustomersParams {
    page: Option<i64>,
    page_size: Option<i64>,
    quick_filter: Option<String>,
    search: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerListResult {
    customers: Vec<CustomerSummary>,
    total: i64,
    all_total: i64,
    missing_phone_count: i64,
    missing_address_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCustomersResult {
    customers: Vec<CustomerSummary>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerFormPayload {
    pub customer_name: String,
    pub phone: String,
    pub customer_address: String,
    pub default_pricing_tax_included: bool,
    pub bridge_processing_fee_tax_included_x100: i64,
    pub powder_processing_fee_tax_included_x100: i64,
    pub billet_processing_fee_tax_included_x100: i64,
    pub oxidation_processing_fee_tax_included_x100: i64,
    pub electrophoresis_processing_fee_tax_included_x100: i64,
    pub bridge_processing_fee_tax_excluded_x100: i64,
    pub powder_processing_fee_tax_excluded_x100: i64,
    pub billet_processing_fee_tax_excluded_x100: i64,
    pub oxidation_processing_fee_tax_excluded_x100: i64,
    pub electrophoresis_processing_fee_tax_excluded_x100: i64,
    pub special_pricing_keyword: String,
    pub special_bridge_processing_fee_tax_included_x100: i64,
    pub special_powder_processing_fee_tax_included_x100: i64,
    pub special_billet_processing_fee_tax_included_x100: i64,
    pub special_oxidation_processing_fee_tax_included_x100: i64,
    pub special_electrophoresis_processing_fee_tax_included_x100: i64,
    pub special_bridge_processing_fee_tax_excluded_x100: i64,
    pub special_powder_processing_fee_tax_excluded_x100: i64,
    pub special_billet_processing_fee_tax_excluded_x100: i64,
    pub special_oxidation_processing_fee_tax_excluded_x100: i64,
    pub special_electrophoresis_processing_fee_tax_excluded_x100: i64,
}

pub type CreateCustomerPayload = CustomerFormPayload;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomerPayload {
    id: String,
    customer_name: String,
    phone: String,
    customer_address: String,
    default_pricing_tax_included: bool,
    bridge_processing_fee_tax_included_x100: i64,
    powder_processing_fee_tax_included_x100: i64,
    billet_processing_fee_tax_included_x100: i64,
    oxidation_processing_fee_tax_included_x100: i64,
    electrophoresis_processing_fee_tax_included_x100: i64,
    bridge_processing_fee_tax_excluded_x100: i64,
    powder_processing_fee_tax_excluded_x100: i64,
    billet_processing_fee_tax_excluded_x100: i64,
    oxidation_processing_fee_tax_excluded_x100: i64,
    electrophoresis_processing_fee_tax_excluded_x100: i64,
    special_pricing_keyword: String,
    special_bridge_processing_fee_tax_included_x100: i64,
    special_powder_processing_fee_tax_included_x100: i64,
    special_billet_processing_fee_tax_included_x100: i64,
    special_oxidation_processing_fee_tax_included_x100: i64,
    special_electrophoresis_processing_fee_tax_included_x100: i64,
    special_bridge_processing_fee_tax_excluded_x100: i64,
    special_powder_processing_fee_tax_excluded_x100: i64,
    special_billet_processing_fee_tax_excluded_x100: i64,
    special_oxidation_processing_fee_tax_excluded_x100: i64,
    special_electrophoresis_processing_fee_tax_excluded_x100: i64,
}

impl From<&UpdateCustomerPayload> for CustomerFormPayload {
    fn from(payload: &UpdateCustomerPayload) -> Self {
        Self {
            customer_name: payload.customer_name.clone(),
            phone: payload.phone.clone(),
            customer_address: payload.customer_address.clone(),
            default_pricing_tax_included: payload.default_pricing_tax_included,
            bridge_processing_fee_tax_included_x100: payload
                .bridge_processing_fee_tax_included_x100,
            powder_processing_fee_tax_included_x100: payload
                .powder_processing_fee_tax_included_x100,
            billet_processing_fee_tax_included_x100: payload
                .billet_processing_fee_tax_included_x100,
            oxidation_processing_fee_tax_included_x100: payload
                .oxidation_processing_fee_tax_included_x100,
            electrophoresis_processing_fee_tax_included_x100: payload
                .electrophoresis_processing_fee_tax_included_x100,
            bridge_processing_fee_tax_excluded_x100: payload
                .bridge_processing_fee_tax_excluded_x100,
            powder_processing_fee_tax_excluded_x100: payload
                .powder_processing_fee_tax_excluded_x100,
            billet_processing_fee_tax_excluded_x100: payload
                .billet_processing_fee_tax_excluded_x100,
            oxidation_processing_fee_tax_excluded_x100: payload
                .oxidation_processing_fee_tax_excluded_x100,
            electrophoresis_processing_fee_tax_excluded_x100: payload
                .electrophoresis_processing_fee_tax_excluded_x100,
            special_pricing_keyword: payload.special_pricing_keyword.clone(),
            special_bridge_processing_fee_tax_included_x100: payload
                .special_bridge_processing_fee_tax_included_x100,
            special_powder_processing_fee_tax_included_x100: payload
                .special_powder_processing_fee_tax_included_x100,
            special_billet_processing_fee_tax_included_x100: payload
                .special_billet_processing_fee_tax_included_x100,
            special_oxidation_processing_fee_tax_included_x100: payload
                .special_oxidation_processing_fee_tax_included_x100,
            special_electrophoresis_processing_fee_tax_included_x100: payload
                .special_electrophoresis_processing_fee_tax_included_x100,
            special_bridge_processing_fee_tax_excluded_x100: payload
                .special_bridge_processing_fee_tax_excluded_x100,
            special_powder_processing_fee_tax_excluded_x100: payload
                .special_powder_processing_fee_tax_excluded_x100,
            special_billet_processing_fee_tax_excluded_x100: payload
                .special_billet_processing_fee_tax_excluded_x100,
            special_oxidation_processing_fee_tax_excluded_x100: payload
                .special_oxidation_processing_fee_tax_excluded_x100,
            special_electrophoresis_processing_fee_tax_excluded_x100: payload
                .special_electrophoresis_processing_fee_tax_excluded_x100,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCustomersPayload {
    customers: Vec<CustomerFormPayload>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCustomersResult {
    created_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseCustomerImportResult {
    pub customers: Vec<CustomerFormPayload>,
    pub errors: Vec<String>,
}

struct NormalizedCustomerPayload {
    customer_name: String,
    phone: String,
    customer_address: String,
    default_pricing_tax_included: bool,
    bridge_processing_fee_tax_included_x100: i64,
    powder_processing_fee_tax_included_x100: i64,
    billet_processing_fee_tax_included_x100: i64,
    oxidation_processing_fee_tax_included_x100: i64,
    electrophoresis_processing_fee_tax_included_x100: i64,
    bridge_processing_fee_tax_excluded_x100: i64,
    powder_processing_fee_tax_excluded_x100: i64,
    billet_processing_fee_tax_excluded_x100: i64,
    oxidation_processing_fee_tax_excluded_x100: i64,
    electrophoresis_processing_fee_tax_excluded_x100: i64,
    special_pricing_keyword: String,
    special_bridge_processing_fee_tax_included_x100: i64,
    special_powder_processing_fee_tax_included_x100: i64,
    special_billet_processing_fee_tax_included_x100: i64,
    special_oxidation_processing_fee_tax_included_x100: i64,
    special_electrophoresis_processing_fee_tax_included_x100: i64,
    special_bridge_processing_fee_tax_excluded_x100: i64,
    special_powder_processing_fee_tax_excluded_x100: i64,
    special_billet_processing_fee_tax_excluded_x100: i64,
    special_oxidation_processing_fee_tax_excluded_x100: i64,
    special_electrophoresis_processing_fee_tax_excluded_x100: i64,
}

#[tauri::command]
pub fn list_customers(
    state: State<'_, AppState>,
    params: Option<ListCustomersParams>,
) -> Result<CustomerListResult, CommandError> {
    list_customers_inner(state, params).map_err(map_customer_list_error)
}

fn list_customers_inner(
    state: State<'_, AppState>,
    params: Option<ListCustomersParams>,
) -> Result<CustomerListResult, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let params = params.unwrap_or(ListCustomersParams {
        page: None,
        page_size: None,
        quick_filter: None,
        search: None,
    });
    let page = params.page.unwrap_or(1).max(1);
    let page_size = params.page_size.unwrap_or(20).clamp(10, 1000);
    let offset = (page - 1) * page_size;
    let search = params.search.unwrap_or_default().trim().to_string();
    let quick_filter = params.quick_filter.unwrap_or_default().trim().to_string();
    let quick_filter_sql = match quick_filter.as_str() {
        "" | "all" => "1 = 1",
        "missingPhone" => "phone = ''",
        "missingAddress" => "customer_address = ''",
        _ => return Err("客户筛选参数无效".to_string()),
    };
    let all_total = conn
        .query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .map_err(|err| format!("failed to count all customers: {err}"))?;
    let missing_phone_count = conn
        .query_row(
            "SELECT COUNT(*) FROM customers WHERE phone = ''",
            [],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to count customers missing phone: {err}"))?;
    let missing_address_count = conn
        .query_row(
            "SELECT COUNT(*) FROM customers WHERE customer_address = ''",
            [],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to count customers missing address: {err}"))?;
    let search_pattern = format!("%{search}%");
    let count_sql = format!(
        "
        SELECT COUNT(*)
        FROM customers
        WHERE (?1 = '' OR customer_name LIKE ?2 OR phone LIKE ?2 OR customer_address LIKE ?2)
          AND {quick_filter_sql}
        "
    );
    let total = conn
        .query_row(&count_sql, params![&search, &search_pattern], |row| {
            row.get(0)
        })
        .map_err(|err| format!("failed to count customers: {err}"))?;
    let customers_sql = format!(
        "
        SELECT {CUSTOMER_SELECT_COLUMNS}
        FROM customers
        WHERE (?1 = '' OR customer_name LIKE ?2 OR phone LIKE ?2 OR customer_address LIKE ?2)
          AND {quick_filter_sql}
        ORDER BY updated_at DESC, customer_name ASC
        LIMIT ?3 OFFSET ?4
        "
    );
    let customers = query_customers_page(
        &conn,
        &customers_sql,
        params![&search, &search_pattern, page_size, offset],
    )?;

    Ok(CustomerListResult {
        customers,
        total,
        all_total,
        missing_phone_count,
        missing_address_count,
    })
}

fn map_customer_list_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "客户筛选参数无效" => "CUSTOMER_FILTER_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn export_customers(
    state: State<'_, AppState>,
    params: Option<ListCustomersParams>,
) -> Result<ExportCustomersResult, CommandError> {
    export_customers_inner(state, params).map_err(map_customer_export_error)
}

fn export_customers_inner(
    state: State<'_, AppState>,
    params: Option<ListCustomersParams>,
) -> Result<ExportCustomersResult, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let resolved = resolve_customer_list_params(params)?;
    let customers_sql = format!(
        "
        SELECT {CUSTOMER_SELECT_COLUMNS}
        FROM customers
        WHERE (?1 = '' OR customer_name LIKE ?2 OR phone LIKE ?2 OR customer_address LIKE ?2)
          AND {quick_filter_sql}
        ORDER BY updated_at DESC, customer_name ASC
        ",
        quick_filter_sql = resolved.quick_filter_sql,
    );
    let customers = query_customers_page(
        &conn,
        &customers_sql,
        params![&resolved.search, &resolved.search_pattern],
    )?;

    Ok(ExportCustomersResult { customers })
}

fn map_customer_export_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "客户筛选参数无效" => "CUSTOMER_FILTER_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn create_customer(
    state: State<'_, AppState>,
    payload: CreateCustomerPayload,
) -> Result<CustomerSummary, CommandError> {
    create_customer_inner(state, payload).map_err(map_create_customer_error)
}

fn create_customer_inner(
    state: State<'_, AppState>,
    payload: CreateCustomerPayload,
) -> Result<CustomerSummary, String> {
    let normalized = validate_customer(&payload)?;
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let id = next_customer_id(&conn)?;

    insert_customer(&conn, &id, &normalized)?;

    query_customer_by_id(&conn, &id)
}

fn map_create_customer_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "客户名称不能为空" => "CUSTOMER_NAME_REQUIRED",
        "含税加工费未设置，不能选含税" => "CUSTOMER_INCLUDED_PROCESSING_FEE_REQUIRED",
        "不含税加工费未设置，不能选不含税" => {
            "CUSTOMER_EXCLUDED_PROCESSING_FEE_REQUIRED"
        }
        "客户名称已存在" => "CUSTOMER_NAME_CONFLICT",
        _ if message.ends_with("加工费不能小于 0") => "CUSTOMER_PROCESSING_FEE_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn update_customer(
    state: State<'_, AppState>,
    payload: UpdateCustomerPayload,
) -> Result<CustomerSummary, CommandError> {
    update_customer_inner(state, payload).map_err(map_update_customer_error)
}

fn update_customer_inner(
    state: State<'_, AppState>,
    payload: UpdateCustomerPayload,
) -> Result<CustomerSummary, String> {
    let id = payload.id.trim();

    if id.is_empty() {
        return Err("客户 ID 不能为空".to_string());
    }

    let normalized = validate_customer(&CustomerFormPayload::from(&payload))?;
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start customer update transaction: {err}"))?;
    let updated_count = tx
        .execute(
            "
            UPDATE customers
            SET customer_name = ?2,
                phone = ?3,
                customer_address = ?4,
                default_pricing_tax_included = ?5,
                bridge_processing_fee_tax_included_x100 = ?6,
                powder_processing_fee_tax_included_x100 = ?7,
                billet_processing_fee_tax_included_x100 = ?8,
                oxidation_processing_fee_tax_included_x100 = ?9,
                electrophoresis_processing_fee_tax_included_x100 = ?10,
                bridge_processing_fee_tax_excluded_x100 = ?11,
                powder_processing_fee_tax_excluded_x100 = ?12,
                billet_processing_fee_tax_excluded_x100 = ?13,
                oxidation_processing_fee_tax_excluded_x100 = ?14,
                electrophoresis_processing_fee_tax_excluded_x100 = ?15,
                special_pricing_keyword = ?16,
                special_bridge_processing_fee_tax_included_x100 = ?17,
                special_powder_processing_fee_tax_included_x100 = ?18,
                special_billet_processing_fee_tax_included_x100 = ?19,
                special_oxidation_processing_fee_tax_included_x100 = ?20,
                special_electrophoresis_processing_fee_tax_included_x100 = ?21,
                special_bridge_processing_fee_tax_excluded_x100 = ?22,
                special_powder_processing_fee_tax_excluded_x100 = ?23,
                special_billet_processing_fee_tax_excluded_x100 = ?24,
                special_oxidation_processing_fee_tax_excluded_x100 = ?25,
                special_electrophoresis_processing_fee_tax_excluded_x100 = ?26,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
            ",
            params![
                id,
                normalized.customer_name,
                normalized.phone,
                normalized.customer_address,
                normalized.default_pricing_tax_included,
                normalized.bridge_processing_fee_tax_included_x100,
                normalized.powder_processing_fee_tax_included_x100,
                normalized.billet_processing_fee_tax_included_x100,
                normalized.oxidation_processing_fee_tax_included_x100,
                normalized.electrophoresis_processing_fee_tax_included_x100,
                normalized.bridge_processing_fee_tax_excluded_x100,
                normalized.powder_processing_fee_tax_excluded_x100,
                normalized.billet_processing_fee_tax_excluded_x100,
                normalized.oxidation_processing_fee_tax_excluded_x100,
                normalized.electrophoresis_processing_fee_tax_excluded_x100,
                normalized.special_pricing_keyword,
                normalized.special_bridge_processing_fee_tax_included_x100,
                normalized.special_powder_processing_fee_tax_included_x100,
                normalized.special_billet_processing_fee_tax_included_x100,
                normalized.special_oxidation_processing_fee_tax_included_x100,
                normalized.special_electrophoresis_processing_fee_tax_included_x100,
                normalized.special_bridge_processing_fee_tax_excluded_x100,
                normalized.special_powder_processing_fee_tax_excluded_x100,
                normalized.special_billet_processing_fee_tax_excluded_x100,
                normalized.special_oxidation_processing_fee_tax_excluded_x100,
                normalized.special_electrophoresis_processing_fee_tax_excluded_x100
            ],
        )
        .map_err(map_customer_write_error)?;

    if updated_count == 0 {
        return Err("客户不存在".to_string());
    }

    tx.execute(
        "
        UPDATE orders
        SET customer_name = ?2,
            customer_address = ?3,
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = ?1
          AND status IN ('editing', 'saved')
        ",
        params![id, normalized.customer_name, normalized.customer_address],
    )
    .map_err(|err| format!("failed to sync editable orders: {err}"))?;
    tx.commit()
        .map_err(|err| format!("failed to commit customer update: {err}"))?;

    query_customer_by_id(&conn, id)
}

fn map_update_customer_error(message: String) -> CommandError {
    match message.as_str() {
        "客户 ID 不能为空" => CommandError::new("CUSTOMER_ID_REQUIRED", message),
        "客户不存在" => CommandError::new("CUSTOMER_NOT_FOUND", message),
        _ => map_create_customer_error(message),
    }
}

#[tauri::command]
pub fn import_customers(
    state: State<'_, AppState>,
    payload: ImportCustomersPayload,
) -> Result<ImportCustomersResult, CommandError> {
    import_customers_inner(state, payload).map_err(map_import_customers_error)
}

fn import_customers_inner(
    state: State<'_, AppState>,
    payload: ImportCustomersPayload,
) -> Result<ImportCustomersResult, String> {
    if payload.customers.is_empty() {
        return Err("没有可导入的客户".to_string());
    }

    let mut customer_names = HashSet::new();

    for (index, customer) in payload.customers.iter().enumerate() {
        let normalized = validate_customer(customer)
            .map_err(|message| format!("第 {} 行：{message}", index + 1))?;

        if !customer_names.insert(normalized.customer_name.to_string()) {
            return Err(format!("第 {} 行：客户名称重复", index + 1));
        }
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start customer import transaction: {err}"))?;
    for (next_number, customer) in (next_customer_number(&tx)?..).zip(payload.customers.iter()) {
        let normalized = validate_customer(customer)?;
        let id = format_customer_id(next_number);

        insert_customer(&tx, &id, &normalized)?;
    }

    tx.commit()
        .map_err(|err| format!("failed to commit customer import: {err}"))?;

    Ok(ImportCustomersResult {
        created_count: payload.customers.len(),
    })
}

fn map_import_customers_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "没有可导入的客户" => "CUSTOMER_IMPORT_EMPTY",
        "客户名称已存在" => "CUSTOMER_IMPORT_NAME_CONFLICT",
        _ if message.starts_with("第 ") && message.ends_with("：客户名称重复") => {
            "CUSTOMER_IMPORT_NAME_DUPLICATE"
        }
        _ if message.starts_with("第 ") => "CUSTOMER_IMPORT_ROW_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn parse_customer_import_file(path: String) -> Result<ParseCustomerImportResult, CommandError> {
    parse_customer_import_file_inner(path).map_err(map_customer_import_file_error)
}

fn parse_customer_import_file_inner(path: String) -> Result<ParseCustomerImportResult, String> {
    let normalized_path = normalize_file_path(&path);
    let file_path = Path::new(&normalized_path);
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match extension.as_str() {
        "csv" => parse_customer_rows(read_csv_rows(file_path)?),
        "xlsx" | "xls" => parse_customer_rows(read_excel_rows(file_path)?),
        _ => Err("请选择 CSV、XLSX 或 XLS 文件".to_string()),
    }
}

fn map_customer_import_file_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择 CSV、XLSX 或 XLS 文件" => "CUSTOMER_IMPORT_FILE_TYPE_INVALID",
        "Excel 文件没有工作表" => "CUSTOMER_IMPORT_WORKSHEET_MISSING",
        _ if message.starts_with("无法读取文件：")
            || message.starts_with("无法打开 Excel 文件：")
            || message.starts_with("无法读取工作表：") =>
        {
            "CUSTOMER_IMPORT_FILE_READ_FAILED"
        }
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn delete_customer(state: State<'_, AppState>, id: String) -> Result<(), CommandError> {
    let id = id.trim();

    if id.is_empty() {
        return Err(CommandError::new(
            "CUSTOMER_ID_REQUIRED",
            "客户 ID 不能为空",
        ));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;
    delete_customer_with_connection(&mut conn, id).map_err(map_customer_delete_error)
}

fn map_customer_delete_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "有未下订单引用此客户，不能删除" => "CUSTOMER_HAS_PENDING_ORDERS",
        "有客户历史库存批次引用此客户，不能删除" => {
            "CUSTOMER_HAS_HISTORICAL_INVENTORY"
        }
        "客户不存在" => "CUSTOMER_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

fn delete_customer_with_connection(conn: &mut Connection, id: &str) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start customer delete transaction: {err}"))?;
    let editable_order_count: i64 = tx
        .query_row(
            "
            SELECT COUNT(*)
            FROM orders
            WHERE customer_id = ?1
              AND status IN ('editing', 'saved')
            ",
            [id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to check customer references: {err}"))?;

    if editable_order_count > 0 {
        return Err("有未下订单引用此客户，不能删除".to_string());
    }

    let customer_inventory_batch_count: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM customer_inventory_batches WHERE customer_id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to check customer inventory references: {err}"))?;

    if customer_inventory_batch_count > 0 {
        return Err("有客户历史库存批次引用此客户，不能删除".to_string());
    }

    tx.execute(
        "
        UPDATE orders
        SET customer_id = NULL
        WHERE customer_id = ?1
          AND status = 'ordered'
        ",
        [id],
    )
    .map_err(|err| format!("failed to detach ordered order snapshots: {err}"))?;

    let deleted_count = tx
        .execute("DELETE FROM customers WHERE id = ?1", [id])
        .map_err(|err| format!("failed to delete customer: {err}"))?;

    if deleted_count == 0 {
        return Err("客户不存在".to_string());
    }

    tx.commit()
        .map_err(|err| format!("failed to commit customer delete: {err}"))?;

    Ok(())
}

fn query_customers_page<P>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> Result<Vec<CustomerSummary>, String>
where
    P: Params,
{
    let mut stmt = conn
        .prepare(sql)
        .map_err(|err| format!("failed to prepare customer query: {err}"))?;
    let rows = stmt
        .query_map(params, map_customer_row)
        .map_err(|err| format!("failed to query customers: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customers: {err}"))
}

fn query_customer_by_id(conn: &Connection, id: &str) -> Result<CustomerSummary, String> {
    conn.query_row(
        &format!(
            "
        SELECT {CUSTOMER_SELECT_COLUMNS}
        FROM customers
        WHERE id = ?1
        "
        ),
        [id],
        map_customer_row,
    )
    .map_err(|err| format!("failed to query customer: {err}"))
}

fn map_customer_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CustomerSummary> {
    Ok(CustomerSummary {
        id: row.get(0)?,
        customer_name: row.get(1)?,
        phone: row.get(2)?,
        customer_address: row.get(3)?,
        default_pricing_tax_included: row.get(4)?,
        bridge_processing_fee_tax_included_x100: row.get(5)?,
        powder_processing_fee_tax_included_x100: row.get(6)?,
        billet_processing_fee_tax_included_x100: row.get(7)?,
        oxidation_processing_fee_tax_included_x100: row.get(8)?,
        electrophoresis_processing_fee_tax_included_x100: row.get(9)?,
        bridge_processing_fee_tax_excluded_x100: row.get(10)?,
        powder_processing_fee_tax_excluded_x100: row.get(11)?,
        billet_processing_fee_tax_excluded_x100: row.get(12)?,
        oxidation_processing_fee_tax_excluded_x100: row.get(13)?,
        electrophoresis_processing_fee_tax_excluded_x100: row.get(14)?,
        special_pricing_keyword: row.get(15)?,
        special_bridge_processing_fee_tax_included_x100: row.get(16)?,
        special_powder_processing_fee_tax_included_x100: row.get(17)?,
        special_billet_processing_fee_tax_included_x100: row.get(18)?,
        special_oxidation_processing_fee_tax_included_x100: row.get(19)?,
        special_electrophoresis_processing_fee_tax_included_x100: row.get(20)?,
        special_bridge_processing_fee_tax_excluded_x100: row.get(21)?,
        special_powder_processing_fee_tax_excluded_x100: row.get(22)?,
        special_billet_processing_fee_tax_excluded_x100: row.get(23)?,
        special_oxidation_processing_fee_tax_excluded_x100: row.get(24)?,
        special_electrophoresis_processing_fee_tax_excluded_x100: row.get(25)?,
        created_at: row.get(26)?,
        updated_at: row.get(27)?,
    })
}

fn insert_customer(
    conn: &Connection,
    id: &str,
    payload: &NormalizedCustomerPayload,
) -> Result<(), String> {
    conn.execute(
        "
        INSERT INTO customers (
          id,
          customer_name,
          phone,
          customer_address,
          default_pricing_tax_included,
          bridge_processing_fee_tax_included_x100,
          powder_processing_fee_tax_included_x100,
          billet_processing_fee_tax_included_x100,
          oxidation_processing_fee_tax_included_x100,
          electrophoresis_processing_fee_tax_included_x100,
          bridge_processing_fee_tax_excluded_x100,
          powder_processing_fee_tax_excluded_x100,
          billet_processing_fee_tax_excluded_x100,
          oxidation_processing_fee_tax_excluded_x100,
          electrophoresis_processing_fee_tax_excluded_x100,
          special_pricing_keyword,
          special_bridge_processing_fee_tax_included_x100,
          special_powder_processing_fee_tax_included_x100,
          special_billet_processing_fee_tax_included_x100,
          special_oxidation_processing_fee_tax_included_x100,
          special_electrophoresis_processing_fee_tax_included_x100,
          special_bridge_processing_fee_tax_excluded_x100,
          special_powder_processing_fee_tax_excluded_x100,
          special_billet_processing_fee_tax_excluded_x100,
          special_oxidation_processing_fee_tax_excluded_x100,
          special_electrophoresis_processing_fee_tax_excluded_x100,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ",
        params![
            id,
            payload.customer_name,
            payload.phone,
            payload.customer_address,
            payload.default_pricing_tax_included,
            payload.bridge_processing_fee_tax_included_x100,
            payload.powder_processing_fee_tax_included_x100,
            payload.billet_processing_fee_tax_included_x100,
            payload.oxidation_processing_fee_tax_included_x100,
            payload.electrophoresis_processing_fee_tax_included_x100,
            payload.bridge_processing_fee_tax_excluded_x100,
            payload.powder_processing_fee_tax_excluded_x100,
            payload.billet_processing_fee_tax_excluded_x100,
            payload.oxidation_processing_fee_tax_excluded_x100,
            payload.electrophoresis_processing_fee_tax_excluded_x100,
            payload.special_pricing_keyword,
            payload.special_bridge_processing_fee_tax_included_x100,
            payload.special_powder_processing_fee_tax_included_x100,
            payload.special_billet_processing_fee_tax_included_x100,
            payload.special_oxidation_processing_fee_tax_included_x100,
            payload.special_electrophoresis_processing_fee_tax_included_x100,
            payload.special_bridge_processing_fee_tax_excluded_x100,
            payload.special_powder_processing_fee_tax_excluded_x100,
            payload.special_billet_processing_fee_tax_excluded_x100,
            payload.special_oxidation_processing_fee_tax_excluded_x100,
            payload.special_electrophoresis_processing_fee_tax_excluded_x100
        ],
    )
    .map_err(map_customer_write_error)?;

    Ok(())
}

fn validate_customer(payload: &CustomerFormPayload) -> Result<NormalizedCustomerPayload, String> {
    let customer_name = payload.customer_name.trim();
    let phone = payload.phone.trim();
    let customer_address = payload.customer_address.trim();

    if customer_name.is_empty() {
        return Err("客户名称不能为空".to_string());
    }

    let price_fields = [
        (
            "含税断桥加工费",
            payload.bridge_processing_fee_tax_included_x100,
        ),
        (
            "含税喷涂加工费",
            payload.powder_processing_fee_tax_included_x100,
        ),
        (
            "含税坯料加工费",
            payload.billet_processing_fee_tax_included_x100,
        ),
        (
            "含税氧化加工费",
            payload.oxidation_processing_fee_tax_included_x100,
        ),
        (
            "含税电泳加工费",
            payload.electrophoresis_processing_fee_tax_included_x100,
        ),
        (
            "不含税断桥加工费",
            payload.bridge_processing_fee_tax_excluded_x100,
        ),
        (
            "不含税喷涂加工费",
            payload.powder_processing_fee_tax_excluded_x100,
        ),
        (
            "不含税坯料加工费",
            payload.billet_processing_fee_tax_excluded_x100,
        ),
        (
            "不含税氧化加工费",
            payload.oxidation_processing_fee_tax_excluded_x100,
        ),
        (
            "不含税电泳加工费",
            payload.electrophoresis_processing_fee_tax_excluded_x100,
        ),
        (
            "特殊断桥加工费",
            payload.special_bridge_processing_fee_tax_included_x100,
        ),
        (
            "特殊喷涂加工费",
            payload.special_powder_processing_fee_tax_included_x100,
        ),
        (
            "特殊坯料加工费",
            payload.special_billet_processing_fee_tax_included_x100,
        ),
        (
            "特殊氧化加工费",
            payload.special_oxidation_processing_fee_tax_included_x100,
        ),
        (
            "特殊电泳加工费",
            payload.special_electrophoresis_processing_fee_tax_included_x100,
        ),
        (
            "特殊不含税断桥加工费",
            payload.special_bridge_processing_fee_tax_excluded_x100,
        ),
        (
            "特殊不含税喷涂加工费",
            payload.special_powder_processing_fee_tax_excluded_x100,
        ),
        (
            "特殊不含税坯料加工费",
            payload.special_billet_processing_fee_tax_excluded_x100,
        ),
        (
            "特殊不含税氧化加工费",
            payload.special_oxidation_processing_fee_tax_excluded_x100,
        ),
        (
            "特殊不含税电泳加工费",
            payload.special_electrophoresis_processing_fee_tax_excluded_x100,
        ),
    ];

    for (label, value) in price_fields {
        if value < 0 {
            return Err(format!("{label}不能小于 0"));
        }
    }

    let has_included_price = [
        payload.bridge_processing_fee_tax_included_x100,
        payload.powder_processing_fee_tax_included_x100,
        payload.billet_processing_fee_tax_included_x100,
        payload.oxidation_processing_fee_tax_included_x100,
        payload.electrophoresis_processing_fee_tax_included_x100,
    ]
    .iter()
    .any(|value| *value > 0);
    let has_excluded_price = [
        payload.bridge_processing_fee_tax_excluded_x100,
        payload.powder_processing_fee_tax_excluded_x100,
        payload.billet_processing_fee_tax_excluded_x100,
        payload.oxidation_processing_fee_tax_excluded_x100,
        payload.electrophoresis_processing_fee_tax_excluded_x100,
    ]
    .iter()
    .any(|value| *value > 0);

    if payload.default_pricing_tax_included && !has_included_price {
        return Err("含税加工费未设置，不能选含税".to_string());
    }

    if !payload.default_pricing_tax_included && !has_excluded_price {
        return Err("不含税加工费未设置，不能选不含税".to_string());
    }

    Ok(NormalizedCustomerPayload {
        customer_name: customer_name.to_string(),
        phone: phone.to_string(),
        customer_address: customer_address.to_string(),
        default_pricing_tax_included: payload.default_pricing_tax_included,
        bridge_processing_fee_tax_included_x100: payload.bridge_processing_fee_tax_included_x100,
        powder_processing_fee_tax_included_x100: payload.powder_processing_fee_tax_included_x100,
        billet_processing_fee_tax_included_x100: payload.billet_processing_fee_tax_included_x100,
        oxidation_processing_fee_tax_included_x100: payload
            .oxidation_processing_fee_tax_included_x100,
        electrophoresis_processing_fee_tax_included_x100: payload
            .electrophoresis_processing_fee_tax_included_x100,
        bridge_processing_fee_tax_excluded_x100: payload.bridge_processing_fee_tax_excluded_x100,
        powder_processing_fee_tax_excluded_x100: payload.powder_processing_fee_tax_excluded_x100,
        billet_processing_fee_tax_excluded_x100: payload.billet_processing_fee_tax_excluded_x100,
        oxidation_processing_fee_tax_excluded_x100: payload
            .oxidation_processing_fee_tax_excluded_x100,
        electrophoresis_processing_fee_tax_excluded_x100: payload
            .electrophoresis_processing_fee_tax_excluded_x100,
        special_pricing_keyword: payload.special_pricing_keyword.trim().to_string(),
        special_bridge_processing_fee_tax_included_x100: payload
            .special_bridge_processing_fee_tax_included_x100,
        special_powder_processing_fee_tax_included_x100: payload
            .special_powder_processing_fee_tax_included_x100,
        special_billet_processing_fee_tax_included_x100: payload
            .special_billet_processing_fee_tax_included_x100,
        special_oxidation_processing_fee_tax_included_x100: payload
            .special_oxidation_processing_fee_tax_included_x100,
        special_electrophoresis_processing_fee_tax_included_x100: payload
            .special_electrophoresis_processing_fee_tax_included_x100,
        special_bridge_processing_fee_tax_excluded_x100: payload
            .special_bridge_processing_fee_tax_excluded_x100,
        special_powder_processing_fee_tax_excluded_x100: payload
            .special_powder_processing_fee_tax_excluded_x100,
        special_billet_processing_fee_tax_excluded_x100: payload
            .special_billet_processing_fee_tax_excluded_x100,
        special_oxidation_processing_fee_tax_excluded_x100: payload
            .special_oxidation_processing_fee_tax_excluded_x100,
        special_electrophoresis_processing_fee_tax_excluded_x100: payload
            .special_electrophoresis_processing_fee_tax_excluded_x100,
    })
}

struct CustomerListParamsResolved {
    search: String,
    search_pattern: String,
    quick_filter_sql: &'static str,
}

fn resolve_customer_list_params(
    params: Option<ListCustomersParams>,
) -> Result<CustomerListParamsResolved, String> {
    let params = params.unwrap_or(ListCustomersParams {
        page: None,
        page_size: None,
        quick_filter: None,
        search: None,
    });
    let search = params.search.unwrap_or_default().trim().to_string();
    let quick_filter = params.quick_filter.unwrap_or_default().trim().to_string();
    let quick_filter_sql = match quick_filter.as_str() {
        "" | "all" => "1 = 1",
        "missingPhone" => "phone = ''",
        "missingAddress" => "customer_address = ''",
        _ => return Err("客户筛选参数无效".to_string()),
    };
    let search_pattern = format!("%{search}%");

    Ok(CustomerListParamsResolved {
        search,
        search_pattern,
        quick_filter_sql,
    })
}

fn next_customer_id(conn: &Connection) -> Result<String, String> {
    Ok(format_customer_id(next_customer_number(conn)?))
}

fn next_customer_number(conn: &Connection) -> Result<i64, String> {
    let next_number: i64 = conn
        .query_row(
            "
            SELECT COALESCE(MAX(CAST(substr(id, 5) AS INTEGER)), 0) + 1
            FROM customers
            WHERE id LIKE 'CUS-%'
            ",
            [],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to resolve next customer id: {err}"))?;

    Ok(next_number)
}

fn format_customer_id(number: i64) -> String {
    format!("CUS-{number:03}")
}

fn map_customer_write_error(err: rusqlite::Error) -> String {
    let message = err.to_string();

    if message.contains("customers.customer_name") {
        "客户名称已存在".to_string()
    } else {
        format!("failed to write customer: {err}")
    }
}

fn read_csv_rows(path: &Path) -> Result<Vec<Vec<String>>, String> {
    let text = std::fs::read_to_string(path).map_err(|err| format!("无法读取文件：{err}"))?;

    Ok(text
        .trim_start_matches('\u{FEFF}')
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(parse_csv_line)
        .collect())
}

fn read_excel_rows(path: &Path) -> Result<Vec<Vec<String>>, String> {
    let mut workbook =
        open_workbook_auto(path).map_err(|err| format!("无法打开 Excel 文件：{err}"))?;
    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "Excel 文件没有工作表".to_string())?;
    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|err| format!("无法读取工作表：{err}"))?;

    Ok(range
        .rows()
        .map(|row| row.iter().map(excel_cell_to_string).collect())
        .collect())
}

fn parse_customer_rows(rows: Vec<Vec<String>>) -> Result<ParseCustomerImportResult, String> {
    let mut errors = Vec::new();

    if rows.len() < 2 {
        return Ok(ParseCustomerImportResult {
            customers: Vec::new(),
            errors: vec!["文件至少需要表头和一行数据".to_string()],
        });
    }

    let customer_name_candidates = ["客户名称", "客户", "customerName", "name"];
    let phone_candidates = ["手机", "手机号", "电话", "phone"];
    let address_candidates = ["客户地址", "地址", "customerAddress", "address"];
    let default_pricing_candidates = ["默认计价", "默认计价是否含税", "defaultPricingTaxIncluded"];
    let bridge_included_candidates = [
        "含税断桥加工费",
        "断桥加工费含税",
        "bridgeProcessingFeeTaxIncluded",
    ];
    let powder_included_candidates = [
        "含税喷涂加工费",
        "喷涂加工费含税",
        "powderProcessingFeeTaxIncluded",
    ];
    let billet_included_candidates = [
        "含税坯料加工费",
        "坯料加工费含税",
        "billetProcessingFeeTaxIncluded",
    ];
    let oxidation_included_candidates = [
        "含税氧化加工费",
        "氧化加工费含税",
        "oxidationProcessingFeeTaxIncluded",
    ];
    let electrophoresis_included_candidates = [
        "含税电泳加工费",
        "电泳加工费含税",
        "electrophoresisProcessingFeeTaxIncluded",
    ];
    let bridge_excluded_candidates = [
        "不含税断桥加工费",
        "断桥加工费不含税",
        "bridgeProcessingFeeTaxExcluded",
    ];
    let powder_excluded_candidates = [
        "不含税喷涂加工费",
        "喷涂加工费不含税",
        "powderProcessingFeeTaxExcluded",
    ];
    let billet_excluded_candidates = [
        "不含税坯料加工费",
        "坯料加工费不含税",
        "billetProcessingFeeTaxExcluded",
    ];
    let oxidation_excluded_candidates = [
        "不含税氧化加工费",
        "氧化加工费不含税",
        "oxidationProcessingFeeTaxExcluded",
    ];
    let electrophoresis_excluded_candidates = [
        "不含税电泳加工费",
        "电泳加工费不含税",
        "electrophoresisProcessingFeeTaxExcluded",
    ];
    let special_pricing_keyword_candidates = [
        "特殊计价关键词",
        "特殊计价备注关键词",
        "订单备注关键词",
        "specialPricingKeyword",
    ];
    let special_bridge_included_candidates = [
        "特殊含税断桥加工费",
        "特殊断桥加工费含税",
        "specialBridgeProcessingFeeTaxIncluded",
    ];
    let special_powder_included_candidates = [
        "特殊含税喷涂加工费",
        "特殊喷涂加工费含税",
        "specialPowderProcessingFeeTaxIncluded",
    ];
    let special_billet_included_candidates = [
        "特殊含税坯料加工费",
        "特殊坯料加工费含税",
        "specialBilletProcessingFeeTaxIncluded",
    ];
    let special_oxidation_included_candidates = [
        "特殊含税氧化加工费",
        "特殊氧化加工费含税",
        "specialOxidationProcessingFeeTaxIncluded",
    ];
    let special_electrophoresis_included_candidates = [
        "特殊含税电泳加工费",
        "特殊电泳加工费含税",
        "specialElectrophoresisProcessingFeeTaxIncluded",
    ];
    let special_bridge_excluded_candidates = [
        "特殊不含税断桥加工费",
        "特殊断桥加工费不含税",
        "specialBridgeProcessingFeeTaxExcluded",
    ];
    let special_powder_excluded_candidates = [
        "特殊不含税喷涂加工费",
        "特殊喷涂加工费不含税",
        "specialPowderProcessingFeeTaxExcluded",
    ];
    let special_billet_excluded_candidates = [
        "特殊不含税坯料加工费",
        "特殊坯料加工费不含税",
        "specialBilletProcessingFeeTaxExcluded",
    ];
    let special_oxidation_excluded_candidates = [
        "特殊不含税氧化加工费",
        "特殊氧化加工费不含税",
        "specialOxidationProcessingFeeTaxExcluded",
    ];
    let special_electrophoresis_excluded_candidates = [
        "特殊不含税电泳加工费",
        "特殊电泳加工费不含税",
        "specialElectrophoresisProcessingFeeTaxExcluded",
    ];
    let header_row_index = find_best_header_row_index(
        &rows,
        &[
            &customer_name_candidates,
            &default_pricing_candidates,
            &bridge_included_candidates,
            &powder_included_candidates,
            &billet_included_candidates,
            &oxidation_included_candidates,
            &electrophoresis_included_candidates,
            &bridge_excluded_candidates,
            &powder_excluded_candidates,
            &billet_excluded_candidates,
            &oxidation_excluded_candidates,
            &electrophoresis_excluded_candidates,
        ],
    );
    let headers = rows[header_row_index]
        .iter()
        .map(|header| normalize_header(header))
        .collect::<Vec<_>>();
    let customer_name_index = find_header_index(&headers, &customer_name_candidates);
    let phone_index = find_header_index(&headers, &phone_candidates);
    let address_index = find_header_index(&headers, &address_candidates);
    let default_pricing_index = find_header_index(&headers, &default_pricing_candidates);
    let bridge_included_index = find_header_index(&headers, &bridge_included_candidates);
    let powder_included_index = find_header_index(&headers, &powder_included_candidates);
    let billet_included_index = find_header_index(&headers, &billet_included_candidates);
    let oxidation_included_index = find_header_index(&headers, &oxidation_included_candidates);
    let electrophoresis_included_index =
        find_header_index(&headers, &electrophoresis_included_candidates);
    let bridge_excluded_index = find_header_index(&headers, &bridge_excluded_candidates);
    let powder_excluded_index = find_header_index(&headers, &powder_excluded_candidates);
    let billet_excluded_index = find_header_index(&headers, &billet_excluded_candidates);
    let oxidation_excluded_index = find_header_index(&headers, &oxidation_excluded_candidates);
    let electrophoresis_excluded_index =
        find_header_index(&headers, &electrophoresis_excluded_candidates);
    let special_pricing_keyword_index =
        find_header_index(&headers, &special_pricing_keyword_candidates);
    let special_bridge_included_index =
        find_header_index(&headers, &special_bridge_included_candidates);
    let special_powder_included_index =
        find_header_index(&headers, &special_powder_included_candidates);
    let special_billet_included_index =
        find_header_index(&headers, &special_billet_included_candidates);
    let special_oxidation_included_index =
        find_header_index(&headers, &special_oxidation_included_candidates);
    let special_electrophoresis_included_index =
        find_header_index(&headers, &special_electrophoresis_included_candidates);
    let special_bridge_excluded_index =
        find_header_index(&headers, &special_bridge_excluded_candidates);
    let special_powder_excluded_index =
        find_header_index(&headers, &special_powder_excluded_candidates);
    let special_billet_excluded_index =
        find_header_index(&headers, &special_billet_excluded_candidates);
    let special_oxidation_excluded_index =
        find_header_index(&headers, &special_oxidation_excluded_candidates);
    let special_electrophoresis_excluded_index =
        find_header_index(&headers, &special_electrophoresis_excluded_candidates);
    let required_columns = [
        (customer_name_index, "缺少客户名称列"),
        (default_pricing_index, "缺少默认计价列"),
        (bridge_included_index, "缺少含税断桥加工费列"),
        (powder_included_index, "缺少含税喷涂加工费列"),
        (billet_included_index, "缺少含税坯料加工费列"),
        (oxidation_included_index, "缺少含税氧化加工费列"),
        (electrophoresis_included_index, "缺少含税电泳加工费列"),
        (bridge_excluded_index, "缺少不含税断桥加工费列"),
        (powder_excluded_index, "缺少不含税喷涂加工费列"),
        (billet_excluded_index, "缺少不含税坯料加工费列"),
        (oxidation_excluded_index, "缺少不含税氧化加工费列"),
        (electrophoresis_excluded_index, "缺少不含税电泳加工费列"),
    ];

    for (index, message) in required_columns {
        if index.is_none() {
            errors.push(message.to_string());
        }
    }

    if !errors.is_empty() {
        return Ok(ParseCustomerImportResult {
            customers: Vec::new(),
            errors,
        });
    }

    let (
        Some(customer_name_index),
        Some(default_pricing_index),
        Some(bridge_included_index),
        Some(powder_included_index),
        Some(billet_included_index),
        Some(oxidation_included_index),
        Some(electrophoresis_included_index),
        Some(bridge_excluded_index),
        Some(powder_excluded_index),
        Some(billet_excluded_index),
        Some(oxidation_excluded_index),
        Some(electrophoresis_excluded_index),
    ) = (
        customer_name_index,
        default_pricing_index,
        bridge_included_index,
        powder_included_index,
        billet_included_index,
        oxidation_included_index,
        electrophoresis_included_index,
        bridge_excluded_index,
        powder_excluded_index,
        billet_excluded_index,
        oxidation_excluded_index,
        electrophoresis_excluded_index,
    )
    else {
        return Ok(ParseCustomerImportResult {
            customers: Vec::new(),
            errors,
        });
    };
    let mut customers = Vec::new();
    let mut customer_names = HashSet::new();

    for (index, row) in rows.iter().enumerate().skip(header_row_index + 1) {
        if row.iter().all(|value| value.trim().is_empty()) {
            continue;
        }

        let row_number = index + 1;
        let customer_name = row
            .get(customer_name_index)
            .map(|value| value.trim())
            .unwrap_or("");
        let phone = phone_index
            .and_then(|column| row.get(column))
            .map(|value| value.trim())
            .unwrap_or("");
        let customer_address = address_index
            .and_then(|column| row.get(column))
            .map(|value| value.trim())
            .unwrap_or("");
        let default_pricing = row
            .get(default_pricing_index)
            .map(|value| parse_default_pricing(value))
            .unwrap_or(None);
        let bridge_included = parse_money_cell(row, bridge_included_index);
        let powder_included = parse_money_cell(row, powder_included_index);
        let billet_included = parse_money_cell(row, billet_included_index);
        let oxidation_included = parse_money_cell(row, oxidation_included_index);
        let electrophoresis_included = parse_money_cell(row, electrophoresis_included_index);
        let bridge_excluded = parse_money_cell(row, bridge_excluded_index);
        let powder_excluded = parse_money_cell(row, powder_excluded_index);
        let billet_excluded = parse_money_cell(row, billet_excluded_index);
        let oxidation_excluded = parse_money_cell(row, oxidation_excluded_index);
        let electrophoresis_excluded = parse_money_cell(row, electrophoresis_excluded_index);
        let special_pricing_keyword = special_pricing_keyword_index
            .and_then(|column| row.get(column))
            .map(|value| value.trim())
            .unwrap_or("");
        let special_bridge_included = parse_optional_money_cell(row, special_bridge_included_index);
        let special_powder_included = parse_optional_money_cell(row, special_powder_included_index);
        let special_billet_included = parse_optional_money_cell(row, special_billet_included_index);
        let special_oxidation_included =
            parse_optional_money_cell(row, special_oxidation_included_index);
        let special_electrophoresis_included =
            parse_optional_money_cell(row, special_electrophoresis_included_index);
        let special_bridge_excluded = parse_optional_money_cell(row, special_bridge_excluded_index);
        let special_powder_excluded = parse_optional_money_cell(row, special_powder_excluded_index);
        let special_billet_excluded = parse_optional_money_cell(row, special_billet_excluded_index);
        let special_oxidation_excluded =
            parse_optional_money_cell(row, special_oxidation_excluded_index);
        let special_electrophoresis_excluded =
            parse_optional_money_cell(row, special_electrophoresis_excluded_index);

        if customer_name.is_empty() {
            errors.push(format!("第 {row_number} 行：客户名称不能为空"));
        }

        if !customer_name.is_empty() && !customer_names.insert(customer_name.to_string()) {
            errors.push(format!("第 {row_number} 行：客户名称重复"));
        }

        if default_pricing.is_none() {
            errors.push(format!("第 {row_number} 行：默认计价必须为含税或不含税"));
        }

        let money_fields = [
            ("含税断桥加工费", bridge_included),
            ("含税喷涂加工费", powder_included),
            ("含税坯料加工费", billet_included),
            ("含税氧化加工费", oxidation_included),
            ("含税电泳加工费", electrophoresis_included),
            ("不含税断桥加工费", bridge_excluded),
            ("不含税喷涂加工费", powder_excluded),
            ("不含税坯料加工费", billet_excluded),
            ("不含税氧化加工费", oxidation_excluded),
            ("不含税电泳加工费", electrophoresis_excluded),
            ("特殊含税断桥加工费", special_bridge_included),
            ("特殊含税喷涂加工费", special_powder_included),
            ("特殊含税坯料加工费", special_billet_included),
            ("特殊含税氧化加工费", special_oxidation_included),
            ("特殊含税电泳加工费", special_electrophoresis_included),
            ("特殊不含税断桥加工费", special_bridge_excluded),
            ("特殊不含税喷涂加工费", special_powder_excluded),
            ("特殊不含税坯料加工费", special_billet_excluded),
            ("特殊不含税氧化加工费", special_oxidation_excluded),
            ("特殊不含税电泳加工费", special_electrophoresis_excluded),
        ];

        for (label, value) in money_fields {
            if value.is_none() {
                errors.push(format!("第 {row_number} 行：{label}必须为非负金额"));
            }
        }

        let customer = CustomerFormPayload {
            customer_name: customer_name.to_string(),
            phone: phone.to_string(),
            customer_address: customer_address.to_string(),
            default_pricing_tax_included: default_pricing.unwrap_or(true),
            bridge_processing_fee_tax_included_x100: bridge_included.unwrap_or_default(),
            powder_processing_fee_tax_included_x100: powder_included.unwrap_or_default(),
            billet_processing_fee_tax_included_x100: billet_included.unwrap_or_default(),
            oxidation_processing_fee_tax_included_x100: oxidation_included.unwrap_or_default(),
            electrophoresis_processing_fee_tax_included_x100: electrophoresis_included
                .unwrap_or_default(),
            bridge_processing_fee_tax_excluded_x100: bridge_excluded.unwrap_or_default(),
            powder_processing_fee_tax_excluded_x100: powder_excluded.unwrap_or_default(),
            billet_processing_fee_tax_excluded_x100: billet_excluded.unwrap_or_default(),
            oxidation_processing_fee_tax_excluded_x100: oxidation_excluded.unwrap_or_default(),
            electrophoresis_processing_fee_tax_excluded_x100: electrophoresis_excluded
                .unwrap_or_default(),
            special_pricing_keyword: special_pricing_keyword.to_string(),
            special_bridge_processing_fee_tax_included_x100: special_bridge_included
                .unwrap_or_default(),
            special_powder_processing_fee_tax_included_x100: special_powder_included
                .unwrap_or_default(),
            special_billet_processing_fee_tax_included_x100: special_billet_included
                .unwrap_or_default(),
            special_oxidation_processing_fee_tax_included_x100: special_oxidation_included
                .unwrap_or_default(),
            special_electrophoresis_processing_fee_tax_included_x100:
                special_electrophoresis_included.unwrap_or_default(),
            special_bridge_processing_fee_tax_excluded_x100: special_bridge_excluded
                .unwrap_or_default(),
            special_powder_processing_fee_tax_excluded_x100: special_powder_excluded
                .unwrap_or_default(),
            special_billet_processing_fee_tax_excluded_x100: special_billet_excluded
                .unwrap_or_default(),
            special_oxidation_processing_fee_tax_excluded_x100: special_oxidation_excluded
                .unwrap_or_default(),
            special_electrophoresis_processing_fee_tax_excluded_x100:
                special_electrophoresis_excluded.unwrap_or_default(),
        };

        if let Err(message) = validate_customer(&customer) {
            errors.push(format!("第 {row_number} 行：{message}"));
        }

        customers.push(customer);
    }

    Ok(ParseCustomerImportResult {
        customers: if errors.is_empty() {
            customers
        } else {
            Vec::new()
        },
        errors,
    })
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut chars = line.chars().peekable();
    let mut in_quotes = false;

    while let Some(ch) = chars.next() {
        if ch == '"' && in_quotes && chars.peek() == Some(&'"') {
            current.push('"');
            chars.next();
            continue;
        }

        if ch == '"' {
            in_quotes = !in_quotes;
            continue;
        }

        if ch == ',' && !in_quotes {
            cells.push(current);
            current = String::new();
            continue;
        }

        current.push(ch);
    }

    cells.push(current);
    cells
}

fn excel_cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        Data::Float(value) => format_number(*value),
        Data::Int(value) => value.to_string(),
        Data::Bool(value) => value.to_string(),
        Data::DateTime(value) => value.to_string(),
        Data::DateTimeIso(value) | Data::DurationIso(value) => value.trim().to_string(),
        Data::Error(_) => String::new(),
    }
}

fn format_number(value: f64) -> String {
    if !value.is_finite() {
        return String::new();
    }

    if value.fract().abs() < f64::EPSILON {
        format!("{value:.0}")
    } else {
        let formatted = format!("{value:.10}");
        formatted
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }
}

fn normalize_header(header: &str) -> String {
    header
        .trim()
        .to_lowercase()
        .chars()
        .filter(|ch| !matches!(ch, ' ' | '\t' | '\n' | '\r' | '_' | '（' | '）' | '(' | ')'))
        .collect()
}

fn find_header_index(headers: &[String], candidates: &[&str]) -> Option<usize> {
    let normalized_candidates = candidates
        .iter()
        .map(|candidate| normalize_header(candidate))
        .collect::<HashSet<_>>();

    headers
        .iter()
        .position(|header| normalized_candidates.contains(header))
}

fn find_best_header_row_index(rows: &[Vec<String>], candidate_groups: &[&[&str]]) -> usize {
    rows.iter()
        .enumerate()
        .max_by_key(|(_, row)| {
            let headers = row
                .iter()
                .map(|header| normalize_header(header))
                .collect::<Vec<_>>();

            candidate_groups
                .iter()
                .filter(|candidates| find_header_index(&headers, candidates).is_some())
                .count()
        })
        .map(|(index, _)| index)
        .unwrap_or(0)
}

fn parse_default_pricing(value: &str) -> Option<bool> {
    match value.trim().to_lowercase().as_str() {
        "含税" | "included" | "true" | "是" | "1" => Some(true),
        "不含税" | "excluded" | "false" | "否" | "0" => Some(false),
        _ => None,
    }
}

fn parse_money_cell(row: &[String], index: usize) -> Option<i64> {
    let value = row.get(index).map(|value| value.trim()).unwrap_or("");

    if value.is_empty() {
        return Some(0);
    }

    let normalized = value
        .replace(',', "")
        .replace("￥", "")
        .replace("¥", "")
        .trim()
        .to_string();
    let (amount_text, unit_text) = split_money_and_unit(&normalized)?;
    let unit = unit_text.trim().to_lowercase();

    if !unit.is_empty()
        && !matches!(
            unit.as_str(),
            "元" | "元/吨" | "元／吨" | "元吨" | "rmb" | "cny"
        )
    {
        return None;
    }

    let number = amount_text.parse::<f64>().ok()?;

    if number.is_finite() && number >= 0.0 {
        Some((number * 100.0).round() as i64)
    } else {
        None
    }
}

fn parse_optional_money_cell(row: &[String], index: Option<usize>) -> Option<i64> {
    index
        .map(|index| parse_money_cell(row, index))
        .unwrap_or(Some(0))
}

fn split_money_and_unit(value: &str) -> Option<(&str, &str)> {
    let value = value.trim();
    let mut end = 0;
    let mut has_digit = false;
    let mut has_dot = false;

    for (index, ch) in value.char_indices() {
        if ch.is_ascii_digit() {
            has_digit = true;
            end = index + ch.len_utf8();
            continue;
        }

        if ch == '.' && !has_dot {
            has_dot = true;
            end = index + ch.len_utf8();
            continue;
        }

        break;
    }

    if !has_digit {
        return None;
    }

    Some((&value[..end], &value[end..]))
}

fn normalize_file_path(path: &str) -> String {
    let trimmed = path.trim();

    if let Some(rest) = trimmed.strip_prefix("file://") {
        percent_decode(rest)
    } else {
        trimmed.to_string()
    }
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(hex) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                decoded.push(hex);
                index += 3;
                continue;
            }
        }

        decoded.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&decoded).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.execute_batch(include_str!("../db/migrations/001_init.sql"))
            .expect("run migrations");
        conn
    }

    #[test]
    fn parses_customer_import_with_oxidation_and_electrophoresis_fees() {
        let rows = vec![
            vec![
                "客户名称",
                "手机",
                "客户地址",
                "默认计价",
                "含税断桥加工费",
                "含税喷涂加工费",
                "含税坯料加工费",
                "含税氧化加工费",
                "含税电泳加工费",
                "不含税断桥加工费",
                "不含税喷涂加工费",
                "不含税坯料加工费",
                "不含税氧化加工费",
                "不含税电泳加工费",
            ],
            vec![
                "测试客户",
                "",
                "",
                "含税",
                "1",
                "2",
                "3",
                "4.5",
                "5.5",
                "6",
                "7",
                "8",
                "9.25",
                "10.75",
            ],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_customer_rows(rows).expect("parse customers");

        assert!(result.errors.is_empty());
        assert_eq!(result.customers.len(), 1);

        let customer = &result.customers[0];
        assert_eq!(customer.oxidation_processing_fee_tax_included_x100, 450);
        assert_eq!(
            customer.electrophoresis_processing_fee_tax_included_x100,
            550
        );
        assert_eq!(customer.oxidation_processing_fee_tax_excluded_x100, 925);
        assert_eq!(
            customer.electrophoresis_processing_fee_tax_excluded_x100,
            1075
        );
    }

    #[test]
    fn parses_customer_import_with_optional_special_pricing() {
        let rows = vec![
            vec![
                "客户名称",
                "默认计价",
                "含税断桥加工费",
                "含税喷涂加工费",
                "含税坯料加工费",
                "含税氧化加工费",
                "含税电泳加工费",
                "不含税断桥加工费",
                "不含税喷涂加工费",
                "不含税坯料加工费",
                "不含税氧化加工费",
                "不含税电泳加工费",
                "特殊计价关键词",
                "特殊含税氧化加工费",
                "特殊含税电泳加工费",
                "特殊不含税氧化加工费",
                "特殊不含税电泳加工费",
            ],
            vec![
                "测试客户",
                "含税",
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
                "沃德虎标膜",
                "11.25",
                "12.5",
                "13.75",
                "14.25",
            ],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_customer_rows(rows).expect("parse customers");

        assert!(result.errors.is_empty());
        assert_eq!(result.customers.len(), 1);

        let customer = &result.customers[0];
        assert_eq!(customer.special_pricing_keyword, "沃德虎标膜");
        assert_eq!(
            customer.special_oxidation_processing_fee_tax_included_x100,
            1125
        );
        assert_eq!(
            customer.special_electrophoresis_processing_fee_tax_included_x100,
            1250
        );
        assert_eq!(
            customer.special_oxidation_processing_fee_tax_excluded_x100,
            1375
        );
        assert_eq!(
            customer.special_electrophoresis_processing_fee_tax_excluded_x100,
            1425
        );
    }

    #[test]
    fn reports_customer_import_row_validation_errors() {
        let rows = vec![
            vec![
                "客户名称",
                "默认计价",
                "含税断桥加工费",
                "含税喷涂加工费",
                "含税坯料加工费",
                "含税氧化加工费",
                "含税电泳加工费",
                "不含税断桥加工费",
                "不含税喷涂加工费",
                "不含税坯料加工费",
                "不含税氧化加工费",
                "不含税电泳加工费",
            ],
            vec![
                "测试客户",
                "未知",
                "abc",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
            ],
            vec![
                "测试客户",
                "含税",
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
                "7",
                "8",
                "9",
                "10",
            ],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_customer_rows(rows).expect("parse customers");

        assert!(result.customers.is_empty());
        assert_eq!(
            result.errors,
            vec![
                "第 2 行：默认计价必须为含税或不含税",
                "第 2 行：含税断桥加工费必须为非负金额",
                "第 3 行：客户名称重复",
            ]
        );
    }

    #[test]
    fn parses_customer_import_money_with_common_units() {
        let rows = vec![
            vec![
                "客户名称",
                "电话",
                "地址",
                "默认计价是否含税",
                "含税断桥加工费",
                "含税喷涂加工费",
                "含税坯料加工费",
                "含税氧化加工费",
                "含税电泳加工费",
                "不含税断桥加工费",
                "不含税喷涂加工费",
                "不含税坯料加工费",
                "不含税氧化加工费",
                "不含税电泳加工费",
            ],
            vec![
                " 单位客户 ",
                " 13800138000 ",
                " 上海 ",
                " 是 ",
                "1,800元/吨",
                "1200元",
                "800",
                "1500.50元／吨",
                "¥1600",
                "1700rmb",
                "1100cny",
                "700元吨",
                "1400",
                "1500",
            ],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_customer_rows(rows).expect("parse customers");

        assert!(result.errors.is_empty());
        assert_eq!(result.customers.len(), 1);
        let customer = &result.customers[0];
        assert_eq!(customer.customer_name, "单位客户");
        assert_eq!(customer.phone, "13800138000");
        assert_eq!(customer.customer_address, "上海");
        assert!(customer.default_pricing_tax_included);
        assert_eq!(customer.bridge_processing_fee_tax_included_x100, 180000);
        assert_eq!(customer.powder_processing_fee_tax_included_x100, 120000);
        assert_eq!(customer.oxidation_processing_fee_tax_included_x100, 150050);
        assert_eq!(customer.bridge_processing_fee_tax_excluded_x100, 170000);
        assert_eq!(customer.powder_processing_fee_tax_excluded_x100, 110000);
        assert_eq!(customer.billet_processing_fee_tax_excluded_x100, 70000);
    }

    #[test]
    fn normalizes_file_urls_for_customer_import() {
        assert_eq!(
            normalize_file_path(" file:///Users/test/%E5%AE%A2%E6%88%B7.csv "),
            "/Users/test/客户.csv"
        );
        assert_eq!(
            normalize_file_path("/Users/test/customers.csv"),
            "/Users/test/customers.csv"
        );
        assert_eq!(
            percent_decode("%E4%B8%8D%E5%AE%8C%E6%95%B4%ZZ"),
            "不完整%ZZ"
        );
    }

    #[test]
    fn customer_id_generation_uses_numeric_suffix() {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.execute_batch(include_str!("../db/migrations/001_init.sql"))
            .expect("run migrations");

        assert_eq!(
            next_customer_id(&conn).expect("first customer id"),
            "CUS-001"
        );

        conn.execute(
            "
            INSERT INTO customers (id, customer_name)
            VALUES
              ('CUS-002', '客户 2'),
              ('LEGACY', '旧客户'),
              ('CUS-010', '客户 10')
            ",
            [],
        )
        .expect("insert customers");

        assert_eq!(
            next_customer_id(&conn).expect("next customer id"),
            "CUS-011"
        );
    }

    #[test]
    fn maps_customer_delete_business_errors_to_stable_codes() {
        assert_eq!(
            map_customer_delete_error("有未下订单引用此客户，不能删除".to_string()),
            CommandError::new(
                "CUSTOMER_HAS_PENDING_ORDERS",
                "有未下订单引用此客户，不能删除"
            )
        );
        assert_eq!(
            map_customer_delete_error("有客户历史库存批次引用此客户，不能删除".to_string()),
            CommandError::new(
                "CUSTOMER_HAS_HISTORICAL_INVENTORY",
                "有客户历史库存批次引用此客户，不能删除"
            )
        );
        assert_eq!(
            map_customer_delete_error("客户不存在".to_string()),
            CommandError::new("CUSTOMER_NOT_FOUND", "客户不存在")
        );
        assert_eq!(
            map_customer_delete_error("database unavailable".to_string()),
            CommandError::new("INTERNAL_ERROR", "database unavailable")
        );
    }

    #[test]
    fn maps_customer_list_errors_to_stable_codes() {
        assert_eq!(
            map_customer_list_error("客户筛选参数无效".to_string()),
            CommandError::new("CUSTOMER_FILTER_INVALID", "客户筛选参数无效")
        );
        assert_eq!(
            map_customer_list_error("failed to query customers".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to query customers")
        );
    }

    #[test]
    fn maps_customer_export_errors_to_stable_codes() {
        assert_eq!(
            map_customer_export_error("客户筛选参数无效".to_string()),
            CommandError::new("CUSTOMER_FILTER_INVALID", "客户筛选参数无效")
        );
        assert_eq!(
            map_customer_export_error("failed to query customers".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to query customers")
        );
    }

    #[test]
    fn delete_customer_rejects_editable_order_references() {
        let mut conn = setup_conn();
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES ('customer-1', '测试客户')",
            [],
        )
        .expect("insert customer");
        conn.execute(
            "
            INSERT INTO orders (id, customer_id, customer_name, status)
            VALUES ('ALU20260623001', 'customer-1', '测试客户', 'saved')
            ",
            [],
        )
        .expect("insert saved order");

        let error = delete_customer_with_connection(&mut conn, "customer-1")
            .expect_err("should reject customer delete");

        assert_eq!(error, "有未下订单引用此客户，不能删除");
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM customers WHERE id = 'customer-1'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("count customer"),
            1
        );
    }

    #[test]
    fn delete_customer_detaches_ordered_snapshots() {
        let mut conn = setup_conn();
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES ('customer-1', '测试客户')",
            [],
        )
        .expect("insert customer");
        conn.execute(
            "
            INSERT INTO orders (id, customer_id, customer_name, status)
            VALUES ('ALU20260623001', 'customer-1', '测试客户快照', 'ordered')
            ",
            [],
        )
        .expect("insert ordered order");

        delete_customer_with_connection(&mut conn, "customer-1").expect("delete customer");

        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM customers WHERE id = 'customer-1'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("count customer"),
            0
        );
        let (customer_id, customer_name): (Option<String>, String) = conn
            .query_row(
                "SELECT customer_id, customer_name FROM orders WHERE id = 'ALU20260623001'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("read ordered order snapshot");

        assert!(customer_id.is_none());
        assert_eq!(customer_name, "测试客户快照");
    }

    #[test]
    fn delete_customer_rejects_historical_inventory_references() {
        let mut conn = setup_conn();
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES ('customer-1', '测试客户')",
            [],
        )
        .expect("insert customer");
        conn.execute(
            "
            INSERT INTO customer_inventory_batches (
              id, customer_id, customer_name, aluminum_ingot_price_x100
            ) VALUES ('KH-20260623001', 'customer-1', '测试客户', 2000000)
            ",
            [],
        )
        .expect("insert historical inventory batch");

        let error = delete_customer_with_connection(&mut conn, "customer-1")
            .expect_err("should reject customer delete");

        assert_eq!(error, "有客户历史库存批次引用此客户，不能删除");
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM customers WHERE id = 'customer-1'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("count customer"),
            1
        );
    }

    #[test]
    fn maps_create_customer_errors_to_stable_codes() {
        let cases = [
            ("客户名称不能为空", "CUSTOMER_NAME_REQUIRED"),
            (
                "含税喷涂加工费不能小于 0",
                "CUSTOMER_PROCESSING_FEE_INVALID",
            ),
            (
                "特殊不含税电泳加工费不能小于 0",
                "CUSTOMER_PROCESSING_FEE_INVALID",
            ),
            (
                "含税加工费未设置，不能选含税",
                "CUSTOMER_INCLUDED_PROCESSING_FEE_REQUIRED",
            ),
            (
                "不含税加工费未设置，不能选不含税",
                "CUSTOMER_EXCLUDED_PROCESSING_FEE_REQUIRED",
            ),
            ("客户名称已存在", "CUSTOMER_NAME_CONFLICT"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_create_customer_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_create_customer_error("failed to write customer".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to write customer")
        );
    }

    #[test]
    fn maps_update_customer_errors_to_stable_codes() {
        let cases = [
            ("客户 ID 不能为空", "CUSTOMER_ID_REQUIRED"),
            ("客户不存在", "CUSTOMER_NOT_FOUND"),
            ("客户名称已存在", "CUSTOMER_NAME_CONFLICT"),
            (
                "特殊喷涂加工费不能小于 0",
                "CUSTOMER_PROCESSING_FEE_INVALID",
            ),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_update_customer_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_update_customer_error("failed to sync editable orders".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to sync editable orders")
        );
    }

    #[test]
    fn maps_import_customer_errors_to_stable_codes() {
        let cases = [
            ("没有可导入的客户", "CUSTOMER_IMPORT_EMPTY"),
            ("第 2 行：客户名称重复", "CUSTOMER_IMPORT_NAME_DUPLICATE"),
            (
                "第 3 行：含税喷涂加工费不能小于 0",
                "CUSTOMER_IMPORT_ROW_INVALID",
            ),
            ("客户名称已存在", "CUSTOMER_IMPORT_NAME_CONFLICT"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_import_customers_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_import_customers_error("failed to commit customer import".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to commit customer import")
        );
    }

    #[test]
    fn maps_customer_import_file_errors_to_stable_codes() {
        let cases = [
            (
                "请选择 CSV、XLSX 或 XLS 文件",
                "CUSTOMER_IMPORT_FILE_TYPE_INVALID",
            ),
            (
                "无法读取文件：文件不存在",
                "CUSTOMER_IMPORT_FILE_READ_FAILED",
            ),
            (
                "无法打开 Excel 文件：格式损坏",
                "CUSTOMER_IMPORT_FILE_READ_FAILED",
            ),
            (
                "无法读取工作表：数据损坏",
                "CUSTOMER_IMPORT_FILE_READ_FAILED",
            ),
            ("Excel 文件没有工作表", "CUSTOMER_IMPORT_WORKSHEET_MISSING"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_customer_import_file_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_customer_import_file_error("failed to parse customers".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to parse customers")
        );
    }
}
