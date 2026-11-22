use rusqlite::{params, OptionalExtension};
use tauri::State;

use crate::commands::error::CommandError;
use crate::db::AppState;

use super::helpers::{
    current_local_date, format_customer_inventory_stock_id, format_delivery_note_item_id,
    get_required_delivery_weights, next_customer_inventory_batch_id, next_order_delivery_note_id,
    normalize_delivery_extra_charges, query_delivery_note, query_order_for_delivery_note,
    query_order_product_for_inventory, resolve_delivery_note_pricing,
    validate_delivery_note_pricing_for_items, write_customer_inventory_movement,
    write_inventory_movement, CustomerInventoryMovementInput, InventoryMovementInput,
};

use super::types::{
    CreateDeliveryNotePayload, DeliveryNote, TransferOrderInventoryRemainderPayload,
    TransferOrderInventoryRemainderResult, UpdateDeliveryNoteSpecialNotePayload,
};

#[tauri::command]
pub fn create_delivery_note(
    state: State<'_, AppState>,
    payload: CreateDeliveryNotePayload,
) -> Result<DeliveryNote, CommandError> {
    create_delivery_note_inner(state, payload).map_err(map_create_delivery_note_error)
}

#[tauri::command]
pub fn transfer_order_inventory_remainder(
    state: State<'_, AppState>,
    payload: TransferOrderInventoryRemainderPayload,
) -> Result<TransferOrderInventoryRemainderResult, CommandError> {
    transfer_order_inventory_remainder_inner(state, payload)
        .map_err(map_order_inventory_remainder_transfer_error)
}

pub(crate) fn map_order_inventory_remainder_transfer_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择订单" => "ORDER_INVENTORY_REMAINDER_ORDER_REQUIRED",
        "请选择剩余库存去向" => "ORDER_INVENTORY_REMAINDER_DESTINATION_REQUIRED",
        "订单不存在或未下单" => "ORDER_NOT_FOUND_OR_NOT_ORDERED",
        "订单首次出库后才能处理剩余库存" => "ORDER_INVENTORY_REMAINDER_NOT_LOCKED",
        "该订单库存已完结" => "ORDER_INVENTORY_CLOSED",
        "当前订单没有剩余库存" => "ORDER_INVENTORY_REMAINDER_EMPTY",
        "订单客户不存在" => "ORDER_CUSTOMER_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

