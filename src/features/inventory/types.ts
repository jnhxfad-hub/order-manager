export type PublicInventoryMovementType = "in" | "out" | "adjust"
export type OrderInventoryMovementType = "produce" | "ship" | "adjust"
export type InventoryMovementType =
  | PublicInventoryMovementType
  | OrderInventoryMovementType
  | "transfer_public"
  | "transfer_customer"
export type CustomerInventoryMovementType =
  | "historical_import"
  | "out"
  | "adjust"
  | "transfer_order"

export type InventoryItem = {
  productId: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  thicknessMmX100: number
  weightPerMeterKgX1000: number
  quantity: number
  latestNote: string
  updatedAt: string | null
}

export type InventoryMovement = {
  id: string
  productId: string | null
  orderId: string | null
  deliveryNoteId: string | null
  productName: string
  moldCode: string
  lengthMm: number | null
  color: string
  movementType: InventoryMovementType
  quantityBefore: number
  quantityAfter: number
  deltaQuantity: number
  note: string
  createdAt: string
}

export type OrderInventoryItem = {
  orderId: string
  customerName: string
  customerAddress: string
  handlerName: string
  pricingTaxIncluded: boolean
  deliveryNoteId: string | null
  deliveryNoteIds: string[]
  inventoryLockedAt: string | null
  inventoryClosedAt: string | null
  inventoryCloseDestination: "shipped" | "public" | "customer" | null
  productId: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  requiredQuantity: number
  orderQuantity: number
  publicQuantity: number
  orderedDate: string | null
  orderNote: string
  note: string
}

export type DeliveryNoteItem = {
  id: string
  productId: string | null
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  orderQuantity: number
  quantity: number
  note: string
  groupLabel?: string | null
  priceGroupId?: string | null
  sourceBatchId?: string | null
  sourceBatchNote?: string | null
}

export type DeliveryNotePriceGroup = {
  id: string
  title: string
  aluminumIngotPriceX100: number
  pricingTaxIncluded: boolean
  bridgeProcessingFeeX100: number
  powderProcessingFeeX100: number
  billetProcessingFeeX100: number
  oxidationProcessingFeeX100: number
  electrophoresisProcessingFeeX100: number
  bridgeWeightKgX100: number
  powderWeightKgX100: number
  billetWeightKgX100: number
  oxidationWeightKgX100: number
  electrophoresisWeightKgX100: number
  extraCharges: Array<{ name: string; amountX100: number }>
  pricingProfileName: string
  pricingTriggerKeyword: string
  items: DeliveryNoteItem[]
}

export type DeliveryNote = {
  id: string
  orderId: string
  customerName: string
  customerAddress: string
  handlerName: string
  deliveryDate: string
  aluminumIngotPriceX100: number
  pricingTaxIncluded: boolean
  bridgeProcessingFeeX100: number
  powderProcessingFeeX100: number
  billetProcessingFeeX100: number
  oxidationProcessingFeeX100: number
  electrophoresisProcessingFeeX100: number
  bridgeWeightKgX100: number
  powderWeightKgX100: number
  billetWeightKgX100: number
  oxidationWeightKgX100: number
  electrophoresisWeightKgX100: number
  extraCharges: Array<{ name: string; amountX100: number }>
  pricingProfileName: string
  pricingTriggerKeyword: string
  note: string
  specialNote: string
  createdAt: string
  items: DeliveryNoteItem[]
  priceGroups?: DeliveryNotePriceGroup[]
}

export type MergedDeliveryNoteItem = DeliveryNoteItem & {
  customGroup: string
  sourceDeliveryNoteId: string
  sourceOrderId: string
}

