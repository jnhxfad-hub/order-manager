// 库存接口的统一出口：实现按领域拆在同目录的模块里，这里只做转发，调用方无需改动。
export type {
  ListInventoryParams,
  AdjustInventoryPayload,
  AdjustOrderInventoryPayload,
  AdjustOrderInventoryBatchPayload,
  TransferPublicInventoryToOrderPayload,
  TransferOrderInventoryRemainderPayload,
  TransferOrderInventoryRemainderResult,
  UpdateDeliveryNoteSpecialNotePayload,
  CreateDeliveryNotePayload,
  CreateCustomerInventoryBatchPayload,
  UpdateCustomerInventoryBatchPayload,
  ParsedCustomerInventoryImportRow,
  ParseCustomerInventoryImportResult,
  ImportCustomerInventoryResult,
  CreateCustomerInventoryDeliveryNotePayload,
  AdjustCustomerInventoryStockPayload,
} from "./inventory-api-types"
export {
  listInventory,
  adjustInventory,
  adjustOrderInventory,
  adjustOrderInventoryBatch,
  recognizeInventoryImage,
  readInventoryImagePreview,
  transferPublicInventoryToOrder,
  transferOrderInventoryRemainder,
} from "./inventory-public-api"
export {
  createDeliveryNote,
  getDeliveryNote,
  updateDeliveryNoteSpecialNote,
} from "./inventory-delivery-notes-api"
export {
  deriveCustomerInventoryDeliveryGroupLabel,
  listCustomerInventory,
  getCustomerInventoryPrintSnapshot,
  getCustomerInventoryBatch,
  createCustomerInventoryBatch,
  parseCustomerInventoryImportFile,
  importCustomerInventoryBatches,
  updateCustomerInventoryBatch,
  createCustomerInventoryDeliveryNote,
  createCustomerInventoryDeliveryNotes,
  adjustCustomerInventoryStock,
  getCustomerInventoryDeliveryNote,
  updateCustomerInventoryDeliveryNoteSpecialNote,
} from "./inventory-customer-api"