pub(crate) fn transfer_order_inventory_remainder_inner(
    state: State<'_, AppState>,
    payload: TransferOrderInventoryRemainderPayload,
) -> Result<TransferOrderInventoryRemainderResult, String> {
    let order_id = payload.order_id.trim();
    let destination = payload.destination.trim();
    let note = payload.note.trim();
    if order_id.is_empty() {
        return Err("请选择订单".to_string());
    }
    if !matches!(destination, "public" | "customer") {
        return Err("请选择剩余库存去向".to_string());
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start remainder transfer transaction: {err}"))?;
    let order = query_order_for_delivery_note(&tx, order_id)?
        .ok_or_else(|| "订单不存在或未下单".to_string())?;
    let (locked_at, closed_at, ordered_date): (Option<String>, Option<String>, Option<String>) = tx
        .query_row(
            "SELECT inventory_locked_at, inventory_closed_at, ordered_date FROM orders WHERE id = ?1",
            [order_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|err| format!("failed to read order inventory state: {err}"))?;
    if locked_at.is_none() {
        return Err("订单首次出库后才能处理剩余库存".to_string());
    }
    if closed_at.is_some() {
        return Err("该订单库存已完结".to_string());
    }

    let mut stmt = tx
        .prepare(
            "
            SELECT
              stocks.product_id,
              items.product_name,
              items.product_mold_code,
              stocks.length_mm,
              stocks.color,
              stocks.quantity,
              COALESCE(GROUP_CONCAT(NULLIF(TRIM(items.note), ''), '；'), '')
            FROM order_inventory_stocks stocks
            INNER JOIN order_items items
              ON items.order_id = stocks.order_id
             AND items.product_id = stocks.product_id
             AND items.length_mm = stocks.length_mm
             AND items.color = stocks.color
            WHERE stocks.order_id = ?1 AND stocks.quantity > 0
            GROUP BY stocks.product_id, stocks.length_mm, stocks.color
            ORDER BY MIN(items.created_at), MIN(items.id)
            ",
        )
        .map_err(|err| format!("failed to prepare order remainder query: {err}"))?;
    let rows = stmt
        .query_map([order_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|err| format!("failed to query order remainder: {err}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read order remainder: {err}"))?;
    drop(stmt);
    let total_quantity = rows.iter().map(|row| row.5).sum();
    if total_quantity <= 0 {
        return Err("当前订单没有剩余库存".to_string());
    }

    let transfer_note = if note.is_empty() {
        format!("订单 {order_id} 剩余库存转入")
    } else {
        note.to_string()
    };
    let mut customer_inventory_batch_id = None;

    if destination == "public" {
        for (product_id, product_name, mold_code, length_mm, color, quantity, _) in &rows {
            let public_before: i64 = tx
                .query_row(
                    "SELECT quantity FROM inventory_stocks WHERE product_id = ?1 AND length_mm = ?2 AND color = ?3",
                    params![product_id, length_mm, color],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|err| format!("failed to read public inventory stock: {err}"))?
                .unwrap_or(0);
            tx.execute(
                "INSERT INTO inventory_stocks (product_id, length_mm, color, quantity, updated_at)
                 VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
                 ON CONFLICT(product_id, length_mm, color) DO UPDATE SET quantity = excluded.quantity, updated_at = CURRENT_TIMESTAMP",
                params![product_id, length_mm, color, public_before + quantity],
            )
            .map_err(|err| format!("failed to transfer remainder to public inventory: {err}"))?;
            write_inventory_movement(
                &tx,
                InventoryMovementInput {
                    product_id,
                    order_id: Some(order_id),
                    delivery_note_id: None,
                    length_mm: Some(*length_mm),
                    color,
                    product_name,
                    mold_code,
                    movement_type: "transfer_public",
                    quantity_before: *quantity,
                    quantity_after: 0,
                    delta_quantity: -*quantity,
                    note: &transfer_note,
                },
            )?;
            write_inventory_movement(
                &tx,
                InventoryMovementInput {
                    product_id,
                    order_id: Some(order_id),
                    delivery_note_id: None,
                    length_mm: Some(*length_mm),
                    color,
                    product_name,
                    mold_code,
                    movement_type: "transfer_public",
                    quantity_before: public_before,
                    quantity_after: public_before + quantity,
                    delta_quantity: *quantity,
                    note: &transfer_note,
                },
            )?;
        }
    } else {
        let customer_id = order
            .customer_id
            .as_deref()
            .ok_or_else(|| "订单客户不存在".to_string())?;
        let batch_date = match &ordered_date {
            Some(date) => date.clone(),
            None => current_local_date(&tx)?,
        };
        let batch_id = next_customer_inventory_batch_id(&tx, &order.customer_name, &batch_date)?;
        tx.execute(
            "
            INSERT INTO customer_inventory_batches (
              id, customer_id, customer_name, customer_address, historical_order_date,
              historical_order_ref, aluminum_ingot_price_x100, pricing_tax_included,
              bridge_processing_fee_x100, powder_processing_fee_x100,
              billet_processing_fee_x100, oxidation_processing_fee_x100,
              electrophoresis_processing_fee_x100, source_order_id, note, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ",
            params![
                &batch_id, customer_id, &order.customer_name, &order.customer_address,
                ordered_date, order_id, order.aluminum_ingot_price_x100, order.pricing_tax_included,
                order.processing_fees.bridge, order.processing_fees.powder,
                order.processing_fees.billet, order.processing_fees.oxidation,
                order.processing_fees.electrophoresis, order_id, &order.note
            ],
        )
        .map_err(|err| format!("failed to create customer inventory batch from order: {err}"))?;

        for (index, (product_id, product_name, mold_code, length_mm, color, quantity, item_note)) in
            rows.iter().enumerate()
        {
            let stock_id = format_customer_inventory_stock_id(&batch_id, index + 1);
            tx.execute(
                "INSERT INTO customer_inventory_stocks (
                   id, batch_id, product_id, product_name, mold_code, length_mm, color, quantity, note, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                params![&stock_id, &batch_id, product_id, product_name, mold_code, length_mm, color, quantity, item_note],
            )
            .map_err(|err| format!("failed to create customer inventory stock from order: {err}"))?;
            write_inventory_movement(
                &tx,
                InventoryMovementInput {
                    product_id,
                    order_id: Some(order_id),
                    delivery_note_id: None,
                    length_mm: Some(*length_mm),
                    color,
                    product_name,
                    mold_code,
                    movement_type: "transfer_customer",
                    quantity_before: *quantity,
                    quantity_after: 0,
                    delta_quantity: -*quantity,
                    note: &transfer_note,
                },
            )?;
            write_customer_inventory_movement(
                &tx,
                CustomerInventoryMovementInput {
                    batch_id: Some(&batch_id),
                    stock_id: Some(&stock_id),
                    customer_id: Some(customer_id),
                    customer_name: &order.customer_name,
                    delivery_note_id: None,
                    product_id: Some(product_id),
                    product_name,
                    mold_code,
                    length_mm: Some(*length_mm),
                    color,
                    movement_type: "transfer_order",
                    quantity_before: 0,
                    quantity_after: *quantity,
                    delta_quantity: *quantity,
                    note: &transfer_note,
                },
            )?;
        }
        customer_inventory_batch_id = Some(batch_id);
    }

    tx.execute(
        "UPDATE order_inventory_stocks SET quantity = 0, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?1",
        [order_id],
    )
    .map_err(|err| format!("failed to clear order remainder: {err}"))?;
    tx.execute(
        "UPDATE orders SET inventory_closed_at = CURRENT_TIMESTAMP, inventory_close_destination = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![order_id, destination],
    )
    .map_err(|err| format!("failed to close order inventory: {err}"))?;
    tx.commit()
        .map_err(|err| format!("failed to commit order remainder transfer: {err}"))?;

    Ok(TransferOrderInventoryRemainderResult {
        destination: destination.to_string(),
        customer_inventory_batch_id,
        total_quantity,
    })
}

pub(crate) fn create_delivery_note_inner(
    state: State<'_, AppState>,
    payload: CreateDeliveryNotePayload,
) -> Result<DeliveryNote, String> {
    let order_id = payload.order_id.trim();
    let note = payload.note.trim();
    let special_note = payload.special_note.trim();
    let extra_charges = normalize_delivery_extra_charges(&payload.extra_charges)?;

    if order_id.is_empty() {
        return Err("请选择订单".to_string());
    }

    if payload.items.is_empty() {
        return Err("请至少选择一项出库明细".to_string());
    }

    if payload.bridge_weight_kg_x100 < 0
        || payload.powder_weight_kg_x100 < 0
        || payload.billet_weight_kg_x100 < 0
        || payload.oxidation_weight_kg_x100 < 0
        || payload.electrophoresis_weight_kg_x100 < 0
    {
        return Err("重量不能小于 0".to_string());
    }

    let mut conn = state
        .conn
        .lock()
        .map_err(|_| "failed to lock database connection".to_string())?;

    let tx = conn
        .transaction()
        .map_err(|err| format!("failed to start delivery note transaction: {err}"))?;

    let order = query_order_for_delivery_note(&tx, order_id)?
        .ok_or_else(|| "订单不存在或未下单".to_string())?;
    let inventory_closed_at: Option<String> = tx
        .query_row(
            "SELECT inventory_closed_at FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to read order inventory state: {err}"))?;
    if inventory_closed_at.is_some() {
        return Err("该订单库存已完结，不能继续出库".to_string());
    }
    let pricing = resolve_delivery_note_pricing(&tx, &order, payload.pricing_tax_included)?;
    validate_delivery_note_pricing_for_items(&pricing, &payload.items)?;
    let delivery_note_id = next_order_delivery_note_id(&tx, order_id)?;
    let delivery_date: String = tx
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .map_err(|err| format!("failed to resolve delivery date: {err}"))?;

    tx.execute(
        "
        INSERT INTO delivery_notes (
          id,
          order_id,
          customer_name,
          customer_address,
          handler_name,
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
          pricing_profile_name,
          pricing_trigger_keyword,
          note,
          special_note,
          created_at,
          updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ",
        params![
            delivery_note_id,
            order_id,
            order.customer_name,
            order.customer_address,
            order.handler_name,
            delivery_date,
            order.aluminum_ingot_price_x100,
            pricing.pricing_tax_included,
            pricing.processing_fees.bridge,
            pricing.processing_fees.powder,
            pricing.processing_fees.billet,
            pricing.processing_fees.oxidation,
            pricing.processing_fees.electrophoresis,
            payload.bridge_weight_kg_x100,
            payload.powder_weight_kg_x100,
            payload.billet_weight_kg_x100,
            payload.oxidation_weight_kg_x100,
            payload.electrophoresis_weight_kg_x100,
            pricing.profile_name,
            pricing.trigger_keyword,
            note,
            special_note
        ],
    )
    .map_err(|err| format!("failed to create delivery note: {err}"))?;

    for (position, charge) in extra_charges.iter().enumerate() {
        tx.execute(
                "INSERT INTO delivery_note_extra_charges (delivery_note_id, position, name, amount_x100) VALUES (?1, ?2, ?3, ?4)",
                params![delivery_note_id, position as i64, charge.name, charge.amount_x100],
            ).map_err(|err| format!("failed to save delivery note charge: {err}"))?;
    }

    let current_order_quantity = tx
        .query_row(
            "
            SELECT COALESCE(SUM(quantity), 0)
            FROM order_inventory_stocks
            WHERE order_id = ?1
            ",
            [order_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|err| format!("failed to read order inventory quantity: {err}"))?;
    let delivery_quantity = payload.items.iter().try_fold(0_i64, |total, item| {
        if item.quantity < 0 {
            return Err("出库数量不能小于 0".to_string());
        }

        Ok(total + item.quantity)
    })?;

    if current_order_quantity <= 0 {
        return Err("当前订单没有可出库库存".to_string());
    }

    if delivery_quantity <= 0 {
        return Err("请至少录入一项出库数量".to_string());
    }

    if delivery_quantity > current_order_quantity {
        return Err("出库数量不能大于当前订单库存".to_string());
    }

    let required_weights = get_required_delivery_weights(&payload.items)?;

    if required_weights.bridge && payload.bridge_weight_kg_x100 <= 0 {
        return Err("请填写断桥重量".to_string());
    }

    if required_weights.powder && payload.powder_weight_kg_x100 <= 0 {
        return Err("请填写喷涂重量".to_string());
    }

    if required_weights.billet && payload.billet_weight_kg_x100 <= 0 {
        return Err("请填写坯料重量".to_string());
    }

    if required_weights.oxidation && payload.oxidation_weight_kg_x100 <= 0 {
        return Err("请填写氧化重量".to_string());
    }

    if required_weights.electrophoresis && payload.electrophoresis_weight_kg_x100 <= 0 {
        return Err("请填写电泳重量".to_string());
    }

    let mut delivery_item_number = 1;

    for item in payload.items.iter() {
        let product_id = item.product_id.trim();
        let color = item.color.trim();
        let item_note = item.note.trim();

        if product_id.is_empty() {
            return Err("出库商品不能为空".to_string());
        }

        if item.length_mm <= 0 {
            return Err("长度必须大于 0".to_string());
        }

        if color.is_empty() {
            return Err("颜色不能为空".to_string());
        }

        if item.quantity < 0 {
            return Err("出库数量不能小于 0".to_string());
        }

        let product =
            query_order_product_for_inventory(&tx, order_id, product_id, item.length_mm, color)?
                .ok_or_else(|| "订单商品不存在".to_string())?;
        let quantity_before = tx
            .query_row(
                "
                SELECT quantity
                FROM order_inventory_stocks
                WHERE order_id = ?1 AND product_id = ?2 AND length_mm = ?3 AND color = ?4
                ",
                params![order_id, product_id, item.length_mm, color],
                |row| row.get(0),
            )
            .optional()
            .map_err(|err| format!("failed to read order inventory stock: {err}"))?
            .unwrap_or(0);

        if item.quantity > quantity_before {
            return Err(format!("{} 出库数量不能大于当前库存", product.product_name));
        }

        let remaining_quantity = quantity_before - item.quantity;

        tx.execute(
            "
            INSERT INTO order_inventory_stocks (
              order_id,
              product_id,
              length_mm,
              color,
              quantity,
              updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
            ON CONFLICT(order_id, product_id, length_mm, color) DO UPDATE SET
              quantity = excluded.quantity,
              updated_at = CURRENT_TIMESTAMP
            ",
            params![
                order_id,
                product_id,
                item.length_mm,
                color,
                remaining_quantity
            ],
        )
        .map_err(|err| format!("failed to update order inventory stock: {err}"))?;

        if item.quantity > 0 {
            tx.execute(
                "
                INSERT INTO delivery_note_items (
                  id,
                  delivery_note_id,
                  product_id,
                  product_name,
                  mold_code,
                  length_mm,
                  color,
                  order_quantity,
                  quantity,
                  note,
                  created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP)
                ",
                params![
                    format_delivery_note_item_id(&delivery_note_id, delivery_item_number),
                    delivery_note_id,
                    product_id,
                    product.product_name,
                    product.mold_code,
                    item.length_mm,
                    color,
                    product.order_quantity,
                    item.quantity,
                    item_note
                ],
            )
            .map_err(|err| format!("failed to create delivery note item: {err}"))?;
            delivery_item_number += 1;

            let movement_note = if item_note.is_empty() {
                format!("出库单 {delivery_note_id}")
            } else {
                format!("出库单 {delivery_note_id}，{item_note}")
            };
            let quantity_after_ship = quantity_before - item.quantity;

            write_inventory_movement(
                &tx,
                InventoryMovementInput {
                    product_id,
                    order_id: Some(order_id),
                    delivery_note_id: Some(&delivery_note_id),
                    length_mm: Some(item.length_mm),
                    color,
                    product_name: &product.product_name,
                    mold_code: &product.mold_code,
                    movement_type: "ship",
                    quantity_before,
                    quantity_after: quantity_after_ship,
                    delta_quantity: -item.quantity,
                    note: &movement_note,
                },
            )?;
        }
    }

    let unhandled_quantity = tx
        .query_row(
            "
            SELECT COALESCE(SUM(quantity), 0)
            FROM order_inventory_stocks
            WHERE order_id = ?1
            ",
            [order_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|err| format!("failed to read remaining order inventory: {err}"))?;

    tx.execute(
        "
        UPDATE orders
        SET
          inventory_locked_at = COALESCE(inventory_locked_at, CURRENT_TIMESTAMP),
          inventory_closed_at = CASE WHEN ?2 = 0 THEN CURRENT_TIMESTAMP ELSE NULL END,
          inventory_close_destination = CASE WHEN ?2 = 0 THEN 'shipped' ELSE NULL END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?1
        ",
        params![order_id, unhandled_quantity],
    )
    .map_err(|err| format!("failed to update order inventory state: {err}"))?;

    tx.commit()
        .map_err(|err| format!("failed to commit delivery note: {err}"))?;

    query_delivery_note(&conn, &delivery_note_id)?.ok_or_else(|| "出库单不存在".to_string())
}

pub(crate) fn map_create_delivery_note_error(message: String) -> CommandError {
    let code = if message.ends_with(" 出库数量不能大于当前库存") {
        "DELIVERY_ITEM_INSUFFICIENT_STOCK"
    } else {
        match message.as_str() {
            "请选择订单" => "DELIVERY_ORDER_REQUIRED",
            "请至少选择一项出库明细" => "DELIVERY_ITEMS_REQUIRED",
            "重量不能小于 0" => "DELIVERY_WEIGHT_INVALID",
            "请填写收费名称" => "DELIVERY_EXTRA_CHARGE_NAME_REQUIRED",
            "其他费用合计超出允许范围" => "DELIVERY_EXTRA_CHARGE_AMOUNT_INVALID",
            "收费金额不能小于 0" => "DELIVERY_EXTRA_CHARGE_AMOUNT_INVALID",
            "收费金额必须大于 0" => "DELIVERY_EXTRA_CHARGE_AMOUNT_REQUIRED",
            "订单不存在或未下单" => "DELIVERY_ORDER_NOT_FOUND",
            "该订单库存已完结，不能继续出库" => "DELIVERY_INVENTORY_CLOSED",
            "当前订单没有可出库库存" => "DELIVERY_NO_STOCK",
            "请至少录入一项出库数量" => "DELIVERY_QUANTITY_REQUIRED",
            "出库数量不能小于 0" => "DELIVERY_QUANTITY_INVALID",
            "出库数量不能大于当前订单库存" => "DELIVERY_INSUFFICIENT_STOCK",
            "出库商品不能为空" => "DELIVERY_PRODUCT_REQUIRED",
            "订单商品不存在" => "DELIVERY_ITEM_NOT_FOUND",
            "长度必须大于 0" => "DELIVERY_LENGTH_INVALID",
            "颜色不能为空" => "DELIVERY_COLOR_REQUIRED",
            "请填写断桥重量" => "DELIVERY_BRIDGE_WEIGHT_REQUIRED",
            "请填写喷涂重量" => "DELIVERY_POWDER_WEIGHT_REQUIRED",
            "请填写坯料重量" => "DELIVERY_BILLET_WEIGHT_REQUIRED",
            "请填写氧化重量" => "DELIVERY_OXIDATION_WEIGHT_REQUIRED",
            "请填写电泳重量" => "DELIVERY_ELECTROPHORESIS_WEIGHT_REQUIRED",
            "出库单不存在" => "DELIVERY_NOT_FOUND",
            message if message.contains("同时命中") && message.ends_with("请检查颜色录入") => {
                "DELIVERY_COLOR_CATEGORY_CONFLICT"
            }
            message if message.contains("加工费未设置") => {
                "DELIVERY_PROCESSING_FEE_NOT_CONFIGURED"
            }
            message if message.contains("客户资料未设置") => {
                "DELIVERY_PRICING_NOT_CONFIGURED"
            }
            _ => "INTERNAL_ERROR",
        }
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn get_delivery_note(
    state: State<'_, AppState>,
    id: String,
) -> Result<DeliveryNote, CommandError> {
    let id = id.trim();

    if id.is_empty() {
        return Err(CommandError::new(
            "DELIVERY_ID_REQUIRED",
            "出库单号不能为空",
        ));
    }

    let conn = state
        .conn
        .lock()
        .map_err(|_| CommandError::internal("failed to lock database connection"))?;

    query_delivery_note(&conn, id)
        .map_err(map_get_delivery_note_error)?
        .ok_or_else(|| CommandError::new("DELIVERY_NOT_FOUND", "出库单不存在"))
}

#[tauri::command]
pub fn update_delivery_note_special_note(
    state: State<'_, AppState>,
    payload: UpdateDeliveryNoteSpecialNotePayload,
) -> Result<DeliveryNote, CommandError> {
    let id = payload.id.trim();

    if id.is_empty() {
        return Err(CommandError::new(
            "DELIVERY_ID_REQUIRED",
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
            UPDATE delivery_notes
            SET special_note = ?2, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?1
            ",
            params![id, payload.special_note.trim()],
        )
        .map_err(|err| {
            CommandError::internal(format!(
                "failed to update delivery note special note: {err}"
            ))
        })?;

    if affected == 0 {
        return Err(CommandError::new("DELIVERY_NOT_FOUND", "出库单不存在"));
    }

    query_delivery_note(&conn, id)
        .map_err(map_get_delivery_note_error)?
        .ok_or_else(|| CommandError::new("DELIVERY_NOT_FOUND", "出库单不存在"))
}

pub(crate) fn map_get_delivery_note_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "出库单号不能为空" => "DELIVERY_ID_REQUIRED",
        "出库单不存在" => "DELIVERY_NOT_FOUND",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}
