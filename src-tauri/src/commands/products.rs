use calamine::{open_workbook_auto, Data, Reader};
use rusqlite::{params, Connection, OptionalExtension, Params};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use tauri::State;

use crate::commands::error::CommandError;
use crate::db::AppState;

const PRODUCT_FILTER_SQL: &str = "
WHERE products.deleted_at IS NULL
  AND (?1 = '' OR products.product_name LIKE ?2 OR products.mold_code LIKE ?2)
  AND (
    ?3 = ''
    OR EXISTS (
      SELECT 1
      FROM customer_products AS customer_filter
      WHERE customer_filter.product_id = products.id
        AND customer_filter.customer_id = ?3
    )
  )
  AND (
    ?4 = ''
    OR (
      ?4 = 'assigned'
      AND EXISTS (
        SELECT 1
        FROM customer_products AS assigned_filter
        WHERE assigned_filter.product_id = products.id
      )
    )
    OR (
      ?4 = 'unassigned'
      AND NOT EXISTS (
        SELECT 1
        FROM customer_products AS unassigned_filter
        WHERE unassigned_filter.product_id = products.id
      )
    )
  )
";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductSummary {
    id: String,
    product_name: String,
    mold_code: String,
    thickness_mm_x100: i64,
    weight_per_meter_kg_x1000: i64,
    assigned_customer_ids: Vec<String>,
    assigned_customer_names: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProductsParams {
    page: Option<i64>,
    page_size: Option<i64>,
    search: Option<String>,
    customer_id: Option<String>,
    assignment_status: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductListResult {
    products: Vec<ProductSummary>,
    total: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProductsResult {
    products: Vec<ProductSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductIdsResult {
    ids: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductPayload {
    pub product_name: String,
    pub mold_code: String,
    pub thickness_mm_x100: i64,
    pub weight_per_meter_kg_x1000: i64,
    #[serde(default)]
    pub assigned_customer_names: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductPayload {
    id: String,
    product_name: String,
    mold_code: String,
    thickness_mm_x100: i64,
    weight_per_meter_kg_x1000: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProductsPayload {
    products: Vec<CreateProductPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignCustomerProductsPayload {
    customer_id: String,
    product_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetProductCustomersPayload {
    product_id: String,
    customer_ids: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignCustomerProductsResult {
    assigned_count: usize,
    skipped_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProductsResult {
    created_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseProductImportResult {
    pub products: Vec<CreateProductPayload>,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn list_products(
    state: State<'_, AppState>,
    params: Option<ListProductsParams>,
) -> Result<ProductListResult, CommandError> {
    list_products_inner(state, params).map_err(map_product_list_error)
}

fn list_products_inner(
    state: State<'_, AppState>,
    params: Option<ListProductsParams>,
) -> Result<ProductListResult, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let page = params
        .as_ref()
        .and_then(|params| params.page)
        .unwrap_or(1)
        .max(1);
    let page_size = params
        .as_ref()
        .and_then(|params| params.page_size)
        .unwrap_or(20)
        .clamp(10, 1000);
    let offset = (page - 1) * page_size;
    let (search, search_pattern, customer_id, assignment_status) = resolve_product_filters(params)?;
    let count_sql = format!("SELECT COUNT(*) FROM products {PRODUCT_FILTER_SQL}");
    let total = conn
        .query_row(
            &count_sql,
            params![search, search_pattern, customer_id, assignment_status],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to count products: {err}"))?;
    let list_sql = format!(
        "
        SELECT products.id,
               products.product_name,
               products.mold_code,
               products.thickness_mm_x100,
               products.weight_per_meter_kg_x1000,
               COALESCE(GROUP_CONCAT(customer_products.customer_id, '、'), '') AS assigned_customer_ids,
               COALESCE(GROUP_CONCAT(customers.customer_name, '、'), '') AS assigned_customer_names
        FROM products
        LEFT JOIN customer_products ON customer_products.product_id = products.id
        LEFT JOIN customers ON customers.id = customer_products.customer_id
        {PRODUCT_FILTER_SQL}
        GROUP BY products.id
        ORDER BY products.product_name ASC
        LIMIT ?5 OFFSET ?6
        "
    );

    let products = query_products_page(
        &conn,
        &list_sql,
        params![
            search,
            search_pattern,
            customer_id,
            assignment_status,
            page_size,
            offset
        ],
    )?;

    Ok(ProductListResult { products, total })
}

fn map_product_list_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "归属状态参数无效" => "PRODUCT_ASSIGNMENT_STATUS_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn list_product_ids(
    state: State<'_, AppState>,
    params: Option<ListProductsParams>,
) -> Result<ProductIdsResult, CommandError> {
    list_product_ids_inner(state, params).map_err(map_product_id_list_error)
}

fn list_product_ids_inner(
    state: State<'_, AppState>,
    params: Option<ListProductsParams>,
) -> Result<ProductIdsResult, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let (search, search_pattern, customer_id, assignment_status) = resolve_product_filters(params)?;

    let product_ids_sql = format!(
        "
        SELECT products.id
        FROM products
        {PRODUCT_FILTER_SQL}
        ORDER BY products.product_name ASC
        "
    );

    let mut stmt = conn
        .prepare(&product_ids_sql)
        .map_err(|err| format!("failed to prepare product id query: {err}"))?;

    let rows = stmt
        .query_map(
            params![search, search_pattern, customer_id, assignment_status],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to query product ids: {err}"))?;

    let ids = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read product ids: {err}"))?;

    Ok(ProductIdsResult { ids })
}

fn map_product_id_list_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "归属状态参数无效" => "PRODUCT_ASSIGNMENT_STATUS_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn export_products(
    state: State<'_, AppState>,
    params: Option<ListProductsParams>,
) -> Result<ExportProductsResult, CommandError> {
    export_products_inner(state, params).map_err(map_product_export_error)
}

fn export_products_inner(
    state: State<'_, AppState>,
    params: Option<ListProductsParams>,
) -> Result<ExportProductsResult, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let (search, search_pattern, customer_id, assignment_status) = resolve_product_filters(params)?;
    let export_sql = format!(
        "
        SELECT products.id,
               products.product_name,
               products.mold_code,
               products.thickness_mm_x100,
               products.weight_per_meter_kg_x1000,
               COALESCE(GROUP_CONCAT(customer_products.customer_id, '、'), '') AS assigned_customer_ids,
               COALESCE(GROUP_CONCAT(customers.customer_name, '、'), '') AS assigned_customer_names
        FROM products
        LEFT JOIN customer_products ON customer_products.product_id = products.id
        LEFT JOIN customers ON customers.id = customer_products.customer_id
        {PRODUCT_FILTER_SQL}
        GROUP BY products.id
        ORDER BY products.product_name ASC
        "
    );
    let products = query_products_page(
        &conn,
        &export_sql,
        params![search, search_pattern, customer_id, assignment_status],
    )?;

    Ok(ExportProductsResult { products })
}

fn map_product_export_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "归属状态参数无效" => "PRODUCT_ASSIGNMENT_STATUS_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

fn query_products_page<P>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> Result<Vec<ProductSummary>, String>
where
    P: Params,
{
    let mut stmt = conn
        .prepare(sql)
        .map_err(|err| format!("failed to prepare product query: {err}"))?;

    let rows = stmt
        .query_map(params, |row| {
            Ok(ProductSummary {
                id: row.get(0)?,
                product_name: row.get(1)?,
                mold_code: row.get(2)?,
                thickness_mm_x100: row.get(3)?,
                weight_per_meter_kg_x1000: row.get(4)?,
                assigned_customer_ids: parse_delimited_values(row.get(5)?),
                assigned_customer_names: parse_delimited_values(row.get(6)?),
            })
        })
        .map_err(|err| format!("failed to query products: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read products: {err}"))
}

fn resolve_product_filters(
    params: Option<ListProductsParams>,
) -> Result<(String, String, String, String), String> {
    let params = params.unwrap_or(ListProductsParams {
        assignment_status: None,
        customer_id: None,
        page: None,
        page_size: None,
        search: None,
    });
    let search = params.search.unwrap_or_default().trim().to_string();
    let customer_id = params.customer_id.unwrap_or_default().trim().to_string();
    let assignment_status = params
        .assignment_status
        .unwrap_or_default()
        .trim()
        .to_string();

    if !matches!(assignment_status.as_str(), "" | "assigned" | "unassigned") {
        return Err("归属状态参数无效".to_string());
    }

    let search_pattern = format!("%{search}%");

    Ok((search, search_pattern, customer_id, assignment_status))
}

#[tauri::command]
pub fn create_product(
    state: State<'_, AppState>,
    payload: CreateProductPayload,
) -> Result<ProductSummary, CommandError> {
    create_product_inner(state, payload).map_err(map_create_product_error)
}

fn create_product_inner(
    state: State<'_, AppState>,
    payload: CreateProductPayload,
) -> Result<ProductSummary, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let (product_name, mold_code) = validate_create_product(&payload)?;

    let id = next_product_id(&conn)?;

    conn.execute(
        "
        INSERT INTO products (
          id,
          product_name,
          mold_code,
          thickness_mm_x100,
          weight_per_meter_kg_x1000,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ",
        params![
            id,
            product_name,
            mold_code,
            payload.thickness_mm_x100,
            payload.weight_per_meter_kg_x1000
        ],
    )
    .map_err(map_product_write_error)?;

    Ok(ProductSummary {
        id,
        product_name: product_name.to_string(),
        mold_code: mold_code.to_string(),
        thickness_mm_x100: payload.thickness_mm_x100,
        weight_per_meter_kg_x1000: payload.weight_per_meter_kg_x1000,
        assigned_customer_ids: Vec::new(),
        assigned_customer_names: Vec::new(),
    })
}

fn map_create_product_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "商品名称不能为空" => "PRODUCT_NAME_REQUIRED",
        "模具编号不能为空" => "PRODUCT_MOLD_CODE_REQUIRED",
        "厚度必须大于 0" => "PRODUCT_THICKNESS_INVALID",
        "米重必须大于 0" => "PRODUCT_WEIGHT_PER_METER_INVALID",
        "商品名称已存在" => "PRODUCT_NAME_CONFLICT",
        "模具编号已存在" => "PRODUCT_MOLD_CODE_CONFLICT",
        "商品引用的数据不存在" => "PRODUCT_REFERENCE_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn import_products(
    state: State<'_, AppState>,
    payload: ImportProductsPayload,
) -> Result<ImportProductsResult, CommandError> {
    import_products_inner(state, payload).map_err(map_import_products_error)
}

fn import_products_inner(
    state: State<'_, AppState>,
    payload: ImportProductsPayload,
) -> Result<ImportProductsResult, String> {
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    import_products_with_connection(&mut conn, payload)
}

fn map_import_products_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "没有可导入的商品" => "PRODUCT_IMPORT_EMPTY",
        "商品名称已存在" => "PRODUCT_IMPORT_NAME_CONFLICT",
        "模具编号已存在" => "PRODUCT_IMPORT_MOLD_CODE_CONFLICT",
        "商品引用的数据不存在" => "PRODUCT_IMPORT_REFERENCE_NOT_FOUND",
        "商品名称不能为空" | "模具编号不能为空" | "厚度必须大于 0" | "米重必须大于 0" => {
            "PRODUCT_IMPORT_ROW_INVALID"
        }
        _ if message.starts_with("第 ")
            && message.contains("商品名称“")
            && message.ends_with("”在导入文件中重复") =>
        {
            "PRODUCT_IMPORT_NAME_DUPLICATE"
        }
        _ if message.starts_with("第 ")
            && message.contains("模具编号“")
            && message.ends_with("”在导入文件中重复") =>
        {
            "PRODUCT_IMPORT_MOLD_CODE_DUPLICATE"
        }
        _ if message.starts_with("第 ")
            && message.contains("商品名称“")
            && message.ends_with("”已存在于系统商品资料中") =>
        {
            "PRODUCT_IMPORT_NAME_CONFLICT"
        }
        _ if message.starts_with("第 ")
            && message.contains("模具编号“")
            && message.ends_with("”已存在于系统商品资料中") =>
        {
            "PRODUCT_IMPORT_MOLD_CODE_CONFLICT"
        }
        _ if message.starts_with("第 ") && message.contains("：归属客户不存在：") => {
            "PRODUCT_IMPORT_CUSTOMER_NOT_FOUND"
        }
        _ if message.starts_with("第 ") => "PRODUCT_IMPORT_ROW_INVALID",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

fn import_products_with_connection(
    conn: &mut Connection,
    payload: ImportProductsPayload,
) -> Result<ImportProductsResult, String> {
    if payload.products.is_empty() {
        return Err("没有可导入的商品".to_string());
    }

    let mut product_keys = HashSet::new();
    let mut mold_keys = HashSet::new();
    let mut customer_name_keys = HashSet::new();

    for (index, product) in payload.products.iter().enumerate() {
        let (product_name, mold_code) = validate_create_product(product)
            .map_err(|message| format!("第 {} 行：{message}", index + 1))?;

        if !product_keys.insert(product_name.to_string()) {
            return Err(format!(
                "第 {} 行：商品名称“{}”在导入文件中重复",
                index + 1,
                product_name
            ));
        }

        if !mold_keys.insert(mold_code.to_string()) {
            return Err(format!(
                "第 {} 行：模具编号“{}”在导入文件中重复",
                index + 1,
                mold_code
            ));
        }

        for customer_name in &product.assigned_customer_names {
            customer_name_keys.insert(customer_name.trim().to_string());
        }
    }

    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start product import transaction: {err}"))?;
    for (index, product) in payload.products.iter().enumerate() {
        let (product_name, mold_code) = validate_create_product(product)?;

        if product_unique_value_exists(&tx, "product_name", product_name)? {
            return Err(format!(
                "第 {} 行：商品名称“{}”已存在于系统商品资料中",
                index + 1,
                product_name
            ));
        }

        if product_unique_value_exists(&tx, "mold_code", mold_code)? {
            return Err(format!(
                "第 {} 行：模具编号“{}”已存在于系统商品资料中",
                index + 1,
                mold_code
            ));
        }
    }

    let customer_ids_by_name = query_customer_ids_by_name(
        &tx,
        customer_name_keys
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .as_slice(),
    )?;
    for (index, product) in payload.products.iter().enumerate() {
        for customer_name in &product.assigned_customer_names {
            if !customer_ids_by_name.contains_key(customer_name.trim()) {
                return Err(format!(
                    "第 {} 行：归属客户不存在：{}",
                    index + 1,
                    customer_name.trim()
                ));
            }
        }
    }

    for (next_number, product) in (next_product_number(&tx)?..).zip(payload.products.iter()) {
        let (product_name, mold_code) = validate_create_product(product)?;
        let id = format_product_id(next_number);

        tx.execute(
            "
            INSERT INTO products (
              id,
              product_name,
              mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000,
              created_at,
              updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ",
            params![
                id,
                product_name,
                mold_code,
                product.thickness_mm_x100,
                product.weight_per_meter_kg_x1000
            ],
        )
        .map_err(map_product_write_error)?;

        for customer_name in &product.assigned_customer_names {
            let customer_id = customer_ids_by_name
                .get(customer_name.trim())
                .expect("customer names were validated before product import");

            tx.execute(
                "
                INSERT OR IGNORE INTO customer_products (customer_id, product_id, created_at)
                VALUES (?1, ?2, CURRENT_TIMESTAMP)
                ",
                params![customer_id, &id],
            )
            .map_err(|err| format!("failed to assign imported product customer: {err}"))?;
        }
    }

    tx.commit()
        .map_err(|err| format!("failed to commit product import: {err}"))?;

    Ok(ImportProductsResult {
        created_count: payload.products.len(),
    })
}

#[tauri::command]
pub fn parse_product_import_file(path: String) -> Result<ParseProductImportResult, CommandError> {
    parse_product_import_file_inner(path).map_err(map_product_import_file_error)
}

fn parse_product_import_file_inner(path: String) -> Result<ParseProductImportResult, String> {
    let normalized_path = normalize_file_path(&path);
    let file_path = Path::new(&normalized_path);
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match extension.as_str() {
        "csv" => parse_product_rows(read_csv_rows(file_path)?),
        "xlsx" | "xls" => parse_product_rows(read_excel_rows(file_path)?),
        _ => Err("请选择 CSV、XLSX 或 XLS 文件".to_string()),
    }
}

fn map_product_import_file_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择 CSV、XLSX 或 XLS 文件" => "PRODUCT_IMPORT_FILE_TYPE_INVALID",
        "Excel 文件没有工作表" => "PRODUCT_IMPORT_WORKSHEET_MISSING",
        _ if message.starts_with("无法读取文件：")
            || message.starts_with("无法打开 Excel 文件：")
            || message.starts_with("无法读取工作表：") =>
        {
            "PRODUCT_IMPORT_FILE_READ_FAILED"
        }
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn update_product(
    state: State<'_, AppState>,
    payload: UpdateProductPayload,
) -> Result<ProductSummary, CommandError> {
    update_product_inner(state, payload).map_err(map_update_product_error)
}

fn update_product_inner(
    state: State<'_, AppState>,
    payload: UpdateProductPayload,
) -> Result<ProductSummary, String> {
    let id = payload.id.trim();
    let product_name = payload.product_name.trim();
    let mold_code = payload.mold_code.trim();

    if id.is_empty() {
        return Err("商品 ID 不能为空".to_string());
    }

    if product_name.is_empty() {
        return Err("商品名称不能为空".to_string());
    }

    if mold_code.is_empty() {
        return Err("模具编号不能为空".to_string());
    }

    if payload.thickness_mm_x100 <= 0 {
        return Err("厚度必须大于 0".to_string());
    }

    if payload.weight_per_meter_kg_x1000 <= 0 {
        return Err("米重必须大于 0".to_string());
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start product update transaction: {err}"))?;

    let updated_count = tx
        .execute(
            "
            UPDATE products
            SET product_name = ?2,
                mold_code = ?3,
                thickness_mm_x100 = ?4,
                weight_per_meter_kg_x1000 = ?5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
              AND deleted_at IS NULL
            ",
            params![
                id,
                product_name,
                mold_code,
                payload.thickness_mm_x100,
                payload.weight_per_meter_kg_x1000
            ],
        )
        .map_err(map_product_write_error)?;

    if updated_count == 0 {
        return Err("商品不存在".to_string());
    }

    tx.execute(
        "
        UPDATE order_items
        SET product_name = ?2,
            product_mold_code = ?3,
            thickness_mm_x100 = ?4,
            weight_per_meter_kg_x1000 = ?5,
            theoretical_weight_kg_x100 = CAST(
              ROUND((length_mm / 1000.0) * quantity * (?5 / 10.0))
              AS INTEGER
            )
        WHERE product_id = ?1
          AND order_id IN (
            SELECT id
            FROM orders
            WHERE status IN ('editing', 'saved')
          )
        ",
        params![
            id,
            product_name,
            mold_code,
            payload.thickness_mm_x100,
            payload.weight_per_meter_kg_x1000
        ],
    )
    .map_err(|err| format!("failed to sync editable order items: {err}"))?;

    tx.commit()
        .map_err(|err| format!("failed to commit product update: {err}"))?;

    Ok(ProductSummary {
        id: id.to_string(),
        product_name: product_name.to_string(),
        mold_code: mold_code.to_string(),
        thickness_mm_x100: payload.thickness_mm_x100,
        weight_per_meter_kg_x1000: payload.weight_per_meter_kg_x1000,
        assigned_customer_ids: query_assigned_customer_ids(&conn, id)?,
        assigned_customer_names: query_assigned_customer_names(&conn, id)?,
    })
}

fn map_update_product_error(message: String) -> CommandError {
    match message.as_str() {
        "商品 ID 不能为空" => CommandError::new("PRODUCT_ID_REQUIRED", message),
        "商品不存在" => CommandError::new("PRODUCT_NOT_FOUND", message),
        _ => map_create_product_error(message),
    }
}

#[tauri::command]
pub fn assign_customer_products(
    state: State<'_, AppState>,
    payload: AssignCustomerProductsPayload,
) -> Result<AssignCustomerProductsResult, CommandError> {
    assign_customer_products_inner(state, payload).map_err(map_assign_customer_products_error)
}

fn assign_customer_products_inner(
    state: State<'_, AppState>,
    payload: AssignCustomerProductsPayload,
) -> Result<AssignCustomerProductsResult, String> {
    let customer_id = payload.customer_id.trim();
    let product_ids = payload
        .product_ids
        .iter()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
        .collect::<Vec<_>>();

    if customer_id.is_empty() {
        return Err("请选择客户".to_string());
    }

    if product_ids.is_empty() {
        return Err("请选择商品".to_string());
    }

    let mut unique_ids = HashSet::new();
    for product_id in &product_ids {
        if !unique_ids.insert(product_id.to_string()) {
            return Err("分配列表中存在重复商品".to_string());
        }
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start product assignment transaction: {err}"))?;

    ensure_customer_exists(&tx, customer_id)?;

    let mut assigned_count = 0;

    for product_id in &product_ids {
        ensure_product_exists(&tx, product_id)?;
        assigned_count += tx
            .execute(
                "
            INSERT OR IGNORE INTO customer_products (customer_id, product_id, created_at)
            VALUES (?1, ?2, CURRENT_TIMESTAMP)
            ",
                params![customer_id, product_id],
            )
            .map_err(|err| format!("failed to assign customer product: {err}"))?;
    }

    let skipped_count = product_ids.len() - assigned_count;

    tx.commit()
        .map_err(|err| format!("failed to commit product assignment: {err}"))?;

    Ok(AssignCustomerProductsResult {
        assigned_count,
        skipped_count,
    })
}

fn map_assign_customer_products_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择客户" => "PRODUCT_ASSIGN_CUSTOMER_REQUIRED",
        "请选择商品" => "PRODUCT_ASSIGN_PRODUCTS_REQUIRED",
        "分配列表中存在重复商品" => "PRODUCT_ASSIGNMENT_DUPLICATE_PRODUCT",
        "选择的客户不存在" => "CUSTOMER_NOT_FOUND",
        "商品不存在" => "PRODUCT_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn set_product_customers(
    state: State<'_, AppState>,
    payload: SetProductCustomersPayload,
) -> Result<ProductSummary, CommandError> {
    set_product_customers_inner(state, payload).map_err(map_set_product_customers_error)
}

fn set_product_customers_inner(
    state: State<'_, AppState>,
    payload: SetProductCustomersPayload,
) -> Result<ProductSummary, String> {
    let product_id = payload.product_id.trim();

    if product_id.is_empty() {
        return Err("商品 ID 不能为空".to_string());
    }

    let mut customer_ids = Vec::new();
    let mut unique_ids = HashSet::new();

    for customer_id in payload
        .customer_ids
        .iter()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
    {
        if unique_ids.insert(customer_id.to_string()) {
            customer_ids.push(customer_id.to_string());
        }
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start product customer update transaction: {err}"))?;

    ensure_product_exists(&tx, product_id)?;

    for customer_id in &customer_ids {
        ensure_customer_exists(&tx, customer_id)?;
    }

    tx.execute(
        "DELETE FROM customer_products WHERE product_id = ?1",
        [product_id],
    )
    .map_err(|err| format!("failed to replace product customers: {err}"))?;

    for customer_id in &customer_ids {
        tx.execute(
            "
            INSERT INTO customer_products (customer_id, product_id, created_at)
            VALUES (?1, ?2, CURRENT_TIMESTAMP)
            ",
            params![customer_id, product_id],
        )
        .map_err(|err| format!("failed to set product customer: {err}"))?;
    }

    tx.execute(
        "UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        [product_id],
    )
    .map_err(|err| format!("failed to touch product: {err}"))?;

    tx.commit()
        .map_err(|err| format!("failed to commit product customer update: {err}"))?;

    query_product_summary_by_id(&conn, product_id)
}

fn map_set_product_customers_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "商品 ID 不能为空" => "PRODUCT_ID_REQUIRED",
        "商品不存在" => "PRODUCT_NOT_FOUND",
        "选择的客户不存在" => "CUSTOMER_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn delete_product(state: State<'_, AppState>, id: String) -> Result<(), CommandError> {
    let id = id.trim();

    if id.is_empty() {
        return Err(CommandError::new("PRODUCT_ID_REQUIRED", "商品 ID 不能为空"));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;
    delete_product_with_connection(&mut conn, id).map_err(map_product_delete_error)
}

fn map_product_delete_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "有未下订单引用此商品，不能删除" => "PRODUCT_HAS_PENDING_ORDERS",
        "商品不存在" => "PRODUCT_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

fn delete_product_with_connection(conn: &mut Connection, id: &str) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start product delete transaction: {err}"))?;

    ensure_product_is_deletable(&tx, id)?;

    tx.execute("DELETE FROM customer_products WHERE product_id = ?1", [id])
        .map_err(|err| format!("failed to detach product assignments: {err}"))?;

    let deleted_count = tx
        .execute(
            "
            UPDATE products
            SET deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
              AND deleted_at IS NULL
            ",
            [id],
        )
        .map_err(|err| format!("failed to delete product: {err}"))?;

    if deleted_count == 0 {
        return Err("商品不存在".to_string());
    }

    tx.commit()
        .map_err(|err| format!("failed to commit product delete: {err}"))?;

    Ok(())
}

fn ensure_product_is_deletable(conn: &Connection, id: &str) -> Result<(), String> {
    let editable_item_count: i64 = conn
        .query_row(
            "
            SELECT COUNT(*)
            FROM order_items
            INNER JOIN orders ON orders.id = order_items.order_id
            WHERE order_items.product_id = ?1
              AND orders.status IN ('editing', 'saved')
            ",
            [id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to check product references: {err}"))?;

    if editable_item_count > 0 {
        return Err("有未下订单引用此商品，不能删除".to_string());
    }

    Ok(())
}

fn validate_create_product(payload: &CreateProductPayload) -> Result<(&str, &str), String> {
    let product_name = payload.product_name.trim();
    let mold_code = payload.mold_code.trim();

    if product_name.is_empty() {
        return Err("商品名称不能为空".to_string());
    }

    if mold_code.is_empty() {
        return Err("模具编号不能为空".to_string());
    }

    if payload.thickness_mm_x100 <= 0 {
        return Err("厚度必须大于 0".to_string());
    }

    if payload.weight_per_meter_kg_x1000 <= 0 {
        return Err("米重必须大于 0".to_string());
    }

    Ok((product_name, mold_code))
}

fn ensure_customer_exists(conn: &Connection, customer_id: &str) -> Result<(), String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM customers WHERE id = ?1",
            [customer_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to validate customer: {err}"))?;

    if count == 0 {
        return Err("选择的客户不存在".to_string());
    }

    Ok(())
}

fn ensure_product_exists(conn: &Connection, product_id: &str) -> Result<(), String> {
    let count: i64 = conn
        .query_row(
            "
            SELECT COUNT(*)
            FROM products
            WHERE id = ?1
              AND deleted_at IS NULL
            ",
            [product_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to validate product: {err}"))?;

    if count == 0 {
        return Err("商品不存在".to_string());
    }

    Ok(())
}

fn query_assigned_customer_names(
    conn: &Connection,
    product_id: &str,
) -> Result<Vec<String>, String> {
    let names = conn
        .query_row(
            "
            SELECT COALESCE(GROUP_CONCAT(customers.customer_name, '、'), '')
            FROM customer_products
            INNER JOIN customers ON customers.id = customer_products.customer_id
            WHERE customer_products.product_id = ?1
            ",
            [product_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to read product assignments: {err}"))?;

    Ok(parse_delimited_values(names))
}

fn query_assigned_customer_ids(conn: &Connection, product_id: &str) -> Result<Vec<String>, String> {
    let ids = conn
        .query_row(
            "
            SELECT COALESCE(GROUP_CONCAT(customer_id, '、'), '')
            FROM customer_products
            WHERE product_id = ?1
            ",
            [product_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to read product assignment ids: {err}"))?;

    Ok(parse_delimited_values(ids))
}

fn query_product_summary_by_id(
    conn: &Connection,
    product_id: &str,
) -> Result<ProductSummary, String> {
    conn.query_row(
        "
        SELECT products.id,
               products.product_name,
               products.mold_code,
               products.thickness_mm_x100,
               products.weight_per_meter_kg_x1000,
               COALESCE(GROUP_CONCAT(customer_products.customer_id, '、'), '') AS assigned_customer_ids,
               COALESCE(GROUP_CONCAT(customers.customer_name, '、'), '') AS assigned_customer_names
        FROM products
        LEFT JOIN customer_products ON customer_products.product_id = products.id
        LEFT JOIN customers ON customers.id = customer_products.customer_id
        WHERE products.id = ?1
          AND products.deleted_at IS NULL
        GROUP BY products.id
        ",
        [product_id],
        |row| {
            Ok(ProductSummary {
                id: row.get(0)?,
                product_name: row.get(1)?,
                mold_code: row.get(2)?,
                thickness_mm_x100: row.get(3)?,
                weight_per_meter_kg_x1000: row.get(4)?,
                assigned_customer_ids: parse_delimited_values(row.get(5)?),
                assigned_customer_names: parse_delimited_values(row.get(6)?),
            })
        },
    )
    .map_err(|err| format!("failed to read product: {err}"))
}

fn parse_delimited_values(values: String) -> Vec<String> {
    if values.is_empty() {
        return Vec::new();
    }

    values.split('、').map(ToOwned::to_owned).collect()
}

fn parse_customer_names(value: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut seen = HashSet::new();

    for name in value
        .split(['、', ',', '，', ';', '；', '\n', '\r'])
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .filter(|name| !matches!(*name, "未分配客户" | "未分配" | "无" | "-"))
    {
        if seen.insert(name.to_string()) {
            names.push(name.to_string());
        }
    }

    names
}

fn query_customer_ids_by_name(
    conn: &Connection,
    customer_names: &[&str],
) -> Result<HashMap<String, String>, String> {
    let mut ids_by_name = HashMap::new();

    for customer_name in customer_names
        .iter()
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
    {
        let customer_id = conn
            .query_row(
                "SELECT id FROM customers WHERE customer_name = ?1",
                [customer_name],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|err| format!("failed to resolve customer by name: {err}"))?;

        if let Some(customer_id) = customer_id {
            ids_by_name.insert(customer_name.to_string(), customer_id);
        }
    }

    Ok(ids_by_name)
}

fn product_unique_value_exists(
    conn: &Connection,
    column_name: &str,
    value: &str,
) -> Result<bool, String> {
    debug_assert!(matches!(column_name, "product_name" | "mold_code"));

    conn.query_row(
        &format!(
            "
        SELECT EXISTS(
          SELECT 1
          FROM products
          WHERE {column_name} = ?1
            AND deleted_at IS NULL
        )
        "
        ),
        [value],
        |row| row.get::<_, bool>(0),
    )
    .map_err(|err| format!("failed to check product unique value: {err}"))
}

fn next_product_id(conn: &Connection) -> Result<String, String> {
    Ok(format_product_id(next_product_number(conn)?))
}

fn next_product_number(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "
        SELECT COALESCE(MAX(CAST(substr(id, 6) AS INTEGER)), 0) + 1
        FROM products
        WHERE id LIKE 'PROD-%'
        ",
        [],
        |row| row.get(0),
    )
    .map_err(|err| format!("failed to resolve next product id: {err}"))
}

fn format_product_id(number: i64) -> String {
    format!("PROD-{number:03}")
}

fn map_product_write_error(err: rusqlite::Error) -> String {
    let message = err.to_string();
    if message.contains("idx_products_product_name_unique")
        || message.contains("products.product_name")
    {
        "商品名称已存在".to_string()
    } else if message.contains("idx_products_mold_code_unique")
        || message.contains("products.mold_code")
    {
        "模具编号已存在".to_string()
    } else if message.contains("FOREIGN KEY") {
        "商品引用的数据不存在".to_string()
    } else {
        format!("failed to write product: {err}")
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

fn parse_product_rows(rows: Vec<Vec<String>>) -> Result<ParseProductImportResult, String> {
    let mut errors = Vec::new();

    if rows.len() < 2 {
        return Ok(ParseProductImportResult {
            products: Vec::new(),
            errors: vec!["文件至少需要表头和一行数据".to_string()],
        });
    }

    let product_name_candidates = ["商品名称", "名称", "productName", "name"];
    let mold_code_candidates = ["模具编号", "型号", "moldCode", "model"];
    let thickness_candidates = ["厚度", "厚度mm", "thickness", "thicknessmm"];
    let weight_candidates = ["米重", "米重kgm", "米重kg/m", "weight", "weightpermeterkg"];
    let assigned_customer_candidates = [
        "归属客户",
        "客户",
        "客户名称",
        "assignedCustomers",
        "assignedCustomerNames",
        "customers",
        "customerNames",
    ];
    let header_row_index = find_best_header_row_index(
        &rows,
        &[
            &product_name_candidates,
            &mold_code_candidates,
            &thickness_candidates,
            &weight_candidates,
        ],
    );
    let headers = rows[header_row_index]
        .iter()
        .map(|header| normalize_header(header))
        .collect::<Vec<_>>();

    let product_name_index = find_header_index(&headers, &product_name_candidates);
    let mold_code_index = find_header_index(&headers, &mold_code_candidates);
    let thickness_index = find_header_index(&headers, &thickness_candidates);
    let weight_index = find_header_index(&headers, &weight_candidates);
    let assigned_customer_index = find_header_index(&headers, &assigned_customer_candidates);

    if product_name_index.is_none() {
        errors.push("缺少商品名称列".to_string());
    }
    if mold_code_index.is_none() {
        errors.push("缺少模具编号列".to_string());
    }
    if thickness_index.is_none() {
        errors.push("缺少厚度列".to_string());
    }
    if weight_index.is_none() {
        errors.push("缺少米重列".to_string());
    }

    if !errors.is_empty() {
        return Ok(ParseProductImportResult {
            products: Vec::new(),
            errors,
        });
    }

    let (
        Some(product_name_index),
        Some(mold_code_index),
        Some(thickness_index),
        Some(weight_index),
    ) = (
        product_name_index,
        mold_code_index,
        thickness_index,
        weight_index,
    )
    else {
        return Ok(ParseProductImportResult {
            products: Vec::new(),
            errors,
        });
    };
    let mut products = Vec::new();
    let mut product_names = HashSet::new();
    let mut mold_codes = HashSet::new();

    for (index, row) in rows.iter().enumerate().skip(header_row_index + 1) {
        if row.iter().all(|value| value.trim().is_empty()) {
            continue;
        }

        let row_number = index + 1;
        let product_name = row
            .get(product_name_index)
            .map(|value| value.trim())
            .unwrap_or("");
        let mold_code = row
            .get(mold_code_index)
            .map(|value| value.trim())
            .unwrap_or("");
        let thickness_mm = row
            .get(thickness_index)
            .and_then(|value| parse_positive_number(value));
        let weight_per_meter_kg = row
            .get(weight_index)
            .and_then(|value| parse_positive_number(value));
        let assigned_customer_names = assigned_customer_index
            .and_then(|index| row.get(index))
            .map(|value| parse_customer_names(value))
            .unwrap_or_default();

        if product_name.is_empty() {
            errors.push(format!("第 {row_number} 行：商品名称不能为空"));
        }
        if mold_code.is_empty() {
            errors.push(format!("第 {row_number} 行：模具编号不能为空"));
        }
        if thickness_mm.is_none() {
            errors.push(format!("第 {row_number} 行：厚度必须大于 0"));
        }
        if weight_per_meter_kg.is_none() {
            errors.push(format!("第 {row_number} 行：米重必须大于 0"));
        }
        if !product_name.is_empty() && !product_names.insert(product_name.to_string()) {
            errors.push(format!(
                "第 {row_number} 行：商品名称“{product_name}”在导入文件中重复"
            ));
        }
        if !mold_code.is_empty() && !mold_codes.insert(mold_code.to_string()) {
            errors.push(format!(
                "第 {row_number} 行：模具编号“{mold_code}”在导入文件中重复"
            ));
        }

        products.push(CreateProductPayload {
            product_name: product_name.to_string(),
            mold_code: mold_code.to_string(),
            thickness_mm_x100: (thickness_mm.unwrap_or_default() * 100.0).round() as i64,
            weight_per_meter_kg_x1000: (weight_per_meter_kg.unwrap_or_default() * 1000.0).round()
                as i64,
            assigned_customer_names,
        });
    }

    Ok(ParseProductImportResult {
        products: if errors.is_empty() {
            products
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

fn parse_positive_number(value: &str) -> Option<f64> {
    let normalized = value.trim().replace(',', "");
    let (number_text, unit_text) = split_number_and_unit(&normalized)?;
    let number = number_text.parse::<f64>().ok()?;
    let unit = unit_text.trim().to_lowercase();

    if !unit.is_empty()
        && !matches!(
            unit.as_str(),
            "mm" | "毫米" | "kg/m" | "kg／m" | "kgm" | "kg每米" | "公斤/米" | "公斤／米"
        )
    {
        return None;
    }

    if number.is_finite() && number > 0.0 {
        Some(number)
    } else {
        None
    }
}

fn split_number_and_unit(value: &str) -> Option<(&str, &str)> {
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

    fn insert_customer_and_product(conn: &Connection) {
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES ('customer-1', '测试客户')",
            [],
        )
        .expect("insert customer");
        conn.execute(
            "
            INSERT INTO products (
              id,
              product_name,
              mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000
            ) VALUES ('product-1', '测试商品', 'M001', 120, 2500)
            ",
            [],
        )
        .expect("insert product");
        conn.execute(
            "INSERT INTO customer_products (customer_id, product_id) VALUES ('customer-1', 'product-1')",
            [],
        )
        .expect("assign product");
    }

    #[test]
    fn parses_product_import_rows_with_alias_headers() {
        let rows = vec![
            vec!["name", "model", "thickness", "weightPerMeterKg"],
            vec![" 70 边框 ", " G5501 ", "1.25", "2.345"],
            vec!["白色边框", "G5502", "1", "2"],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_product_rows(rows).expect("parse products");

        assert!(result.errors.is_empty());
        assert_eq!(result.products.len(), 2);
        assert_eq!(result.products[0].product_name, "70 边框");
        assert_eq!(result.products[0].mold_code, "G5501");
        assert_eq!(result.products[0].thickness_mm_x100, 125);
        assert_eq!(result.products[0].weight_per_meter_kg_x1000, 2345);
        assert_eq!(result.products[1].thickness_mm_x100, 100);
        assert_eq!(result.products[1].weight_per_meter_kg_x1000, 2000);
    }

    #[test]
    fn reports_product_import_row_validation_errors() {
        let rows = vec![
            vec!["商品名称", "模具编号", "厚度", "米重"],
            vec!["70 边框", "G5501", "0", "abc"],
            vec!["70 边框", "G5501", "1.2", "2.3"],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_product_rows(rows).expect("parse products");

        assert!(result.products.is_empty());
        assert_eq!(
            result.errors,
            vec![
                "第 2 行：厚度必须大于 0",
                "第 2 行：米重必须大于 0",
                "第 3 行：商品名称“70 边框”在导入文件中重复",
                "第 3 行：模具编号“G5501”在导入文件中重复",
            ]
        );
    }

    #[test]
    fn parses_product_import_numbers_with_units() {
        let rows = vec![
            vec![" 商品名称 ", " 型号 ", " 厚度(mm) ", " 米重(kg/m) "],
            vec![" 90 转角 ", " G9001 ", "1.20mm", "2.500kg/m"],
            vec!["100 扇料", "G9002", "1毫米", "1,234.5kg/m"],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_product_rows(rows).expect("parse products");

        assert!(result.errors.is_empty());
        assert_eq!(result.products.len(), 2);
        assert_eq!(result.products[0].thickness_mm_x100, 120);
        assert_eq!(result.products[0].weight_per_meter_kg_x1000, 2500);
        assert_eq!(result.products[1].thickness_mm_x100, 100);
        assert_eq!(result.products[1].weight_per_meter_kg_x1000, 1_234_500);
    }

    #[test]
    fn parses_product_import_with_assigned_customers() {
        let rows = vec![
            vec!["商品名称", "模具编号", "厚度(mm)", "米重(kg/m)", "归属客户"],
            vec!["90 转角", "G9001", "1.20mm", "2.500kg/m", "客户 A、客户 B"],
            vec!["100 扇料", "G9002", "1.00mm", "2.000kg/m", "未分配客户"],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_product_rows(rows).expect("parse products");

        assert!(result.errors.is_empty());
        assert_eq!(
            result.products[0].assigned_customer_names,
            vec!["客户 A".to_string(), "客户 B".to_string()]
        );
        assert!(result.products[1].assigned_customer_names.is_empty());
    }

    #[test]
    fn imports_products_with_assigned_customers() {
        let mut conn = setup_conn();
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES ('customer-1', '客户 A')",
            [],
        )
        .expect("insert first customer");
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES ('customer-2', '客户 B')",
            [],
        )
        .expect("insert second customer");

        let result = import_products_with_connection(
            &mut conn,
            ImportProductsPayload {
                products: vec![CreateProductPayload {
                    assigned_customer_names: vec!["客户 A".to_string(), "客户 B".to_string()],
                    mold_code: "G9001".to_string(),
                    product_name: "90 转角".to_string(),
                    thickness_mm_x100: 120,
                    weight_per_meter_kg_x1000: 2500,
                }],
            },
        )
        .expect("import products");

        assert_eq!(result.created_count, 1);
        let assigned_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM customer_products WHERE product_id = 'PROD-001'",
                [],
                |row| row.get(0),
            )
            .expect("count assignments");
        assert_eq!(assigned_count, 2);
    }

    #[test]
    fn rejects_product_import_with_missing_assigned_customer() {
        let mut conn = setup_conn();
        conn.execute(
            "INSERT INTO customers (id, customer_name) VALUES ('customer-1', '客户 A')",
            [],
        )
        .expect("insert customer");

        let error = match import_products_with_connection(
            &mut conn,
            ImportProductsPayload {
                products: vec![CreateProductPayload {
                    assigned_customer_names: vec!["客户 A".to_string(), "客户 B".to_string()],
                    mold_code: "G9001".to_string(),
                    product_name: "90 转角".to_string(),
                    thickness_mm_x100: 120,
                    weight_per_meter_kg_x1000: 2500,
                }],
            },
        ) {
            Ok(_) => panic!("should reject missing customer"),
            Err(error) => error,
        };

        assert_eq!(error, "第 1 行：归属客户不存在：客户 B");
        let product_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
            .expect("count products");
        assert_eq!(product_count, 0);
    }

    #[test]
    fn rejects_product_import_when_values_exist_in_system() {
        let mut conn = setup_conn();
        conn.execute(
            "
            INSERT INTO products (
              id,
              product_name,
              mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000
            )
            VALUES ('product-1', '系统商品', 'G9001', 120, 2500)
            ",
            [],
        )
        .expect("insert product");

        let mold_error = match import_products_with_connection(
            &mut conn,
            ImportProductsPayload {
                products: vec![CreateProductPayload {
                    assigned_customer_names: Vec::new(),
                    mold_code: "G9001".to_string(),
                    product_name: "新商品".to_string(),
                    thickness_mm_x100: 120,
                    weight_per_meter_kg_x1000: 2500,
                }],
            },
        ) {
            Ok(_) => panic!("should reject existing mold code"),
            Err(error) => error,
        };
        assert_eq!(mold_error, "第 1 行：模具编号“G9001”已存在于系统商品资料中");

        let name_error = match import_products_with_connection(
            &mut conn,
            ImportProductsPayload {
                products: vec![CreateProductPayload {
                    assigned_customer_names: Vec::new(),
                    mold_code: "G9002".to_string(),
                    product_name: "系统商品".to_string(),
                    thickness_mm_x100: 120,
                    weight_per_meter_kg_x1000: 2500,
                }],
            },
        ) {
            Ok(_) => panic!("should reject existing product name"),
            Err(error) => error,
        };
        assert_eq!(
            name_error,
            "第 1 行：商品名称“系统商品”已存在于系统商品资料中"
        );
    }

    #[test]
    fn reports_product_import_duplicate_rows_clearly() {
        let rows = vec![
            vec!["商品名称", "模具编号", "厚度", "米重"],
            vec!["重复商品", "G9001", "1.2mm", "2.5kg/m"],
            vec!["重复商品", "G9001", "1.3mm", "2.6kg/m"],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_product_rows(rows).expect("parse products");

        assert!(result.products.is_empty());
        assert_eq!(
            result.errors,
            vec![
                "第 3 行：商品名称“重复商品”在导入文件中重复",
                "第 3 行：模具编号“G9001”在导入文件中重复"
            ]
        );
    }

    #[test]
    fn normalizes_file_urls_for_product_import() {
        assert_eq!(
            normalize_file_path(" file:///Users/test/%E5%95%86%E5%93%81.csv "),
            "/Users/test/商品.csv"
        );
        assert_eq!(
            normalize_file_path("/Users/test/products.csv"),
            "/Users/test/products.csv"
        );
        assert_eq!(
            percent_decode("%E4%B8%8D%E5%AE%8C%E6%95%B4%ZZ"),
            "不完整%ZZ"
        );
    }

    #[test]
    fn product_id_generation_uses_numeric_suffix() {
        let conn = setup_conn();

        assert_eq!(
            next_product_id(&conn).expect("first product id"),
            "PROD-001"
        );

        conn.execute(
            "
            INSERT INTO products (
              id,
              product_name,
              mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000
            ) VALUES
              ('PROD-002', '商品 2', 'M002', 100, 2000),
              ('LEGACY', '旧商品', 'OLD', 100, 2000),
              ('PROD-010', '商品 10', 'M010', 100, 2000)
            ",
            [],
        )
        .expect("insert products");

        assert_eq!(next_product_id(&conn).expect("next product id"), "PROD-011");
    }

    #[test]
    fn maps_product_unique_constraint_errors_to_business_messages() {
        let conn = setup_conn();
        conn.execute(
            "
            INSERT INTO products (
              id,
              product_name,
              mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000
            )
            VALUES ('product-1', '测试商品', 'G5501', 120, 2500)
            ",
            [],
        )
        .expect("insert product");

        let mold_error = conn
            .execute(
                "
                INSERT INTO products (
                  id,
                  product_name,
                  mold_code,
                  thickness_mm_x100,
                  weight_per_meter_kg_x1000
                )
                VALUES ('product-2', '其他商品', 'G5501', 120, 2500)
                ",
                [],
            )
            .map_err(map_product_write_error)
            .expect_err("should reject duplicate mold code");
        assert_eq!(mold_error, "模具编号已存在");

        let name_error = conn
            .execute(
                "
                INSERT INTO products (
                  id,
                  product_name,
                  mold_code,
                  thickness_mm_x100,
                  weight_per_meter_kg_x1000
                )
                VALUES ('product-3', '测试商品', 'G5502', 120, 2500)
                ",
                [],
            )
            .map_err(map_product_write_error)
            .expect_err("should reject duplicate product name");
        assert_eq!(name_error, "商品名称已存在");
    }

    #[test]
    fn maps_product_delete_errors_to_stable_codes() {
        assert_eq!(
            map_product_delete_error("有未下订单引用此商品，不能删除".to_string()),
            CommandError::new(
                "PRODUCT_HAS_PENDING_ORDERS",
                "有未下订单引用此商品，不能删除"
            )
        );
        assert_eq!(
            map_product_delete_error("商品不存在".to_string()),
            CommandError::new("PRODUCT_NOT_FOUND", "商品不存在")
        );
        assert_eq!(
            map_product_delete_error("failed to delete product".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to delete product")
        );
    }

    #[test]
    fn maps_product_list_errors_to_stable_codes() {
        assert_eq!(
            map_product_list_error("归属状态参数无效".to_string()),
            CommandError::new("PRODUCT_ASSIGNMENT_STATUS_INVALID", "归属状态参数无效")
        );
        assert_eq!(
            map_product_list_error("failed to query products".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to query products")
        );
    }

    #[test]
    fn maps_product_id_list_errors_to_stable_codes() {
        assert_eq!(
            map_product_id_list_error("归属状态参数无效".to_string()),
            CommandError::new("PRODUCT_ASSIGNMENT_STATUS_INVALID", "归属状态参数无效")
        );
        assert_eq!(
            map_product_id_list_error("failed to query product ids".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to query product ids")
        );
    }

    #[test]
    fn maps_product_export_errors_to_stable_codes() {
        assert_eq!(
            map_product_export_error("归属状态参数无效".to_string()),
            CommandError::new("PRODUCT_ASSIGNMENT_STATUS_INVALID", "归属状态参数无效")
        );
        assert_eq!(
            map_product_export_error("failed to query products".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to query products")
        );
    }

    #[test]
    fn maps_assign_customer_product_errors_to_stable_codes() {
        let cases = [
            ("请选择客户", "PRODUCT_ASSIGN_CUSTOMER_REQUIRED"),
            ("请选择商品", "PRODUCT_ASSIGN_PRODUCTS_REQUIRED"),
            (
                "分配列表中存在重复商品",
                "PRODUCT_ASSIGNMENT_DUPLICATE_PRODUCT",
            ),
            ("选择的客户不存在", "CUSTOMER_NOT_FOUND"),
            ("商品不存在", "PRODUCT_NOT_FOUND"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_assign_customer_products_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_assign_customer_products_error("failed to commit product assignment".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to commit product assignment")
        );
    }

    #[test]
    fn maps_set_product_customer_errors_to_stable_codes() {
        let cases = [
            ("商品 ID 不能为空", "PRODUCT_ID_REQUIRED"),
            ("商品不存在", "PRODUCT_NOT_FOUND"),
            ("选择的客户不存在", "CUSTOMER_NOT_FOUND"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_set_product_customers_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_set_product_customers_error("failed to commit product customer update".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to commit product customer update")
        );
    }

    #[test]
    fn maps_create_product_errors_to_stable_codes() {
        let cases = [
            ("商品名称不能为空", "PRODUCT_NAME_REQUIRED"),
            ("模具编号不能为空", "PRODUCT_MOLD_CODE_REQUIRED"),
            ("厚度必须大于 0", "PRODUCT_THICKNESS_INVALID"),
            ("米重必须大于 0", "PRODUCT_WEIGHT_PER_METER_INVALID"),
            ("商品名称已存在", "PRODUCT_NAME_CONFLICT"),
            ("模具编号已存在", "PRODUCT_MOLD_CODE_CONFLICT"),
            ("商品引用的数据不存在", "PRODUCT_REFERENCE_NOT_FOUND"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_create_product_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_create_product_error("failed to write product".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to write product")
        );
    }

    #[test]
    fn maps_update_product_errors_to_stable_codes() {
        let cases = [
            ("商品 ID 不能为空", "PRODUCT_ID_REQUIRED"),
            ("商品不存在", "PRODUCT_NOT_FOUND"),
            ("商品名称已存在", "PRODUCT_NAME_CONFLICT"),
            ("厚度必须大于 0", "PRODUCT_THICKNESS_INVALID"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_update_product_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_update_product_error("failed to sync editable order items".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to sync editable order items")
        );
    }

    #[test]
    fn maps_import_product_errors_to_stable_codes() {
        let cases = [
            ("没有可导入的商品", "PRODUCT_IMPORT_EMPTY"),
            (
                "第 2 行：商品名称“重复商品”在导入文件中重复",
                "PRODUCT_IMPORT_NAME_DUPLICATE",
            ),
            (
                "第 3 行：模具编号“G9001”在导入文件中重复",
                "PRODUCT_IMPORT_MOLD_CODE_DUPLICATE",
            ),
            (
                "第 1 行：商品名称“系统商品”已存在于系统商品资料中",
                "PRODUCT_IMPORT_NAME_CONFLICT",
            ),
            (
                "第 1 行：模具编号“G9001”已存在于系统商品资料中",
                "PRODUCT_IMPORT_MOLD_CODE_CONFLICT",
            ),
            (
                "第 4 行：归属客户不存在：客户 B",
                "PRODUCT_IMPORT_CUSTOMER_NOT_FOUND",
            ),
            ("第 5 行：厚度必须大于 0", "PRODUCT_IMPORT_ROW_INVALID"),
            ("商品名称已存在", "PRODUCT_IMPORT_NAME_CONFLICT"),
            ("模具编号已存在", "PRODUCT_IMPORT_MOLD_CODE_CONFLICT"),
            ("商品引用的数据不存在", "PRODUCT_IMPORT_REFERENCE_NOT_FOUND"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_import_products_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_import_products_error("failed to commit product import".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to commit product import")
        );
    }

    #[test]
    fn maps_product_import_file_errors_to_stable_codes() {
        let cases = [
            (
                "请选择 CSV、XLSX 或 XLS 文件",
                "PRODUCT_IMPORT_FILE_TYPE_INVALID",
            ),
            (
                "无法读取文件：文件不存在",
                "PRODUCT_IMPORT_FILE_READ_FAILED",
            ),
            (
                "无法打开 Excel 文件：格式损坏",
                "PRODUCT_IMPORT_FILE_READ_FAILED",
            ),
            (
                "无法读取工作表：数据损坏",
                "PRODUCT_IMPORT_FILE_READ_FAILED",
            ),
            ("Excel 文件没有工作表", "PRODUCT_IMPORT_WORKSHEET_MISSING"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_product_import_file_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_product_import_file_error("failed to parse products".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to parse products")
        );
    }

    #[test]
    fn delete_product_rejects_editable_order_references() {
        let mut conn = setup_conn();
        insert_customer_and_product(&conn);
        conn.execute(
            "
            INSERT INTO orders (id, customer_id, customer_name, status)
            VALUES ('ALU20260623001', 'customer-1', '测试客户', 'saved')
            ",
            [],
        )
        .expect("insert saved order");
        conn.execute(
            "
            INSERT INTO order_items (
              id,
              order_id,
              product_id,
              product_name,
              product_mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000,
              length_mm,
              color,
              quantity,
              theoretical_weight_kg_x100
            ) VALUES (
              'item-1',
              'ALU20260623001',
              'product-1',
              '测试商品',
              'M001',
              120,
              2500,
              6000,
              '灰色',
              2,
              3000
            )
            ",
            [],
        )
        .expect("insert saved order item");

        let error = delete_product_with_connection(&mut conn, "product-1")
            .expect_err("should reject product delete");

        assert_eq!(error, "有未下订单引用此商品，不能删除");
        let deleted_at: Option<String> = conn
            .query_row(
                "SELECT deleted_at FROM products WHERE id = 'product-1'",
                [],
                |row| row.get(0),
            )
            .expect("read deleted_at");

        assert!(deleted_at.is_none());
    }

    #[test]
    fn delete_product_soft_deletes_and_removes_assignments() {
        let mut conn = setup_conn();
        insert_customer_and_product(&conn);

        delete_product_with_connection(&mut conn, "product-1").expect("delete product");

        let deleted_at: Option<String> = conn
            .query_row(
                "SELECT deleted_at FROM products WHERE id = 'product-1'",
                [],
                |row| row.get(0),
            )
            .expect("read deleted_at");
        let assignment_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM customer_products WHERE product_id = 'product-1'",
                [],
                |row| row.get(0),
            )
            .expect("count assignments");

        assert!(deleted_at.is_some());
        assert_eq!(assignment_count, 0);
    }
}
