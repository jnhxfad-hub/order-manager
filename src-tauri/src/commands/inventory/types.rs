use serde::Deserialize;
use serde::Serialize;

use super::helpers::DeliveryExtraCharge;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListInventoryParams {
    pub(crate) search: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryListResult {
    pub(crate) items: Vec<InventoryItem>,
    pub(crate) order_items: Vec<OrderInventoryItem>,
    pub(crate) recent_movements: Vec<InventoryMovement>,
    pub(crate) order_movements: Vec<InventoryMovement>,
    pub(crate) total_quantity: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItem {
    pub(crate) product_id: String,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) thickness_mm_x100: i64,
    pub(crate) weight_per_meter_kg_x1000: i64,
    pub(crate) quantity: i64,
    pub(crate) latest_note: String,
    pub(crate) updated_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InventoryMovement {
    pub(crate) id: String,
    pub(crate) product_id: Option<String>,
    pub(crate) order_id: Option<String>,
    pub(crate) delivery_note_id: Option<String>,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: Option<i64>,
    pub(crate) color: String,
    pub(crate) movement_type: String,
    pub(crate) quantity_before: i64,
    pub(crate) quantity_after: i64,
    pub(crate) delta_quantity: i64,
    pub(crate) note: String,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderInventoryItem {
    pub(crate) order_id: String,
    pub(crate) customer_name: String,
    pub(crate) customer_address: String,
    pub(crate) handler_name: String,
    pub(crate) pricing_tax_included: bool,
    pub(crate) delivery_note_id: Option<String>,
    pub(crate) delivery_note_ids: Vec<String>,
    pub(crate) inventory_locked_at: Option<String>,
    pub(crate) inventory_closed_at: Option<String>,
    pub(crate) inventory_close_destination: Option<String>,
    pub(crate) product_id: String,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) required_quantity: i64,
    pub(crate) order_quantity: i64,
    pub(crate) public_quantity: i64,
    pub(crate) ordered_date: Option<String>,
    pub(crate) order_note: String,
    pub(crate) note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustInventoryPayload {
    pub(crate) product_id: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) movement_type: String,
    pub(crate) quantity: i64,
    pub(crate) note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustOrderInventoryPayload {
    pub(crate) order_id: String,
    pub(crate) product_id: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) movement_type: String,
    pub(crate) quantity: i64,
    pub(crate) note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustOrderInventoryBatchPayload {
    pub(crate) order_id: String,
    pub(crate) items: Vec<AdjustOrderInventoryBatchItem>,
    pub(crate) note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustOrderInventoryBatchItem {
    pub(crate) product_id: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferPublicInventoryToOrderPayload {
    pub(crate) order_id: String,
    pub(crate) product_id: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
    pub(crate) note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferOrderInventoryRemainderPayload {
    pub(crate) order_id: String,
    pub(crate) destination: String,
    pub(crate) note: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferOrderInventoryRemainderResult {
    pub(crate) destination: String,
    pub(crate) customer_inventory_batch_id: Option<String>,
    pub(crate) total_quantity: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeliveryNotePayload {
    pub(crate) order_id: String,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_weight_kg_x100: i64,
    pub(crate) powder_weight_kg_x100: i64,
    pub(crate) billet_weight_kg_x100: i64,
    pub(crate) oxidation_weight_kg_x100: i64,
    pub(crate) electrophoresis_weight_kg_x100: i64,
    pub(crate) extra_charges: Vec<DeliveryExtraCharge>,
    pub(crate) note: String,
    #[serde(default)]
    pub(crate) special_note: String,
    pub(crate) items: Vec<CreateDeliveryNoteItemPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDeliveryNoteSpecialNotePayload {
    pub(crate) id: String,
    pub(crate) special_note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeliveryNoteItemPayload {
    pub(crate) product_id: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
    pub(crate) note: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryNote {
    pub(crate) id: String,
    pub(crate) order_id: String,
    pub(crate) customer_name: String,
    pub(crate) customer_address: String,
    pub(crate) handler_name: String,
    pub(crate) delivery_date: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) bridge_weight_kg_x100: i64,
    pub(crate) powder_weight_kg_x100: i64,
    pub(crate) billet_weight_kg_x100: i64,
    pub(crate) oxidation_weight_kg_x100: i64,
    pub(crate) electrophoresis_weight_kg_x100: i64,
    pub(crate) extra_charges: Vec<DeliveryExtraCharge>,
    pub(crate) pricing_profile_name: String,
    pub(crate) pricing_trigger_keyword: String,
    pub(crate) note: String,
    pub(crate) special_note: String,
    pub(crate) created_at: String,
    pub(crate) items: Vec<DeliveryNoteItem>,
    pub(crate) price_groups: Vec<DeliveryNotePriceGroup>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryNoteItem {
    pub(crate) id: String,
    pub(crate) product_id: Option<String>,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) order_quantity: i64,
    pub(crate) quantity: i64,
    pub(crate) note: String,
    pub(crate) group_label: Option<String>,
    pub(crate) price_group_id: Option<String>,
    pub(crate) source_batch_id: Option<String>,
    pub(crate) source_batch_note: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryNotePriceGroup {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) bridge_weight_kg_x100: i64,
    pub(crate) powder_weight_kg_x100: i64,
    pub(crate) billet_weight_kg_x100: i64,
    pub(crate) oxidation_weight_kg_x100: i64,
    pub(crate) electrophoresis_weight_kg_x100: i64,
    pub(crate) extra_charges: Vec<DeliveryExtraCharge>,
    pub(crate) pricing_profile_name: String,
    pub(crate) pricing_trigger_keyword: String,
    pub(crate) items: Vec<DeliveryNoteItem>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInventoryBatch {
    pub(crate) id: String,
    pub(crate) customer_id: String,
    pub(crate) customer_name: String,
    pub(crate) customer_address: String,
    pub(crate) historical_order_date: Option<String>,
    pub(crate) historical_order_ref: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) source_order_id: Option<String>,
    pub(crate) note: String,
    pub(crate) total_quantity: i64,
    pub(crate) item_count: i64,
    pub(crate) has_delivery_note: bool,
    pub(crate) delivery_note_id: Option<String>,
    pub(crate) delivery_note_ids: Vec<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) items: Vec<CustomerInventoryStockItem>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInventoryStockItem {
    pub(crate) id: String,
    pub(crate) batch_id: String,
    pub(crate) product_id: Option<String>,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
    pub(crate) note: String,
    pub(crate) updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInventoryListResult {
    pub(crate) batches: Vec<CustomerInventoryBatch>,
    pub(crate) delivery_notes: Vec<CustomerInventoryDeliveryNoteSummary>,
    pub(crate) recent_movements: Vec<CustomerInventoryMovement>,
    pub(crate) total_quantity: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInventoryPrintSnapshot {
    pub(crate) customer_id: String,
    pub(crate) customer_name: String,
    pub(crate) customer_address: String,
    pub(crate) generated_at: String,
    pub(crate) total_quantity: i64,
    pub(crate) item_count: i64,
    pub(crate) batches: Vec<CustomerInventoryPrintBatch>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInventoryPrintBatch {
    pub(crate) id: String,
    pub(crate) historical_order_date: Option<String>,
    pub(crate) historical_order_ref: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) note: String,
    pub(crate) total_quantity: i64,
    pub(crate) item_count: i64,
    pub(crate) items: Vec<CustomerInventoryStockItem>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInventoryDeliveryNoteSummary {
    pub(crate) id: String,
    pub(crate) customer_name: String,
    pub(crate) delivery_date: String,
    pub(crate) handler_name: String,
    pub(crate) batch_ids: Vec<String>,
    pub(crate) item_count: i64,
    pub(crate) total_quantity: i64,
    pub(crate) created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerInventoryMovement {
    pub(crate) id: String,
    pub(crate) batch_id: Option<String>,
    pub(crate) stock_id: Option<String>,
    pub(crate) customer_id: Option<String>,
    pub(crate) customer_name: String,
    pub(crate) delivery_note_id: Option<String>,
    pub(crate) product_id: Option<String>,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: Option<i64>,
    pub(crate) color: String,
    pub(crate) movement_type: String,
    pub(crate) quantity_before: i64,
    pub(crate) quantity_after: i64,
    pub(crate) delta_quantity: i64,
    pub(crate) note: String,
    pub(crate) created_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerInventoryBatchPayload {
    pub(crate) customer_id: String,
    pub(crate) historical_order_date: Option<String>,
    pub(crate) historical_order_ref: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) note: String,
    pub(crate) items: Vec<CreateCustomerInventoryStockItemPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerInventoryStockItemPayload {
    pub(crate) product_id: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
    pub(crate) note: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomerInventoryBatchPayload {
    pub(crate) batch_id: String,
    pub(crate) customer_id: String,
    pub(crate) historical_order_date: Option<String>,
    pub(crate) historical_order_ref: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) note: String,
    pub(crate) items: Vec<CreateCustomerInventoryStockItemPayload>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedCustomerInventoryImportRow {
    pub(crate) row_number: usize,
    pub(crate) batch_key: String,
    pub(crate) customer_name: String,
    pub(crate) historical_order_date: Option<String>,
    pub(crate) historical_order_ref: String,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) batch_note: String,
    pub(crate) product_name: String,
    pub(crate) mold_code: String,
    pub(crate) length_mm: i64,
    pub(crate) color: String,
    pub(crate) quantity: i64,
    pub(crate) item_note: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseCustomerInventoryImportResult {
    pub(crate) rows: Vec<ParsedCustomerInventoryImportRow>,
    pub(crate) errors: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCustomerInventoryResult {
    pub(crate) batch_ids: Vec<String>,
    pub(crate) batch_count: usize,
    pub(crate) item_count: usize,
    pub(crate) total_quantity: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerInventoryDeliveryNotePayload {
    pub(crate) batch_id: Option<String>,
    #[serde(default)]
    pub(crate) batch_ids: Vec<String>,
    pub(crate) handler_name: String,
    pub(crate) bridge_weight_kg_x100: i64,
    pub(crate) powder_weight_kg_x100: i64,
    pub(crate) billet_weight_kg_x100: i64,
    pub(crate) oxidation_weight_kg_x100: i64,
    pub(crate) electrophoresis_weight_kg_x100: i64,
    pub(crate) extra_charge_name: String,
    pub(crate) extra_charge_amount_x100: i64,
    pub(crate) note: String,
    #[serde(default)]
    pub(crate) special_note: String,
    pub(crate) items: Vec<CreateCustomerInventoryDeliveryNoteItemPayload>,
    #[serde(default)]
    pub(crate) price_groups: Vec<CreateCustomerInventoryDeliveryNotePriceGroupPayload>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerInventoryDeliveryNoteItemPayload {
    pub(crate) stock_id: String,
    pub(crate) quantity: i64,
    #[serde(default)]
    pub(crate) group_label: String,
    pub(crate) note: String,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerInventoryDeliveryNotePriceGroupPayload {
    #[serde(default)]
    pub(crate) batch_ids: Vec<String>,
    pub(crate) bridge_weight_kg_x100: i64,
    pub(crate) powder_weight_kg_x100: i64,
    pub(crate) billet_weight_kg_x100: i64,
    pub(crate) oxidation_weight_kg_x100: i64,
    pub(crate) electrophoresis_weight_kg_x100: i64,
    pub(crate) extra_charge_name: String,
    pub(crate) extra_charge_amount_x100: i64,
    pub(crate) items: Vec<CreateCustomerInventoryDeliveryNoteItemPayload>,
}

pub(crate) struct CustomerInventoryDeliveryPriceGroupInput {
    pub(crate) batch_ids: Vec<String>,
    pub(crate) bridge_weight_kg_x100: i64,
    pub(crate) powder_weight_kg_x100: i64,
    pub(crate) billet_weight_kg_x100: i64,
    pub(crate) oxidation_weight_kg_x100: i64,
    pub(crate) electrophoresis_weight_kg_x100: i64,
    pub(crate) extra_charge_name: String,
    pub(crate) extra_charge_amount_x100: i64,
    pub(crate) items: Vec<CreateCustomerInventoryDeliveryNoteItemPayload>,
}

pub(crate) struct ResolvedCustomerInventoryDeliveryPriceGroup {
    pub(crate) title: String,
    pub(crate) batch_ids: Vec<String>,
    pub(crate) aluminum_ingot_price_x100: i64,
    pub(crate) pricing_tax_included: bool,
    pub(crate) bridge_processing_fee_x100: i64,
    pub(crate) powder_processing_fee_x100: i64,
    pub(crate) billet_processing_fee_x100: i64,
    pub(crate) oxidation_processing_fee_x100: i64,
    pub(crate) electrophoresis_processing_fee_x100: i64,
    pub(crate) bridge_weight_kg_x100: i64,
    pub(crate) powder_weight_kg_x100: i64,
    pub(crate) billet_weight_kg_x100: i64,
    pub(crate) oxidation_weight_kg_x100: i64,
    pub(crate) electrophoresis_weight_kg_x100: i64,
    pub(crate) extra_charge_name: String,
    pub(crate) extra_charge_amount_x100: i64,
    pub(crate) pricing_profile_name: String,
    pub(crate) pricing_trigger_keyword: String,
    pub(crate) items: Vec<CreateCustomerInventoryDeliveryNoteItemPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdjustCustomerInventoryStockPayload {
    pub(crate) stock_id: String,
    pub(crate) quantity: i64,
    pub(crate) note: String,
}