export type MergedDeliveryNotePriceGroup = {
  id: string
  title: string
  aluminumIngotPriceX100: number
  pricingTaxIncluded: boolean
  bridgeProcessingFeeX100: number
  powderProcessingFeeX100: number
  billetProcessingFeeX100: number
  oxidationProcessingFeeX100: number
  electrophoresisProcessingFeeX100: number
  bridgeWeightKgX100: number
  powderWeightKgX100: number
  billetWeightKgX100: number
  oxidationWeightKgX100: number
  electrophoresisWeightKgX100: number
  extraCharges: Array<{ name: string; amountX100: number }>
  items: MergedDeliveryNoteItem[]
  sourceDeliveryNoteIds: string[]
}

export type MergedDeliveryNote = {
  id: string
  customerName: string
  customerAddress: string
  deliveryDate: string
  groupColumnLabel: string
  handlerName: string
  note: string
  specialNote: string
  priceGroups: MergedDeliveryNotePriceGroup[]
  sourceDeliveryNoteIds: string[]
}

export type InventoryListResult = {
  items: InventoryItem[]
  orderItems: OrderInventoryItem[]
  recentMovements: InventoryMovement[]
  orderMovements: InventoryMovement[]
  totalQuantity: number
}

export type CustomerInventoryStockItem = {
  id: string
  batchId: string
  productId: string | null
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  quantity: number
  note: string
  updatedAt: string
}

export type CustomerInventoryBatch = {
  id: string
  customerId: string
  customerName: string
  customerAddress: string
  historicalOrderDate: string | null
  historicalOrderRef: string
  aluminumIngotPriceX100: number
  pricingTaxIncluded: boolean
  bridgeProcessingFeeX100: number
  powderProcessingFeeX100: number
  billetProcessingFeeX100: number
  oxidationProcessingFeeX100: number
  electrophoresisProcessingFeeX100: number
  sourceOrderId: string | null
  note: string
  totalQuantity: number
  itemCount: number
  hasDeliveryNote: boolean
  deliveryNoteId: string | null
  deliveryNoteIds: string[]
  createdAt: string
  updatedAt: string
  items: CustomerInventoryStockItem[]
}

export type CustomerInventoryMovement = {
  id: string
  batchId: string | null
  stockId: string | null
  customerId: string | null
  customerName: string
  deliveryNoteId: string | null
  productId: string | null
  productName: string
  moldCode: string
  lengthMm: number | null
  color: string
  movementType: CustomerInventoryMovementType
  quantityBefore: number
  quantityAfter: number
  deltaQuantity: number
  note: string
  createdAt: string
}

export type CustomerInventoryDeliveryNoteSummary = {
  id: string
  customerName: string
  deliveryDate: string
  handlerName: string
  batchIds: string[]
  itemCount: number
  totalQuantity: number
  createdAt: string
}

export type CustomerInventoryListResult = {
  batches: CustomerInventoryBatch[]
  deliveryNotes: CustomerInventoryDeliveryNoteSummary[]
  recentMovements: CustomerInventoryMovement[]
  totalQuantity: number
}

export type CustomerInventoryPrintBatch = {
  id: string
  historicalOrderDate: string | null
  historicalOrderRef: string
  aluminumIngotPriceX100: number
  pricingTaxIncluded: boolean
  bridgeProcessingFeeX100: number
  powderProcessingFeeX100: number
  billetProcessingFeeX100: number
  oxidationProcessingFeeX100: number
  electrophoresisProcessingFeeX100: number
  note: string
  totalQuantity: number
  itemCount: number
  items: CustomerInventoryStockItem[]
}

export type CustomerInventoryPrintSnapshot = {
  customerId: string
  customerName: string
  customerAddress: string
  generatedAt: string
  totalQuantity: number
  itemCount: number
  batches: CustomerInventoryPrintBatch[]
}

export type RecognizedInventoryImageItem = {
  moldCode: string
  productName: string
  color: string
  lengthMm: number
  quantity: number | null
  rawText: string
}

export type RecognizedInventoryImageResult = {
  rawText: string
  items: RecognizedInventoryImageItem[]
}
