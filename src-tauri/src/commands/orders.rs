use std::collections::HashSet;
use std::path::Path;

use calamine::{open_workbook_auto, Data, Reader};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use super::error::CommandError;
use crate::db::AppState;
use crate::processing_fees::{processing_category_from_color, ProcessingFeeSnapshot};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderSummary {
    id: String,
    customer_id: Option<String>,
    customer_name: String,
    customer_address: String,
    handler_name: String,
    aluminum_ingot_price_x100: i64,
    pricing_tax_included: bool,
    bridge_processing_fee_x100: i64,
    powder_processing_fee_x100: i64,
    billet_processing_fee_x100: i64,
    oxidation_processing_fee_x100: i64,
    electrophoresis_processing_fee_x100: i64,
    status: String,
    delivery_note_id: Option<String>,
    delivery_note_ids: Vec<String>,
    inventory_locked_at: Option<String>,
    inventory_closed_at: Option<String>,
    inventory_close_destination: Option<String>,
    total_theoretical_weight_kg_x100: i64,
    ordered_date: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItemDetail {
    id: String,
    order_id: String,
    product_id: Option<String>,
    product_name: String,
    product_mold_code: String,
    thickness_mm_x100: i64,
    weight_per_meter_kg_x1000: i64,
    length_mm: i64,
    color: String,
    quantity: i64,
    theoretical_weight_kg_x100: i64,
    note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderDetail {
    id: String,
    customer_id: Option<String>,
    customer_name: String,
    customer_address: String,
    handler_name: String,
    aluminum_ingot_price_x100: i64,
    pricing_tax_included: bool,
    bridge_processing_fee_x100: i64,
    powder_processing_fee_x100: i64,
    billet_processing_fee_x100: i64,
    oxidation_processing_fee_x100: i64,
    electrophoresis_processing_fee_x100: i64,
    status: String,
    delivery_note_id: Option<String>,
    delivery_note_ids: Vec<String>,
    inventory_locked_at: Option<String>,
    inventory_closed_at: Option<String>,
    inventory_close_destination: Option<String>,
    ordered_date: Option<String>,
    created_at: String,
    updated_at: String,
    note: Option<String>,
    items: Vec<OrderItemDetail>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertOrderPayload {
    id: Option<String>,
    customer_id: String,
    customer_name: String,
    customer_address: String,
    handler_name: String,
    aluminum_ingot_price_x100: i64,
    pricing_tax_included: bool,
    status: String,
    ordered_date: Option<String>,
    note: Option<String>,
    items: Vec<UpsertOrderItemPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertOrderItemPayload {
    product_id: Option<String>,
    length_mm: i64,
    color: String,
    quantity: i64,
    note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseOrderItemImportResult {
    pub rows: Vec<ParsedOrderItemImportRow>,
    pub errors: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedOrderItemImportRow {
    pub row_number: usize,
    pub product_name: String,
    pub length_mm: String,
    pub color: String,
    pub quantity: String,
    pub note: String,
}

#[tauri::command]
pub fn list_orders(state: State<'_, AppState>) -> Result<Vec<OrderSummary>, CommandError> {
    list_orders_inner(state).map_err(map_order_list_error)
}

fn list_orders_inner(state: State<'_, AppState>) -> Result<Vec<OrderSummary>, String> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let mut stmt = conn
        .prepare(
            "
            SELECT
              orders.id,
              orders.customer_id,
              orders.customer_name,
              orders.customer_address,
              orders.handler_name,
              orders.aluminum_ingot_price_x100,
              orders.pricing_tax_included,
              orders.bridge_processing_fee_x100,
              orders.powder_processing_fee_x100,
              orders.billet_processing_fee_x100,
              orders.oxidation_processing_fee_x100,
              orders.electrophoresis_processing_fee_x100,
              orders.status,
              (
                SELECT delivery_notes.id FROM delivery_notes
                WHERE delivery_notes.order_id = orders.id
                ORDER BY delivery_notes.created_at DESC, delivery_notes.id DESC LIMIT 1
              ),
              COALESCE((
                SELECT GROUP_CONCAT(delivery_notes.id, char(31)) FROM delivery_notes
                WHERE delivery_notes.order_id = orders.id
              ), ''),
              orders.inventory_locked_at,
              orders.inventory_closed_at,
              orders.inventory_close_destination,
              COALESCE(SUM(order_items.theoretical_weight_kg_x100), 0) AS total_theoretical_weight_kg_x100,
              orders.ordered_date,
              orders.created_at,
              orders.updated_at
            FROM orders
            LEFT JOIN order_items ON order_items.order_id = orders.id
            GROUP BY orders.id
            ORDER BY orders.updated_at DESC
            ",
        )
        .map_err(|err| format!("failed to prepare order query: {err}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(OrderSummary {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                customer_name: row.get(2)?,
                customer_address: row.get(3)?,
                handler_name: row.get(4)?,
                aluminum_ingot_price_x100: row.get(5)?,
                pricing_tax_included: row.get(6)?,
                bridge_processing_fee_x100: row.get(7)?,
                powder_processing_fee_x100: row.get(8)?,
                billet_processing_fee_x100: row.get(9)?,
                oxidation_processing_fee_x100: row.get(10)?,
                electrophoresis_processing_fee_x100: row.get(11)?,
                status: row.get(12)?,
                delivery_note_id: row.get(13)?,
                delivery_note_ids: split_delivery_note_ids(row.get(14)?),
                inventory_locked_at: row.get(15)?,
                inventory_closed_at: row.get(16)?,
                inventory_close_destination: row.get(17)?,
                total_theoretical_weight_kg_x100: row.get(18)?,
                ordered_date: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        })
        .map_err(|err| format!("failed to query orders: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read orders: {err}"))
}

fn map_order_list_error(message: String) -> CommandError {
    CommandError::internal(message)
}

#[tauri::command]
pub fn parse_order_item_import_file(
    path: String,
) -> Result<ParseOrderItemImportResult, CommandError> {
    parse_order_item_import_file_inner(path).map_err(map_order_item_import_error)
}

fn parse_order_item_import_file_inner(path: String) -> Result<ParseOrderItemImportResult, String> {
    let normalized_path = normalize_file_path(&path);
    let file_path = Path::new(&normalized_path);
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match extension.as_str() {
        "csv" => parse_order_item_rows(read_csv_rows(file_path)?),
        "xlsx" | "xls" => parse_order_item_rows(read_excel_rows(file_path)?),
        _ => Err("请选择 CSV、XLSX 或 XLS 文件".to_string()),
    }
}

fn map_order_item_import_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择 CSV、XLSX 或 XLS 文件" => "ORDER_IMPORT_FILE_TYPE_INVALID",
        "Excel 文件没有工作表" => "ORDER_IMPORT_WORKSHEET_MISSING",
        _ if message.starts_with("无法读取文件：")
            || message.starts_with("无法打开 Excel 文件：")
            || message.starts_with("无法读取工作表：") =>
        {
            "ORDER_IMPORT_FILE_READ_FAILED"
        }
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn get_order(state: State<'_, AppState>, id: String) -> Result<OrderDetail, CommandError> {
    let id = id.trim();

    if id.is_empty() {
        return Err(CommandError::new("ORDER_ID_REQUIRED", "订单编号不能为空"));
    }

    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    query_order_detail(&conn, id).map_err(map_order_read_error)
}

fn map_order_read_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "订单不存在" => "ORDER_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn create_order(
    state: State<'_, AppState>,
    payload: UpsertOrderPayload,
) -> Result<OrderDetail, CommandError> {
    create_order_inner(state, payload).map_err(map_create_order_error)
}

fn create_order_inner(
    state: State<'_, AppState>,
    payload: UpsertOrderPayload,
) -> Result<OrderDetail, String> {
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start order create transaction: {err}"))?;
    let normalized = validate_order_payload(&tx, &payload)?;
    let id_date = normalized.ordered_date.as_deref();
    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or(next_order_id(&tx, id_date)?);

    tx.execute(
        "
        INSERT INTO orders (
          id,
          customer_id,
          customer_name,
          customer_address,
          handler_name,
          aluminum_ingot_price_x100,
          pricing_tax_included,
          bridge_processing_fee_x100,
          powder_processing_fee_x100,
          billet_processing_fee_x100,
          oxidation_processing_fee_x100,
          electrophoresis_processing_fee_x100,
          status,
          ordered_date,
          note,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ",
        params![
            &id,
            &normalized.customer_id,
            &normalized.customer_name,
            &normalized.customer_address,
            &normalized.handler_name,
            normalized.aluminum_ingot_price_x100,
            normalized.pricing_tax_included,
            normalized.processing_fees.bridge,
            normalized.processing_fees.powder,
            normalized.processing_fees.billet,
            normalized.processing_fees.oxidation,
            normalized.processing_fees.electrophoresis,
            &normalized.status,
            normalized.ordered_date.as_deref(),
            normalized.note.as_deref()
        ],
    )
    .map_err(map_order_write_error)?;

    write_order_items(&tx, &id, &normalized.items)?;
    if normalized.status == "ordered" {
        ensure_order_inventory_stocks(&tx, &id, &normalized.items)?;
    }
    tx.commit()
        .map_err(|err| format!("failed to commit order create: {err}"))?;

    query_order_detail(&conn, &id)
}

fn map_create_order_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择客户" => "ORDER_CUSTOMER_REQUIRED",
        "选择的客户不存在" => "ORDER_CUSTOMER_NOT_FOUND",
        "客户名称不能为空" => "ORDER_CUSTOMER_NAME_REQUIRED",
        "经手人不能为空" => "ORDER_HANDLER_REQUIRED",
        "铝锭价必须大于 0" => "ORDER_ALUMINUM_PRICE_INVALID",
        "订单状态不正确" => "ORDER_STATUS_INVALID",
        "已下单订单需要下单日期" => "ORDER_ORDERED_DATE_REQUIRED",
        "下单日期格式不正确" => "ORDER_ORDERED_DATE_INVALID",
        "订单至少需要一条明细" => "ORDER_ITEMS_REQUIRED",
        "订单编号已存在" => "ORDER_ID_CONFLICT",
        "订单引用的数据不存在" => "ORDER_REFERENCE_NOT_FOUND",
        _ if message.ends_with("加工费不能小于 0") => "ORDER_PROCESSING_FEE_INVALID",
        _ if message.ends_with("：请选择商品") => "ORDER_ITEM_PRODUCT_REQUIRED",
        _ if message.ends_with("：请选择当前客户的商品") => {
            "ORDER_ITEM_PRODUCT_NOT_ASSIGNED"
        }
        _ if message.ends_with("：长度必须大于 0") => "ORDER_ITEM_LENGTH_INVALID",
        _ if message.ends_with("：颜色不能为空") => "ORDER_ITEM_COLOR_REQUIRED",
        _ if message.ends_with("：数量必须大于 0") => "ORDER_ITEM_QUANTITY_INVALID",
        _ if message.ends_with("加工费未设置") => "ORDER_PROCESSING_FEE_NOT_CONFIGURED",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn update_order(
    state: State<'_, AppState>,
    payload: UpsertOrderPayload,
) -> Result<OrderDetail, CommandError> {
    update_order_inner(state, payload).map_err(map_update_order_error)
}

fn update_order_inner(
    state: State<'_, AppState>,
    payload: UpsertOrderPayload,
) -> Result<OrderDetail, String> {
    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "订单编号不能为空".to_string())?;
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start order update transaction: {err}"))?;
    let normalized = validate_order_payload(&tx, &payload)?;

    let existing_status = tx
        .query_row("SELECT status FROM orders WHERE id = ?1", [id], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(|err| format!("failed to find order: {err}"))?;

    let Some(existing_status) = existing_status else {
        return Err("订单不存在".to_string());
    };

    if existing_status == "ordered" {
        return Err("已下单订单不能编辑".to_string());
    }

    tx.execute(
        "
        UPDATE orders
        SET customer_id = ?2,
            customer_name = ?3,
            customer_address = ?4,
            handler_name = ?5,
            aluminum_ingot_price_x100 = ?6,
            pricing_tax_included = ?7,
            bridge_processing_fee_x100 = ?8,
            powder_processing_fee_x100 = ?9,
            billet_processing_fee_x100 = ?10,
            oxidation_processing_fee_x100 = ?11,
            electrophoresis_processing_fee_x100 = ?12,
            status = ?13,
            ordered_date = ?14,
            note = ?15,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![
            id,
            &normalized.customer_id,
            &normalized.customer_name,
            &normalized.customer_address,
            &normalized.handler_name,
            normalized.aluminum_ingot_price_x100,
            normalized.pricing_tax_included,
            normalized.processing_fees.bridge,
            normalized.processing_fees.powder,
            normalized.processing_fees.billet,
            normalized.processing_fees.oxidation,
            normalized.processing_fees.electrophoresis,
            &normalized.status,
            normalized.ordered_date.as_deref(),
            normalized.note.as_deref()
        ],
    )
    .map_err(map_order_write_error)?;

    tx.execute("DELETE FROM order_items WHERE order_id = ?1", [id])
        .map_err(|err| format!("failed to replace order items: {err}"))?;
    write_order_items(&tx, id, &normalized.items)?;
    if normalized.status == "ordered" {
        ensure_order_inventory_stocks(&tx, id, &normalized.items)?;
    }
    tx.commit()
        .map_err(|err| format!("failed to commit order update: {err}"))?;

    query_order_detail(&conn, id)
}

fn map_update_order_error(message: String) -> CommandError {
    match message.as_str() {
        "订单编号不能为空" => CommandError::new("ORDER_ID_REQUIRED", message),
        "订单不存在" => CommandError::new("ORDER_NOT_FOUND", message),
        "已下单订单不能编辑" => CommandError::new("ORDER_ALREADY_ORDERED", message),
        _ => map_create_order_error(message),
    }
}

#[tauri::command]
pub fn delete_order(state: State<'_, AppState>, id: String) -> Result<(), CommandError> {
    let id = id.trim();

    if id.is_empty() {
        return Err(CommandError::new("ORDER_ID_REQUIRED", "订单编号不能为空"));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;
    delete_order_with_connection(&mut conn, id).map_err(map_order_delete_error)
}

fn map_order_delete_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "已下单订单不能删除" => "ORDER_ALREADY_ORDERED",
        "订单不存在" => "ORDER_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

fn delete_order_with_connection(conn: &mut Connection, id: &str) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start order delete transaction: {err}"))?;
    let existing_status = tx
        .query_row("SELECT status FROM orders WHERE id = ?1", [id], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(|err| format!("failed to find order: {err}"))?;

    let Some(existing_status) = existing_status else {
        return Err("订单不存在".to_string());
    };

    if existing_status == "ordered" {
        return Err("已下单订单不能删除".to_string());
    }

    let affected_rows = tx
        .execute("DELETE FROM orders WHERE id = ?1", [id])
        .map_err(|err| format!("failed to delete order: {err}"))?;

    if affected_rows == 0 {
        return Err("订单不存在".to_string());
    }

    tx.commit()
        .map_err(|err| format!("failed to commit order delete: {err}"))?;

    Ok(())
}

struct NormalizedOrderPayload {
    customer_id: String,
    customer_name: String,
    customer_address: String,
    handler_name: String,
    aluminum_ingot_price_x100: i64,
    pricing_tax_included: bool,
    processing_fees: ProcessingFeeSnapshot,
    status: String,
    ordered_date: Option<String>,
    note: Option<String>,
    items: Vec<NormalizedOrderItemPayload>,
}

struct NormalizedOrderItemPayload {
    product_id: Option<String>,
    product_name: String,
    product_mold_code: String,
    thickness_mm_x100: i64,
    weight_per_meter_kg_x1000: i64,
    length_mm: i64,
    color: String,
    quantity: i64,
    theoretical_weight_kg_x100: i64,
    note: Option<String>,
}

struct OrderProductSnapshot {
    product_name: String,
    mold_code: String,
    thickness_mm_x100: i64,
    weight_per_meter_kg_x1000: i64,
}

fn query_order_detail(conn: &Connection, id: &str) -> Result<OrderDetail, String> {
    let order = conn
        .query_row(
            "
            SELECT
              orders.id,
              orders.customer_id,
              orders.customer_name,
              orders.customer_address,
              orders.handler_name,
              orders.aluminum_ingot_price_x100,
              orders.pricing_tax_included,
              orders.bridge_processing_fee_x100,
              orders.powder_processing_fee_x100,
              orders.billet_processing_fee_x100,
              orders.oxidation_processing_fee_x100,
              orders.electrophoresis_processing_fee_x100,
              orders.status,
              (
                SELECT delivery_notes.id FROM delivery_notes
                WHERE delivery_notes.order_id = orders.id
                ORDER BY delivery_notes.created_at DESC, delivery_notes.id DESC LIMIT 1
              ),
              COALESCE((
                SELECT GROUP_CONCAT(delivery_notes.id, char(31)) FROM delivery_notes
                WHERE delivery_notes.order_id = orders.id
              ), ''),
              orders.inventory_locked_at,
              orders.inventory_closed_at,
              orders.inventory_close_destination,
              orders.ordered_date,
              orders.created_at,
              orders.updated_at,
              orders.note
            FROM orders
            WHERE orders.id = ?1
            ",
            [id],
            |row| {
                Ok(OrderDetail {
                    id: row.get(0)?,
                    customer_id: row.get(1)?,
                    customer_name: row.get(2)?,
                    customer_address: row.get(3)?,
                    handler_name: row.get(4)?,
                    aluminum_ingot_price_x100: row.get(5)?,
                    pricing_tax_included: row.get(6)?,
                    bridge_processing_fee_x100: row.get(7)?,
                    powder_processing_fee_x100: row.get(8)?,
                    billet_processing_fee_x100: row.get(9)?,
                    oxidation_processing_fee_x100: row.get(10)?,
                    electrophoresis_processing_fee_x100: row.get(11)?,
                    status: row.get(12)?,
                    delivery_note_id: row.get(13)?,
                    delivery_note_ids: split_delivery_note_ids(row.get(14)?),
                    inventory_locked_at: row.get(15)?,
                    inventory_closed_at: row.get(16)?,
                    inventory_close_destination: row.get(17)?,
                    ordered_date: row.get(18)?,
                    created_at: row.get(19)?,
                    updated_at: row.get(20)?,
                    note: row.get(21)?,
                    items: Vec::new(),
                })
            },
        )
        .optional()
        .map_err(|err| format!("failed to query order: {err}"))?;

    let Some(mut order) = order else {
        return Err("订单不存在".to_string());
    };

    order.items = query_order_items(conn, id)?;
    Ok(order)
}

fn split_delivery_note_ids(value: String) -> Vec<String> {
    value
        .split('\u{1f}')
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect()
}

fn query_order_items(conn: &Connection, order_id: &str) -> Result<Vec<OrderItemDetail>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT
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
              theoretical_weight_kg_x100,
              note
            FROM order_items
            WHERE order_id = ?1
            ORDER BY created_at ASC, id ASC
            ",
        )
        .map_err(|err| format!("failed to prepare order item query: {err}"))?;
    let rows = stmt
        .query_map([order_id], |row| {
            Ok(OrderItemDetail {
                id: row.get(0)?,
                order_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                product_mold_code: row.get(4)?,
                thickness_mm_x100: row.get(5)?,
                weight_per_meter_kg_x1000: row.get(6)?,
                length_mm: row.get(7)?,
                color: row.get(8)?,
                quantity: row.get(9)?,
                theoretical_weight_kg_x100: row.get(10)?,
                note: row.get(11)?,
            })
        })
        .map_err(|err| format!("failed to query order items: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read order items: {err}"))
}

fn query_active_customer_product_for_order(
    conn: &Connection,
    product_id: &str,
    customer_id: &str,
) -> Result<Option<OrderProductSnapshot>, String> {
    conn.query_row(
        "
        SELECT
          products.product_name,
          products.mold_code,
          products.thickness_mm_x100,
          products.weight_per_meter_kg_x1000
        FROM products
        INNER JOIN customer_products
          ON customer_products.product_id = products.id
         AND customer_products.customer_id = ?2
        WHERE products.id = ?1
          AND products.deleted_at IS NULL
        ",
        params![product_id, customer_id],
        |row| {
            Ok(OrderProductSnapshot {
                product_name: row.get(0)?,
                mold_code: row.get(1)?,
                thickness_mm_x100: row.get(2)?,
                weight_per_meter_kg_x1000: row.get(3)?,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to validate product customer: {err}"))
}

fn validate_order_payload(
    conn: &Connection,
    payload: &UpsertOrderPayload,
) -> Result<NormalizedOrderPayload, String> {
    let customer_id = payload.customer_id.trim();
    let customer_name = payload.customer_name.trim();
    let customer_address = payload.customer_address.trim();
    let handler_name = payload.handler_name.trim();
    let status = payload.status.trim();
    let aluminum_ingot_price_x100 = payload.aluminum_ingot_price_x100;
    if customer_id.is_empty() {
        return Err("请选择客户".to_string());
    }

    let ordered_date = payload
        .ordered_date
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let note = payload
        .note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let note_text = note.as_deref().unwrap_or("");
    let customer =
        query_customer_pricing(conn, customer_id, note_text, payload.pricing_tax_included)?
            .ok_or_else(|| "选择的客户不存在".to_string())?;
    let processing_fees = customer.processing_fees;
    let price_fields = [
        ("断桥加工费", processing_fees.bridge),
        ("喷涂加工费", processing_fees.powder),
        ("坯料加工费", processing_fees.billet),
        ("氧化加工费", processing_fees.oxidation),
        ("电泳加工费", processing_fees.electrophoresis),
    ];

    if customer_name.is_empty() {
        return Err("客户名称不能为空".to_string());
    }

    if handler_name.is_empty() {
        return Err("经手人不能为空".to_string());
    }

    if aluminum_ingot_price_x100 <= 0 {
        return Err("铝锭价必须大于 0".to_string());
    }

    for (label, value) in price_fields {
        if value < 0 {
            return Err(format!("{label}不能小于 0"));
        }
    }

    if !matches!(status, "editing" | "saved" | "ordered") {
        return Err("订单状态不正确".to_string());
    }

    if status == "ordered" && ordered_date.is_none() {
        return Err("已下单订单需要下单日期".to_string());
    }

    if payload.items.is_empty() {
        return Err("订单至少需要一条明细".to_string());
    }

    let mut items = Vec::with_capacity(payload.items.len());

    for (index, item) in payload.items.iter().enumerate() {
        let color = item.color.trim();
        let note = item
            .note
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let product_id = item
            .product_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| format!("第 {} 行：请选择商品", index + 1))?;

        let product = query_active_customer_product_for_order(conn, product_id, customer_id)?
            .ok_or_else(|| format!("第 {} 行：请选择当前客户的商品", index + 1))?;

        if item.length_mm <= 0 {
            return Err(format!("第 {} 行：长度必须大于 0", index + 1));
        }

        if color.is_empty() {
            return Err(format!("第 {} 行：颜色不能为空", index + 1));
        }

        if item.quantity <= 0 {
            return Err(format!("第 {} 行：数量必须大于 0", index + 1));
        }

        let processing_fee_category = processing_category_from_color(color);
        let processing_fee_x100 = processing_fees.get(processing_fee_category);

        if processing_fee_x100 <= 0 {
            let pricing_label = if payload.pricing_tax_included {
                "含税"
            } else {
                "不含税"
            };

            return Err(format!(
                "第 {} 行：{}{}加工费未设置",
                index + 1,
                pricing_label,
                processing_fee_category.label()
            ));
        }

        items.push(NormalizedOrderItemPayload {
            product_id: Some(product_id.to_string()),
            product_name: product.product_name,
            product_mold_code: product.mold_code,
            thickness_mm_x100: product.thickness_mm_x100,
            weight_per_meter_kg_x1000: product.weight_per_meter_kg_x1000,
            length_mm: item.length_mm,
            color: color.to_string(),
            quantity: item.quantity,
            theoretical_weight_kg_x100: calculate_theoretical_weight(
                item.length_mm,
                item.quantity,
                product.weight_per_meter_kg_x1000,
            ),
            note,
        });
    }

    Ok(NormalizedOrderPayload {
        customer_id: customer_id.to_string(),
        customer_name: customer_name.to_string(),
        customer_address: customer_address.to_string(),
        handler_name: handler_name.to_string(),
        aluminum_ingot_price_x100,
        pricing_tax_included: payload.pricing_tax_included,
        processing_fees,
        status: status.to_string(),
        ordered_date,
        note,
        items,
    })
}

struct CustomerPricingSnapshot {
    processing_fees: ProcessingFeeSnapshot,
}

fn query_customer_pricing(
    conn: &Connection,
    customer_id: &str,
    note: &str,
    pricing_tax_included: bool,
) -> Result<Option<CustomerPricingSnapshot>, String> {
    conn.query_row(
        "
        SELECT
          special_pricing_keyword,
          CASE
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%' AND ?3
            THEN special_bridge_processing_fee_tax_included_x100
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%'
            THEN special_bridge_processing_fee_tax_excluded_x100
            WHEN ?3 THEN bridge_processing_fee_tax_included_x100
            ELSE bridge_processing_fee_tax_excluded_x100
          END,
          CASE
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%' AND ?3
            THEN special_powder_processing_fee_tax_included_x100
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%'
            THEN special_powder_processing_fee_tax_excluded_x100
            WHEN ?3 THEN powder_processing_fee_tax_included_x100
            ELSE powder_processing_fee_tax_excluded_x100
          END,
          CASE
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%' AND ?3
            THEN special_billet_processing_fee_tax_included_x100
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%'
            THEN special_billet_processing_fee_tax_excluded_x100
            WHEN ?3 THEN billet_processing_fee_tax_included_x100
            ELSE billet_processing_fee_tax_excluded_x100
          END,
          CASE
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%' AND ?3
            THEN special_oxidation_processing_fee_tax_included_x100
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%'
            THEN special_oxidation_processing_fee_tax_excluded_x100
            WHEN ?3 THEN oxidation_processing_fee_tax_included_x100
            ELSE oxidation_processing_fee_tax_excluded_x100
          END,
          CASE
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%' AND ?3
            THEN special_electrophoresis_processing_fee_tax_included_x100
            WHEN special_pricing_keyword <> '' AND ?2 LIKE '%' || special_pricing_keyword || '%'
            THEN special_electrophoresis_processing_fee_tax_excluded_x100
            WHEN ?3 THEN electrophoresis_processing_fee_tax_included_x100
            ELSE electrophoresis_processing_fee_tax_excluded_x100
          END
        FROM customers
        WHERE id = ?1
        ",
        params![customer_id, note, pricing_tax_included],
        |row| {
            let _trigger_keyword: String = row.get(0)?;

            Ok(CustomerPricingSnapshot {
                processing_fees: ProcessingFeeSnapshot::new(
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ),
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read customer pricing: {err}"))
}

fn write_order_items(
    conn: &Connection,
    order_id: &str,
    items: &[NormalizedOrderItemPayload],
) -> Result<(), String> {
    for (index, item) in items.iter().enumerate() {
        let id = format_order_item_id(order_id, index + 1);
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
              theoretical_weight_kg_x100,
              note,
              created_at,
              updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ",
            params![
                id,
                order_id,
                item.product_id.as_deref(),
                &item.product_name,
                &item.product_mold_code,
                item.thickness_mm_x100,
                item.weight_per_meter_kg_x1000,
                item.length_mm,
                &item.color,
                item.quantity,
                item.theoretical_weight_kg_x100,
                item.note.as_deref()
            ],
        )
        .map_err(|err| format!("failed to write order items: {err}"))?;
    }

    Ok(())
}

fn ensure_order_inventory_stocks(
    conn: &Connection,
    order_id: &str,
    items: &[NormalizedOrderItemPayload],
) -> Result<(), String> {
    for item in items {
        let Some(product_id) = item.product_id.as_deref() else {
            continue;
        };

        conn.execute(
            "
            INSERT INTO order_inventory_stocks (
              order_id,
              product_id,
              length_mm,
              color,
              quantity,
              updated_at
            ) VALUES (?1, ?2, ?3, ?4, 0, CURRENT_TIMESTAMP)
            ON CONFLICT(order_id, product_id, length_mm, color) DO NOTHING
            ",
            params![order_id, product_id, item.length_mm, &item.color],
        )
        .map_err(|err| format!("failed to initialize order inventory: {err}"))?;
    }

    Ok(())
}

fn next_order_id(conn: &Connection, ordered_date: Option<&str>) -> Result<String, String> {
    let today = match ordered_date {
        Some(value) => order_id_date_part(value)?,
        None => conn
            .query_row("SELECT strftime('%Y%m%d', 'now', 'localtime')", [], |row| {
                row.get(0)
            })
            .map_err(|err| format!("failed to resolve order date: {err}"))?,
    };
    let sequence_name = format!("orders:{today}");
    let order_id_pattern = format!("ALU{today}%");

    conn.execute(
        "
        INSERT INTO number_sequences (name, next_number, updated_at)
        SELECT ?1,
               COALESCE(MAX(CAST(substr(id, 12) AS INTEGER)), 0) + 2,
               CURRENT_TIMESTAMP
        FROM orders
        WHERE id LIKE ?2
        ON CONFLICT(name) DO UPDATE
        SET next_number = next_number + 1,
            updated_at = CURRENT_TIMESTAMP
        ",
        [&sequence_name, &order_id_pattern],
    )
    .map_err(|err| format!("failed to advance order sequence: {err}"))?;

    let current_number: i64 = conn
        .query_row(
            "
            SELECT next_number - 1
            FROM number_sequences
            WHERE name = ?1
            ",
            [&sequence_name],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to resolve next order id: {err}"))?;

    Ok(format!("ALU{today}{current_number:03}"))
}

fn order_id_date_part(value: &str) -> Result<String, String> {
    let date = value.trim();
    let parts = date.split('-').collect::<Vec<_>>();

    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 {
        return Err("下单日期格式不正确".to_string());
    }

    let year = parse_date_part(parts[0])?;
    let month = parse_date_part(parts[1])?;
    let day = parse_date_part(parts[2])?;

    if year <= 0 || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err("下单日期格式不正确".to_string());
    }

    Ok(format!("{}{}{}", parts[0], parts[1], parts[2]))
}

fn parse_date_part(value: &str) -> Result<i64, String> {
    value
        .parse::<i64>()
        .map_err(|_| "下单日期格式不正确".to_string())
}

fn format_order_item_id(order_id: &str, number: usize) -> String {
    format!("{order_id}-{number:03}")
}

fn calculate_theoretical_weight(
    length_mm: i64,
    quantity: i64,
    weight_per_meter_kg_x1000: i64,
) -> i64 {
    ((length_mm as f64 / 1000.0) * quantity as f64 * (weight_per_meter_kg_x1000 as f64 / 10.0))
        .round() as i64
}

fn map_order_write_error(err: rusqlite::Error) -> String {
    let message = err.to_string();
    if message.contains("orders.id") {
        "订单编号已存在".to_string()
    } else if message.contains("FOREIGN KEY") {
        "订单引用的数据不存在".to_string()
    } else {
        format!("failed to write order: {err}")
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

fn parse_order_item_rows(rows: Vec<Vec<String>>) -> Result<ParseOrderItemImportResult, String> {
    let mut errors = Vec::new();

    if rows.len() < 2 {
        return Ok(ParseOrderItemImportResult {
            rows: Vec::new(),
            errors: vec!["文件至少需要表头和一行数据".to_string()],
        });
    }

    let product_name_candidates = ["商品名称", "商品", "productName", "name"];
    let length_candidates = ["长度", "长度mm", "length", "lengthMm", "lengthmm"];
    let color_candidates = ["颜色", "color"];
    let quantity_candidates = ["数量", "数量支", "quantity", "qty"];
    let note_candidates = ["备注", "note", "remark"];
    let header_row_index = find_best_header_row_index(
        &rows,
        &[
            &product_name_candidates,
            &length_candidates,
            &color_candidates,
            &quantity_candidates,
        ],
    );
    let headers = rows[header_row_index]
        .iter()
        .map(|header| normalize_header(header))
        .collect::<Vec<_>>();

    let product_name_index = find_header_index(&headers, &product_name_candidates);
    let length_index = find_header_index(&headers, &length_candidates);
    let color_index = find_header_index(&headers, &color_candidates);
    let quantity_index = find_header_index(&headers, &quantity_candidates);
    let note_index = find_header_index(&headers, &note_candidates);

    if product_name_index.is_none() {
        errors.push("缺少商品名称列".to_string());
    }
    if length_index.is_none() {
        errors.push("缺少长度(mm)列".to_string());
    }
    if color_index.is_none() {
        errors.push("缺少颜色列".to_string());
    }
    if quantity_index.is_none() {
        errors.push("缺少数量列".to_string());
    }

    if !errors.is_empty() {
        return Ok(ParseOrderItemImportResult {
            rows: Vec::new(),
            errors,
        });
    }

    let (Some(product_name_index), Some(length_index), Some(color_index), Some(quantity_index)) = (
        product_name_index,
        length_index,
        color_index,
        quantity_index,
    ) else {
        return Ok(ParseOrderItemImportResult {
            rows: Vec::new(),
            errors,
        });
    };

    let parsed_rows = rows
        .iter()
        .enumerate()
        .skip(header_row_index + 1)
        .filter(|(_, row)| row.iter().any(|value| !value.trim().is_empty()))
        .map(|(index, row)| ParsedOrderItemImportRow {
            row_number: index + 1,
            product_name: row
                .get(product_name_index)
                .map(|value| value.trim().to_string())
                .unwrap_or_default(),
            length_mm: row
                .get(length_index)
                .map(|value| {
                    normalize_positive_integer_cell(value)
                        .unwrap_or_else(|| value.trim().to_string())
                })
                .unwrap_or_default(),
            color: row
                .get(color_index)
                .map(|value| value.trim().to_string())
                .unwrap_or_default(),
            quantity: row
                .get(quantity_index)
                .map(|value| {
                    normalize_positive_integer_cell(value)
                        .unwrap_or_else(|| value.trim().to_string())
                })
                .unwrap_or_default(),
            note: note_index
                .and_then(|index| row.get(index))
                .map(|value| value.trim().to_string())
                .unwrap_or_default(),
        })
        .collect();

    Ok(ParseOrderItemImportResult {
        rows: parsed_rows,
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

fn normalize_positive_integer_cell(value: &str) -> Option<String> {
    let normalized = value.trim().replace(',', "");
    let (number_text, unit_text) = split_number_and_unit(&normalized)?;
    let unit = unit_text.trim().to_lowercase();

    if !unit.is_empty() && !matches!(unit.as_str(), "mm" | "毫米" | "支" | "pcs" | "pc" | "根")
    {
        return None;
    }

    let number = number_text.parse::<f64>().ok()?;

    if !number.is_finite() || number <= 0.0 {
        return None;
    }

    Some(format!("{:.0}", number.round()))
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
        rest.to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.execute_batch(include_str!("../db/migrations/001_init.sql"))
            .expect("run migrations");
        conn.execute(
            "
            INSERT INTO customers (
              id,
              customer_name,
              default_pricing_tax_included,
              bridge_processing_fee_tax_included_x100,
              powder_processing_fee_tax_included_x100,
              billet_processing_fee_tax_included_x100,
              oxidation_processing_fee_tax_included_x100,
              electrophoresis_processing_fee_tax_included_x100
            ) VALUES ('customer-1', '测试客户', 1, 100, 100, 100, 100, 100)
            ",
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
            "
            INSERT INTO customer_products (customer_id, product_id)
            VALUES ('customer-1', 'product-1')
            ",
            [],
        )
        .expect("assign product to customer");

        conn
    }

    fn base_payload(color: &str) -> UpsertOrderPayload {
        UpsertOrderPayload {
            id: None,
            customer_id: "customer-1".to_string(),
            customer_name: "测试客户".to_string(),
            customer_address: String::new(),
            handler_name: "经手人".to_string(),
            aluminum_ingot_price_x100: 2_000_000,
            pricing_tax_included: true,
            status: "saved".to_string(),
            ordered_date: None,
            note: None,
            items: vec![UpsertOrderItemPayload {
                product_id: Some("product-1".to_string()),
                length_mm: 6000,
                color: color.to_string(),
                quantity: 2,
                note: None,
            }],
        }
    }

    #[test]
    fn rejects_order_when_electrophoresis_fee_is_missing() {
        let conn = setup_conn();
        conn.execute(
            "
            UPDATE customers
            SET electrophoresis_processing_fee_tax_included_x100 = 0
            WHERE id = 'customer-1'
            ",
            [],
        )
        .expect("clear electrophoresis fee");
        let payload = base_payload("1#色");

        let error = match validate_order_payload(&conn, &payload) {
            Ok(_) => panic!("should reject order"),
            Err(error) => error,
        };

        assert_eq!(error, "第 1 行：含税电泳加工费未设置");
    }

    #[test]
    fn rejects_order_when_oxidation_fee_is_missing() {
        let conn = setup_conn();
        conn.execute(
            "
            UPDATE customers
            SET oxidation_processing_fee_tax_included_x100 = 0
            WHERE id = 'customer-1'
            ",
            [],
        )
        .expect("clear oxidation fee");
        let payload = base_payload("国标氧化");

        let error = match validate_order_payload(&conn, &payload) {
            Ok(_) => panic!("should reject order"),
            Err(error) => error,
        };

        assert_eq!(error, "第 1 行：含税氧化加工费未设置");
    }

    #[test]
    fn accepts_order_when_required_processing_fee_is_set() {
        let conn = setup_conn();
        let payload = base_payload("2#色");

        let normalized =
            validate_order_payload(&conn, &payload).expect("should accept valid order");

        assert_eq!(normalized.items.len(), 1);
        assert_eq!(normalized.processing_fees.electrophoresis, 100);
    }

    #[test]
    fn uses_special_pricing_when_order_note_matches_keyword() {
        let conn = setup_conn();
        conn.execute(
            "
            UPDATE customers
            SET electrophoresis_processing_fee_tax_included_x100 = 0,
                special_pricing_keyword = '沃德虎标膜',
                special_bridge_processing_fee_tax_included_x100 = 200,
                special_powder_processing_fee_tax_included_x100 = 200,
                special_billet_processing_fee_tax_included_x100 = 200,
                special_oxidation_processing_fee_tax_included_x100 = 200,
                special_electrophoresis_processing_fee_tax_included_x100 = 300
            WHERE id = 'customer-1'
            ",
            [],
        )
        .expect("set special pricing");
        let mut payload = base_payload("1#色");
        payload.note = Some("沃德虎标膜".to_string());

        let normalized =
            validate_order_payload(&conn, &payload).expect("should use special pricing");

        assert_eq!(normalized.processing_fees.electrophoresis, 300);
    }

    #[test]
    fn parses_order_item_import_rows_with_alias_headers_and_trimmed_values() {
        let rows = vec![
            vec!["productName", "lengthMm", "color", "qty", "remark"],
            vec![" 70 边框 ", " 6000 ", " 灰色 ", " 2 ", " 首行备注 "],
            vec!["白色边框", "3000", "白色", "1", ""],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_order_item_rows(rows).expect("parse rows");

        assert!(result.errors.is_empty());
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0].row_number, 2);
        assert_eq!(result.rows[0].product_name, "70 边框");
        assert_eq!(result.rows[0].length_mm, "6000");
        assert_eq!(result.rows[0].color, "灰色");
        assert_eq!(result.rows[0].quantity, "2");
        assert_eq!(result.rows[0].note, "首行备注");
        assert_eq!(result.rows[1].row_number, 3);
        assert_eq!(result.rows[1].note, "");
    }

    #[test]
    fn reports_missing_required_order_item_import_columns() {
        let rows = vec![vec!["商品名称", "备注"], vec!["70 边框", "缺少规格"]]
            .into_iter()
            .map(|row| row.into_iter().map(str::to_string).collect())
            .collect();

        let result = parse_order_item_rows(rows).expect("parse rows");

        assert!(result.rows.is_empty());
        assert_eq!(
            result.errors,
            vec!["缺少长度(mm)列", "缺少颜色列", "缺少数量列"]
        );
    }

    #[test]
    fn parses_order_item_import_rows_with_realistic_headers_and_blank_note() {
        let rows = vec![
            vec![" 商品 ", " 长度(mm) ", " 颜色 ", " 数量(支) ", " 备注 "],
            vec![" 70 边框 ", " 6000 ", " 外灰内白 ", " 12 ", " 急单 "],
            vec!["喷涂扇料", "5500", "砂灰", "8", ""],
        ]
        .into_iter()
        .map(|row| row.into_iter().map(str::to_string).collect())
        .collect();

        let result = parse_order_item_rows(rows).expect("parse rows");

        assert!(result.errors.is_empty());
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0].row_number, 2);
        assert_eq!(result.rows[0].product_name, "70 边框");
        assert_eq!(result.rows[0].length_mm, "6000");
        assert_eq!(result.rows[0].color, "外灰内白");
        assert_eq!(result.rows[0].quantity, "12");
        assert_eq!(result.rows[0].note, "急单");
        assert_eq!(result.rows[1].row_number, 3);
        assert_eq!(result.rows[1].note, "");
    }

    #[test]
    fn normalizes_file_urls_for_order_item_import() {
        assert_eq!(
            normalize_file_path(" file:///Users/test/%E8%AE%A2%E5%8D%95.csv "),
            "/Users/test/%E8%AE%A2%E5%8D%95.csv"
        );
        assert_eq!(
            normalize_file_path("/Users/test/order-items.csv"),
            "/Users/test/order-items.csv"
        );
    }

    #[test]
    fn order_id_generation_uses_order_date_sequence() {
        let conn = setup_conn();

        assert_eq!(
            next_order_id(&conn, Some("2026-06-20")).expect("first order id"),
            "ALU20260620001"
        );
        assert_eq!(
            next_order_id(&conn, Some("2026-06-20")).expect("second order id"),
            "ALU20260620002"
        );

        conn.execute(
            "
            INSERT INTO orders (
              id,
              customer_id,
              customer_name,
              status
            ) VALUES
              ('ALU20260621002', 'customer-1', '测试客户', 'saved'),
              ('ALU20260622005', 'customer-1', '测试客户', 'saved')
            ",
            [],
        )
        .expect("insert orders");

        assert_eq!(
            next_order_id(&conn, Some("2026-06-21")).expect("next same-day order id"),
            "ALU20260621003"
        );
        assert_eq!(
            next_order_id(&conn, Some("2026-06-22")).expect("next other-day order id"),
            "ALU20260622006"
        );
        assert_eq!(
            order_id_date_part("2026-06-21").expect("format date part"),
            "20260621"
        );
        assert_eq!(
            order_id_date_part("2026-6-21").expect_err("reject non padded date"),
            "下单日期格式不正确"
        );
    }

    #[test]
    fn delete_order_rejects_ordered_orders() {
        let mut conn = setup_conn();
        conn.execute(
            "
            INSERT INTO orders (id, customer_id, customer_name, status)
            VALUES ('ALU20260623001', 'customer-1', '测试客户', 'ordered')
            ",
            [],
        )
        .expect("insert ordered order");

        let error = delete_order_with_connection(&mut conn, "ALU20260623001")
            .expect_err("should reject ordered order delete");

        assert_eq!(error, "已下单订单不能删除");
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM orders WHERE id = 'ALU20260623001'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("count order"),
            1
        );
    }

    #[test]
    fn delete_order_allows_saved_orders_and_removes_items() {
        let mut conn = setup_conn();
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
        .expect("insert order item");

        delete_order_with_connection(&mut conn, "ALU20260623001").expect("delete saved order");

        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM orders WHERE id = 'ALU20260623001'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("count order"),
            0
        );
        assert_eq!(
            conn.query_row("SELECT COUNT(*) FROM order_items", [], |row| {
                row.get::<_, i64>(0)
            })
            .expect("count items"),
            0
        );
    }

    #[test]
    fn maps_order_delete_errors_to_stable_codes() {
        assert_eq!(
            map_order_delete_error("已下单订单不能删除".to_string()),
            CommandError::new("ORDER_ALREADY_ORDERED", "已下单订单不能删除")
        );
        assert_eq!(
            map_order_delete_error("订单不存在".to_string()),
            CommandError::new("ORDER_NOT_FOUND", "订单不存在")
        );
        assert_eq!(
            map_order_delete_error("failed to delete order".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to delete order")
        );
    }

    #[test]
    fn maps_order_read_errors_to_stable_codes() {
        assert_eq!(
            map_order_read_error("订单不存在".to_string()),
            CommandError::new("ORDER_NOT_FOUND", "订单不存在")
        );
        assert_eq!(
            map_order_read_error("failed to query order items".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to query order items")
        );
    }

    #[test]
    fn maps_order_list_errors_to_internal_error() {
        assert_eq!(
            map_order_list_error("failed to prepare order query".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to prepare order query")
        );
        assert_eq!(
            map_order_list_error("failed to read orders".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to read orders")
        );
    }

    #[test]
    fn maps_order_item_import_errors_to_stable_codes() {
        let cases = [
            (
                "请选择 CSV、XLSX 或 XLS 文件",
                "ORDER_IMPORT_FILE_TYPE_INVALID",
            ),
            ("无法读取文件：文件不存在", "ORDER_IMPORT_FILE_READ_FAILED"),
            (
                "无法打开 Excel 文件：格式损坏",
                "ORDER_IMPORT_FILE_READ_FAILED",
            ),
            ("无法读取工作表：数据损坏", "ORDER_IMPORT_FILE_READ_FAILED"),
            ("Excel 文件没有工作表", "ORDER_IMPORT_WORKSHEET_MISSING"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_order_item_import_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_order_item_import_error("failed to parse order items".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to parse order items")
        );
    }

    #[test]
    fn maps_create_order_errors_to_stable_codes() {
        let cases = [
            ("请选择客户", "ORDER_CUSTOMER_REQUIRED"),
            ("选择的客户不存在", "ORDER_CUSTOMER_NOT_FOUND"),
            ("客户名称不能为空", "ORDER_CUSTOMER_NAME_REQUIRED"),
            ("经手人不能为空", "ORDER_HANDLER_REQUIRED"),
            ("铝锭价必须大于 0", "ORDER_ALUMINUM_PRICE_INVALID"),
            ("喷涂加工费不能小于 0", "ORDER_PROCESSING_FEE_INVALID"),
            ("订单状态不正确", "ORDER_STATUS_INVALID"),
            ("已下单订单需要下单日期", "ORDER_ORDERED_DATE_REQUIRED"),
            ("下单日期格式不正确", "ORDER_ORDERED_DATE_INVALID"),
            ("订单至少需要一条明细", "ORDER_ITEMS_REQUIRED"),
            ("第 1 行：请选择商品", "ORDER_ITEM_PRODUCT_REQUIRED"),
            (
                "第 2 行：请选择当前客户的商品",
                "ORDER_ITEM_PRODUCT_NOT_ASSIGNED",
            ),
            ("第 3 行：长度必须大于 0", "ORDER_ITEM_LENGTH_INVALID"),
            ("第 4 行：颜色不能为空", "ORDER_ITEM_COLOR_REQUIRED"),
            ("第 5 行：数量必须大于 0", "ORDER_ITEM_QUANTITY_INVALID"),
            (
                "第 6 行：含税氧化加工费未设置",
                "ORDER_PROCESSING_FEE_NOT_CONFIGURED",
            ),
            ("订单编号已存在", "ORDER_ID_CONFLICT"),
            ("订单引用的数据不存在", "ORDER_REFERENCE_NOT_FOUND"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_create_order_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_create_order_error("failed to commit order create".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to commit order create")
        );
    }

    #[test]
    fn maps_update_order_errors_to_stable_codes() {
        let cases = [
            ("订单编号不能为空", "ORDER_ID_REQUIRED"),
            ("订单不存在", "ORDER_NOT_FOUND"),
            ("已下单订单不能编辑", "ORDER_ALREADY_ORDERED"),
            ("第 1 行：数量必须大于 0", "ORDER_ITEM_QUANTITY_INVALID"),
            ("订单引用的数据不存在", "ORDER_REFERENCE_NOT_FOUND"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_update_order_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_update_order_error("failed to commit order update".to_string()),
            CommandError::new("INTERNAL_ERROR", "failed to commit order update")
        );
    }
}
