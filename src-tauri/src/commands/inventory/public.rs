use rusqlite::{params, OptionalExtension};
use tauri::State;

use crate::commands::error::CommandError;
use crate::db::AppState;

use super::helpers::{
    apply_order_inventory_adjustment, apply_order_inventory_batch_adjustment,
    ensure_order_inventory_unlocked, query_inventory_item, query_inventory_items,
    query_order_inventory_items, query_order_movements, query_order_product_for_inventory,
    query_product_for_inventory, query_recent_movements, write_inventory_movement,
    InventoryMovementInput, InventoryProduct, OrderInventoryAdjustmentParams,
};

use super::types::{
    AdjustInventoryPayload, AdjustOrderInventoryBatchPayload, AdjustOrderInventoryPayload,
    InventoryItem, InventoryListResult, ListInventoryParams, TransferPublicInventoryToOrderPayload,
};

#[tauri::command]
pub fn list_inventory(
    state: State<'_, AppState>,
    params: Option<ListInventoryParams>,
) -> Result<InventoryListResult, CommandError> {
    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    let search = params
        .and_then(|params| params.search)
        .unwrap_or_default()
        .trim()
        .to_string();

    let items = query_inventory_items(&conn, &search).map_err(map_inventory_list_error)?;
    let order_items =
        query_order_inventory_items(&conn, &search).map_err(map_inventory_list_error)?;
    let recent_movements =
        query_recent_movements(&conn, &search).map_err(map_inventory_list_error)?;
    let order_movements = query_order_movements(&conn).map_err(map_inventory_list_error)?;
    let total_quantity = conn
        .query_row(
            "SELECT COALESCE(SUM(quantity), 0) FROM inventory_stocks",
            [],
            |row| row.get(0),
        )
        .map_err(|err| {
            map_inventory_list_error(format!("failed to sum inventory quantity: {err}"))
        })?;

    Ok(InventoryListResult {
        items,
        order_items,
        recent_movements,
        order_movements,
        total_quantity,
    })
}

pub(crate) fn map_inventory_list_error(message: String) -> CommandError {
    CommandError::internal(message)
}

