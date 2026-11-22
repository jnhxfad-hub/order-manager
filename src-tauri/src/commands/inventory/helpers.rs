use std::collections::{HashMap, HashSet};
use std::path::Path;

use calamine::{open_workbook_auto, Data, Reader};
use pinyin::ToPinyin;
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use serde::Serialize;

use crate::processing_fees::{
    checked_processing_category_from_color, ProcessingCategory, ProcessingFeeSnapshot,
};

use super::types::{
    AdjustOrderInventoryBatchItem, CreateCustomerInventoryStockItemPayload,
    CreateDeliveryNoteItemPayload, CustomerInventoryBatch, CustomerInventoryDeliveryNoteSummary,
    CustomerInventoryMovement, CustomerInventoryPrintBatch, CustomerInventoryPrintSnapshot,
    CustomerInventoryStockItem, DeliveryNote, DeliveryNoteItem, DeliveryNotePriceGroup,
    InventoryItem, InventoryMovement, OrderInventoryItem, ParseCustomerInventoryImportResult,
    ParsedCustomerInventoryImportRow,
};

pub(crate) fn apply_order_inventory_adjustment(
    conn: &Connection,
    params: OrderInventoryAdjustmentParams<'_>,
) -> Result<(), String> {
    ensure_order_inventory_unlocked(conn, params.order_id)?;

    let product = query_order_product_for_inventory(
        conn,
        params.order_id,
        params.product_id,
        params.length_mm,
        params.color,
    )?
    .ok_or_else(|| "订单商品不存在".to_string())?;

    let quantity_before = conn
        .query_row(
            "
            SELECT quantity
            FROM order_inventory_stocks
            WHERE order_id = ?1 AND product_id = ?2 AND length_mm = ?3 AND color = ?4
            ",
            params![
                params.order_id,
                params.product_id,
                params.length_mm,
                params.color
            ],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| format!("failed to read order inventory stock: {err}"))?
        .unwrap_or(0);

    let quantity_after = match params.movement_type {
        "produce" => quantity_before + params.quantity,
        "ship" => quantity_before - params.quantity,
        "adjust" => params.quantity,
        _ => return Err("订单库存类型不正确".to_string()),
    };

    if quantity_after < 0 {
        return Err("出库数量不能大于当前订单库存".to_string());
    }

    let delta_quantity = quantity_after - quantity_before;
    conn.execute(
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
            params.order_id,
            params.product_id,
            params.length_mm,
            params.color,
            quantity_after
        ],
    )
    .map_err(|err| format!("failed to update order inventory stock: {err}"))?;

    write_inventory_movement(
        conn,
        InventoryMovementInput {
            product_id: params.product_id,
            order_id: Some(params.order_id),
            delivery_note_id: None,
            length_mm: Some(params.length_mm),
            color: params.color,
            product_name: &product.product_name,
            mold_code: &product.mold_code,
            movement_type: params.movement_type,
            quantity_before,
            quantity_after,
            delta_quantity,
            note: params.note,
        },
    )?;

    Ok(())
}

pub(crate) fn apply_order_inventory_batch_adjustment(
    conn: &Connection,
    order_id: &str,
    items: Vec<AdjustOrderInventoryBatchItem>,
    note: &str,
) -> Result<(), String> {
    for item in items {
        let product_id = item.product_id.trim();
        let color = item.color.trim();

        if product_id.is_empty() {
            return Err("订单商品不能为空".to_string());
        }

        if item.length_mm <= 0 {
            return Err("长度必须大于 0".to_string());
        }

        if color.is_empty() {
            return Err("颜色不能为空".to_string());
        }

        if item.quantity <= 0 {
            return Err("入库数量必须大于 0".to_string());
        }

        apply_order_inventory_adjustment(
            conn,
            OrderInventoryAdjustmentParams {
                order_id,
                product_id,
                length_mm: item.length_mm,
                color,
                movement_type: "produce",
                quantity: item.quantity,
                note,
            },
        )?;
    }

    Ok(())
}

pub(crate) struct OrderInventoryAdjustmentParams<'a> {
    pub(crate) order_id: &'a str,
    pub(crate) product_id: &'a str,
    pub(crate) length_mm: i64,
    pub(crate) color: &'a str,
    pub(crate) movement_type: &'a str,
    pub(crate) quantity: i64,
    pub(crate) note: &'a str,
}

pub(crate) struct InventoryMovementInput<'a> {
    pub(crate) product_id: &'a str,
    pub(crate) order_id: Option<&'a str>,
    pub(crate) delivery_note_id: Option<&'a str>,
    pub(crate) length_mm: Option<i64>,
    pub(crate) color: &'a str,
    pub(crate) product_name: &'a str,
    pub(crate) mold_code: &'a str,
    pub(crate) movement_type: &'a str,
    pub(crate) quantity_before: i64,
    pub(crate) quantity_after: i64,
    pub(crate) delta_quantity: i64,
    pub(crate) note: &'a str,
}

pub(crate) fn write_inventory_movement(
    conn: &Connection,
    input: InventoryMovementInput<'_>,
) -> Result<(), String> {
    let movement_id = next_movement_id(conn)?;

    conn.execute(
        "
        INSERT INTO inventory_movements (
          id,
          product_id,
          order_id,
          delivery_note_id,
          product_name,
          mold_code,
          length_mm,
          color,
          movement_type,
          quantity_before,
          quantity_after,
          delta_quantity,
          note,
          created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, CURRENT_TIMESTAMP)
        ",
        params![
            movement_id,
            input.product_id,
            input.order_id,
            input.delivery_note_id,
            input.product_name,
            input.mold_code,
            input.length_mm,
            input.color,
            input.movement_type,
            input.quantity_before,
            input.quantity_after,
            input.delta_quantity,
            input.note
        ],
    )
    .map_err(|err| format!("failed to write inventory movement: {err}"))?;

    Ok(())
}

pub(crate) fn query_inventory_items(
    conn: &Connection,
    search: &str,
) -> Result<Vec<InventoryItem>, String> {
    if search.is_empty() {
        let mut stmt = conn
            .prepare(
                "
                SELECT
                  products.id,
                  products.product_name,
                  products.mold_code,
                  inventory_stocks.length_mm,
                  inventory_stocks.color,
                  products.thickness_mm_x100,
                  products.weight_per_meter_kg_x1000,
                  inventory_stocks.quantity,
                  COALESCE((
                    SELECT inventory_movements.note
                    FROM inventory_movements
                    WHERE inventory_movements.product_id = products.id
                      AND inventory_movements.length_mm = inventory_stocks.length_mm
                      AND inventory_movements.color = inventory_stocks.color
                      AND (
                        inventory_movements.order_id IS NULL
                        OR inventory_movements.movement_type = 'transfer_public'
                      )
                    ORDER BY inventory_movements.created_at DESC, inventory_movements.id DESC
                    LIMIT 1
                  ), '') AS latest_note,
                  inventory_stocks.updated_at
                FROM inventory_stocks
                INNER JOIN products ON products.id = inventory_stocks.product_id
                ORDER BY products.product_name ASC, inventory_stocks.length_mm ASC, inventory_stocks.color ASC
                ",
            )
            .map_err(|err| format!("failed to prepare inventory query: {err}"))?;

        return collect_inventory_items(&mut stmt, []);
    }

    let search_pattern = format!("%{search}%");
    let mut stmt = conn
        .prepare(
            "
            SELECT
              products.id,
              products.product_name,
              products.mold_code,
              inventory_stocks.length_mm,
              inventory_stocks.color,
              products.thickness_mm_x100,
              products.weight_per_meter_kg_x1000,
              inventory_stocks.quantity,
              COALESCE((
                SELECT inventory_movements.note
                FROM inventory_movements
                WHERE inventory_movements.product_id = products.id
                  AND inventory_movements.length_mm = inventory_stocks.length_mm
                  AND inventory_movements.color = inventory_stocks.color
                  AND (
                    inventory_movements.order_id IS NULL
                    OR inventory_movements.movement_type = 'transfer_public'
                  )
                ORDER BY inventory_movements.created_at DESC, inventory_movements.id DESC
                LIMIT 1
              ), '') AS latest_note,
              inventory_stocks.updated_at
            FROM inventory_stocks
            INNER JOIN products ON products.id = inventory_stocks.product_id
            WHERE
              products.product_name LIKE ?1
              OR products.mold_code LIKE ?1
              OR CAST(inventory_stocks.length_mm AS TEXT) LIKE ?1
              OR inventory_stocks.color LIKE ?1
              OR latest_note LIKE ?1
            ORDER BY products.product_name ASC, inventory_stocks.length_mm ASC, inventory_stocks.color ASC
            ",
        )
        .map_err(|err| format!("failed to prepare inventory query: {err}"))?;

    collect_inventory_items(&mut stmt, [search_pattern])
}

