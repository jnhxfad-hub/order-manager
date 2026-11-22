import type { Customer } from "@/features/customers/types"
import {
  getMatchedSpecialPricingKeyword,
  hasAnyCustomerProcessingFee,
} from "@/features/customers/lib/customer-pricing"
import type { Product } from "@/features/products/types"
import type { ParsedOrderItemImportRow, UpsertOrderPayload } from "@/features/orders/api/orders-api"
import type { OrderDetail, OrderStatus } from "@/features/orders/types"
import {
  emptyProcessingFeeSnapshotX100,
  getProcessingCategoryFromColor,
  getProcessingCategoryLabel,
  getProcessingFeeSnapshotValue,
  processingCategories,
  type ProcessingCategory,
  type ProcessingFeeSnapshotX100,
} from "@/lib/processing-fees"
import { formatDateInputValue, formatAppDateTime } from "@/lib/datetime"
import { parseIntegerInput } from "@/lib/number-input"
import { formatMoneyInput, parseMoneyToX100 } from "@/lib/money"

export { emptyProcessingFeeSnapshotX100 }

export type OrderFormValues = ProcessingFeeSnapshotX100 & {
  customerId: string
  customerName: string
  customerAddress: string
  handlerName: string
  aluminumIngotPrice: string
  pricingTaxIncluded: boolean
  orderedDate: string
  note: string
  items: OrderItemFormValues[]
}

export type OrderItemFormValues = {
  localId: string
  productId: string
  productName: string
  productMoldCode: string
  thicknessMmX100: number
  weightPerMeterKgX1000: number
  lengthMm: string
  color: string
  quantity: string
  note: string
}

export function groupOrderItemsByColor(items: OrderItemFormValues[]) {
  const groups = new Map<string, OrderItemFormValues[]>()

  for (const item of items) {
    const color = item.color.trim()
    const group = groups.get(color)
    if (group) {
      group.push(item)
    } else {
      groups.set(color, [item])
    }
  }

  return Array.from(groups.values()).flat()
}

export type RequiredItemField = "product" | "lengthMm" | "color" | "quantity"
export type EditableItemField = RequiredItemField | "note"

export type OrderDraftSnapshot = ProcessingFeeSnapshotX100 & {
  customerId: string
  customerName: string
  customerAddress: string
  handlerName: string
  aluminumIngotPrice: string
  pricingTaxIncluded: boolean
  orderedDate: string
  note: string
  items: Array<{
    productId: string
    productName: string
    productMoldCode: string
    thicknessMmX100: number
    weightPerMeterKgX1000: number
    lengthMm: string
    color: string
    quantity: string
    note: string
  }>
}

export type OrderFormFocusTarget =
  | {
      kind: "field"
      field: "customerId" | "handlerName" | "aluminumIngotPrice"
    }
  | { kind: "item"; localId: string; field: EditableItemField }

export type OrderItemImportPreviewRow = ParsedOrderItemImportRow & {
  errors: string[]
  item: OrderItemFormValues | null
  product: Product | null
}

const orderItemImportCsvHeader = [
  "商品名称",
  "长度(mm)",
  "颜色",
  "数量",
  "备注",
] as const

export const requiredItemFields: RequiredItemField[] = [
  "product",
  "lengthMm",
  "color",
  "quantity",
]

export const editableItemFieldOrder: EditableItemField[] = [
  "product",
  "lengthMm",
  "color",
  "quantity",
  "note",
]

export function emptyItem(): OrderItemFormValues {
  return {
    localId: crypto.randomUUID(),
    productId: "",
    productName: "",
    productMoldCode: "",
    thicknessMmX100: 0,
    weightPerMeterKgX1000: 0,
    lengthMm: "",
    color: "",
    quantity: "",
    note: "",
  }
}

export function createDefaultOrderValues(): OrderFormValues {
  return {
    ...emptyProcessingFeeSnapshotX100(),
    customerId: "",
    customerName: "",
    customerAddress: "",
    handlerName: "",
    aluminumIngotPrice: "",
    pricingTaxIncluded: true,
    orderedDate: formatDateInputValue(new Date()),
    note: "",
    items: [emptyItem()],
  }
}

