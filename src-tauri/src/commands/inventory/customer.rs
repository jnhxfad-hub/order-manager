use std::collections::{HashMap, HashSet};
use std::path::Path;

use rusqlite::{params, Connection};
use tauri::State;

use crate::commands::error::CommandError;
use crate::db::AppState;
use crate::processing_fees::ProcessingFeeSnapshot;

use super::helpers::{
    current_local_date, format_customer_inventory_stock_id, format_delivery_note_item_id,
    get_required_customer_delivery_weights, get_required_customer_inventory_weights,
    next_customer_inventory_batch_id, next_customer_inventory_delivery_note_id,
    normalize_customer_inventory_import_file_path, normalize_delivery_extra_charge,
    parse_customer_inventory_import_rows, query_customer_for_inventory,
    query_customer_id_for_inventory_import, query_customer_inventory_batch,
    query_customer_inventory_batches, query_customer_inventory_delivery_note,
    query_customer_inventory_delivery_note_summaries, query_customer_inventory_movements,
    query_customer_inventory_print_snapshot, query_customer_inventory_stock_by_id,
    query_customer_inventory_stock_for_delivery, query_customer_product_for_inventory,
    query_customer_product_id_for_import, read_customer_inventory_import_csv_rows,
    read_customer_inventory_import_excel_rows, resolve_customer_inventory_pricing_profile,
    validate_date, validate_processing_fees_for_required_weights,
    write_customer_inventory_movement, CustomerInventoryMovementInput,
    CustomerInventoryStockForDelivery,
};

use super::types::{
    AdjustCustomerInventoryStockPayload, CreateCustomerInventoryBatchPayload,
    CreateCustomerInventoryDeliveryNotePayload, CreateCustomerInventoryStockItemPayload,
    CustomerInventoryBatch, CustomerInventoryDeliveryPriceGroupInput, CustomerInventoryListResult,
    CustomerInventoryPrintSnapshot, DeliveryNote, ImportCustomerInventoryResult,
    ListInventoryParams, ParseCustomerInventoryImportResult, ParsedCustomerInventoryImportRow,
    ResolvedCustomerInventoryDeliveryPriceGroup, UpdateCustomerInventoryBatchPayload,
    UpdateDeliveryNoteSpecialNotePayload,
};

#[tauri::command]
pub fn list_customer_inventory(
    state: State<'_, AppState>,
    params: Option<ListInventoryParams>,
) -> Result<CustomerInventoryListResult, CommandError> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;
    let search = params
        .and_then(|params| params.search)
        .unwrap_or_default()
        .trim()
        .to_string();
    let batches = query_customer_inventory_batches(&conn, &search)
        .map_err(map_customer_inventory_list_error)?;
    let delivery_notes = query_customer_inventory_delivery_note_summaries(&conn, &search)
        .map_err(map_customer_inventory_list_error)?;
    let recent_movements = query_customer_inventory_movements(&conn, &search)
        .map_err(map_customer_inventory_list_error)?;
    let total_quantity = conn
        .query_row(
            "SELECT COALESCE(SUM(quantity), 0) FROM customer_inventory_stocks",
            [],
            |row| row.get(0),
        )
        .map_err(|err| {
            map_customer_inventory_list_error(format!(
                "failed to sum customer inventory quantity: {err}"
            ))
        })?;

    Ok(CustomerInventoryListResult {
        batches,
        delivery_notes,
        recent_movements,
        total_quantity,
    })
}

#[tauri::command]
pub fn get_customer_inventory_print_snapshot(
    state: State<'_, AppState>,
    customer_id: String,
) -> Result<CustomerInventoryPrintSnapshot, CommandError> {
    let customer_id = customer_id.trim();

    if customer_id.is_empty() {
        return Err(CommandError::new("CUSTOMER_REQUIRED", "请选择客户"));
    }

    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    query_customer_inventory_print_snapshot(&conn, customer_id)
        .map_err(map_customer_inventory_print_snapshot_error)?
        .ok_or_else(|| CommandError::new("CUSTOMER_NOT_FOUND", "客户不存在"))
}

pub(crate) fn map_customer_inventory_print_snapshot_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "该客户暂无当前库存" => "CUSTOMER_INVENTORY_EMPTY",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

pub(crate) fn map_customer_inventory_list_error(message: String) -> CommandError {
    CommandError::internal(message)
}

#[tauri::command]
pub fn get_customer_inventory_batch(
    state: State<'_, AppState>,
    batch_id: String,
) -> Result<CustomerInventoryBatch, CommandError> {
    let batch_id = batch_id.trim();

    if batch_id.is_empty() {
        return Err(CommandError::new(
            "CUSTOMER_INVENTORY_BATCH_REQUIRED",
            "请选择客户库存批次",
        ));
    }

    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    query_customer_inventory_batch(&conn, batch_id)
        .map_err(map_get_customer_inventory_batch_error)?
        .ok_or_else(|| {
            CommandError::new("CUSTOMER_INVENTORY_BATCH_NOT_FOUND", "客户库存批次不存在")
        })
}

pub(crate) fn map_get_customer_inventory_batch_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择客户库存批次" => "CUSTOMER_INVENTORY_BATCH_REQUIRED",
        "客户库存批次不存在" => "CUSTOMER_INVENTORY_BATCH_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn create_customer_inventory_batch(
    state: State<'_, AppState>,
    payload: CreateCustomerInventoryBatchPayload,
) -> Result<(), CommandError> {
    create_customer_inventory_batch_inner(state, payload)
        .map_err(map_create_customer_inventory_batch_error)
}

pub(crate) fn create_customer_inventory_batch_inner(
    state: State<'_, AppState>,
    payload: CreateCustomerInventoryBatchPayload,
) -> Result<(), String> {
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start customer inventory transaction: {err}"))?;
    create_customer_inventory_batch_in_transaction(&tx, payload)?;

    tx.commit()
        .map_err(|err| format!("failed to commit customer inventory batch: {err}"))
}

