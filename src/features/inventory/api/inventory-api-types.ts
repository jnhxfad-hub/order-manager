import type {
  OrderInventoryMovementType,
  PublicInventoryMovementType,
} from "@/features/inventory/types"

export type ListInventoryParams = {
  search?: string
}

export type AdjustInventoryPayload = {
  productId: string
  lengthMm: number
  color: string
  movementType: PublicInventoryMovementType
  quantity: number
  note: string
}

export type AdjustOrderInventoryPayload = {
  orderId: string
  productId: string
  lengthMm: number
  color: string
  movementType: OrderInventoryMovementType
  quantity: number
  note: string
}

export type AdjustOrderInventoryBatchPayload = {
  orderId: string
  items: Array<{
    productId: string
    lengthMm: number
    color: string
    quantity: number
  }>
  note: string
}

export type TransferPublicInventoryToOrderPayload = {
  orderId: string
  productId: string
  lengthMm: number
  color: string
  quantity: number
  note: string
}

export type TransferOrderInventoryRemainderPayload = {
  orderId: string
  destination: "public" | "customer"
  note: string
}

export type TransferOrderInventoryRemainderResult = {
  destination: "public" | "customer"
  customerInventoryBatchId: string | null
  totalQuantity: number
}

export type UpdateDeliveryNoteSpecialNotePayload = {
  id: string
  specialNote: string
}

export type CreateDeliveryNotePayload = {
  orderId: string
  pricingTaxIncluded: boolean
  bridgeWeightKgX100: number
  powderWeightKgX100: number
  billetWeightKgX100: number
  oxidationWeightKgX100: number
  electrophoresisWeightKgX100: number
  extraCharges: Array<{ name: string; amountX100: number }>
  note: string
  specialNote: string
  items: Array<{
    productId: string
    lengthMm: number
    color: string
    quantity: number
    note: string
  }>
}

export type CreateCustomerInventoryBatchPayload = {
  customerId: string
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
  items: Array<{
    productId: string
    lengthMm: number
    color: string
    quantity: number
    note: string
  }>
}

export type UpdateCustomerInventoryBatchPayload =
  CreateCustomerInventoryBatchPayload & {
    batchId: string
  }

export type ParsedCustomerInventoryImportRow = {
  rowNumber: number
  batchKey: string
  customerName: string
  historicalOrderDate: string | null
  historicalOrderRef: string
  aluminumIngotPriceX100: number
  pricingTaxIncluded: boolean
  bridgeProcessingFeeX100: number
  powderProcessingFeeX100: number
  billetProcessingFeeX100: number
  oxidationProcessingFeeX100: number
  electrophoresisProcessingFeeX100: number
  batchNote: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  quantity: number
  itemNote: string
}

export type ParseCustomerInventoryImportResult = {
  rows: ParsedCustomerInventoryImportRow[]
  errors: string[]
}

export type ImportCustomerInventoryResult = {
  batchIds: string[]
  batchCount: number
  itemCount: number
  totalQuantity: number
}

export type CreateCustomerInventoryDeliveryNotePayload = {
  batchId?: string
  batchIds?: string[]
  handlerName: string
  bridgeWeightKgX100: number
  powderWeightKgX100: number
  billetWeightKgX100: number
  oxidationWeightKgX100: number
  electrophoresisWeightKgX100: number
  extraChargeAmountX100: number
  extraChargeName: string
  note: string
  specialNote: string
  items: Array<{
    stockId: string
    quantity: number
    groupLabel?: string
    note: string
  }>
  priceGroups?: Array<{
    batchIds: string[]
    bridgeWeightKgX100: number
    powderWeightKgX100: number
    billetWeightKgX100: number
    oxidationWeightKgX100: number
    electrophoresisWeightKgX100: number
    extraChargeAmountX100: number
    extraChargeName: string
    items: Array<{
      stockId: string
      quantity: number
      groupLabel?: string
      note: string
    }>
  }>
}

export type AdjustCustomerInventoryStockPayload = {
  stockId: string
  quantity: number
  note: string
}