#[tauri::command]
pub fn adjust_inventory(
    state: State<'_, AppState>,
    payload: AdjustInventoryPayload,
) -> Result<InventoryItem, CommandError> {
    let product_id = payload.product_id.trim();
    let color = payload.color.trim();
    let movement_type = payload.movement_type.trim();
    let note = payload.note.trim();

    if product_id.is_empty() {
        return Err(CommandError::new(
            "INVENTORY_PRODUCT_REQUIRED",
            "请选择商品",
        ));
    }

    if payload.length_mm <= 0 {
        return Err(CommandError::new(
            "INVENTORY_LENGTH_INVALID",
            "长度必须大于 0",
        ));
    }

    if color.is_empty() {
        return Err(CommandError::new(
            "INVENTORY_COLOR_REQUIRED",
            "颜色不能为空",
        ));
    }

    if !matches!(movement_type, "in" | "out" | "adjust") {
        return Err(CommandError::new(
            "INVENTORY_MOVEMENT_TYPE_INVALID",
            "库存类型不正确",
        ));
    }

    if payload.quantity < 0 || (movement_type != "adjust" && payload.quantity == 0) {
        return Err(CommandError::new(
            "INVENTORY_QUANTITY_INVALID",
            "数量必须大于 0",
        ));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    let tx = conn.transaction().map_err(|err| {
        map_inventory_adjust_error(format!("failed to start inventory transaction: {err}"))
    })?;

    let product = query_product_for_inventory(&tx, product_id)
        .map_err(map_inventory_adjust_error)?
        .ok_or_else(|| CommandError::new("INVENTORY_PRODUCT_NOT_FOUND", "商品不存在"))?;

    let quantity_before = tx
        .query_row(
            "
            SELECT quantity
            FROM inventory_stocks
            WHERE product_id = ?1 AND length_mm = ?2 AND color = ?3
            ",
            params![product_id, payload.length_mm, color],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| {
            map_inventory_adjust_error(format!("failed to read inventory stock: {err}"))
        })?
        .unwrap_or(0);

    let quantity_after = match movement_type {
        "in" => quantity_before + payload.quantity,
        "out" => quantity_before - payload.quantity,
        "adjust" => payload.quantity,
        _ => unreachable!(),
    };

    if quantity_after < 0 {
        return Err(CommandError::new(
            "INVENTORY_INSUFFICIENT_STOCK",
            "出库数量不能大于当前库存",
        ));
    }

    let delta_quantity = quantity_after - quantity_before;
    if quantity_after == 0 {
        tx.execute(
            "
            DELETE FROM inventory_stocks
            WHERE product_id = ?1 AND length_mm = ?2 AND color = ?3
            ",
            params![product_id, payload.length_mm, color],
        )
        .map_err(|err| {
            map_inventory_adjust_error(format!("failed to clear inventory stock: {err}"))
        })?;
    } else {
        tx.execute(
            "
            INSERT INTO inventory_stocks (product_id, length_mm, color, quantity, updated_at)
            VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
            ON CONFLICT(product_id, length_mm, color) DO UPDATE SET
              quantity = excluded.quantity,
              updated_at = CURRENT_TIMESTAMP
            ",
            params![product_id, payload.length_mm, color, quantity_after],
        )
        .map_err(|err| {
            map_inventory_adjust_error(format!("failed to update inventory stock: {err}"))
        })?;
    }

    write_inventory_movement(
        &tx,
        InventoryMovementInput {
            product_id,
            order_id: None,
            delivery_note_id: None,
            length_mm: Some(payload.length_mm),
            color,
            product_name: &product.product_name,
            mold_code: &product.mold_code,
            movement_type,
            quantity_before,
            quantity_after,
            delta_quantity,
            note,
        },
    )
    .map_err(map_inventory_adjust_error)?;

    tx.commit().map_err(|err| {
        map_inventory_adjust_error(format!("failed to commit inventory adjustment: {err}"))
    })?;

    if quantity_after == 0 {
        return Ok(build_zero_inventory_item(
            product_id,
            product,
            payload.length_mm,
            color,
            note,
        ));
    }

    query_inventory_item(&conn, product_id, payload.length_mm, color)
        .map_err(map_inventory_adjust_error)?
        .ok_or_else(|| CommandError::new("INVENTORY_PRODUCT_NOT_FOUND", "商品不存在"))
}

pub(crate) fn map_inventory_adjust_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择商品" => "INVENTORY_PRODUCT_REQUIRED",
        "长度必须大于 0" => "INVENTORY_LENGTH_INVALID",
        "颜色不能为空" => "INVENTORY_COLOR_REQUIRED",
        "库存类型不正确" => "INVENTORY_MOVEMENT_TYPE_INVALID",
        "数量必须大于 0" => "INVENTORY_QUANTITY_INVALID",
        "出库数量不能大于当前库存" => "INVENTORY_INSUFFICIENT_STOCK",
        "商品不存在" => "INVENTORY_PRODUCT_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

pub(crate) fn build_zero_inventory_item(
    product_id: &str,
    product: InventoryProduct,
    length_mm: i64,
    color: &str,
    note: &str,
) -> InventoryItem {
    InventoryItem {
        product_id: product_id.to_string(),
        product_name: product.product_name,
        mold_code: product.mold_code,
        length_mm,
        color: color.to_string(),
        quantity: 0,
        thickness_mm_x100: product.thickness_mm_x100,
        weight_per_meter_kg_x1000: product.weight_per_meter_kg_x1000,
        latest_note: note.to_string(),
        updated_at: None,
    }
}

#[tauri::command]
pub fn adjust_order_inventory(
    state: State<'_, AppState>,
    payload: AdjustOrderInventoryPayload,
) -> Result<(), CommandError> {
    let order_id = payload.order_id.trim();
    let product_id = payload.product_id.trim();
    let color = payload.color.trim();
    let movement_type = payload.movement_type.trim();
    let note = payload.note.trim();

    if order_id.is_empty() {
        return Err(CommandError::new(
            "ORDER_INVENTORY_ORDER_REQUIRED",
            "请选择订单",
        ));
    }

    if product_id.is_empty() {
        return Err(CommandError::new(
            "ORDER_INVENTORY_PRODUCT_REQUIRED",
            "请选择商品",
        ));
    }

    if payload.length_mm <= 0 {
        return Err(CommandError::new(
            "ORDER_INVENTORY_LENGTH_INVALID",
            "长度必须大于 0",
        ));
    }

    if color.is_empty() {
        return Err(CommandError::new(
            "ORDER_INVENTORY_COLOR_REQUIRED",
            "颜色不能为空",
        ));
    }

    if !matches!(movement_type, "produce" | "ship" | "adjust") {
        return Err(CommandError::new(
            "ORDER_INVENTORY_MOVEMENT_TYPE_INVALID",
            "订单库存类型不正确",
        ));
    }

    if payload.quantity < 0 || (movement_type != "adjust" && payload.quantity == 0) {
        return Err(CommandError::new(
            "ORDER_INVENTORY_QUANTITY_INVALID",
            "数量必须大于 0",
        ));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    let tx = conn.transaction().map_err(|err| {
        CommandError::internal(format!(
            "failed to start order inventory transaction: {err}"
        ))
    })?;

    apply_order_inventory_adjustment(
        &tx,
        OrderInventoryAdjustmentParams {
            order_id,
            product_id,
            length_mm: payload.length_mm,
            color,
            movement_type,
            quantity: payload.quantity,
            note,
        },
    )
    .map_err(map_order_inventory_adjust_error)?;

    tx.commit().map_err(|err| {
        CommandError::internal(format!(
            "failed to commit order inventory adjustment: {err}"
        ))
    })?;

    Ok(())
}

pub(crate) fn map_order_inventory_adjust_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "订单已出库，库存已锁定" | "该订单已出库，库存已锁定" => {
            "ORDER_INVENTORY_LOCKED"
        }
        "订单商品不存在" => "ORDER_INVENTORY_ITEM_NOT_FOUND",
        "出库数量不能大于当前订单库存" => "ORDER_INVENTORY_INSUFFICIENT_STOCK",
        "订单库存类型不正确" => "ORDER_INVENTORY_MOVEMENT_TYPE_INVALID",
        "数量必须大于 0" => "ORDER_INVENTORY_QUANTITY_INVALID",
        "请选择订单" => "ORDER_INVENTORY_ORDER_REQUIRED",
        "请选择商品" => "ORDER_INVENTORY_PRODUCT_REQUIRED",
        "长度必须大于 0" => "ORDER_INVENTORY_LENGTH_INVALID",
        "颜色不能为空" => "ORDER_INVENTORY_COLOR_REQUIRED",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn adjust_order_inventory_batch(
    state: State<'_, AppState>,
    payload: AdjustOrderInventoryBatchPayload,
) -> Result<(), CommandError> {
    let order_id = payload.order_id.trim();
    let note = payload.note.trim();

    if order_id.is_empty() {
        return Err(CommandError::new(
            "ORDER_INVENTORY_ORDER_REQUIRED",
            "请选择订单",
        ));
    }

    if payload.items.is_empty() {
        return Err(CommandError::new(
            "ORDER_INVENTORY_BATCH_ITEMS_REQUIRED",
            "请至少录入一项入库数量",
        ));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    let tx = conn.transaction().map_err(|err| {
        CommandError::internal(format!(
            "failed to start batch order inventory transaction: {err}"
        ))
    })?;

    apply_order_inventory_batch_adjustment(&tx, order_id, payload.items, note)
        .map_err(map_order_inventory_batch_adjust_error)?;

    tx.commit().map_err(|err| {
        CommandError::internal(format!(
            "failed to commit batch order inventory adjustment: {err}"
        ))
    })?;

    Ok(())
}

pub(crate) fn map_order_inventory_batch_adjust_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择订单" => "ORDER_INVENTORY_ORDER_REQUIRED",
        "请至少录入一项入库数量" => "ORDER_INVENTORY_BATCH_ITEMS_REQUIRED",
        "订单商品不能为空" => "ORDER_INVENTORY_PRODUCT_REQUIRED",
        "长度必须大于 0" => "ORDER_INVENTORY_LENGTH_INVALID",
        "颜色不能为空" => "ORDER_INVENTORY_COLOR_REQUIRED",
        "入库数量必须大于 0" => "ORDER_INVENTORY_QUANTITY_INVALID",
        "该订单已出库，库存已锁定" | "订单已出库，库存已锁定" => {
            "ORDER_INVENTORY_LOCKED"
        }
        "订单商品不存在" => "ORDER_INVENTORY_ITEM_NOT_FOUND",
        "出库数量不能大于当前订单库存" => "ORDER_INVENTORY_INSUFFICIENT_STOCK",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn transfer_public_inventory_to_order(
    state: State<'_, AppState>,
    payload: TransferPublicInventoryToOrderPayload,
) -> Result<(), CommandError> {
    let order_id = payload.order_id.trim();
    let product_id = payload.product_id.trim();
    let color = payload.color.trim();
    let note = payload.note.trim();

    if order_id.is_empty() {
        return Err(CommandError::new(
            "INVENTORY_TRANSFER_ORDER_REQUIRED",
            "请选择订单",
        ));
    }

    if product_id.is_empty() {
        return Err(CommandError::new(
            "INVENTORY_TRANSFER_PRODUCT_REQUIRED",
            "请选择商品",
        ));
    }

    if payload.length_mm <= 0 {
        return Err(CommandError::new(
            "INVENTORY_TRANSFER_LENGTH_INVALID",
            "长度必须大于 0",
        ));
    }

    if color.is_empty() {
        return Err(CommandError::new(
            "INVENTORY_TRANSFER_COLOR_REQUIRED",
            "颜色不能为空",
        ));
    }

    if payload.quantity <= 0 {
        return Err(CommandError::new(
            "INVENTORY_TRANSFER_QUANTITY_INVALID",
            "转入数量必须大于 0",
        ));
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    let tx = conn.transaction().map_err(|err| {
        CommandError::internal(format!(
            "failed to start inventory transfer transaction: {err}"
        ))
    })?;

    ensure_order_inventory_unlocked(&tx, order_id).map_err(map_public_inventory_transfer_error)?;

    let product =
        query_order_product_for_inventory(&tx, order_id, product_id, payload.length_mm, color)
            .map_err(map_public_inventory_transfer_error)?
            .ok_or_else(|| CommandError::new("ORDER_INVENTORY_ITEM_NOT_FOUND", "订单商品不存在"))?;

    let public_quantity_before = tx
        .query_row(
            "
            SELECT quantity
            FROM inventory_stocks
            WHERE product_id = ?1 AND length_mm = ?2 AND color = ?3
            ",
            params![product_id, payload.length_mm, color],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| {
            CommandError::internal(format!("failed to read public inventory stock: {err}"))
        })?
        .unwrap_or(0);

    if public_quantity_before < payload.quantity {
        return Err(CommandError::new(
            "INVENTORY_TRANSFER_INSUFFICIENT_STOCK",
            "转入数量不能大于公共库存",
        ));
    }

    let order_quantity_before = tx
        .query_row(
            "
            SELECT quantity
            FROM order_inventory_stocks
            WHERE order_id = ?1 AND product_id = ?2 AND length_mm = ?3 AND color = ?4
            ",
            params![order_id, product_id, payload.length_mm, color],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| {
            CommandError::internal(format!("failed to read order inventory stock: {err}"))
        })?
        .unwrap_or(0);

    let public_quantity_after = public_quantity_before - payload.quantity;
    let order_quantity_after = order_quantity_before + payload.quantity;

    if public_quantity_after == 0 {
        tx.execute(
            "
            DELETE FROM inventory_stocks
            WHERE product_id = ?1 AND length_mm = ?2 AND color = ?3
            ",
            params![product_id, payload.length_mm, color],
        )
        .map_err(|err| {
            CommandError::internal(format!("failed to clear public inventory stock: {err}"))
        })?;
    } else {
        tx.execute(
            "
            UPDATE inventory_stocks
            SET quantity = ?3, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ?1 AND length_mm = ?2 AND color = ?4
            ",
            params![product_id, payload.length_mm, public_quantity_after, color],
        )
        .map_err(|err| {
            CommandError::internal(format!("failed to update public inventory stock: {err}"))
        })?;
    }

    tx.execute(
        "
        INSERT INTO order_inventory_stocks (
          order_id,
          product_id,
          length_mm,
          color,
          quantity,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
        ON CONFLICT(order_id, product_id, length_mm, color) DO UPDATE SET
          quantity = excluded.quantity,
          updated_at = CURRENT_TIMESTAMP
        ",
        params![
            order_id,
            product_id,
            payload.length_mm,
            color,
            order_quantity_after
        ],
    )
    .map_err(|err| {
        CommandError::internal(format!("failed to update order inventory stock: {err}"))
    })?;

    write_inventory_movement(
        &tx,
        InventoryMovementInput {
            product_id,
            order_id: Some(order_id),
            delivery_note_id: None,
            length_mm: Some(payload.length_mm),
            color,
            product_name: &product.product_name,
            mold_code: &product.mold_code,
            movement_type: "transfer_public",
            quantity_before: public_quantity_before,
            quantity_after: public_quantity_after,
            delta_quantity: -payload.quantity,
            note,
        },
    )
    .map_err(map_public_inventory_transfer_error)?;
    write_inventory_movement(
        &tx,
        InventoryMovementInput {
            product_id,
            order_id: Some(order_id),
            delivery_note_id: None,
            length_mm: Some(payload.length_mm),
            color,
            product_name: &product.product_name,
            mold_code: &product.mold_code,
            movement_type: "transfer_public",
            quantity_before: order_quantity_before,
            quantity_after: order_quantity_after,
            delta_quantity: payload.quantity,
            note,
        },
    )
    .map_err(map_public_inventory_transfer_error)?;

    tx.commit().map_err(|err| {
        CommandError::internal(format!("failed to commit inventory transfer: {err}"))
    })?;

    Ok(())
}

pub(crate) fn map_public_inventory_transfer_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择订单" => "INVENTORY_TRANSFER_ORDER_REQUIRED",
        "请选择商品" => "INVENTORY_TRANSFER_PRODUCT_REQUIRED",
        "长度必须大于 0" => "INVENTORY_TRANSFER_LENGTH_INVALID",
        "颜色不能为空" => "INVENTORY_TRANSFER_COLOR_REQUIRED",
        "转入数量必须大于 0" => "INVENTORY_TRANSFER_QUANTITY_INVALID",
        "该订单已出库，库存已锁定" | "订单已出库，库存已锁定" => {
            "ORDER_INVENTORY_LOCKED"
        }
        "订单商品不存在" => "ORDER_INVENTORY_ITEM_NOT_FOUND",
        "转入数量不能大于公共库存" => "INVENTORY_TRANSFER_INSUFFICIENT_STOCK",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}