pub(crate) fn collect_inventory_items<P>(
    stmt: &mut rusqlite::Statement<'_>,
    params: P,
) -> Result<Vec<InventoryItem>, String>
where
    P: rusqlite::Params,
{
    let rows = stmt
        .query_map(params, |row| {
            Ok(InventoryItem {
                product_id: row.get(0)?,
                product_name: row.get(1)?,
                mold_code: row.get(2)?,
                length_mm: row.get(3)?,
                color: row.get(4)?,
                thickness_mm_x100: row.get(5)?,
                weight_per_meter_kg_x1000: row.get(6)?,
                quantity: row.get(7)?,
                latest_note: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|err| format!("failed to query inventory: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read inventory: {err}"))
}

pub(crate) fn query_inventory_item(
    conn: &Connection,
    product_id: &str,
    length_mm: i64,
    color: &str,
) -> Result<Option<InventoryItem>, String> {
    conn.query_row(
        "
        SELECT
          products.id,
          products.product_name,
          products.mold_code,
          ?2,
          ?3,
          products.thickness_mm_x100,
          products.weight_per_meter_kg_x1000,
          COALESCE(inventory_stocks.quantity, 0),
          COALESCE((
            SELECT inventory_movements.note
            FROM inventory_movements
            WHERE inventory_movements.product_id = products.id
              AND inventory_movements.length_mm = ?2
              AND inventory_movements.color = ?3
              AND (
                inventory_movements.order_id IS NULL
                OR inventory_movements.movement_type = 'transfer_public'
              )
            ORDER BY inventory_movements.created_at DESC, inventory_movements.id DESC
            LIMIT 1
          ), '') AS latest_note,
          inventory_stocks.updated_at
        FROM products
        LEFT JOIN inventory_stocks
          ON inventory_stocks.product_id = products.id
         AND inventory_stocks.length_mm = ?2
         AND inventory_stocks.color = ?3
        WHERE products.id = ?1
        ",
        params![product_id, length_mm, color],
        |row| {
            Ok(InventoryItem {
                product_id: row.get(0)?,
                product_name: row.get(1)?,
                mold_code: row.get(2)?,
                length_mm: row.get(3)?,
                color: row.get(4)?,
                thickness_mm_x100: row.get(5)?,
                weight_per_meter_kg_x1000: row.get(6)?,
                quantity: row.get(7)?,
                latest_note: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read inventory item: {err}"))
}

pub(crate) fn query_order_inventory_items(
    conn: &Connection,
    search: &str,
) -> Result<Vec<OrderInventoryItem>, String> {
    let search_pattern = format!("%{search}%");
    let mut stmt = conn
        .prepare(
            "
            SELECT
              orders.id,
              orders.customer_name,
              orders.customer_address,
              orders.handler_name,
              orders.pricing_tax_included,
              (
                SELECT delivery_notes.id
                FROM delivery_notes
                WHERE delivery_notes.order_id = orders.id
                ORDER BY delivery_notes.created_at DESC, delivery_notes.id DESC
                LIMIT 1
              ) AS delivery_note_id,
              COALESCE((
                SELECT GROUP_CONCAT(delivery_notes.id, char(31))
                FROM delivery_notes
                WHERE delivery_notes.order_id = orders.id
              ), '') AS delivery_note_ids,
              orders.inventory_locked_at,
              orders.inventory_closed_at,
              orders.inventory_close_destination,
              order_items.product_id,
              order_items.product_name,
              order_items.product_mold_code,
              order_items.length_mm,
              order_items.color,
              SUM(order_items.quantity) AS required_quantity,
              COALESCE(order_inventory_stocks.quantity, 0) AS order_quantity,
              COALESCE(inventory_stocks.quantity, 0) AS public_quantity,
              orders.ordered_date,
              COALESCE(orders.note, '') AS order_note,
              COALESCE(GROUP_CONCAT(NULLIF(TRIM(order_items.note), ''), '；'), '') AS note
            FROM orders
            INNER JOIN order_items ON order_items.order_id = orders.id
            LEFT JOIN order_inventory_stocks
              ON order_inventory_stocks.order_id = orders.id
             AND order_inventory_stocks.product_id = order_items.product_id
             AND order_inventory_stocks.length_mm = order_items.length_mm
             AND order_inventory_stocks.color = order_items.color
            LEFT JOIN inventory_stocks
              ON inventory_stocks.product_id = order_items.product_id
             AND inventory_stocks.length_mm = order_items.length_mm
             AND inventory_stocks.color = order_items.color
            WHERE orders.status = 'ordered'
              AND order_items.product_id IS NOT NULL
              AND (
                ?1 = ''
                OR orders.id LIKE ?2
                OR orders.customer_name LIKE ?2
                OR order_items.product_name LIKE ?2
                OR order_items.product_mold_code LIKE ?2
                OR order_items.color LIKE ?2
              )
            GROUP BY orders.id, order_items.product_id, order_items.length_mm, order_items.color
            ORDER BY
              orders.ordered_date DESC,
              orders.updated_at DESC,
              orders.id DESC,
              MIN(order_items.created_at) ASC,
              MIN(order_items.id) ASC
            ",
        )
        .map_err(|err| format!("failed to prepare order inventory query: {err}"))?;
    let rows = stmt
        .query_map(params![search, search_pattern], |row| {
            Ok(OrderInventoryItem {
                order_id: row.get(0)?,
                customer_name: row.get(1)?,
                customer_address: row.get(2)?,
                handler_name: row.get(3)?,
                pricing_tax_included: row.get(4)?,
                delivery_note_id: row.get(5)?,
                delivery_note_ids: split_sqlite_list(row.get(6)?),
                inventory_locked_at: row.get(7)?,
                inventory_closed_at: row.get(8)?,
                inventory_close_destination: row.get(9)?,
                product_id: row.get(10)?,
                product_name: row.get(11)?,
                mold_code: row.get(12)?,
                length_mm: row.get(13)?,
                color: row.get(14)?,
                required_quantity: row.get(15)?,
                order_quantity: row.get(16)?,
                public_quantity: row.get(17)?,
                ordered_date: row.get(18)?,
                order_note: row.get(19)?,
                note: row.get(20)?,
            })
        })
        .map_err(|err| format!("failed to query order inventory: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read order inventory: {err}"))
}

pub(crate) fn split_sqlite_list(value: String) -> Vec<String> {
    value
        .split('\u{1f}')
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect()
}

pub(crate) fn query_recent_movements(
    conn: &Connection,
    search: &str,
) -> Result<Vec<InventoryMovement>, String> {
    let search_pattern = format!("%{}%", search);
    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
              product_id,
              order_id,
              delivery_note_id,
              product_name,
              mold_code,
              length_mm,
              color,
              movement_type,
              quantity_before,
              quantity_after,
              delta_quantity,
              note,
              created_at
            FROM inventory_movements
            WHERE
              ?1 = ''
              OR product_name LIKE ?2
              OR mold_code LIKE ?2
              OR COALESCE(order_id, '') LIKE ?2
              OR COALESCE(delivery_note_id, '') LIKE ?2
              OR color LIKE ?2
              OR note LIKE ?2
            ORDER BY created_at DESC, id DESC
            LIMIT 50
            ",
        )
        .map_err(|err| format!("failed to prepare inventory movements query: {err}"))?;

    let rows = stmt
        .query_map(params![search, search_pattern], |row| {
            Ok(InventoryMovement {
                id: row.get(0)?,
                product_id: row.get(1)?,
                order_id: row.get(2)?,
                delivery_note_id: row.get(3)?,
                product_name: row.get(4)?,
                mold_code: row.get(5)?,
                length_mm: row.get(6)?,
                color: row.get(7)?,
                movement_type: row.get(8)?,
                quantity_before: row.get(9)?,
                quantity_after: row.get(10)?,
                delta_quantity: row.get(11)?,
                note: row.get(12)?,
                created_at: row.get(13)?,
            })
        })
        .map_err(|err| format!("failed to query inventory movements: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read inventory movements: {err}"))
}

pub(crate) fn query_order_movements(conn: &Connection) -> Result<Vec<InventoryMovement>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
              product_id,
              order_id,
              delivery_note_id,
              product_name,
              mold_code,
              length_mm,
              color,
              movement_type,
              quantity_before,
              quantity_after,
              delta_quantity,
              note,
              created_at
            FROM inventory_movements
            WHERE order_id IS NOT NULL
            ORDER BY created_at DESC, id DESC
            ",
        )
        .map_err(|err| format!("failed to prepare order movements query: {err}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(InventoryMovement {
                id: row.get(0)?,
                product_id: row.get(1)?,
                order_id: row.get(2)?,
                delivery_note_id: row.get(3)?,
                product_name: row.get(4)?,
                mold_code: row.get(5)?,
                length_mm: row.get(6)?,
                color: row.get(7)?,
                movement_type: row.get(8)?,
                quantity_before: row.get(9)?,
                quantity_after: row.get(10)?,
                delta_quantity: row.get(11)?,
                note: row.get(12)?,
                created_at: row.get(13)?,
            })
        })
        .map_err(|err| format!("failed to query order movements: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read order movements: {err}"))
}

pub(crate) struct DeliveryOrder {
    pub(crate) customer_id: Option<String>,
    pub(crate) customer_name: String,
    pub(crate) customer_address: String,
    pub(crate) handler_name: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) processing_fees: ProcessingFeeSnapshot,
    pub(crate) note: String,
}

pub(crate) struct DeliveryPricing {
    pub(crate) pricing_tax_included: bool,
    pub(crate) processing_fees: ProcessingFeeSnapshot,
    pub(crate) profile_name: String,
    pub(crate) trigger_keyword: String,
}

pub(crate) struct PricingProfileSnapshot {
    pub(crate) profile_name: String,
    pub(crate) trigger_keyword: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeliveryExtraCharge {
    pub(crate) name: String,
    pub(crate) amount_x100: i64,
}

pub(crate) fn normalize_delivery_extra_charges(
    charges: &[DeliveryExtraCharge],
) -> Result<Vec<DeliveryExtraCharge>, String> {
    let mut total = 0_i64;
    let mut normalized = Vec::new();
    for charge in charges {
        if charge.name.trim().is_empty() {
            return Err("请填写收费名称".to_string());
        }
        let charge = normalize_delivery_extra_charge(&charge.name, charge.amount_x100)?;
        total = total
            .checked_add(charge.amount_x100)
            .filter(|value| *value <= 9_007_199_254_740_991)
            .ok_or_else(|| "其他费用合计超出允许范围".to_string())?;
        normalized.push(charge);
    }
    Ok(normalized)
}

pub(crate) fn customer_delivery_charge_rows(
    name: String,
    amount_x100: i64,
) -> Vec<DeliveryExtraCharge> {
    if name.is_empty() || amount_x100 == 0 {
        Vec::new()
    } else {
        vec![DeliveryExtraCharge { name, amount_x100 }]
    }
}

pub(crate) fn normalize_delivery_extra_charge(
    name: &str,
    amount_x100: i64,
) -> Result<DeliveryExtraCharge, String> {
    let name = name.trim().to_string();

    if amount_x100 < 0 {
        return Err("收费金额不能小于 0".to_string());
    }

    if name.is_empty() {
        return Ok(DeliveryExtraCharge {
            name,
            amount_x100: 0,
        });
    }

    if amount_x100 <= 0 {
        return Err("收费金额必须大于 0".to_string());
    }

    Ok(DeliveryExtraCharge { name, amount_x100 })
}

pub(crate) fn query_order_for_delivery_note(
    conn: &Connection,
    order_id: &str,
) -> Result<Option<DeliveryOrder>, String> {
    conn.query_row(
        "
        SELECT
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
          COALESCE(note, '')
        FROM orders
        WHERE id = ?1 AND status = 'ordered'
        ",
        [order_id],
        |row| {
            Ok(DeliveryOrder {
                customer_id: row.get(0)?,
                customer_name: row.get(1)?,
                customer_address: row.get(2)?,
                handler_name: row.get(3)?,
                aluminum_ingot_price_x100: row.get(4)?,
                pricing_tax_included: row.get(5)?,
                processing_fees: ProcessingFeeSnapshot::new(
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                    row.get(10)?,
                ),
                note: row.get(11)?,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read order for delivery note: {err}"))
}

pub(crate) fn resolve_delivery_note_pricing(
    conn: &Connection,
    order: &DeliveryOrder,
    pricing_tax_included: bool,
) -> Result<DeliveryPricing, String> {
    let pricing = conn
        .query_row(
            "
            SELECT
              special_pricing_keyword,
              CASE
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%' AND ?2
                THEN special_bridge_processing_fee_tax_included_x100
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%'
                THEN special_bridge_processing_fee_tax_excluded_x100
                WHEN ?2 THEN bridge_processing_fee_tax_included_x100
                ELSE bridge_processing_fee_tax_excluded_x100
              END,
              CASE
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%' AND ?2
                THEN special_powder_processing_fee_tax_included_x100
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%'
                THEN special_powder_processing_fee_tax_excluded_x100
                WHEN ?2 THEN powder_processing_fee_tax_included_x100
                ELSE powder_processing_fee_tax_excluded_x100
              END,
              CASE
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%' AND ?2
                THEN special_billet_processing_fee_tax_included_x100
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%'
                THEN special_billet_processing_fee_tax_excluded_x100
                WHEN ?2 THEN billet_processing_fee_tax_included_x100
                ELSE billet_processing_fee_tax_excluded_x100
              END,
              CASE
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%' AND ?2
                THEN special_oxidation_processing_fee_tax_included_x100
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%'
                THEN special_oxidation_processing_fee_tax_excluded_x100
                WHEN ?2 THEN oxidation_processing_fee_tax_included_x100
                ELSE oxidation_processing_fee_tax_excluded_x100
              END,
              CASE
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%' AND ?2
                THEN special_electrophoresis_processing_fee_tax_included_x100
                WHEN special_pricing_keyword <> '' AND ?3 LIKE '%' || special_pricing_keyword || '%'
                THEN special_electrophoresis_processing_fee_tax_excluded_x100
                WHEN ?2 THEN electrophoresis_processing_fee_tax_included_x100
                ELSE electrophoresis_processing_fee_tax_excluded_x100
              END
            FROM customers
            WHERE id = ?1
            ",
            params![
                order.customer_id.as_deref(),
                pricing_tax_included,
                order.note
            ],
            |row| {
                let trigger_keyword: String = row.get(0)?;
                let is_special = !trigger_keyword.trim().is_empty()
                    && order.note.contains(trigger_keyword.trim());

                Ok(DeliveryPricing {
                    pricing_tax_included,
                    processing_fees: ProcessingFeeSnapshot::new(
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ),
                    profile_name: if is_special {
                        format!("{}价", trigger_keyword.trim())
                    } else {
                        "默认价".to_string()
                    },
                    trigger_keyword: if is_special {
                        trigger_keyword
                    } else {
                        String::new()
                    },
                })
            },
        )
        .optional()
        .map_err(|err| format!("failed to read customer pricing for delivery note: {err}"))?
        .unwrap_or_else(|| DeliveryPricing {
            pricing_tax_included,
            processing_fees: if pricing_tax_included == order.pricing_tax_included {
                order.processing_fees
            } else {
                ProcessingFeeSnapshot::default()
            },
            profile_name: "默认价".to_string(),
            trigger_keyword: String::new(),
        });

    if !pricing.processing_fees.has_any_positive() {
        let pricing_label = if pricing_tax_included {
            "含税"
        } else {
            "不含税"
        };

        return Err(format!(
            "客户资料未设置{pricing_label}加工费，请先维护客户资料"
        ));
    }

    Ok(pricing)
}

pub(crate) fn resolve_customer_inventory_pricing_profile(
    conn: &Connection,
    customer_id: &str,
    batch_note: &str,
) -> Result<PricingProfileSnapshot, String> {
    let trigger_keyword = conn
        .query_row(
            "
            SELECT special_pricing_keyword
            FROM customers
            WHERE id = ?1
            ",
            [customer_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|err| format!("failed to read customer pricing profile: {err}"))?
        .unwrap_or_default();
    let normalized_keyword = trigger_keyword.trim();

    if !normalized_keyword.is_empty() && batch_note.contains(normalized_keyword) {
        Ok(PricingProfileSnapshot {
            profile_name: format!("{normalized_keyword}价"),
            trigger_keyword: normalized_keyword.to_string(),
        })
    } else {
        Ok(PricingProfileSnapshot {
            profile_name: "默认价".to_string(),
            trigger_keyword: String::new(),
        })
    }
}

pub(crate) fn ensure_order_inventory_unlocked(
    conn: &Connection,
    order_id: &str,
) -> Result<(), String> {
    let locked_at: Option<String> = conn
        .query_row(
            "SELECT inventory_locked_at FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| format!("failed to read order inventory lock: {err}"))?
        .flatten();
    if locked_at.is_some() {
        Err("该订单已出库，库存已锁定".to_string())
    } else {
        Ok(())
    }
}

pub(crate) fn next_order_delivery_note_id(
    conn: &Connection,
    order_id: &str,
) -> Result<String, String> {
    let next_number: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(substr(id, length(?1) + 2) AS INTEGER)), 0) + 1
             FROM delivery_notes
             WHERE order_id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to generate delivery note id: {err}"))?;
    Ok(format!("{order_id}-{next_number:02}"))
}

pub(crate) struct RequiredDeliveryWeights {
    pub(crate) bridge: bool,
    pub(crate) powder: bool,
    pub(crate) billet: bool,
    pub(crate) oxidation: bool,
    pub(crate) electrophoresis: bool,
}

pub(crate) fn get_required_delivery_weights(
    items: &[CreateDeliveryNoteItemPayload],
) -> Result<RequiredDeliveryWeights, String> {
    let mut required_weights = RequiredDeliveryWeights {
        bridge: false,
        powder: false,
        billet: false,
        oxidation: false,
        electrophoresis: false,
    };

    for item in items.iter().filter(|item| item.quantity > 0) {
        match checked_processing_category_from_color(item.color.trim())? {
            ProcessingCategory::Billet => required_weights.billet = true,
            ProcessingCategory::Bridge => required_weights.bridge = true,
            ProcessingCategory::Powder => required_weights.powder = true,
            ProcessingCategory::Oxidation => required_weights.oxidation = true,
            ProcessingCategory::Electrophoresis => required_weights.electrophoresis = true,
        }
    }

    Ok(required_weights)
}

pub(crate) fn validate_delivery_note_pricing_for_items(
    pricing: &DeliveryPricing,
    items: &[CreateDeliveryNoteItemPayload],
) -> Result<(), String> {
    let required_weights = get_required_delivery_weights(items)?;
    let pricing_label = if pricing.pricing_tax_included {
        "含税"
    } else {
        "不含税"
    };

    if required_weights.bridge && pricing.processing_fees.bridge <= 0 {
        return Err(format!("{pricing_label}断桥加工费未设置，请先维护客户资料"));
    }

    if required_weights.powder && pricing.processing_fees.powder <= 0 {
        return Err(format!("{pricing_label}喷涂加工费未设置，请先维护客户资料"));
    }

    if required_weights.billet && pricing.processing_fees.billet <= 0 {
        return Err(format!("{pricing_label}坯料加工费未设置，请先维护客户资料"));
    }

    if required_weights.oxidation && pricing.processing_fees.oxidation <= 0 {
        return Err(format!("{pricing_label}氧化加工费未设置，请先维护客户资料"));
    }

    if required_weights.electrophoresis && pricing.processing_fees.electrophoresis <= 0 {
        return Err(format!("{pricing_label}电泳加工费未设置，请先维护客户资料"));
    }

    Ok(())
}

pub(crate) fn query_delivery_note(
    conn: &Connection,
    id: &str,
) -> Result<Option<DeliveryNote>, String> {
    let delivery_note = conn
        .query_row(
            "
            SELECT
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
              created_at
            FROM delivery_notes
            WHERE id = ?1
            ",
            [id],
            |row| {
                Ok(DeliveryNote {
                    id: row.get(0)?,
                    order_id: row.get(1)?,
                    customer_name: row.get(2)?,
                    customer_address: row.get(3)?,
                    handler_name: row.get(4)?,
                    delivery_date: row.get(5)?,
                    aluminum_ingot_price_x100: row.get(6)?,
                    pricing_tax_included: row.get(7)?,
                    bridge_processing_fee_x100: row.get(8)?,
                    powder_processing_fee_x100: row.get(9)?,
                    billet_processing_fee_x100: row.get(10)?,
                    oxidation_processing_fee_x100: row.get(11)?,
                    electrophoresis_processing_fee_x100: row.get(12)?,
                    bridge_weight_kg_x100: row.get(13)?,
                    powder_weight_kg_x100: row.get(14)?,
                    billet_weight_kg_x100: row.get(15)?,
                    oxidation_weight_kg_x100: row.get(16)?,
                    electrophoresis_weight_kg_x100: row.get(17)?,
                    extra_charges: Vec::new(),
                    pricing_profile_name: row.get(18)?,
                    pricing_trigger_keyword: row.get(19)?,
                    note: row.get(20)?,
                    special_note: row.get(21)?,
                    created_at: row.get(22)?,
                    items: Vec::new(),
                    price_groups: Vec::new(),
                })
            },
        )
        .optional()
        .map_err(|err| format!("failed to read delivery note: {err}"))?;

    let Some(mut delivery_note) = delivery_note else {
        return Ok(None);
    };

    let charges = conn.prepare(
        "SELECT name, amount_x100 FROM delivery_note_extra_charges WHERE delivery_note_id = ?1 ORDER BY position",
    ).map_err(|err| format!("failed to prepare delivery charges: {err}"))?
        .query_map([id], |row| Ok(DeliveryExtraCharge { name: row.get(0)?, amount_x100: row.get(1)? }))
        .map_err(|err| format!("failed to query delivery charges: {err}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read delivery charges: {err}"))?;
    delivery_note.extra_charges = charges;

    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
              product_id,
              product_name,
              mold_code,
              length_mm,
              color,
              order_quantity,
              quantity,
              note
            FROM delivery_note_items
            WHERE delivery_note_id = ?1
            ORDER BY id ASC
            ",
        )
        .map_err(|err| format!("failed to prepare delivery note items query: {err}"))?;
    let rows = stmt
        .query_map([id], |row| {
            Ok(DeliveryNoteItem {
                id: row.get(0)?,
                product_id: row.get(1)?,
                product_name: row.get(2)?,
                mold_code: row.get(3)?,
                length_mm: row.get(4)?,
                color: row.get(5)?,
                order_quantity: row.get(6)?,
                quantity: row.get(7)?,
                note: row.get(8)?,
                group_label: None,
                price_group_id: None,
                source_batch_id: None,
                source_batch_note: None,
            })
        })
        .map_err(|err| format!("failed to query delivery note items: {err}"))?;

    delivery_note.items = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read delivery note items: {err}"))?;

    Ok(Some(delivery_note))
}

pub(crate) struct InventoryProduct {
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) thickness_mm_x100: i64,
    pub(crate) weight_per_meter_kg_x1000: i64,
    pub(crate) order_quantity: i64,
}

pub(crate) struct InventoryCustomer {
    pub(crate) customer_name: String,
    pub(crate) customer_address: String,
}

pub(crate) struct CustomerInventoryStockForDelivery {
    pub(crate) id: String,
    pub(crate) batch_id: String,
    pub(crate) batch_note: String,
    pub(crate) customer_id: String,
    pub(crate) customer_name: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) product_id: Option<String>,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
    pub(crate) original_quantity: i64,
}

pub(crate) struct CustomerInventoryStockForAdjustment {
    pub(crate) id: String,
    pub(crate) batch_id: String,
    pub(crate) customer_id: String,
    pub(crate) customer_name: String,
    pub(crate) product_id: Option<String>,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
}

pub(crate) struct CustomerInventoryMovementInput<'a> {
    pub(crate) batch_id: Option<&'a str>,
    pub(crate) stock_id: Option<&'a str>,
    pub(crate) customer_id: Option<&'a str>,
    pub(crate) customer_name: &'a str,
    pub(crate) delivery_note_id: Option<&'a str>,
    pub(crate) product_id: Option<&'a str>,
    pub(crate) product_name: &'a str,
    pub(crate) mold_code: &'a str,
    pub(crate) length_mm: Option<i64>,
    pub(crate) color: &'a str,
    pub(crate) movement_type: &'a str,
    pub(crate) quantity_before: i64,
    pub(crate) quantity_after: i64,
    pub(crate) delta_quantity: i64,
    pub(crate) note: &'a str,
}

pub(crate) fn query_customer_for_inventory(
    conn: &Connection,
    customer_id: &str,
) -> Result<Option<InventoryCustomer>, String> {
    conn.query_row(
        "
        SELECT customer_name, customer_address
        FROM customers
        WHERE id = ?1
        ",
        [customer_id],
        |row| {
            Ok(InventoryCustomer {
                customer_name: row.get(0)?,
                customer_address: row.get(1)?,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read inventory customer: {err}"))
}

pub(crate) fn query_customer_id_for_inventory_import(
    conn: &Connection,
    customer_name: &str,
) -> Result<Option<String>, String> {
    conn.query_row(
        "
        SELECT id
        FROM customers
        WHERE customer_name = ?1
        ",
        [customer_name.trim()],
        |row| row.get(0),
    )
    .optional()
    .map_err(|err| format!("failed to read imported customer inventory customer: {err}"))
}

pub(crate) fn query_customer_product_id_for_import(
    conn: &Connection,
    customer_id: &str,
    product_name: &str,
    mold_code: &str,
) -> Result<Option<String>, String> {
    conn.query_row(
        "
        SELECT products.id
        FROM products
        INNER JOIN customer_products
          ON customer_products.product_id = products.id
        WHERE customer_products.customer_id = ?1
          AND products.product_name = ?2
          AND products.mold_code = ?3
          AND products.deleted_at IS NULL
        ",
        params![customer_id, product_name.trim(), mold_code.trim()],
        |row| row.get(0),
    )
    .optional()
    .map_err(|err| format!("failed to read imported customer inventory product: {err}"))
}

pub(crate) fn query_order_product_for_inventory(
    conn: &Connection,
    order_id: &str,
    product_id: &str,
    length_mm: i64,
    color: &str,
) -> Result<Option<InventoryProduct>, String> {
    conn.query_row(
        "
        SELECT
          order_items.product_name,
          order_items.product_mold_code,
          SUM(order_items.quantity)
        FROM orders
        INNER JOIN order_items ON order_items.order_id = orders.id
        WHERE orders.id = ?1
          AND orders.status = 'ordered'
          AND order_items.product_id = ?2
          AND order_items.length_mm = ?3
          AND order_items.color = ?4
        GROUP BY
          order_items.product_name,
          order_items.product_mold_code
        ",
        params![order_id, product_id, length_mm, color],
        |row| {
            Ok(InventoryProduct {
                product_name: row.get(0)?,
                mold_code: row.get(1)?,
                thickness_mm_x100: 0,
                weight_per_meter_kg_x1000: 0,
                order_quantity: row.get(2)?,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read order inventory product: {err}"))
}

pub(crate) fn query_product_for_inventory(
    conn: &Connection,
    product_id: &str,
) -> Result<Option<InventoryProduct>, String> {
    conn.query_row(
        "
        SELECT product_name, mold_code, thickness_mm_x100, weight_per_meter_kg_x1000
        FROM products
        WHERE id = ?1
        ",
        [product_id],
        |row| {
            Ok(InventoryProduct {
                product_name: row.get(0)?,
                mold_code: row.get(1)?,
                thickness_mm_x100: row.get(2)?,
                weight_per_meter_kg_x1000: row.get(3)?,
                order_quantity: 0,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read inventory product: {err}"))
}

pub(crate) fn query_customer_product_for_inventory(
    conn: &Connection,
    product_id: &str,
    customer_id: &str,
) -> Result<Option<InventoryProduct>, String> {
    conn.query_row(
        "
        SELECT products.product_name, products.mold_code
        FROM products
        INNER JOIN customer_products
          ON customer_products.product_id = products.id
         AND customer_products.customer_id = ?2
        WHERE products.id = ?1
          AND products.deleted_at IS NULL
        ",
        params![product_id, customer_id],
        |row| {
            Ok(InventoryProduct {
                product_name: row.get(0)?,
                mold_code: row.get(1)?,
                thickness_mm_x100: 0,
                weight_per_meter_kg_x1000: 0,
                order_quantity: 0,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read customer inventory product: {err}"))
}

pub(crate) fn query_customer_inventory_batches(
    conn: &Connection,
    search: &str,
) -> Result<Vec<CustomerInventoryBatch>, String> {
    let search_pattern = format!("%{search}%");
    let mut stmt = conn
        .prepare(
            "
            SELECT
              customer_inventory_batches.id,
              customer_inventory_batches.customer_id,
              customer_inventory_batches.customer_name,
              customer_inventory_batches.customer_address,
              customer_inventory_batches.historical_order_date,
              customer_inventory_batches.historical_order_ref,
              customer_inventory_batches.aluminum_ingot_price_x100,
              customer_inventory_batches.pricing_tax_included,
              customer_inventory_batches.bridge_processing_fee_x100,
              customer_inventory_batches.powder_processing_fee_x100,
              customer_inventory_batches.billet_processing_fee_x100,
              customer_inventory_batches.oxidation_processing_fee_x100,
              customer_inventory_batches.electrophoresis_processing_fee_x100,
              customer_inventory_batches.source_order_id,
              customer_inventory_batches.note,
              COALESCE(SUM(customer_inventory_stocks.quantity), 0) AS total_quantity,
              COUNT(customer_inventory_stocks.id) AS item_count,
              EXISTS (
                SELECT 1
                FROM customer_inventory_delivery_notes
                WHERE customer_inventory_delivery_notes.batch_id = customer_inventory_batches.id
                   OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_delivery_note_items
                    INNER JOIN customer_inventory_stocks
                      ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
                   WHERE customer_inventory_delivery_note_items.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_stocks.batch_id = customer_inventory_batches.id
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_movements
                    WHERE customer_inventory_movements.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_movements.batch_id = customer_inventory_batches.id
                  )
              ) AS has_delivery_note,
              (
                SELECT customer_inventory_delivery_notes.id
                FROM customer_inventory_delivery_notes
                WHERE customer_inventory_delivery_notes.batch_id = customer_inventory_batches.id
                   OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_delivery_note_items
                    INNER JOIN customer_inventory_stocks
                      ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
                    WHERE customer_inventory_delivery_note_items.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_stocks.batch_id = customer_inventory_batches.id
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_movements
                    WHERE customer_inventory_movements.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_movements.batch_id = customer_inventory_batches.id
                  )
                ORDER BY customer_inventory_delivery_notes.created_at DESC, customer_inventory_delivery_notes.id DESC
                LIMIT 1
              ) AS delivery_note_id,
              customer_inventory_batches.created_at,
              customer_inventory_batches.updated_at
            FROM customer_inventory_batches
            LEFT JOIN customer_inventory_stocks
              ON customer_inventory_stocks.batch_id = customer_inventory_batches.id
            WHERE
              ?1 = ''
              OR customer_inventory_batches.id LIKE ?2
              OR customer_inventory_batches.customer_name LIKE ?2
              OR customer_inventory_batches.historical_order_ref LIKE ?2
              OR customer_inventory_batches.note LIKE ?2
              OR EXISTS (
                SELECT 1
                FROM customer_inventory_stocks
                WHERE customer_inventory_stocks.batch_id = customer_inventory_batches.id
                  AND (
                    customer_inventory_stocks.product_name LIKE ?2
                    OR customer_inventory_stocks.mold_code LIKE ?2
                    OR customer_inventory_stocks.color LIKE ?2
                    OR CAST(customer_inventory_stocks.length_mm AS TEXT) LIKE ?2
                  )
              )
            GROUP BY customer_inventory_batches.id
            ORDER BY
              customer_inventory_batches.historical_order_date DESC,
              customer_inventory_batches.updated_at DESC,
              customer_inventory_batches.id DESC
            ",
        )
        .map_err(|err| format!("failed to prepare customer inventory query: {err}"))?;
    let rows = stmt
        .query_map(
            params![search, search_pattern],
            read_customer_inventory_batch,
        )
        .map_err(|err| format!("failed to query customer inventory: {err}"))?;
    let mut batches = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer inventory: {err}"))?;

    for batch in batches.iter_mut() {
        batch.items = query_customer_inventory_stock_items(conn, &batch.id)?;
        batch.delivery_note_ids = query_customer_inventory_delivery_note_ids(conn, &batch.id)?;
    }

    Ok(batches)
}

pub(crate) fn query_customer_inventory_print_snapshot(
    conn: &Connection,
    customer_id: &str,
) -> Result<Option<CustomerInventoryPrintSnapshot>, String> {
    let customer = conn
        .query_row(
            "SELECT customer_name, customer_address FROM customers WHERE id = ?1",
            [customer_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|err| format!("failed to read customer inventory print customer: {err}"))?;
    let Some((customer_name, customer_address)) = customer else {
        return Ok(None);
    };

    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
              historical_order_date,
              historical_order_ref,
              aluminum_ingot_price_x100,
              pricing_tax_included,
              bridge_processing_fee_x100,
              powder_processing_fee_x100,
              billet_processing_fee_x100,
              oxidation_processing_fee_x100,
              electrophoresis_processing_fee_x100,
              note
            FROM customer_inventory_batches
            WHERE customer_id = ?1
              AND EXISTS (
                SELECT 1
                FROM customer_inventory_stocks
                WHERE customer_inventory_stocks.batch_id = customer_inventory_batches.id
                  AND customer_inventory_stocks.quantity > 0
              )
            ORDER BY
              historical_order_date DESC,
              updated_at DESC,
              id DESC
            ",
        )
        .map_err(|err| format!("failed to prepare customer inventory print batches: {err}"))?;
    let rows = stmt
        .query_map([customer_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, bool>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
                row.get::<_, i64>(9)?,
                row.get::<_, String>(10)?,
            ))
        })
        .map_err(|err| format!("failed to query customer inventory print batches: {err}"))?;
    let batch_rows = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer inventory print batches: {err}"))?;
    let mut batches = Vec::with_capacity(batch_rows.len());

    for (
        id,
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
    ) in batch_rows
    {
        let items = query_customer_inventory_print_stock_items(conn, &id)?;
        let total_quantity = items.iter().map(|item| item.quantity).sum();

        batches.push(CustomerInventoryPrintBatch {
            id,
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
            total_quantity,
            item_count: items.len() as i64,
            items,
        });
    }

    if batches.is_empty() {
        return Err("该客户暂无当前库存".to_string());
    }

    let generated_at = conn
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |row| {
            row.get(0)
        })
        .map_err(|err| format!("failed to resolve inventory print time: {err}"))?;

    Ok(Some(CustomerInventoryPrintSnapshot {
        customer_id: customer_id.to_string(),
        customer_name,
        customer_address,
        generated_at,
        total_quantity: batches.iter().map(|batch| batch.total_quantity).sum(),
        item_count: batches.iter().map(|batch| batch.item_count).sum(),
        batches,
    }))
}

pub(crate) fn query_customer_inventory_print_stock_items(
    conn: &Connection,
    batch_id: &str,
) -> Result<Vec<CustomerInventoryStockItem>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
              batch_id,
              product_id,
              product_name,
              mold_code,
              length_mm,
              color,
              quantity,
              note,
              updated_at
            FROM customer_inventory_stocks
            WHERE batch_id = ?1 AND quantity > 0
            ORDER BY created_at ASC, id ASC
            ",
        )
        .map_err(|err| format!("failed to prepare customer inventory print items: {err}"))?;
    let rows = stmt
        .query_map([batch_id], |row| {
            Ok(CustomerInventoryStockItem {
                id: row.get(0)?,
                batch_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                mold_code: row.get(4)?,
                length_mm: row.get(5)?,
                color: row.get(6)?,
                quantity: row.get(7)?,
                note: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|err| format!("failed to query customer inventory print items: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer inventory print items: {err}"))
}

pub(crate) fn query_customer_inventory_batch(
    conn: &Connection,
    batch_id: &str,
) -> Result<Option<CustomerInventoryBatch>, String> {
    let batch = conn
        .query_row(
            "
            SELECT
              customer_inventory_batches.id,
              customer_inventory_batches.customer_id,
              customer_inventory_batches.customer_name,
              customer_inventory_batches.customer_address,
              customer_inventory_batches.historical_order_date,
              customer_inventory_batches.historical_order_ref,
              customer_inventory_batches.aluminum_ingot_price_x100,
              customer_inventory_batches.pricing_tax_included,
              customer_inventory_batches.bridge_processing_fee_x100,
              customer_inventory_batches.powder_processing_fee_x100,
              customer_inventory_batches.billet_processing_fee_x100,
              customer_inventory_batches.oxidation_processing_fee_x100,
              customer_inventory_batches.electrophoresis_processing_fee_x100,
              customer_inventory_batches.source_order_id,
              customer_inventory_batches.note,
              COALESCE(SUM(customer_inventory_stocks.quantity), 0) AS total_quantity,
              COUNT(customer_inventory_stocks.id) AS item_count,
              EXISTS (
                SELECT 1
                FROM customer_inventory_delivery_notes
                WHERE customer_inventory_delivery_notes.batch_id = customer_inventory_batches.id
                   OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_delivery_note_items
                    INNER JOIN customer_inventory_stocks
                      ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
                   WHERE customer_inventory_delivery_note_items.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_stocks.batch_id = customer_inventory_batches.id
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_movements
                    WHERE customer_inventory_movements.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_movements.batch_id = customer_inventory_batches.id
                  )
              ) AS has_delivery_note,
              (
                SELECT customer_inventory_delivery_notes.id
                FROM customer_inventory_delivery_notes
                WHERE customer_inventory_delivery_notes.batch_id = customer_inventory_batches.id
                   OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_delivery_note_items
                    INNER JOIN customer_inventory_stocks
                      ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
                    WHERE customer_inventory_delivery_note_items.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_stocks.batch_id = customer_inventory_batches.id
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM customer_inventory_movements
                    WHERE customer_inventory_movements.delivery_note_id = customer_inventory_delivery_notes.id
                      AND customer_inventory_movements.batch_id = customer_inventory_batches.id
                  )
                ORDER BY customer_inventory_delivery_notes.created_at DESC, customer_inventory_delivery_notes.id DESC
                LIMIT 1
              ) AS delivery_note_id,
              customer_inventory_batches.created_at,
              customer_inventory_batches.updated_at
            FROM customer_inventory_batches
            LEFT JOIN customer_inventory_stocks
              ON customer_inventory_stocks.batch_id = customer_inventory_batches.id
            WHERE customer_inventory_batches.id = ?1
            GROUP BY customer_inventory_batches.id
            ",
            [batch_id],
            read_customer_inventory_batch,
        )
        .optional()
        .map_err(|err| format!("failed to read customer inventory batch: {err}"))?;
    let Some(mut batch) = batch else {
        return Ok(None);
    };

    batch.items = query_customer_inventory_stock_items(conn, &batch.id)?;
    batch.delivery_note_ids = query_customer_inventory_delivery_note_ids(conn, &batch.id)?;
    Ok(Some(batch))
}

pub(crate) fn read_customer_inventory_batch(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<CustomerInventoryBatch> {
    Ok(CustomerInventoryBatch {
        id: row.get(0)?,
        customer_id: row.get(1)?,
        customer_name: row.get(2)?,
        customer_address: row.get(3)?,
        historical_order_date: row.get(4)?,
        historical_order_ref: row.get(5)?,
        aluminum_ingot_price_x100: row.get(6)?,
        pricing_tax_included: row.get(7)?,
        bridge_processing_fee_x100: row.get(8)?,
        powder_processing_fee_x100: row.get(9)?,
        billet_processing_fee_x100: row.get(10)?,
        oxidation_processing_fee_x100: row.get(11)?,
        electrophoresis_processing_fee_x100: row.get(12)?,
        source_order_id: row.get(13)?,
        note: row.get(14)?,
        total_quantity: row.get(15)?,
        item_count: row.get(16)?,
        has_delivery_note: row.get(17)?,
        delivery_note_id: row.get(18)?,
        delivery_note_ids: Vec::new(),
        created_at: row.get(19)?,
        updated_at: row.get(20)?,
        items: Vec::new(),
    })
}

pub(crate) fn query_customer_inventory_delivery_note_ids(
    conn: &Connection,
    batch_id: &str,
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT DISTINCT customer_inventory_delivery_notes.id,
              customer_inventory_delivery_notes.created_at
            FROM customer_inventory_delivery_notes
            WHERE customer_inventory_delivery_notes.batch_id = ?1
               OR EXISTS (
                SELECT 1
                FROM customer_inventory_delivery_note_items
                INNER JOIN customer_inventory_stocks
                  ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
                WHERE customer_inventory_delivery_note_items.delivery_note_id = customer_inventory_delivery_notes.id
                  AND customer_inventory_stocks.batch_id = ?1
              )
              OR EXISTS (
                SELECT 1
                FROM customer_inventory_movements
                WHERE customer_inventory_movements.delivery_note_id = customer_inventory_delivery_notes.id
                  AND customer_inventory_movements.batch_id = ?1
              )
            ORDER BY customer_inventory_delivery_notes.created_at ASC,
              customer_inventory_delivery_notes.id ASC
            ",
        )
        .map_err(|err| format!("failed to prepare customer delivery note ids query: {err}"))?;
    let rows = stmt
        .query_map([batch_id], |row| row.get::<_, String>(0))
        .map_err(|err| format!("failed to query customer delivery note ids: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer delivery note ids: {err}"))
}

pub(crate) fn query_customer_inventory_stock_items(
    conn: &Connection,
    batch_id: &str,
) -> Result<Vec<CustomerInventoryStockItem>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
              batch_id,
              product_id,
              product_name,
              mold_code,
              length_mm,
              color,
              quantity,
              note,
              updated_at
            FROM customer_inventory_stocks
            WHERE batch_id = ?1
            ORDER BY created_at ASC, id ASC
            ",
        )
        .map_err(|err| format!("failed to prepare customer inventory stock query: {err}"))?;
    let rows = stmt
        .query_map([batch_id], |row| {
            Ok(CustomerInventoryStockItem {
                id: row.get(0)?,
                batch_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                mold_code: row.get(4)?,
                length_mm: row.get(5)?,
                color: row.get(6)?,
                quantity: row.get(7)?,
                note: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|err| format!("failed to query customer inventory stocks: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer inventory stocks: {err}"))
}

pub(crate) fn query_customer_inventory_stock_by_id(
    conn: &Connection,
    stock_id: &str,
) -> Result<Option<CustomerInventoryStockForAdjustment>, String> {
    conn.query_row(
        "
        SELECT
          customer_inventory_stocks.id,
          customer_inventory_stocks.batch_id,
          customer_inventory_batches.customer_id,
          customer_inventory_batches.customer_name,
          customer_inventory_stocks.product_id,
          customer_inventory_stocks.product_name,
          customer_inventory_stocks.mold_code,
          customer_inventory_stocks.length_mm,
          customer_inventory_stocks.color,
          customer_inventory_stocks.quantity
        FROM customer_inventory_stocks
        INNER JOIN customer_inventory_batches
          ON customer_inventory_batches.id = customer_inventory_stocks.batch_id
        WHERE customer_inventory_stocks.id = ?1
        ",
        [stock_id],
        |row| {
            Ok(CustomerInventoryStockForAdjustment {
                id: row.get(0)?,
                batch_id: row.get(1)?,
                customer_id: row.get(2)?,
                customer_name: row.get(3)?,
                product_id: row.get(4)?,
                product_name: row.get(5)?,
                mold_code: row.get(6)?,
                length_mm: row.get(7)?,
                color: row.get(8)?,
                quantity: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read customer inventory stock for adjustment: {err}"))
}

pub(crate) fn query_customer_inventory_stock_for_delivery(
    conn: &Connection,
    stock_id: &str,
) -> Result<CustomerInventoryStockForDelivery, String> {
    if stock_id.is_empty() {
        return Err("出库商品不能为空".to_string());
    }

    conn.query_row(
        "
        SELECT
          customer_inventory_stocks.id,
          customer_inventory_stocks.batch_id,
          customer_inventory_batches.note,
          customer_inventory_batches.customer_id,
          customer_inventory_batches.customer_name,
          customer_inventory_batches.aluminum_ingot_price_x100,
          customer_inventory_batches.pricing_tax_included,
          customer_inventory_batches.bridge_processing_fee_x100,
          customer_inventory_batches.powder_processing_fee_x100,
          customer_inventory_batches.billet_processing_fee_x100,
          customer_inventory_batches.oxidation_processing_fee_x100,
          customer_inventory_batches.electrophoresis_processing_fee_x100,
          customer_inventory_stocks.product_id,
          customer_inventory_stocks.product_name,
          customer_inventory_stocks.mold_code,
          customer_inventory_stocks.length_mm,
          customer_inventory_stocks.color,
          customer_inventory_stocks.quantity
        FROM customer_inventory_stocks
        INNER JOIN customer_inventory_batches
          ON customer_inventory_batches.id = customer_inventory_stocks.batch_id
        WHERE customer_inventory_stocks.id = ?1
        ",
        params![stock_id],
        |row| {
            let quantity = row.get(17)?;

            Ok(CustomerInventoryStockForDelivery {
                id: row.get(0)?,
                batch_id: row.get(1)?,
                batch_note: row.get(2)?,
                customer_id: row.get(3)?,
                customer_name: row.get(4)?,
                aluminum_ingot_price_x100: row.get(5)?,
                pricing_tax_included: row.get(6)?,
                bridge_processing_fee_x100: row.get(7)?,
                powder_processing_fee_x100: row.get(8)?,
                billet_processing_fee_x100: row.get(9)?,
                oxidation_processing_fee_x100: row.get(10)?,
                electrophoresis_processing_fee_x100: row.get(11)?,
                product_id: row.get(12)?,
                product_name: row.get(13)?,
                mold_code: row.get(14)?,
                length_mm: row.get(15)?,
                color: row.get(16)?,
                quantity,
                original_quantity: quantity,
            })
        },
    )
    .optional()
    .map_err(|err| format!("failed to read customer inventory stock: {err}"))?
    .ok_or_else(|| "客户库存商品不存在".to_string())
}

pub(crate) fn query_customer_inventory_movements(
    conn: &Connection,
    search: &str,
) -> Result<Vec<CustomerInventoryMovement>, String> {
    let search_pattern = format!("%{search}%");
    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
              batch_id,
              stock_id,
              customer_id,
              customer_name,
              delivery_note_id,
              product_id,
              product_name,
              mold_code,
              length_mm,
              color,
              movement_type,
              quantity_before,
              quantity_after,
              delta_quantity,
              note,
              created_at
            FROM customer_inventory_movements
            WHERE
              ?1 = ''
              OR COALESCE(batch_id, '') LIKE ?2
              OR customer_name LIKE ?2
              OR COALESCE(delivery_note_id, '') LIKE ?2
              OR product_name LIKE ?2
              OR mold_code LIKE ?2
              OR color LIKE ?2
              OR note LIKE ?2
            ORDER BY created_at DESC, id DESC
            LIMIT 80
            ",
        )
        .map_err(|err| format!("failed to prepare customer inventory movements query: {err}"))?;
    let rows = stmt
        .query_map(params![search, search_pattern], |row| {
            Ok(CustomerInventoryMovement {
                id: row.get(0)?,
                batch_id: row.get(1)?,
                stock_id: row.get(2)?,
                customer_id: row.get(3)?,
                customer_name: row.get(4)?,
                delivery_note_id: row.get(5)?,
                product_id: row.get(6)?,
                product_name: row.get(7)?,
                mold_code: row.get(8)?,
                length_mm: row.get(9)?,
                color: row.get(10)?,
                movement_type: row.get(11)?,
                quantity_before: row.get(12)?,
                quantity_after: row.get(13)?,
                delta_quantity: row.get(14)?,
                note: row.get(15)?,
                created_at: row.get(16)?,
            })
        })
        .map_err(|err| format!("failed to query customer inventory movements: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer inventory movements: {err}"))
}

pub(crate) fn query_customer_inventory_delivery_note_summaries(
    conn: &Connection,
    search: &str,
) -> Result<Vec<CustomerInventoryDeliveryNoteSummary>, String> {
    let search_pattern = format!("%{search}%");
    let mut stmt = conn
        .prepare(
            "
            SELECT
              customer_inventory_delivery_notes.id,
              customer_inventory_delivery_notes.customer_name,
              customer_inventory_delivery_notes.delivery_date,
              customer_inventory_delivery_notes.handler_name,
              COUNT(customer_inventory_delivery_note_items.id) AS item_count,
              COALESCE(SUM(customer_inventory_delivery_note_items.quantity), 0) AS total_quantity,
              customer_inventory_delivery_notes.created_at
            FROM customer_inventory_delivery_notes
            LEFT JOIN customer_inventory_delivery_note_items
              ON customer_inventory_delivery_note_items.delivery_note_id = customer_inventory_delivery_notes.id
            WHERE
              ?1 = ''
              OR customer_inventory_delivery_notes.id LIKE ?2
              OR customer_inventory_delivery_notes.customer_name LIKE ?2
              OR customer_inventory_delivery_notes.handler_name LIKE ?2
              OR customer_inventory_delivery_notes.note LIKE ?2
              OR customer_inventory_delivery_notes.delivery_date LIKE ?2
              OR EXISTS (
                SELECT 1
                FROM customer_inventory_delivery_note_items
                INNER JOIN customer_inventory_stocks
                  ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
                WHERE customer_inventory_delivery_note_items.delivery_note_id = customer_inventory_delivery_notes.id
                  AND (
                    customer_inventory_stocks.batch_id LIKE ?2
                    OR customer_inventory_stocks.product_name LIKE ?2
                    OR customer_inventory_stocks.mold_code LIKE ?2
                    OR customer_inventory_stocks.color LIKE ?2
                  )
              )
              OR EXISTS (
                SELECT 1
                FROM customer_inventory_movements
                WHERE customer_inventory_movements.delivery_note_id = customer_inventory_delivery_notes.id
                  AND (
                    COALESCE(customer_inventory_movements.batch_id, '') LIKE ?2
                    OR customer_inventory_movements.customer_name LIKE ?2
                    OR customer_inventory_movements.product_name LIKE ?2
                    OR customer_inventory_movements.mold_code LIKE ?2
                    OR customer_inventory_movements.color LIKE ?2
                  )
              )
            GROUP BY customer_inventory_delivery_notes.id
            ORDER BY customer_inventory_delivery_notes.created_at DESC,
              customer_inventory_delivery_notes.id DESC
            LIMIT 80
            ",
        )
        .map_err(|err| format!("failed to prepare customer inventory delivery note summaries query: {err}"))?;
    let rows = stmt
        .query_map(params![search, search_pattern], |row| {
            Ok(CustomerInventoryDeliveryNoteSummary {
                id: row.get(0)?,
                customer_name: row.get(1)?,
                delivery_date: row.get(2)?,
                handler_name: row.get(3)?,
                batch_ids: Vec::new(),
                item_count: row.get(4)?,
                total_quantity: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|err| {
            format!("failed to query customer inventory delivery note summaries: {err}")
        })?;
    let mut delivery_notes = rows.collect::<Result<Vec<_>, _>>().map_err(|err| {
        format!("failed to read customer inventory delivery note summaries: {err}")
    })?;

    for delivery_note in delivery_notes.iter_mut() {
        delivery_note.batch_ids =
            query_customer_inventory_delivery_note_batch_ids(conn, &delivery_note.id)?;
    }

    Ok(delivery_notes)
}

pub(crate) fn query_customer_inventory_delivery_note(
    conn: &Connection,
    id: &str,
) -> Result<Option<DeliveryNote>, String> {
    let delivery_note = conn
        .query_row(
            "
            SELECT
              id,
              COALESCE(batch_id, ''),
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
              extra_charge_name,
              extra_charge_amount_x100,
              pricing_profile_name,
              pricing_trigger_keyword,
              note,
              special_note,
              created_at
            FROM customer_inventory_delivery_notes
            WHERE id = ?1
            ",
            [id],
            |row| {
                let batch_id: String = row.get(1)?;

                Ok(DeliveryNote {
                    id: row.get(0)?,
                    order_id: batch_id,
                    customer_name: row.get(2)?,
                    customer_address: row.get(3)?,
                    handler_name: row.get(4)?,
                    delivery_date: row.get(5)?,
                    aluminum_ingot_price_x100: row.get(6)?,
                    pricing_tax_included: row.get(7)?,
                    bridge_processing_fee_x100: row.get(8)?,
                    powder_processing_fee_x100: row.get(9)?,
                    billet_processing_fee_x100: row.get(10)?,
                    oxidation_processing_fee_x100: row.get(11)?,
                    electrophoresis_processing_fee_x100: row.get(12)?,
                    bridge_weight_kg_x100: row.get(13)?,
                    powder_weight_kg_x100: row.get(14)?,
                    billet_weight_kg_x100: row.get(15)?,
                    oxidation_weight_kg_x100: row.get(16)?,
                    electrophoresis_weight_kg_x100: row.get(17)?,
                    extra_charges: customer_delivery_charge_rows(row.get(18)?, row.get(19)?),
                    pricing_profile_name: row.get(20)?,
                    pricing_trigger_keyword: row.get(21)?,
                    note: row.get(22)?,
                    special_note: row.get(23)?,
                    created_at: row.get(24)?,
                    items: Vec::new(),
                    price_groups: Vec::new(),
                })
            },
        )
        .optional()
        .map_err(|err| format!("failed to read customer inventory delivery note: {err}"))?;
    let Some(mut delivery_note) = delivery_note else {
        return Ok(None);
    };

    let mut stmt = conn
        .prepare(
            "
            SELECT
              customer_inventory_delivery_note_items.id,
              customer_inventory_delivery_note_items.product_id,
              customer_inventory_delivery_note_items.product_name,
              customer_inventory_delivery_note_items.mold_code,
              customer_inventory_delivery_note_items.length_mm,
              customer_inventory_delivery_note_items.color,
              customer_inventory_delivery_note_items.order_quantity,
              customer_inventory_delivery_note_items.quantity,
              customer_inventory_delivery_note_items.note,
              customer_inventory_delivery_note_items.group_label,
              customer_inventory_delivery_note_items.price_group_id,
              customer_inventory_stocks.batch_id,
              customer_inventory_batches.note
            FROM customer_inventory_delivery_note_items
            LEFT JOIN customer_inventory_stocks
              ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
            LEFT JOIN customer_inventory_batches
              ON customer_inventory_batches.id = customer_inventory_stocks.batch_id
            WHERE customer_inventory_delivery_note_items.delivery_note_id = ?1
            ORDER BY customer_inventory_delivery_note_items.id ASC
            ",
        )
        .map_err(|err| format!("failed to prepare customer delivery note items query: {err}"))?;
    let rows = stmt
        .query_map([id], |row| {
            Ok(DeliveryNoteItem {
                id: row.get(0)?,
                product_id: row.get(1)?,
                product_name: row.get(2)?,
                mold_code: row.get(3)?,
                length_mm: row.get(4)?,
                color: row.get(5)?,
                order_quantity: row.get(6)?,
                quantity: row.get(7)?,
                note: row.get(8)?,
                group_label: row.get(9)?,
                price_group_id: row.get(10)?,
                source_batch_id: row.get(11)?,
                source_batch_note: row.get(12)?,
            })
        })
        .map_err(|err| format!("failed to query customer delivery note items: {err}"))?;
    delivery_note.items = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer delivery note items: {err}"))?;
    delivery_note.price_groups =
        query_customer_inventory_delivery_note_price_groups(conn, id, &delivery_note.items)?;

    if delivery_note.order_id.is_empty() {
        let source_batch_ids = query_customer_inventory_delivery_note_batch_ids(conn, id)?;
        delivery_note.order_id = source_batch_ids.join("、");
    }

    Ok(Some(delivery_note))
}

pub(crate) fn query_customer_inventory_delivery_note_price_groups(
    conn: &Connection,
    delivery_note_id: &str,
    delivery_note_items: &[DeliveryNoteItem],
) -> Result<Vec<DeliveryNotePriceGroup>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT
              id,
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
              extra_charge_amount_x100,
              extra_charge_name,
              pricing_profile_name,
              pricing_trigger_keyword
            FROM customer_inventory_delivery_note_price_groups
            WHERE delivery_note_id = ?1
            ORDER BY group_index ASC, id ASC
            ",
        )
        .map_err(|err| {
            format!("failed to prepare customer delivery note price groups query: {err}")
        })?;
    let rows = stmt
        .query_map([delivery_note_id], |row| {
            let price_group_id: String = row.get(0)?;
            let items = delivery_note_items
                .iter()
                .filter(|item| item.price_group_id.as_deref() == Some(price_group_id.as_str()))
                .cloned()
                .collect();

            Ok(DeliveryNotePriceGroup {
                id: price_group_id,
                title: row.get(1)?,
                aluminum_ingot_price_x100: row.get(2)?,
                pricing_tax_included: row.get(3)?,
                bridge_processing_fee_x100: row.get(4)?,
                powder_processing_fee_x100: row.get(5)?,
                billet_processing_fee_x100: row.get(6)?,
                oxidation_processing_fee_x100: row.get(7)?,
                electrophoresis_processing_fee_x100: row.get(8)?,
                bridge_weight_kg_x100: row.get(9)?,
                powder_weight_kg_x100: row.get(10)?,
                billet_weight_kg_x100: row.get(11)?,
                oxidation_weight_kg_x100: row.get(12)?,
                electrophoresis_weight_kg_x100: row.get(13)?,
                extra_charges: customer_delivery_charge_rows(row.get(15)?, row.get(14)?),
                pricing_profile_name: row.get(16)?,
                pricing_trigger_keyword: row.get(17)?,
                items,
            })
        })
        .map_err(|err| format!("failed to query customer delivery note price groups: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer delivery note price groups: {err}"))
}

pub(crate) fn query_customer_inventory_delivery_note_batch_ids(
    conn: &Connection,
    delivery_note_id: &str,
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT batch_id, MIN(source_order) AS source_order
            FROM (
              SELECT customer_inventory_delivery_notes.batch_id AS batch_id, 0 AS source_order
              FROM customer_inventory_delivery_notes
              WHERE customer_inventory_delivery_notes.id = ?1
                AND customer_inventory_delivery_notes.batch_id IS NOT NULL

              UNION

              SELECT customer_inventory_stocks.batch_id AS batch_id, 1 AS source_order
              FROM customer_inventory_delivery_note_items
              INNER JOIN customer_inventory_stocks
                ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
              WHERE customer_inventory_delivery_note_items.delivery_note_id = ?1
                AND customer_inventory_stocks.batch_id IS NOT NULL

              UNION

              SELECT customer_inventory_movements.batch_id AS batch_id, 2 AS source_order
              FROM customer_inventory_movements
              WHERE customer_inventory_movements.delivery_note_id = ?1
                AND customer_inventory_movements.batch_id IS NOT NULL
            )
            GROUP BY batch_id
            ORDER BY source_order ASC, batch_id ASC
            ",
        )
        .map_err(|err| {
            format!("failed to prepare customer delivery note batch ids query: {err}")
        })?;
    let rows = stmt
        .query_map([delivery_note_id], |row| row.get::<_, String>(0))
        .map_err(|err| format!("failed to query customer delivery note batch ids: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("failed to read customer delivery note batch ids: {err}"))
}

pub(crate) fn write_customer_inventory_movement(
    conn: &Connection,
    input: CustomerInventoryMovementInput<'_>,
) -> Result<(), String> {
    let movement_id = next_customer_inventory_movement_id(conn)?;

    conn.execute(
        "
        INSERT INTO customer_inventory_movements (
          id,
          batch_id,
          stock_id,
          customer_id,
          customer_name,
          delivery_note_id,
          product_id,
          product_name,
          mold_code,
          length_mm,
          color,
          movement_type,
          quantity_before,
          quantity_after,
          delta_quantity,
          note,
          created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, CURRENT_TIMESTAMP)
        ",
        params![
            movement_id,
            input.batch_id,
            input.stock_id,
            input.customer_id,
            input.customer_name,
            input.delivery_note_id,
            input.product_id,
            input.product_name,
            input.mold_code,
            input.length_mm,
            input.color,
            input.movement_type,
            input.quantity_before,
            input.quantity_after,
            input.delta_quantity,
            input.note
        ],
    )
    .map_err(|err| format!("failed to write customer inventory movement: {err}"))?;

    Ok(())
}

pub(crate) fn get_required_customer_delivery_weights(
    items: &[CustomerInventoryStockForDelivery],
) -> Result<RequiredDeliveryWeights, String> {
    let mut required_weights = RequiredDeliveryWeights {
        bridge: false,
        powder: false,
        billet: false,
        oxidation: false,
        electrophoresis: false,
    };

    for item in items {
        match checked_processing_category_from_color(item.color.trim())? {
            ProcessingCategory::Billet => required_weights.billet = true,
            ProcessingCategory::Bridge => required_weights.bridge = true,
            ProcessingCategory::Powder => required_weights.powder = true,
            ProcessingCategory::Oxidation => required_weights.oxidation = true,
            ProcessingCategory::Electrophoresis => required_weights.electrophoresis = true,
        }
    }

    Ok(required_weights)
}

pub(crate) fn get_required_customer_inventory_weights(
    items: &[CreateCustomerInventoryStockItemPayload],
) -> Result<RequiredDeliveryWeights, String> {
    let mut required_weights = RequiredDeliveryWeights {
        bridge: false,
        powder: false,
        billet: false,
        oxidation: false,
        electrophoresis: false,
    };

    for item in items {
        match checked_processing_category_from_color(item.color.trim())? {
            ProcessingCategory::Billet => required_weights.billet = true,
            ProcessingCategory::Bridge => required_weights.bridge = true,
            ProcessingCategory::Powder => required_weights.powder = true,
            ProcessingCategory::Oxidation => required_weights.oxidation = true,
            ProcessingCategory::Electrophoresis => required_weights.electrophoresis = true,
        }
    }

    Ok(required_weights)
}

pub(crate) fn validate_processing_fees_for_required_weights(
    pricing_tax_included: bool,
    processing_fees: ProcessingFeeSnapshot,
    required_weights: &RequiredDeliveryWeights,
) -> Result<(), String> {
    let pricing_label = if pricing_tax_included {
        "含税"
    } else {
        "不含税"
    };

    if required_weights.bridge && processing_fees.bridge <= 0 {
        return Err(format!("{pricing_label}断桥加工费未设置"));
    }

    if required_weights.powder && processing_fees.powder <= 0 {
        return Err(format!("{pricing_label}喷涂加工费未设置"));
    }

    if required_weights.billet && processing_fees.billet <= 0 {
        return Err(format!("{pricing_label}坯料加工费未设置"));
    }

    if required_weights.oxidation && processing_fees.oxidation <= 0 {
        return Err(format!("{pricing_label}氧化加工费未设置"));
    }

    if required_weights.electrophoresis && processing_fees.electrophoresis <= 0 {
        return Err(format!("{pricing_label}电泳加工费未设置"));
    }

    Ok(())
}

pub(crate) fn next_movement_id(conn: &Connection) -> Result<String, String> {
    let next_number: i64 = conn
        .query_row(
            "
            SELECT COALESCE(MAX(CAST(substr(id, 5) AS INTEGER)), 0) + 1
            FROM inventory_movements
            WHERE id LIKE 'MOV-%'
            ",
            [],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to generate inventory movement id: {err}"))?;

    Ok(format!("MOV-{next_number:06}"))
}

pub(crate) fn next_customer_inventory_batch_id(
    conn: &Connection,
    customer_name: &str,
    batch_date: &str,
) -> Result<String, String> {
    let customer_initials = customer_name_initials(customer_name);
    let compact_date = batch_date.replace('-', "");
    let batch_prefix = format!("{customer_initials}-{compact_date}");
    let next_number: i64 = conn
        .query_row(
            "
            SELECT COALESCE(MAX(CAST(substr(id, length(?1) + 1) AS INTEGER)), 0) + 1
            FROM customer_inventory_batches
            WHERE id LIKE ?2
            ",
            params![&batch_prefix, format!("{batch_prefix}%")],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to generate customer inventory batch id: {err}"))?;

    Ok(format!("{batch_prefix}{next_number:03}"))
}

pub(crate) fn next_customer_inventory_movement_id(conn: &Connection) -> Result<String, String> {
    let next_number: i64 = conn
        .query_row(
            "
            SELECT COALESCE(MAX(CAST(substr(id, 6) AS INTEGER)), 0) + 1
            FROM customer_inventory_movements
            WHERE id LIKE 'CIM-%'
            ",
            [],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to generate customer inventory movement id: {err}"))?;

    Ok(format!("CIM-{next_number:06}"))
}

pub(crate) fn next_customer_inventory_delivery_note_id(
    conn: &Connection,
    batch: &CustomerInventoryBatch,
    is_merged: bool,
) -> Result<String, String> {
    if !is_merged {
        let next_number: i64 = conn
            .query_row(
                "
                SELECT COALESCE(MAX(CAST(substr(id, length(?1) + 2) AS INTEGER)), 0) + 1
                FROM customer_inventory_delivery_notes
                WHERE batch_id = ?1 AND id LIKE ?2
                ",
                params![&batch.id, format!("{}-%", batch.id)],
                |row| row.get(0),
            )
            .map_err(|err| {
                format!("failed to generate customer inventory delivery note id: {err}")
            })?;

        return Ok(format!("{}-{next_number:02}", batch.id));
    }

    let customer_initials = customer_name_initials(&batch.customer_name);
    let date: String = conn
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .map_err(|err| format!("failed to resolve customer delivery note date: {err}"))?;
    let prefix = format!("{}-CK{}", customer_initials, date.replace('-', ""));
    let next_number: i64 = conn
        .query_row(
            "
            SELECT COALESCE(MAX(CAST(substr(id, length(?1) + 2) AS INTEGER)), 0) + 1
            FROM customer_inventory_delivery_notes
            WHERE id LIKE ?2
            ",
            params![&prefix, format!("{prefix}-%")],
            |row| row.get(0),
        )
        .map_err(|err| format!("failed to generate customer inventory delivery note id: {err}"))?;

    Ok(format!("{prefix}-{next_number:02}"))
}

pub(crate) fn customer_name_initials(customer_name: &str) -> String {
    // 纯 Rust 拼音转换，所有平台同一套逻辑，与 macOS 原来的
    // Foundation Mandarin-Latin 转换结果一致：每个汉字取拼音首字母，
    // 连续的 ASCII 字母数字只取第一个（例如 "ABC公司" -> "AGS"），
    // 其余字符（空格、标点）跳过。
    let normalized = customer_name.trim();

    if normalized.is_empty() {
        return "KH".to_string();
    }

    let mut initials = String::new();
    let mut chars = normalized.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch.is_ascii_alphanumeric() {
            initials.push(ch.to_ascii_uppercase());
            while chars
                .peek()
                .is_some_and(|next| next.is_ascii_alphanumeric())
            {
                chars.next();
            }
        } else if let Some(pinyin) = ch.to_pinyin() {
            if let Some(first) = pinyin.plain().chars().next() {
                initials.push(first.to_ascii_uppercase());
            }
        }
    }

    if initials.is_empty() {
        "KH".to_string()
    } else {
        initials
    }
}

pub(crate) fn format_customer_inventory_stock_id(batch_id: &str, number: usize) -> String {
    format!("{batch_id}-{number:03}")
}

pub(crate) fn format_delivery_note_item_id(delivery_note_id: &str, number: usize) -> String {
    format!("{delivery_note_id}-{number:03}")
}

pub(crate) fn validate_date(value: &str, label: &str) -> Result<(), String> {
    let is_valid = value.len() == 10
        && value.chars().enumerate().all(|(index, ch)| {
            if index == 4 || index == 7 {
                ch == '-'
            } else {
                ch.is_ascii_digit()
            }
        });

    if is_valid {
        Ok(())
    } else {
        Err(format!("{label}格式必须为 YYYY-MM-DD"))
    }
}

pub(crate) fn current_local_date(conn: &Connection) -> Result<String, String> {
    conn.query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .map_err(|err| format!("failed to resolve local date: {err}"))
}

pub(crate) fn parse_customer_inventory_import_rows(
    rows: Vec<Vec<String>>,
) -> ParseCustomerInventoryImportResult {
    if rows.len() < 2 {
        return ParseCustomerInventoryImportResult {
            rows: Vec::new(),
            errors: vec!["文件至少需要表头和一行数据".to_string()],
        };
    }

    let header_specs: [(&str, &[&str]); 18] = [
        ("导入批次标识", &["导入批次标识", "批次标识", "batchKey"]),
        ("客户名称", &["客户名称", "客户", "customerName"]),
        (
            "历史下单日期",
            &["历史下单日期", "历史日期", "historicalOrderDate"],
        ),
        ("历史单号", &["历史单号", "historicalOrderRef"]),
        ("铝锭价", &["铝锭价", "aluminumIngotPrice"]),
        ("计价方式", &["计价方式", "计价", "pricingTaxIncluded"]),
        ("断桥加工费", &["断桥加工费", "bridgeProcessingFee"]),
        ("喷涂加工费", &["喷涂加工费", "powderProcessingFee"]),
        ("坯料加工费", &["坯料加工费", "billetProcessingFee"]),
        ("氧化加工费", &["氧化加工费", "oxidationProcessingFee"]),
        (
            "电泳加工费",
            &["电泳加工费", "electrophoresisProcessingFee"],
        ),
        ("批次备注", &["批次备注", "batchNote"]),
        ("商品名称", &["商品名称", "商品", "productName"]),
        ("模具编号", &["模具编号", "模具", "moldCode"]),
        ("长度(mm)", &["长度", "长度mm", "lengthMm"]),
        ("颜色", &["颜色", "color"]),
        (
            "当前库存(支)",
            &["当前库存", "当前库存支", "库存数量", "quantity"],
        ),
        ("明细备注", &["明细备注", "备注", "itemNote"]),
    ];
    let header_row_index = find_customer_inventory_import_header_row(&rows, &header_specs);
    let headers = rows[header_row_index]
        .iter()
        .map(|header| normalize_customer_inventory_import_header(header))
        .collect::<Vec<_>>();
    let mut indexes = HashMap::new();
    let mut errors = Vec::new();

    for (label, candidates) in header_specs {
        if let Some(index) = find_customer_inventory_import_header_index(&headers, candidates) {
            indexes.insert(label, index);
        } else if !matches!(label, "历史下单日期" | "历史单号" | "批次备注" | "明细备注")
        {
            errors.push(format!("缺少{label}列"));
        }
    }

    if !errors.is_empty() {
        return ParseCustomerInventoryImportResult {
            rows: Vec::new(),
            errors,
        };
    }

    let mut parsed_rows = Vec::new();

    for (index, row) in rows.iter().enumerate().skip(header_row_index + 1) {
        if row.iter().all(|value| value.trim().is_empty()) {
            continue;
        }

        let row_number = index + 1;
        let value = |label: &str| {
            indexes
                .get(label)
                .and_then(|index| row.get(*index))
                .map(|value| value.trim())
                .unwrap_or("")
        };
        let batch_key = value("导入批次标识");
        let customer_name = value("客户名称");
        let historical_order_date_text = value("历史下单日期");
        let product_name = value("商品名称");
        let mold_code = value("模具编号");
        let color = value("颜色");
        let aluminum_ingot_price_x100 = parse_customer_inventory_import_money(value("铝锭价"));
        let pricing_tax_included = parse_customer_inventory_import_pricing(value("计价方式"));
        let bridge_processing_fee_x100 = parse_customer_inventory_import_money(value("断桥加工费"));
        let powder_processing_fee_x100 = parse_customer_inventory_import_money(value("喷涂加工费"));
        let billet_processing_fee_x100 = parse_customer_inventory_import_money(value("坯料加工费"));
        let oxidation_processing_fee_x100 =
            parse_customer_inventory_import_money(value("氧化加工费"));
        let electrophoresis_processing_fee_x100 =
            parse_customer_inventory_import_money(value("电泳加工费"));
        let length_mm = parse_customer_inventory_import_positive_integer(value("长度(mm)"), "mm");
        let quantity =
            parse_customer_inventory_import_positive_integer(value("当前库存(支)"), "支");
        let mut row_errors = Vec::new();

        if batch_key.is_empty() {
            row_errors.push("导入批次标识不能为空".to_string());
        }
        if customer_name.is_empty() {
            row_errors.push("客户名称不能为空".to_string());
        }
        if !historical_order_date_text.is_empty()
            && validate_date(historical_order_date_text, "历史下单日期").is_err()
        {
            row_errors.push("历史下单日期格式必须为 YYYY-MM-DD".to_string());
        }
        if aluminum_ingot_price_x100.is_none_or(|value| value <= 0) {
            row_errors.push("铝锭价必须为大于 0 的金额".to_string());
        }
        if pricing_tax_included.is_none() {
            row_errors.push("计价方式必须为含税或不含税".to_string());
        }
        for (label, parsed) in [
            ("断桥加工费", bridge_processing_fee_x100),
            ("喷涂加工费", powder_processing_fee_x100),
            ("坯料加工费", billet_processing_fee_x100),
            ("氧化加工费", oxidation_processing_fee_x100),
            ("电泳加工费", electrophoresis_processing_fee_x100),
        ] {
            if parsed.is_none() {
                row_errors.push(format!("{label}必须为非负金额"));
            }
        }
        if product_name.is_empty() {
            row_errors.push("商品名称不能为空".to_string());
        }
        if mold_code.is_empty() {
            row_errors.push("模具编号不能为空".to_string());
        }
        if length_mm.is_none() {
            row_errors.push("长度(mm)必须为正整数".to_string());
        }
        if color.is_empty() {
            row_errors.push("颜色不能为空".to_string());
        }
        if quantity.is_none() {
            row_errors.push("当前库存(支)必须为正整数".to_string());
        }

        if !row_errors.is_empty() {
            errors.extend(
                row_errors
                    .into_iter()
                    .map(|message| format!("第 {row_number} 行：{message}")),
            );
            continue;
        }

        parsed_rows.push(ParsedCustomerInventoryImportRow {
            row_number,
            batch_key: batch_key.to_string(),
            customer_name: customer_name.to_string(),
            historical_order_date: if historical_order_date_text.is_empty() {
                None
            } else {
                Some(historical_order_date_text.to_string())
            },
            historical_order_ref: value("历史单号").to_string(),
            aluminum_ingot_price_x100: aluminum_ingot_price_x100.unwrap_or_default(),
            pricing_tax_included: pricing_tax_included.unwrap_or(true),
            bridge_processing_fee_x100: bridge_processing_fee_x100.unwrap_or_default(),
            powder_processing_fee_x100: powder_processing_fee_x100.unwrap_or_default(),
            billet_processing_fee_x100: billet_processing_fee_x100.unwrap_or_default(),
            oxidation_processing_fee_x100: oxidation_processing_fee_x100.unwrap_or_default(),
            electrophoresis_processing_fee_x100: electrophoresis_processing_fee_x100
                .unwrap_or_default(),
            batch_note: value("批次备注").to_string(),
            product_name: product_name.to_string(),
            mold_code: mold_code.to_string(),
            length_mm: length_mm.unwrap_or_default(),
            color: color.to_string(),
            quantity: quantity.unwrap_or_default(),
            item_note: value("明细备注").to_string(),
        });
    }

    if parsed_rows.is_empty() && errors.is_empty() {
        errors.push("没有可导入的客户库存".to_string());
    }

    ParseCustomerInventoryImportResult {
        rows: parsed_rows,
        errors,
    }
}

pub(crate) fn normalize_customer_inventory_import_file_path(path: &str) -> String {
    let trimmed = path.trim();
    trimmed
        .strip_prefix("file://")
        .unwrap_or(trimmed)
        .to_string()
}

pub(crate) fn read_customer_inventory_import_csv_rows(
    path: &Path,
) -> Result<Vec<Vec<String>>, String> {
    let text = std::fs::read_to_string(path).map_err(|err| format!("无法读取文件：{err}"))?;
    Ok(parse_customer_inventory_import_csv(&text))
}

pub(crate) fn read_customer_inventory_import_excel_rows(
    path: &Path,
) -> Result<Vec<Vec<String>>, String> {
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
        .map(|row| {
            row.iter()
                .map(customer_inventory_import_excel_cell_to_string)
                .collect()
        })
        .collect())
}

pub(crate) fn parse_customer_inventory_import_csv(text: &str) -> Vec<Vec<String>> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut current = String::new();
    let mut chars = text.trim_start_matches('\u{FEFF}').chars().peekable();
    let mut in_quotes = false;

    while let Some(ch) = chars.next() {
        if ch == '"' && in_quotes && chars.peek() == Some(&'"') {
            current.push('"');
            chars.next();
        } else if ch == '"' {
            in_quotes = !in_quotes;
        } else if ch == ',' && !in_quotes {
            row.push(current);
            current = String::new();
        } else if matches!(ch, '\r' | '\n') && !in_quotes {
            if ch == '\r' && chars.peek() == Some(&'\n') {
                chars.next();
            }
            row.push(current);
            current = String::new();
            if row.iter().any(|cell| !cell.trim().is_empty()) {
                rows.push(row);
            }
            row = Vec::new();
        } else {
            current.push(ch);
        }
    }

    row.push(current);
    if row.iter().any(|cell| !cell.trim().is_empty()) {
        rows.push(row);
    }
    rows
}

pub(crate) fn customer_inventory_import_excel_cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.trim().to_string(),
        Data::Float(value) => format_customer_inventory_import_number(*value),
        Data::Int(value) => value.to_string(),
        Data::Bool(value) => value.to_string(),
        Data::DateTime(value) if value.is_datetime() => {
            let (year, month, day, _, _, _, _) = value.to_ymd_hms_milli();
            format!("{year:04}-{month:02}-{day:02}")
        }
        Data::DateTime(value) => value.to_string(),
        Data::DateTimeIso(value) | Data::DurationIso(value) => value.trim().to_string(),
        Data::Error(_) => String::new(),
    }
}

pub(crate) fn format_customer_inventory_import_number(value: f64) -> String {
    if !value.is_finite() {
        return String::new();
    }

    if value.fract().abs() < f64::EPSILON {
        format!("{value:.0}")
    } else {
        format!("{value:.10}")
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string()
    }
}

pub(crate) fn normalize_customer_inventory_import_header(header: &str) -> String {
    header
        .trim()
        .to_lowercase()
        .chars()
        .filter(|ch| !matches!(ch, ' ' | '\t' | '\n' | '\r' | '_' | '（' | '）' | '(' | ')'))
        .collect()
}

pub(crate) fn find_customer_inventory_import_header_index(
    headers: &[String],
    candidates: &[&str],
) -> Option<usize> {
    let candidates = candidates
        .iter()
        .map(|candidate| normalize_customer_inventory_import_header(candidate))
        .collect::<HashSet<_>>();

    headers
        .iter()
        .position(|header| candidates.contains(header))
}

pub(crate) fn find_customer_inventory_import_header_row(
    rows: &[Vec<String>],
    specs: &[(&str, &[&str])],
) -> usize {
    rows.iter()
        .enumerate()
        .max_by_key(|(_, row)| {
            let headers = row
                .iter()
                .map(|header| normalize_customer_inventory_import_header(header))
                .collect::<Vec<_>>();

            specs
                .iter()
                .filter(|(_, candidates)| {
                    find_customer_inventory_import_header_index(&headers, candidates).is_some()
                })
                .count()
        })
        .map(|(index, _)| index)
        .unwrap_or(0)
}

pub(crate) fn parse_customer_inventory_import_pricing(value: &str) -> Option<bool> {
    match value.trim().to_lowercase().as_str() {
        "含税" | "included" | "true" | "是" | "1" => Some(true),
        "不含税" | "excluded" | "false" | "否" | "0" => Some(false),
        _ => None,
    }
}

pub(crate) fn parse_customer_inventory_import_money(value: &str) -> Option<i64> {
    let value = value.trim();

    if value.is_empty() {
        return Some(0);
    }

    let normalized = value.replace([',', '￥', '¥'], "");
    let normalized = normalized.trim();
    let number_end = normalized
        .char_indices()
        .take_while(|(_, ch)| ch.is_ascii_digit() || *ch == '.')
        .map(|(index, ch)| index + ch.len_utf8())
        .last()?;
    let number = normalized[..number_end].parse::<f64>().ok()?;
    let unit = normalized[number_end..].trim().to_lowercase();

    if !unit.is_empty()
        && !matches!(
            unit.as_str(),
            "元" | "元/吨" | "元／吨" | "元吨" | "rmb" | "cny"
        )
    {
        return None;
    }

    if number.is_finite() && number >= 0.0 {
        Some((number * 100.0).round() as i64)
    } else {
        None
    }
}

pub(crate) fn parse_customer_inventory_import_positive_integer(
    value: &str,
    unit: &str,
) -> Option<i64> {
    let normalized = value.trim().replace(',', "");
    let number_end = normalized
        .char_indices()
        .take_while(|(_, ch)| ch.is_ascii_digit() || *ch == '.')
        .map(|(index, ch)| index + ch.len_utf8())
        .last()?;
    let number = normalized[..number_end].parse::<f64>().ok()?;
    let suffix = normalized[number_end..].trim().to_lowercase();
    let valid_unit = if unit == "mm" {
        suffix.is_empty() || matches!(suffix.as_str(), "mm" | "毫米")
    } else {
        suffix.is_empty() || matches!(suffix.as_str(), "支" | "pcs" | "pc" | "根")
    };

    if valid_unit && number.is_finite() && number > 0.0 && number.fract().abs() < f64::EPSILON {
        Some(number as i64)
    } else {
        None
    }
}