export function createOrderDraftSnapshot(
  values: OrderFormValues,
): OrderDraftSnapshot {
  return {
    customerId: values.customerId.trim(),
    customerName: values.customerName.trim(),
    customerAddress: values.customerAddress.trim(),
    handlerName: values.handlerName.trim(),
    aluminumIngotPrice: values.aluminumIngotPrice.trim(),
    pricingTaxIncluded: values.pricingTaxIncluded,
    ...getProcessingFeeSnapshotFrom(values),
    orderedDate: values.orderedDate.trim(),
    note: values.note.trim(),
    items: values.items.map((item) => ({
      productId: item.productId.trim(),
      productName: item.productName.trim(),
      productMoldCode: item.productMoldCode.trim(),
      thicknessMmX100: item.thicknessMmX100,
      weightPerMeterKgX1000: item.weightPerMeterKgX1000,
      lengthMm: item.lengthMm.trim(),
      color: item.color.trim(),
      quantity: item.quantity.trim(),
      note: item.note.trim(),
    })),
  }
}

export function areOrderDraftSnapshotsEqual(
  left: OrderDraftSnapshot,
  right: OrderDraftSnapshot,
) {
  if (
    left.customerId !== right.customerId ||
    left.customerName !== right.customerName ||
    left.customerAddress !== right.customerAddress ||
    left.handlerName !== right.handlerName ||
    left.aluminumIngotPrice !== right.aluminumIngotPrice ||
    left.pricingTaxIncluded !== right.pricingTaxIncluded ||
    processingCategories.some(
      (category) =>
        getProcessingFeeSnapshotValue(left, category.key) !==
        getProcessingFeeSnapshotValue(right, category.key),
    ) ||
    left.orderedDate !== right.orderedDate ||
    left.note !== right.note ||
    left.items.length !== right.items.length
  ) {
    return false
  }

  return left.items.every((item, index) => {
    const other = right.items[index]

    return (
      item.productId === other.productId &&
      item.productName === other.productName &&
      item.productMoldCode === other.productMoldCode &&
      item.thicknessMmX100 === other.thicknessMmX100 &&
      item.weightPerMeterKgX1000 === other.weightPerMeterKgX1000 &&
      item.lengthMm === other.lengthMm &&
      item.color === other.color &&
      item.quantity === other.quantity &&
      item.note === other.note
    )
  })
}

export function formatOrderDateTime(value: string) {
  return formatAppDateTime(value, { includeYear: true })
}

export function isAluminumIngotPriceValid(value: string) {
  const aluminumIngotPriceX100 = parseMoneyToX100(value)

  return (
    Boolean(value.trim()) &&
    aluminumIngotPriceX100 !== null &&
    aluminumIngotPriceX100 > 0
  )
}

export function getProcessingFeeSnapshotFrom(
  values: ProcessingFeeSnapshotX100,
): ProcessingFeeSnapshotX100 {
  return {
    billetProcessingFeeX100: values.billetProcessingFeeX100,
    bridgeProcessingFeeX100: values.bridgeProcessingFeeX100,
    electrophoresisProcessingFeeX100: values.electrophoresisProcessingFeeX100,
    oxidationProcessingFeeX100: values.oxidationProcessingFeeX100,
    powderProcessingFeeX100: values.powderProcessingFeeX100,
  }
}

export function getProcessingFeeX100ByCategory(
  fees: ProcessingFeeSnapshotX100,
  category: ProcessingCategory,
) {
  return getProcessingFeeSnapshotValue(fees, category)
}

export function getMissingProcessingFeeMessage({
  hasSpecialPricing,
  pricingTaxIncluded,
}: {
  hasSpecialPricing: boolean
  pricingTaxIncluded: boolean
}) {
  if (pricingTaxIncluded) {
    return hasSpecialPricing
      ? "该客户未设置特殊含税加工费，不能保存"
      : "该客户未设置含税加工费，不能选择含税"
  }

  return hasSpecialPricing
    ? "该客户未设置特殊不含税加工费，不能保存"
    : "该客户未设置不含税加工费，不能选择不含税"
}

export function getOrderFormStatus({
  hasUnsavedChanges,
  isSaving,
  savedStatus,
}: {
  hasUnsavedChanges: boolean
  isSaving: boolean
  savedStatus: OrderStatus | null
}) {
  if (isSaving) {
    return {
      className: "border-muted bg-muted text-muted-foreground",
      label: "保存中",
    }
  }

  if (savedStatus === "ordered") {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "已下单",
    }
  }

  if (hasUnsavedChanges) {
    return {
      className: "border-amber-200 bg-amber-50 text-amber-700",
      label: "未保存",
    }
  }

  if (savedStatus === null) {
    return {
      className: "border-muted bg-muted text-muted-foreground",
      label: "新建",
    }
  }

  return {
    className: "border-blue-200 bg-blue-50 text-blue-700",
    label: "已保存",
  }
}