pub(crate) fn create_customer_inventory_batch_in_transaction(
    tx: &Connection,
    payload: CreateCustomerInventoryBatchPayload,
) -> Result<String, String> {
    let customer_id = payload.customer_id.trim();
    let historical_order_ref = payload.historical_order_ref.trim();
    let note = payload.note.trim();
    let historical_order_date = payload
        .historical_order_date
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if customer_id.is_empty() {
        return Err("请选择客户".to_string());
    }

    if let Some(historical_order_date) = historical_order_date {
        validate_date(historical_order_date, "历史下单日期")?;
    }

    if payload.aluminum_ingot_price_x100 <= 0 {
        return Err("铝锭价必须大于 0".to_string());
    }

    let processing_fees = ProcessingFeeSnapshot::new(
        payload.bridge_processing_fee_x100,
        payload.powder_processing_fee_x100,
        payload.billet_processing_fee_x100,
        payload.oxidation_processing_fee_x100,
        payload.electrophoresis_processing_fee_x100,
    );

    if payload.items.is_empty() {
        return Err("请至少添加一项客户库存".to_string());
    }

    let customer =
        query_customer_for_inventory(tx, customer_id)?.ok_or_else(|| "客户不存在".to_string())?;
    let batch_id_date = historical_order_date
        .map(str::to_string)
        .map(Ok)
        .unwrap_or_else(|| current_local_date(tx))?;
    let batch_id = next_customer_inventory_batch_id(tx, &customer.customer_name, &batch_id_date)?;
    let required_weights = get_required_customer_inventory_weights(&payload.items)?;

    validate_processing_fees_for_required_weights(
        payload.pricing_tax_included,
        processing_fees,
        &required_weights,
    )?;

    tx.execute(
        "
        INSERT INTO customer_inventory_batches (
          id,
          customer_id,
          customer_name,
          customer_address,
          historical_order_date,
          historical_order_ref,
          aluminum_ingot_price_x100,
          pricing_tax_included,
          bridge_processing_fee_x100,
          powder_processing_fee_x100,
          billet_processing_fee_x100,
          oxidation_processing_fee_x100,
          electrophoresis_processing_fee_x100,
          note,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ",
        params![
            &batch_id,
            customer_id,
            &customer.customer_name,
            &customer.customer_address,
            historical_order_date,
            historical_order_ref,
            payload.aluminum_ingot_price_x100,
            payload.pricing_tax_included,
            processing_fees.bridge,
            processing_fees.powder,
            processing_fees.billet,
            processing_fees.oxidation,
            processing_fees.electrophoresis,
            note
        ],
    )
    .map_err(|err| format!("failed to create customer inventory batch: {err}"))?;

    for (stock_number, item) in (1..).zip(payload.items) {
        let product_id = item.product_id.trim();
        let color = item.color.trim();
        let item_note = item.note.trim();

        if product_id.is_empty() {
            return Err("请选择商品".to_string());
        }

        if item.length_mm <= 0 {
            return Err("长度必须大于 0".to_string());
        }

        if color.is_empty() {
            return Err("颜色不能为空".to_string());
        }

        if item.quantity <= 0 {
            return Err("数量必须大于 0".to_string());
        }

        let product = query_customer_product_for_inventory(tx, product_id, customer_id)?
            .ok_or_else(|| "商品不属于当前客户".to_string())?;
        let stock_id = format_customer_inventory_stock_id(&batch_id, stock_number);

        tx.execute(
            "
            INSERT INTO customer_inventory_stocks (
              id,
              batch_id,
              product_id,
              product_name,
              mold_code,
              length_mm,
              color,
              quantity,
              note,
              created_at,
              updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ",
            params![
                &stock_id,
                &batch_id,
                product_id,
                &product.product_name,
                &product.mold_code,
                item.length_mm,
                color,
                item.quantity,
                item_note
            ],
        )
        .map_err(|err| format!("failed to create customer inventory stock: {err}"))?;

        write_customer_inventory_movement(
            tx,
            CustomerInventoryMovementInput {
                batch_id: Some(&batch_id),
                stock_id: Some(&stock_id),
                customer_id: Some(customer_id),
                customer_name: &customer.customer_name,
                delivery_note_id: None,
                product_id: Some(product_id),
                product_name: &product.product_name,
                mold_code: &product.mold_code,
                length_mm: Some(item.length_mm),
                color,
                movement_type: "historical_import",
                quantity_before: 0,
                quantity_after: item.quantity,
                delta_quantity: item.quantity,
                note,
            },
        )?;
    }

    Ok(batch_id)
}

pub(crate) fn map_create_customer_inventory_batch_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择客户" => "CUSTOMER_INVENTORY_CUSTOMER_REQUIRED",
        "历史下单日期格式必须为 YYYY-MM-DD" => "CUSTOMER_INVENTORY_DATE_INVALID",
        "铝锭价必须大于 0" => "CUSTOMER_INVENTORY_PRICE_INVALID",
        "请至少添加一项客户库存" => "CUSTOMER_INVENTORY_ITEMS_REQUIRED",
        "客户不存在" => "CUSTOMER_INVENTORY_CUSTOMER_NOT_FOUND",
        "请选择商品" => "CUSTOMER_INVENTORY_PRODUCT_REQUIRED",
        "长度必须大于 0" => "CUSTOMER_INVENTORY_LENGTH_INVALID",
        "颜色不能为空" => "CUSTOMER_INVENTORY_COLOR_REQUIRED",
        "数量必须大于 0" => "CUSTOMER_INVENTORY_QUANTITY_INVALID",
        "商品不属于当前客户" => "CUSTOMER_INVENTORY_PRODUCT_NOT_ASSIGNED",
        message if message.contains("同时命中") && message.ends_with("请检查颜色录入") => {
            "CUSTOMER_INVENTORY_COLOR_CATEGORY_CONFLICT"
        }
        message if message.contains("加工费未设置") => {
            "CUSTOMER_INVENTORY_PROCESSING_FEE_NOT_CONFIGURED"
        }
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn parse_customer_inventory_import_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<ParseCustomerInventoryImportResult, CommandError> {
    let file_path_text = normalize_customer_inventory_import_file_path(&path);
    let file_path = Path::new(&file_path_text);
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();
    let rows = match extension.as_str() {
        "csv" => read_customer_inventory_import_csv_rows(file_path),
        "xlsx" | "xls" => read_customer_inventory_import_excel_rows(file_path),
        _ => Err("仅支持 CSV、XLSX、XLS 文件".to_string()),
    }
    .map_err(map_customer_inventory_import_error)?;
    let mut result = parse_customer_inventory_import_rows(rows);

    if result.errors.is_empty() {
        let conn = state.conn.lock().map_err(|_| {
            CommandError::new("INTERNAL_ERROR", "failed to lock database connection")
        })?;

        if let Err(message) = build_customer_inventory_import_payloads(&conn, &result.rows) {
            result.errors.push(message);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn import_customer_inventory_batches(
    state: State<'_, AppState>,
    rows: Vec<ParsedCustomerInventoryImportRow>,
) -> Result<ImportCustomerInventoryResult, CommandError> {
    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::new("INTERNAL_ERROR", "failed to lock database connection"))?;
    import_customer_inventory_batches_inner(&mut conn, rows)
        .map_err(map_customer_inventory_import_error)
}

pub(crate) fn import_customer_inventory_batches_inner(
    conn: &mut Connection,
    rows: Vec<ParsedCustomerInventoryImportRow>,
) -> Result<ImportCustomerInventoryResult, String> {
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start customer inventory import transaction: {err}"))?;
    let payloads = build_customer_inventory_import_payloads(&tx, &rows)?;
    let item_count = rows.len();
    let total_quantity = rows.iter().map(|row| row.quantity).sum();
    let mut batch_ids = Vec::with_capacity(payloads.len());

    for (batch_key, payload) in payloads {
        let batch_id = create_customer_inventory_batch_in_transaction(&tx, payload)
            .map_err(|message| format!("批次 {batch_key}：{message}"))?;
        batch_ids.push(batch_id);
    }

    tx.commit()
        .map_err(|err| format!("failed to commit customer inventory import: {err}"))?;

    Ok(ImportCustomerInventoryResult {
        batch_count: batch_ids.len(),
        batch_ids,
        item_count,
        total_quantity,
    })
}

pub(crate) fn map_customer_inventory_import_error(message: String) -> CommandError {
    let code = if message.starts_with("无法") || message.starts_with("failed") {
        "CUSTOMER_INVENTORY_IMPORT_FILE_ERROR"
    } else {
        "CUSTOMER_INVENTORY_IMPORT_INVALID"
    };

    CommandError::new(code, message)
}

pub(crate) fn build_customer_inventory_import_payloads(
    conn: &Connection,
    rows: &[ParsedCustomerInventoryImportRow],
) -> Result<Vec<(String, CreateCustomerInventoryBatchPayload)>, String> {
    if rows.is_empty() {
        return Err("没有可导入的客户库存".to_string());
    }

    let mut batch_indexes = HashMap::<String, usize>::new();
    let mut grouped_rows = Vec::<(String, Vec<&ParsedCustomerInventoryImportRow>)>::new();

    for row in rows {
        let batch_key = row.batch_key.trim();

        if batch_key.is_empty() {
            return Err(format!("第 {} 行：导入批次标识不能为空", row.row_number));
        }

        if let Some(index) = batch_indexes.get(batch_key) {
            grouped_rows[*index].1.push(row);
        } else {
            batch_indexes.insert(batch_key.to_string(), grouped_rows.len());
            grouped_rows.push((batch_key.to_string(), vec![row]));
        }
    }

    let mut payloads = Vec::with_capacity(grouped_rows.len());

    for (batch_key, batch_rows) in grouped_rows {
        let first = batch_rows[0];
        for row in batch_rows.iter().skip(1) {
            if !same_customer_inventory_import_batch(first, row) {
                return Err(format!(
                    "第 {} 行：批次 {batch_key} 的客户、日期、价格或批次备注与同批次前一行不一致",
                    row.row_number
                ));
            }
        }

        let customer_id = query_customer_id_for_inventory_import(conn, &first.customer_name)?
            .ok_or_else(|| {
                format!(
                    "第 {} 行：客户不存在：{}",
                    first.row_number, first.customer_name
                )
            })?;
        let mut detail_keys = HashSet::new();
        let mut items = Vec::with_capacity(batch_rows.len());

        for row in batch_rows {
            let product_id = query_customer_product_id_for_import(
                conn,
                &customer_id,
                &row.product_name,
                &row.mold_code,
            )?
            .ok_or_else(|| {
                format!(
                    "第 {} 行：商品与模具编号不匹配，或商品未分配给客户：{} / {}",
                    row.row_number, row.product_name, row.mold_code
                )
            })?;
            let detail_key = format!("{product_id}:{}:{}", row.length_mm, row.color.trim());

            if !detail_keys.insert(detail_key) {
                return Err(format!(
                    "第 {} 行：批次 {batch_key} 内商品、长度和颜色重复",
                    row.row_number
                ));
            }

            items.push(CreateCustomerInventoryStockItemPayload {
                product_id,
                length_mm: row.length_mm,
                color: row.color.trim().to_string(),
                quantity: row.quantity,
                note: row.item_note.trim().to_string(),
            });
        }

        let payload = CreateCustomerInventoryBatchPayload {
            customer_id,
            historical_order_date: first.historical_order_date.clone(),
            historical_order_ref: first.historical_order_ref.trim().to_string(),
            aluminum_ingot_price_x100: first.aluminum_ingot_price_x100,
            pricing_tax_included: first.pricing_tax_included,
            bridge_processing_fee_x100: first.bridge_processing_fee_x100,
            powder_processing_fee_x100: first.powder_processing_fee_x100,
            billet_processing_fee_x100: first.billet_processing_fee_x100,
            oxidation_processing_fee_x100: first.oxidation_processing_fee_x100,
            electrophoresis_processing_fee_x100: first.electrophoresis_processing_fee_x100,
            note: first.batch_note.trim().to_string(),
            items,
        };
        let required_categories = get_required_customer_inventory_weights(&payload.items)?;

        validate_processing_fees_for_required_weights(
            payload.pricing_tax_included,
            ProcessingFeeSnapshot::new(
                payload.bridge_processing_fee_x100,
                payload.powder_processing_fee_x100,
                payload.billet_processing_fee_x100,
                payload.oxidation_processing_fee_x100,
                payload.electrophoresis_processing_fee_x100,
            ),
            &required_categories,
        )?;
        payloads.push((batch_key, payload));
    }

    Ok(payloads)
}

pub(crate) fn same_customer_inventory_import_batch(
    left: &ParsedCustomerInventoryImportRow,
    right: &ParsedCustomerInventoryImportRow,
) -> bool {
    left.customer_name.trim() == right.customer_name.trim()
        && left.historical_order_date == right.historical_order_date
        && left.historical_order_ref.trim() == right.historical_order_ref.trim()
        && left.aluminum_ingot_price_x100 == right.aluminum_ingot_price_x100
        && left.pricing_tax_included == right.pricing_tax_included
        && left.bridge_processing_fee_x100 == right.bridge_processing_fee_x100
        && left.powder_processing_fee_x100 == right.powder_processing_fee_x100
        && left.billet_processing_fee_x100 == right.billet_processing_fee_x100
        && left.oxidation_processing_fee_x100 == right.oxidation_processing_fee_x100
        && left.electrophoresis_processing_fee_x100 == right.electrophoresis_processing_fee_x100
        && left.batch_note.trim() == right.batch_note.trim()
}

#[tauri::command]
pub fn update_customer_inventory_batch(
    state: State<'_, AppState>,
    payload: UpdateCustomerInventoryBatchPayload,
) -> Result<(), CommandError> {
    update_customer_inventory_batch_inner(state, payload)
        .map_err(map_update_customer_inventory_batch_error)
}

pub(crate) fn update_customer_inventory_batch_inner(
    state: State<'_, AppState>,
    payload: UpdateCustomerInventoryBatchPayload,
) -> Result<(), String> {
    let batch_id = payload.batch_id.trim();
    let customer_id = payload.customer_id.trim();
    let historical_order_ref = payload.historical_order_ref.trim();
    let note = payload.note.trim();
    let historical_order_date = payload
        .historical_order_date
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if batch_id.is_empty() {
        return Err("请选择客户库存批次".to_string());
    }

    if customer_id.is_empty() {
        return Err("请选择客户".to_string());
    }

    if let Some(historical_order_date) = historical_order_date {
        validate_date(historical_order_date, "历史下单日期")?;
    }

    if payload.aluminum_ingot_price_x100 <= 0 {
        return Err("铝锭价必须大于 0".to_string());
    }

    let processing_fees = ProcessingFeeSnapshot::new(
        payload.bridge_processing_fee_x100,
        payload.powder_processing_fee_x100,
        payload.billet_processing_fee_x100,
        payload.oxidation_processing_fee_x100,
        payload.electrophoresis_processing_fee_x100,
    );

    if payload.items.is_empty() {
        return Err("请至少添加一项客户库存".to_string());
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start customer inventory update transaction: {err}"))?;

    let existing_batch = query_customer_inventory_batch(&tx, batch_id)?
        .ok_or_else(|| "客户库存批次不存在".to_string())?;

    if existing_batch.has_delivery_note {
        return Err("该客户库存批次已出库，不能修改".to_string());
    }

    let customer =
        query_customer_for_inventory(&tx, customer_id)?.ok_or_else(|| "客户不存在".to_string())?;
    let required_weights = get_required_customer_inventory_weights(&payload.items)?;

    validate_processing_fees_for_required_weights(
        payload.pricing_tax_included,
        processing_fees,
        &required_weights,
    )?;

    tx.execute(
        "
        UPDATE customer_inventory_batches
        SET
          customer_id = ?2,
          customer_name = ?3,
          customer_address = ?4,
          historical_order_date = ?5,
          historical_order_ref = ?6,
          aluminum_ingot_price_x100 = ?7,
          pricing_tax_included = ?8,
          bridge_processing_fee_x100 = ?9,
          powder_processing_fee_x100 = ?10,
          billet_processing_fee_x100 = ?11,
          oxidation_processing_fee_x100 = ?12,
          electrophoresis_processing_fee_x100 = ?13,
          note = ?14,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![
            batch_id,
            customer_id,
            &customer.customer_name,
            &customer.customer_address,
            historical_order_date,
            historical_order_ref,
            payload.aluminum_ingot_price_x100,
            payload.pricing_tax_included,
            processing_fees.bridge,
            processing_fees.powder,
            processing_fees.billet,
            processing_fees.oxidation,
            processing_fees.electrophoresis,
            note
        ],
    )
    .map_err(|err| format!("failed to update customer inventory batch: {err}"))?;

    tx.execute(
        "DELETE FROM customer_inventory_movements WHERE batch_id = ?1 AND movement_type = 'historical_import'",
        [batch_id],
    )
    .map_err(|err| format!("failed to reset customer inventory movements: {err}"))?;
    tx.execute(
        "DELETE FROM customer_inventory_stocks WHERE batch_id = ?1",
        [batch_id],
    )
    .map_err(|err| format!("failed to reset customer inventory stocks: {err}"))?;

    for (stock_number, item) in (1..).zip(payload.items) {
        let product_id = item.product_id.trim();
        let color = item.color.trim();
        let item_note = item.note.trim();

        if product_id.is_empty() {
            return Err("请选择商品".to_string());
        }

        if item.length_mm <= 0 {
            return Err("长度必须大于 0".to_string());
        }

        if color.is_empty() {
            return Err("颜色不能为空".to_string());
        }

        if item.quantity <= 0 {
            return Err("数量必须大于 0".to_string());
        }

        let product = query_customer_product_for_inventory(&tx, product_id, customer_id)?
            .ok_or_else(|| "商品不属于当前客户".to_string())?;
        let stock_id = format_customer_inventory_stock_id(batch_id, stock_number);

        tx.execute(
            "
            INSERT INTO customer_inventory_stocks (
              id,
              batch_id,
              product_id,
              product_name,
              mold_code,
              length_mm,
              color,
              quantity,
              note,
              created_at,
              updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ",
            params![
                &stock_id,
                batch_id,
                product_id,
                &product.product_name,
                &product.mold_code,
                item.length_mm,
                color,
                item.quantity,
                item_note
            ],
        )
        .map_err(|err| format!("failed to update customer inventory stock: {err}"))?;

        write_customer_inventory_movement(
            &tx,
            CustomerInventoryMovementInput {
                batch_id: Some(batch_id),
                stock_id: Some(&stock_id),
                customer_id: Some(customer_id),
                customer_name: &customer.customer_name,
                delivery_note_id: None,
                product_id: Some(product_id),
                product_name: &product.product_name,
                mold_code: &product.mold_code,
                length_mm: Some(item.length_mm),
                color,
                movement_type: "historical_import",
                quantity_before: 0,
                quantity_after: item.quantity,
                delta_quantity: item.quantity,
                note,
            },
        )?;
    }

    tx.commit()
        .map_err(|err| format!("failed to commit customer inventory batch update: {err}"))
}

pub(crate) fn map_update_customer_inventory_batch_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择客户库存批次" => "CUSTOMER_INVENTORY_BATCH_REQUIRED",
        "请选择客户" => "CUSTOMER_INVENTORY_CUSTOMER_REQUIRED",
        "历史下单日期格式必须为 YYYY-MM-DD" => "CUSTOMER_INVENTORY_DATE_INVALID",
        "铝锭价必须大于 0" => "CUSTOMER_INVENTORY_PRICE_INVALID",
        "请至少添加一项客户库存" => "CUSTOMER_INVENTORY_ITEMS_REQUIRED",
        "客户库存批次不存在" => "CUSTOMER_INVENTORY_BATCH_NOT_FOUND",
        "该客户库存批次已出库，不能修改" => "CUSTOMER_INVENTORY_LOCKED",
        "客户不存在" => "CUSTOMER_INVENTORY_CUSTOMER_NOT_FOUND",
        "请选择商品" => "CUSTOMER_INVENTORY_PRODUCT_REQUIRED",
        "长度必须大于 0" => "CUSTOMER_INVENTORY_LENGTH_INVALID",
        "颜色不能为空" => "CUSTOMER_INVENTORY_COLOR_REQUIRED",
        "数量必须大于 0" => "CUSTOMER_INVENTORY_QUANTITY_INVALID",
        "商品不属于当前客户" => "CUSTOMER_INVENTORY_PRODUCT_NOT_ASSIGNED",
        message if message.contains("同时命中") && message.ends_with("请检查颜色录入") => {
            "CUSTOMER_INVENTORY_COLOR_CATEGORY_CONFLICT"
        }
        message if message.contains("加工费未设置") => {
            "CUSTOMER_INVENTORY_PROCESSING_FEE_NOT_CONFIGURED"
        }
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn create_customer_inventory_delivery_note(
    state: State<'_, AppState>,
    payload: CreateCustomerInventoryDeliveryNotePayload,
) -> Result<DeliveryNote, CommandError> {
    create_customer_inventory_delivery_note_inner(state, payload)
        .map_err(map_create_customer_inventory_delivery_note_error)
}

pub(crate) fn create_customer_inventory_delivery_note_inner(
    state: State<'_, AppState>,
    payload: CreateCustomerInventoryDeliveryNotePayload,
) -> Result<DeliveryNote, String> {
    let batch_ids = normalized_customer_inventory_delivery_batch_ids(&payload);
    let price_group_inputs = normalized_customer_inventory_delivery_price_group_inputs(&payload);
    let handler_name = payload.handler_name.trim();
    let note = payload.note.trim();
    let special_note = payload.special_note.trim();

    if batch_ids.is_empty() {
        return Err("请选择客户库存批次".to_string());
    }

    if handler_name.is_empty() {
        return Err("请输入经手人".to_string());
    }

    if price_group_inputs
        .iter()
        .all(|price_group| price_group.items.is_empty())
    {
        return Err("请至少选择一项出库明细".to_string());
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start customer delivery note transaction: {err}"))?;
    let batches = batch_ids
        .iter()
        .map(|batch_id| {
            query_customer_inventory_batch(&tx, batch_id)?
                .ok_or_else(|| "客户库存批次不存在".to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    let batch = batches
        .first()
        .ok_or_else(|| "请选择客户库存批次".to_string())?;

    validate_customer_inventory_delivery_batches(batch, &batches)?;

    let mut resolved_price_groups = Vec::new();
    let price_group_count = price_group_inputs.len();
    let mut delivery_quantity = 0_i64;

    for (price_group_index, price_group) in price_group_inputs.into_iter().enumerate() {
        if price_group.bridge_weight_kg_x100 < 0
            || price_group.powder_weight_kg_x100 < 0
            || price_group.billet_weight_kg_x100 < 0
            || price_group.oxidation_weight_kg_x100 < 0
            || price_group.electrophoresis_weight_kg_x100 < 0
        {
            return Err("重量不能小于 0".to_string());
        }

        let group_batch_ids = if price_group.batch_ids.is_empty() {
            batch_ids.clone()
        } else {
            price_group.batch_ids.clone()
        };
        let group_batches = group_batch_ids
            .iter()
            .map(|batch_id| find_customer_inventory_batch(&batches, batch_id))
            .collect::<Result<Vec<_>, _>>()?;
        let group_batch = group_batches
            .first()
            .copied()
            .ok_or_else(|| "请选择客户库存批次".to_string())?;
        let group_delivery_quantity = price_group.items.iter().try_fold(0_i64, |total, item| {
            if item.quantity < 0 {
                return Err("出库数量不能小于 0".to_string());
            }

            Ok(total + item.quantity)
        })?;

        if group_delivery_quantity <= 0 {
            continue;
        }

        let stock_items = price_group
            .items
            .iter()
            .filter(|item| item.quantity > 0)
            .map(|item| query_customer_inventory_stock_for_delivery(&tx, item.stock_id.trim()))
            .collect::<Result<Vec<_>, _>>()?;
        let allowed_batch_ids: std::collections::HashSet<&str> =
            group_batch_ids.iter().map(String::as_str).collect();

        for stock in stock_items.iter() {
            if !allowed_batch_ids.contains(stock.batch_id.as_str()) {
                return Err("出库明细不属于所选客户库存批次".to_string());
            }

            if stock.customer_id != batch.customer_id {
                return Err("出库明细必须属于同一客户".to_string());
            }
        }

        validate_customer_inventory_delivery_price_group(
            group_batch,
            &group_batches,
            &stock_items,
        )?;
        let required_weights = get_required_customer_delivery_weights(&stock_items)?;

        if required_weights.bridge && price_group.bridge_weight_kg_x100 <= 0 {
            return Err("请填写断桥重量".to_string());
        }

        if required_weights.powder && price_group.powder_weight_kg_x100 <= 0 {
            return Err("请填写喷涂重量".to_string());
        }

        if required_weights.billet && price_group.billet_weight_kg_x100 <= 0 {
            return Err("请填写坯料重量".to_string());
        }

        if required_weights.oxidation && price_group.oxidation_weight_kg_x100 <= 0 {
            return Err("请填写氧化重量".to_string());
        }

        if required_weights.electrophoresis && price_group.electrophoresis_weight_kg_x100 <= 0 {
            return Err("请填写电泳重量".to_string());
        }

        validate_processing_fees_for_required_weights(
            group_batch.pricing_tax_included,
            ProcessingFeeSnapshot::new(
                group_batch.bridge_processing_fee_x100,
                group_batch.powder_processing_fee_x100,
                group_batch.billet_processing_fee_x100,
                group_batch.oxidation_processing_fee_x100,
                group_batch.electrophoresis_processing_fee_x100,
            ),
            &required_weights,
        )?;

        let pricing_profile = resolve_customer_inventory_pricing_profile(
            &tx,
            &group_batch.customer_id,
            &group_batch.note,
        )?;
        let extra_charge = normalize_delivery_extra_charge(
            &price_group.extra_charge_name,
            price_group.extra_charge_amount_x100,
        )?;

        delivery_quantity += group_delivery_quantity;
        resolved_price_groups.push(ResolvedCustomerInventoryDeliveryPriceGroup {
            title: if price_group_count > 1 {
                format!("计价方案{}", price_group_index + 1)
            } else {
                "计价方案".to_string()
            },
            batch_ids: group_batch_ids,
            aluminum_ingot_price_x100: group_batch.aluminum_ingot_price_x100,
            pricing_tax_included: group_batch.pricing_tax_included,
            bridge_processing_fee_x100: group_batch.bridge_processing_fee_x100,
            powder_processing_fee_x100: group_batch.powder_processing_fee_x100,
            billet_processing_fee_x100: group_batch.billet_processing_fee_x100,
            oxidation_processing_fee_x100: group_batch.oxidation_processing_fee_x100,
            electrophoresis_processing_fee_x100: group_batch.electrophoresis_processing_fee_x100,
            bridge_weight_kg_x100: price_group.bridge_weight_kg_x100,
            powder_weight_kg_x100: price_group.powder_weight_kg_x100,
            billet_weight_kg_x100: price_group.billet_weight_kg_x100,
            oxidation_weight_kg_x100: price_group.oxidation_weight_kg_x100,
            electrophoresis_weight_kg_x100: price_group.electrophoresis_weight_kg_x100,
            extra_charge_name: extra_charge.name,
            extra_charge_amount_x100: extra_charge.amount_x100,
            pricing_profile_name: pricing_profile.profile_name,
            pricing_trigger_keyword: pricing_profile.trigger_keyword,
            items: price_group.items,
        });
    }

    if delivery_quantity <= 0 || resolved_price_groups.is_empty() {
        return Err("请至少录入一项出库数量".to_string());
    }

    let first_price_group = resolved_price_groups
        .first()
        .ok_or_else(|| "请至少录入一项出库数量".to_string())?;

    let delivery_note_id = next_customer_inventory_delivery_note_id(&tx, batch, batches.len() > 1)?;
    let delivery_date: String = tx
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .map_err(|err| format!("failed to resolve delivery date: {err}"))?;

    tx.execute(
        "
        INSERT INTO customer_inventory_delivery_notes (
          id,
          batch_id,
          customer_id,
          customer_name,
          customer_address,
          handler_name,
          historical_order_date,
          historical_order_ref,
          delivery_date,
          aluminum_ingot_price_x100,
          pricing_tax_included,
          bridge_processing_fee_x100,
          powder_processing_fee_x100,
          billet_processing_fee_x100,
          oxidation_processing_fee_x100,
          electrophoresis_processing_fee_x100,
          bridge_weight_kg_x100,
          powder_weight_kg_x100,
          billet_weight_kg_x100,
          oxidation_weight_kg_x100,
          electrophoresis_weight_kg_x100,
          extra_charge_name,
          extra_charge_amount_x100,
          pricing_profile_name,
          pricing_trigger_keyword,
          note,
          special_note,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ",
        params![
            &delivery_note_id,
            if batches.len() == 1 {
                Some(batch.id.as_str())
            } else {
                None
            },
            &batch.customer_id,
            &batch.customer_name,
            &batch.customer_address,
            handler_name,
            &batch.historical_order_date,
            &batch.historical_order_ref,
            &delivery_date,
            first_price_group.aluminum_ingot_price_x100,
            first_price_group.pricing_tax_included,
            first_price_group.bridge_processing_fee_x100,
            first_price_group.powder_processing_fee_x100,
            first_price_group.billet_processing_fee_x100,
            first_price_group.oxidation_processing_fee_x100,
            first_price_group.electrophoresis_processing_fee_x100,
            first_price_group.bridge_weight_kg_x100,
            first_price_group.powder_weight_kg_x100,
            first_price_group.billet_weight_kg_x100,
            first_price_group.oxidation_weight_kg_x100,
            first_price_group.electrophoresis_weight_kg_x100,
            &first_price_group.extra_charge_name,
            first_price_group.extra_charge_amount_x100,
            &first_price_group.pricing_profile_name,
            &first_price_group.pricing_trigger_keyword,
            note,
            special_note
        ],
    )
    .map_err(|err| format!("failed to create customer inventory delivery note: {err}"))?;

    let mut delivery_item_number = 1;
    for (price_group_index, price_group) in resolved_price_groups.iter().enumerate() {
        let price_group_id = format!("{}-PG-{:03}", delivery_note_id, price_group_index + 1);

        tx.execute(
            "
            INSERT INTO customer_inventory_delivery_note_price_groups (
              id,
              delivery_note_id,
              group_index,
              title,
              aluminum_ingot_price_x100,
              pricing_tax_included,
              bridge_processing_fee_x100,
              powder_processing_fee_x100,
              billet_processing_fee_x100,
              oxidation_processing_fee_x100,
              electrophoresis_processing_fee_x100,
              bridge_weight_kg_x100,
              powder_weight_kg_x100,
              billet_weight_kg_x100,
              oxidation_weight_kg_x100,
              electrophoresis_weight_kg_x100,
              extra_charge_name,
              extra_charge_amount_x100,
              pricing_profile_name,
              pricing_trigger_keyword,
              created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, CURRENT_TIMESTAMP)
            ",
            params![
                &price_group_id,
                &delivery_note_id,
                (price_group_index as i64) + 1,
                &price_group.title,
                price_group.aluminum_ingot_price_x100,
                price_group.pricing_tax_included,
                price_group.bridge_processing_fee_x100,
                price_group.powder_processing_fee_x100,
                price_group.billet_processing_fee_x100,
                price_group.oxidation_processing_fee_x100,
                price_group.electrophoresis_processing_fee_x100,
                price_group.bridge_weight_kg_x100,
                price_group.powder_weight_kg_x100,
                price_group.billet_weight_kg_x100,
                price_group.oxidation_weight_kg_x100,
                price_group.electrophoresis_weight_kg_x100,
                &price_group.extra_charge_name,
                price_group.extra_charge_amount_x100,
                &price_group.pricing_profile_name,
                &price_group.pricing_trigger_keyword
            ],
        )
        .map_err(|err| {
            format!("failed to create customer inventory delivery note price group: {err}")
        })?;

        let allowed_batch_ids: std::collections::HashSet<&str> =
            price_group.batch_ids.iter().map(String::as_str).collect();

        for item in price_group.items.iter() {
            let stock_id = item.stock_id.trim();
            let item_note = item.note.trim();

            if item.quantity <= 0 {
                continue;
            }

            let stock = query_customer_inventory_stock_for_delivery(&tx, stock_id)?;

            if !allowed_batch_ids.contains(stock.batch_id.as_str()) {
                return Err("出库明细不属于所选客户库存批次".to_string());
            }

            if item.quantity > stock.quantity {
                return Err(format!("{} 出库数量不能大于当前库存", stock.product_name));
            }

            let group_label = if item.group_label.trim().is_empty() {
                derive_customer_inventory_delivery_group_label(&stock.batch_note)
            } else {
                item.group_label.trim().to_string()
            };

            if group_label.is_empty() {
                return Err(format!("{} 出库分组不能为空", stock.product_name));
            }

            let quantity_after = stock.quantity - item.quantity;
            tx.execute(
                "
                UPDATE customer_inventory_stocks
                SET quantity = ?2, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?1
                ",
                params![stock.id, quantity_after],
            )
            .map_err(|err| format!("failed to update customer inventory stock: {err}"))?;
            tx.execute(
                "
                INSERT INTO customer_inventory_delivery_note_items (
                  id,
                  delivery_note_id,
                  price_group_id,
                  stock_id,
                  product_id,
                  product_name,
                  mold_code,
                  length_mm,
                  color,
                  order_quantity,
                  quantity,
                  note,
                  group_label,
                  created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, CURRENT_TIMESTAMP)
                ",
                params![
                    format_delivery_note_item_id(&delivery_note_id, delivery_item_number),
                    &delivery_note_id,
                    &price_group_id,
                    &stock.id,
                    &stock.product_id,
                    &stock.product_name,
                    &stock.mold_code,
                    stock.length_mm,
                    &stock.color,
                    stock.original_quantity,
                    item.quantity,
                    item_note,
                    group_label
                ],
            )
            .map_err(|err| {
                format!("failed to create customer inventory delivery note item: {err}")
            })?;
            delivery_item_number += 1;

            let movement_note = if item_note.is_empty() {
                format!("历史库存出库单 {delivery_note_id}")
            } else {
                format!("历史库存出库单 {delivery_note_id}，{item_note}")
            };
            write_customer_inventory_movement(
                &tx,
                CustomerInventoryMovementInput {
                    batch_id: Some(&stock.batch_id),
                    stock_id: Some(&stock.id),
                    customer_id: Some(&stock.customer_id),
                    customer_name: &stock.customer_name,
                    delivery_note_id: Some(&delivery_note_id),
                    product_id: stock.product_id.as_deref(),
                    product_name: &stock.product_name,
                    mold_code: &stock.mold_code,
                    length_mm: Some(stock.length_mm),
                    color: &stock.color,
                    movement_type: "out",
                    quantity_before: stock.quantity,
                    quantity_after,
                    delta_quantity: -item.quantity,
                    note: &movement_note,
                },
            )?;
        }
    }

    tx.commit()
        .map_err(|err| format!("failed to commit customer inventory delivery note: {err}"))?;

    query_customer_inventory_delivery_note(&conn, &delivery_note_id)?
        .ok_or_else(|| "历史库存出库单不存在".to_string())
}

pub(crate) fn map_create_customer_inventory_delivery_note_error(message: String) -> CommandError {
    let code = if message.ends_with(" 出库数量不能大于当前库存") {
        "CUSTOMER_DELIVERY_ITEM_INSUFFICIENT_STOCK"
    } else if message.ends_with(" 出库分组不能为空") {
        "CUSTOMER_DELIVERY_GROUP_REQUIRED"
    } else {
        match message.as_str() {
            "请选择客户库存批次" => "CUSTOMER_DELIVERY_BATCH_REQUIRED",
            "请输入经手人" => "CUSTOMER_DELIVERY_HANDLER_REQUIRED",
            "请至少选择一项出库明细" => "CUSTOMER_DELIVERY_ITEMS_REQUIRED",
            "客户库存批次不存在" => "CUSTOMER_INVENTORY_BATCH_NOT_FOUND",
            "只能合并同一客户的库存批次" => {
                "CUSTOMER_DELIVERY_BATCH_CUSTOMER_MISMATCH"
            }
            "重量不能小于 0" => "CUSTOMER_DELIVERY_WEIGHT_INVALID",
            "出库数量不能小于 0" => "CUSTOMER_DELIVERY_QUANTITY_INVALID",
            "出库明细不属于所选客户库存批次" => {
                "CUSTOMER_DELIVERY_ITEM_BATCH_MISMATCH"
            }
            "出库明细必须属于同一客户" => "CUSTOMER_DELIVERY_CUSTOMER_MISMATCH",
            "合并出库的批次价格快照必须一致，请拆开出库" => {
                "CUSTOMER_DELIVERY_BATCH_PRICING_MISMATCH"
            }
            "出库明细的价格快照必须一致，请拆开出库" => {
                "CUSTOMER_DELIVERY_ITEM_PRICING_MISMATCH"
            }
            "请填写断桥重量" => "CUSTOMER_DELIVERY_BRIDGE_WEIGHT_REQUIRED",
            "请填写喷涂重量" => "CUSTOMER_DELIVERY_POWDER_WEIGHT_REQUIRED",
            "请填写坯料重量" => "CUSTOMER_DELIVERY_BILLET_WEIGHT_REQUIRED",
            "请填写氧化重量" => "CUSTOMER_DELIVERY_OXIDATION_WEIGHT_REQUIRED",
            "请填写电泳重量" => "CUSTOMER_DELIVERY_ELECTROPHORESIS_WEIGHT_REQUIRED",
            "收费金额不能小于 0" => "DELIVERY_EXTRA_CHARGE_AMOUNT_INVALID",
            "收费金额必须大于 0" => "DELIVERY_EXTRA_CHARGE_AMOUNT_REQUIRED",
            "请至少录入一项出库数量" => "CUSTOMER_DELIVERY_QUANTITY_REQUIRED",
            "出库商品不能为空" => "CUSTOMER_DELIVERY_PRODUCT_REQUIRED",
            "客户库存商品不存在" => "CUSTOMER_DELIVERY_ITEM_NOT_FOUND",
            "历史库存出库单不存在" => "CUSTOMER_DELIVERY_NOT_FOUND",
            message if message.contains("同时命中") && message.ends_with("请检查颜色录入") => {
                "CUSTOMER_DELIVERY_COLOR_CATEGORY_CONFLICT"
            }
            message if message.contains("加工费未设置") => {
                "CUSTOMER_DELIVERY_PROCESSING_FEE_NOT_CONFIGURED"
            }
            _ => "INTERNAL_ERROR",
        }
    };

    CommandError::new(code, message)
}

pub(crate) fn normalized_customer_inventory_delivery_batch_ids(
    payload: &CreateCustomerInventoryDeliveryNotePayload,
) -> Vec<String> {
    let mut batch_ids = Vec::new();

    if let Some(batch_id) = payload.batch_id.as_deref() {
        let trimmed_batch_id = batch_id.trim();

        if !trimmed_batch_id.is_empty() {
            batch_ids.push(trimmed_batch_id.to_string());
        }
    }

    for batch_id in payload.batch_ids.iter() {
        let trimmed_batch_id = batch_id.trim();

        if !trimmed_batch_id.is_empty() && !batch_ids.iter().any(|id| id == trimmed_batch_id) {
            batch_ids.push(trimmed_batch_id.to_string());
        }
    }

    for price_group in payload.price_groups.iter() {
        for batch_id in price_group.batch_ids.iter() {
            let trimmed_batch_id = batch_id.trim();

            if !trimmed_batch_id.is_empty() && !batch_ids.iter().any(|id| id == trimmed_batch_id) {
                batch_ids.push(trimmed_batch_id.to_string());
            }
        }
    }

    batch_ids
}

pub(crate) fn normalized_customer_inventory_delivery_price_group_inputs(
    payload: &CreateCustomerInventoryDeliveryNotePayload,
) -> Vec<CustomerInventoryDeliveryPriceGroupInput> {
    if !payload.price_groups.is_empty() {
        return payload
            .price_groups
            .iter()
            .map(|price_group| CustomerInventoryDeliveryPriceGroupInput {
                batch_ids: price_group
                    .batch_ids
                    .iter()
                    .map(|batch_id| batch_id.trim().to_string())
                    .filter(|batch_id| !batch_id.is_empty())
                    .fold(Vec::new(), |mut batch_ids, batch_id| {
                        if !batch_ids.iter().any(|id| id == &batch_id) {
                            batch_ids.push(batch_id);
                        }

                        batch_ids
                    }),
                bridge_weight_kg_x100: price_group.bridge_weight_kg_x100,
                powder_weight_kg_x100: price_group.powder_weight_kg_x100,
                billet_weight_kg_x100: price_group.billet_weight_kg_x100,
                oxidation_weight_kg_x100: price_group.oxidation_weight_kg_x100,
                electrophoresis_weight_kg_x100: price_group.electrophoresis_weight_kg_x100,
                extra_charge_name: price_group.extra_charge_name.clone(),
                extra_charge_amount_x100: price_group.extra_charge_amount_x100,
                items: price_group.items.clone(),
            })
            .collect();
    }

    vec![CustomerInventoryDeliveryPriceGroupInput {
        batch_ids: normalized_customer_inventory_delivery_batch_ids(payload),
        bridge_weight_kg_x100: payload.bridge_weight_kg_x100,
        powder_weight_kg_x100: payload.powder_weight_kg_x100,
        billet_weight_kg_x100: payload.billet_weight_kg_x100,
        oxidation_weight_kg_x100: payload.oxidation_weight_kg_x100,
        electrophoresis_weight_kg_x100: payload.electrophoresis_weight_kg_x100,
        extra_charge_name: payload.extra_charge_name.clone(),
        extra_charge_amount_x100: payload.extra_charge_amount_x100,
        items: payload.items.clone(),
    }]
}

pub(crate) fn find_customer_inventory_batch<'a>(
    batches: &'a [CustomerInventoryBatch],
    batch_id: &str,
) -> Result<&'a CustomerInventoryBatch, String> {
    batches
        .iter()
        .find(|batch| batch.id == batch_id)
        .ok_or_else(|| "客户库存批次不存在".to_string())
}

pub(crate) fn derive_customer_inventory_delivery_group_label(batch_note: &str) -> String {
    batch_note
        .trim()
        .split([',', '，'])
        .nth(1)
        .unwrap_or_default()
        .trim()
        .to_string()
}

pub(crate) fn validate_customer_inventory_delivery_batches(
    first_batch: &CustomerInventoryBatch,
    batches: &[CustomerInventoryBatch],
) -> Result<(), String> {
    for batch in batches.iter() {
        if batch.customer_id != first_batch.customer_id {
            return Err("只能合并同一客户的库存批次".to_string());
        }
    }

    Ok(())
}

pub(crate) fn validate_customer_inventory_delivery_price_group(
    first_batch: &CustomerInventoryBatch,
    batches: &[&CustomerInventoryBatch],
    stock_items: &[CustomerInventoryStockForDelivery],
) -> Result<(), String> {
    for batch in batches.iter() {
        if batch.aluminum_ingot_price_x100 != first_batch.aluminum_ingot_price_x100
            || batch.pricing_tax_included != first_batch.pricing_tax_included
            || batch.bridge_processing_fee_x100 != first_batch.bridge_processing_fee_x100
            || batch.powder_processing_fee_x100 != first_batch.powder_processing_fee_x100
            || batch.billet_processing_fee_x100 != first_batch.billet_processing_fee_x100
            || batch.oxidation_processing_fee_x100 != first_batch.oxidation_processing_fee_x100
            || batch.electrophoresis_processing_fee_x100
                != first_batch.electrophoresis_processing_fee_x100
        {
            return Err("合并出库的批次价格快照必须一致，请拆开出库".to_string());
        }
    }

    for stock in stock_items.iter() {
        if stock.aluminum_ingot_price_x100 != first_batch.aluminum_ingot_price_x100
            || stock.pricing_tax_included != first_batch.pricing_tax_included
            || stock.bridge_processing_fee_x100 != first_batch.bridge_processing_fee_x100
            || stock.powder_processing_fee_x100 != first_batch.powder_processing_fee_x100
            || stock.billet_processing_fee_x100 != first_batch.billet_processing_fee_x100
            || stock.oxidation_processing_fee_x100 != first_batch.oxidation_processing_fee_x100
            || stock.electrophoresis_processing_fee_x100
                != first_batch.electrophoresis_processing_fee_x100
        {
            return Err("出库明细的价格快照必须一致，请拆开出库".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
pub fn adjust_customer_inventory_stock(
    state: State<'_, AppState>,
    payload: AdjustCustomerInventoryStockPayload,
) -> Result<(), CommandError> {
    let stock_id = payload.stock_id.trim();
    let note = payload.note.trim();

    if stock_id.is_empty() {
        return Err(CommandError::new(
            "CUSTOMER_INVENTORY_STOCK_REQUIRED",
            "请选择客户库存明细",
        ));
    }

    if payload.quantity < 0 {
        return Err(CommandError::new(
            "CUSTOMER_INVENTORY_ADJUST_QUANTITY_INVALID",
            "盘点数量不能小于 0",
        ));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;
    let tx = conn.transaction().map_err(|err| {
        CommandError::internal(format!(
            "failed to start customer inventory adjustment: {err}"
        ))
    })?;
    let stock = query_customer_inventory_stock_by_id(&tx, stock_id)
        .map_err(map_customer_inventory_adjust_error)?
        .ok_or_else(|| {
            CommandError::new("CUSTOMER_INVENTORY_STOCK_NOT_FOUND", "客户库存商品不存在")
        })?;

    if payload.quantity == stock.quantity {
        return Err(CommandError::new(
            "CUSTOMER_INVENTORY_ADJUST_UNCHANGED",
            "盘点数量未变化",
        ));
    }

    tx.execute(
        "
        UPDATE customer_inventory_stocks
        SET quantity = ?2, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![stock.id, payload.quantity],
    )
    .map_err(|err| {
        CommandError::internal(format!("failed to adjust customer inventory stock: {err}"))
    })?;

    let movement_note = if note.is_empty() {
        "客户库存盘点"
    } else {
        note
    };
    write_customer_inventory_movement(
        &tx,
        CustomerInventoryMovementInput {
            batch_id: Some(&stock.batch_id),
            stock_id: Some(&stock.id),
            customer_id: Some(&stock.customer_id),
            customer_name: &stock.customer_name,
            delivery_note_id: None,
            product_id: stock.product_id.as_deref(),
            product_name: &stock.product_name,
            mold_code: &stock.mold_code,
            length_mm: Some(stock.length_mm),
            color: &stock.color,
            movement_type: "adjust",
            quantity_before: stock.quantity,
            quantity_after: payload.quantity,
            delta_quantity: payload.quantity - stock.quantity,
            note: movement_note,
        },
    )
    .map_err(map_customer_inventory_adjust_error)?;

    tx.commit().map_err(|err| {
        CommandError::internal(format!(
            "failed to commit customer inventory adjustment: {err}"
        ))
    })
}

pub(crate) fn map_customer_inventory_adjust_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择客户库存明细" => "CUSTOMER_INVENTORY_STOCK_REQUIRED",
        "盘点数量不能小于 0" => "CUSTOMER_INVENTORY_ADJUST_QUANTITY_INVALID",
        "客户库存商品不存在" => "CUSTOMER_INVENTORY_STOCK_NOT_FOUND",
        "盘点数量未变化" => "CUSTOMER_INVENTORY_ADJUST_UNCHANGED",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn get_customer_inventory_delivery_note(
    state: State<'_, AppState>,
    id: String,
) -> Result<DeliveryNote, CommandError> {
    let id = id.trim();

    if id.is_empty() {
        return Err(CommandError::new(
            "CUSTOMER_DELIVERY_ID_REQUIRED",
            "出库单号不能为空",
        ));
    }

    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    query_customer_inventory_delivery_note(&conn, id)
        .map_err(map_get_customer_inventory_delivery_note_error)?
        .ok_or_else(|| CommandError::new("CUSTOMER_DELIVERY_NOT_FOUND", "历史库存出库单不存在"))
}

#[tauri::command]
pub fn update_customer_inventory_delivery_note_special_note(
    state: State<'_, AppState>,
    payload: UpdateDeliveryNoteSpecialNotePayload,
) -> Result<DeliveryNote, CommandError> {
    let id = payload.id.trim();

    if id.is_empty() {
        return Err(CommandError::new(
            "CUSTOMER_DELIVERY_ID_REQUIRED",
            "出库单号不能为空",
        ));
    }

    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    let affected = conn
        .execute(
            "
            UPDATE customer_inventory_delivery_notes
            SET special_note = ?2, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
            ",
            params![id, payload.special_note.trim()],
        )
        .map_err(|err| {
            CommandError::internal(format!(
                "failed to update customer inventory delivery note special note: {err}"
            ))
        })?;

    if affected == 0 {
        return Err(CommandError::new(
            "CUSTOMER_DELIVERY_NOT_FOUND",
            "历史库存出库单不存在",
        ));
    }

    query_customer_inventory_delivery_note(&conn, id)
        .map_err(map_get_customer_inventory_delivery_note_error)?
        .ok_or_else(|| CommandError::new("CUSTOMER_DELIVERY_NOT_FOUND", "历史库存出库单不存在"))
}

pub(crate) fn map_get_customer_inventory_delivery_note_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "出库单号不能为空" => "CUSTOMER_DELIVERY_ID_REQUIRED",
        "历史库存出库单不存在" => "CUSTOMER_DELIVERY_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}
