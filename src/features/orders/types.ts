export type OrderStatus =
  | "editing"
  | "ordered"
  | "saved"

export type Order = {
  id: string
  customerId: string | null
  customerName: string
  customerAddress: string
  handlerName: string
  aluminumIngotPriceX100: number
  pricingTaxIncluded: boolean
  bridgeProcessingFeeX100: number
  powderProcessingFeeX100: number
  billetProcessingFeeX100: number
  oxidationProcessingFeeX100: number
  electrophoresisProcessingFeeX100: number
  status: OrderStatus
  deliveryNoteId: string | null
  deliveryNoteIds: string[]
  inventoryLockedAt: string | null
  inventoryClosedAt: string | null
  inventoryCloseDestination: "shipped" | "public" | "customer" | null
  totalTheoreticalWeightKgX100: number
  orderedDate: string | null
  createdAt: string
  updatedAt: string
}

export type OrderItem = {
  id: string
  orderId: string
  productId: string | null
  productName: string
  productMoldCode: string
  thicknessMmX100: number
  weightPerMeterKgX1000: number
  lengthMm: number
  color: string
  quantity: number
  theoreticalWeightKgX100: number
  note: string | null
}

export type OrderDetail = Omit<Order, "totalTheoreticalWeightKgX100"> & {
  note: string | null
  items: OrderItem[]
}