export function orderDetailToFormValues(order: OrderDetail): OrderFormValues {
  return {
    customerId: order.customerId ?? "",
    customerName: order.customerName,
    customerAddress: order.customerAddress,
    handlerName: order.handlerName,
    aluminumIngotPrice: formatMoneyInput(order.aluminumIngotPriceX100),
    pricingTaxIncluded: order.pricingTaxIncluded,
    bridgeProcessingFeeX100: order.bridgeProcessingFeeX100,
    powderProcessingFeeX100: order.powderProcessingFeeX100,
    billetProcessingFeeX100: order.billetProcessingFeeX100,
    oxidationProcessingFeeX100: order.oxidationProcessingFeeX100,
    electrophoresisProcessingFeeX100: order.electrophoresisProcessingFeeX100,
    orderedDate: order.orderedDate ?? formatDateInputValue(new Date()),
    note: order.note ?? "",
    items:
      order.items.length > 0
        ? order.items.map((item) => ({
            localId: item.id,
            productId: item.productId ?? "",
            productName: item.productName,
            productMoldCode: item.productMoldCode,
            thicknessMmX100: item.thicknessMmX100,
            weightPerMeterKgX1000: item.weightPerMeterKgX1000,
            lengthMm: String(item.lengthMm),
            color: item.color,
            quantity: String(item.quantity),
            note: item.note ?? "",
          }))
        : [emptyItem()],
  }
}

export function buildOrderPayload(
  values: OrderFormValues,
  status: OrderStatus,
  orderId?: string,
  customer?: Customer | null,
): UpsertOrderPayload | string {
  if (!values.customerId.trim()) {
    return "请选择客户"
  }

  if (!values.customerName.trim()) {
    return "客户名称不能为空"
  }

  if (!values.handlerName.trim()) {
    return "经手人不能为空"
  }

  const aluminumIngotPriceX100 = parseMoneyToX100(values.aluminumIngotPrice)

  if (!values.aluminumIngotPrice.trim()) {
    return "铝锭价不能为空"
  }

  if (aluminumIngotPriceX100 === null) {
    return "铝锭价只能输入非负金额，最多两位小数"
  }

  if (aluminumIngotPriceX100 <= 0) {
    return "铝锭价必须大于 0"
  }

  if (
    customer &&
    !hasAnyCustomerProcessingFee(
      customer,
      values.pricingTaxIncluded,
      values.note,
    )
  ) {
    const hasSpecialPricing = Boolean(
      getMatchedSpecialPricingKeyword(customer, values.note),
    )

    return getMissingProcessingFeeMessage({
      hasSpecialPricing,
      pricingTaxIncluded: values.pricingTaxIncluded,
    })
  }

  try {
    const items = values.items.map((item, index) => {
      const lengthMm = parseIntegerInput(item.lengthMm)
      const quantity = parseIntegerInput(item.quantity)

      if (!item.productId || !item.productName.trim()) {
        throw new Error(`第 ${index + 1} 行：请选择商品`)
      }

      if (lengthMm === null || lengthMm <= 0) {
        throw new Error(`第 ${index + 1} 行：长度必须大于 0`)
      }

      if (!item.color.trim()) {
        throw new Error(`第 ${index + 1} 行：颜色不能为空`)
      }

      if (quantity === null || quantity <= 0) {
        throw new Error(`第 ${index + 1} 行：数量必须大于 0`)
      }

      const color = item.color.trim()
      const category = getProcessingCategoryFromColor(color)

      if (getProcessingFeeX100ByCategory(values, category) <= 0) {
        throw new Error(
          `第 ${index + 1} 行：${values.pricingTaxIncluded ? "含税" : "不含税"}${getProcessingCategoryLabel(category)}加工费未设置`,
        )
      }

      return {
        productId: item.productId,
        productName: item.productName,
        productMoldCode: item.productMoldCode,
        thicknessMmX100: item.thicknessMmX100,
        weightPerMeterKgX1000: item.weightPerMeterKgX1000,
        lengthMm,
        color,
        quantity,
        note: item.note.trim() || null,
      }
    })

    return {
      id: orderId ?? null,
      customerId: values.customerId.trim(),
      customerName: values.customerName.trim(),
      customerAddress: values.customerAddress.trim(),
      handlerName: values.handlerName.trim(),
      aluminumIngotPriceX100,
      pricingTaxIncluded: values.pricingTaxIncluded,
      ...getProcessingFeeSnapshotFrom(values),
      status,
      orderedDate: values.orderedDate.trim() || null,
      note: values.note.trim() || null,
      items,
    }
  } catch (error) {
    return error instanceof Error ? error.message : "订单明细不完整"
  }
}

export function isItemFieldValid(item: OrderItemFormValues, field: RequiredItemField) {
  if (field === "product") {
    return Boolean(item.productId && item.productName.trim())
  }

  if (field === "color") {
    return Boolean(item.color.trim())
  }

  const value = parseIntegerInput(item[field])

  if (!item[field].trim()) {
    return false
  }

  return value !== null && value > 0
}

export function buildOrderItemImportPreviewRows(
  rows: ParsedOrderItemImportRow[],
  products: Product[],
  currentItems: OrderItemFormValues[],
): OrderItemImportPreviewRow[] {
  const productByName = new Map(
    products.map((product) => [product.productName.trim(), product]),
  )
  const seenKeys = new Set<string>()

  for (const item of currentItems) {
    if (isBlankItem(item)) {
      continue
    }

    const lengthMm = parseIntegerInput(item.lengthMm)
    const color = item.color.trim()

    if (item.productName.trim() && lengthMm !== null && lengthMm > 0 && color) {
      seenKeys.add(createOrderItemSpecKey(item.productName, lengthMm, color))
    }
  }

  return rows.map((row) => {
    const productName = row.productName.trim()
    const color = row.color.trim()
    const note = row.note.trim()
    const lengthMm = parseIntegerInput(row.lengthMm)
    const quantity = parseIntegerInput(row.quantity)
    const product = productByName.get(productName) ?? null
    const errors: string[] = []

    if (!productName) {
      errors.push("商品名称不能为空")
    } else if (!product) {
      errors.push("当前客户商品中未找到该商品")
    }

    if (!row.lengthMm.trim()) {
      errors.push("长度不能为空")
    } else if (lengthMm === null || lengthMm <= 0) {
      errors.push("长度必须为正整数")
    }

    if (!color) {
      errors.push("颜色不能为空")
    }

    if (!row.quantity.trim()) {
      errors.push("数量不能为空")
    } else if (quantity === null || quantity <= 0) {
      errors.push("数量必须为正整数")
    }

    if (productName && lengthMm !== null && lengthMm > 0 && color) {
      const key = createOrderItemSpecKey(productName, lengthMm, color)

      if (seenKeys.has(key)) {
        errors.push("同一商品、长度、颜色不能重复")
      } else {
        seenKeys.add(key)
      }
    }

    return {
      ...row,
      color,
      errors,
      item:
        errors.length === 0 && product && lengthMm !== null && quantity !== null
          ? {
              color,
              lengthMm: String(lengthMm),
              localId: crypto.randomUUID(),
              note,
              productId: product.id,
              productMoldCode: product.moldCode,
              productName: product.productName,
              quantity: String(quantity),
              thicknessMmX100: product.thicknessMmX100,
              weightPerMeterKgX1000: product.weightPerMeterKgX1000,
            }
          : null,
      lengthMm: row.lengthMm.trim(),
      note,
      product,
      productName,
      quantity: row.quantity.trim(),
    }
  })
}

export function createOrderItemImportTemplateCsvRows() {
  return [
    [...orderItemImportCsvHeader],
    ["70 边框（1.15）-- 外", 6000, "常用灰", 20, ""],
    ["70 边框（1.15）-- 内", 6000, "常用灰", 20, ""],
  ]
}

export function createImportableOrderItemCsvRows(items: OrderDetail["items"]) {
  return [
    [...orderItemImportCsvHeader],
    ...items.map((item) => [
      item.productName,
      item.lengthMm,
      item.color,
      item.quantity,
      item.note ?? "",
    ]),
  ]
}

export function createOrderItemSpecKey(
  productName: string,
  lengthMm: number,
  color: string,
) {
  return `${productName.trim()}\u0000${lengthMm}\u0000${color.trim()}`
}

export function isBlankItem(item: OrderItemFormValues) {
  return (
    !item.productId &&
    !item.productName.trim() &&
    !item.lengthMm.trim() &&
    !item.color.trim() &&
    !item.quantity.trim() &&
    !item.note.trim()
  )
}

export function getOrderItemTotals(items: OrderDetail["items"]) {
  return items.reduce(
    (totals, item) => ({
      totalQuantity: totals.totalQuantity + item.quantity,
      totalTheoreticalWeightKgX100:
        totals.totalTheoreticalWeightKgX100 + item.theoreticalWeightKgX100,
    }),
    {
      totalQuantity: 0,
      totalTheoreticalWeightKgX100: 0,
    },
  )
}

export function calculateItemWeight(item: OrderItemFormValues) {
  const lengthMm = parseIntegerInput(item.lengthMm)
  const quantity = parseIntegerInput(item.quantity)

  if (
    lengthMm === null ||
    quantity === null ||
    lengthMm <= 0 ||
    quantity <= 0 ||
    item.weightPerMeterKgX1000 <= 0
  ) {
    return 0
  }

  return Math.round((lengthMm / 1000) * quantity * (item.weightPerMeterKgX1000 / 10))
}
