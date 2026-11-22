import {
  getCustomerProcessingFeesX100,
  getMatchedSpecialPricingKeyword,
} from "@/features/customers/lib/customer-pricing"
import type { Customer } from "@/features/customers/types"
import type {
  CustomerInventoryDeliveryNoteSummary,
  CustomerInventoryMovement,
  CustomerInventoryBatch,
  DeliveryNote,
  InventoryItem,
  InventoryListResult,
  InventoryMovement,
  OrderInventoryItem,
} from "@/features/inventory/types"
import type { OrderDetail } from "@/features/orders/types"
import type { Product } from "@/features/products/types"
import {
  loadBrowserStorageArray,
  loadBrowserStorageRecordMap,
  saveBrowserStorageJson,
  saveBrowserStorageRecordMap,
} from "@/lib/browser-runtime"
import { formatCompactDatePart } from "@/lib/datetime"
import {
  getProcessingCategoryConflict,
  getProcessingCategoryFromColor,
  getProcessingFeeSnapshotValue,
  processingCategories,
  type ProcessingCategory,
} from "@/lib/processing-fees"
import type {
  CreateDeliveryNotePayload,
  CreateCustomerInventoryBatchPayload,
} from "./inventory-api-types"

type BrowserFallbackDeliveryWeightsPayload = {
  billetWeightKgX100: number
  bridgeWeightKgX100: number
  electrophoresisWeightKgX100: number
  oxidationWeightKgX100: number
  powderWeightKgX100: number
}

export type BrowserFallbackStagedCustomerDeliveryItem = {
  deliveryItem: DeliveryNote["items"][number]
  sourceBatch: CustomerInventoryBatch
  stockItem: CustomerInventoryBatch["items"][number]
}

const browserFallbackProcessingCategoryLabels: Record<
  ProcessingCategory,
  string
> = {
  billet: "坯料",
  bridge: "断桥",
  electrophoresis: "电泳",
  oxidation: "氧化",
  powder: "喷涂",
}

const browserFallbackPublicInventoryStorageKey =
  "order-manager:fallback-public-inventory-stocks"
const browserFallbackInventoryMovementStorageKey =
  "order-manager:fallback-inventory-movements"
const storedBrowserFallbackInventoryItems =
  loadBrowserStorageArray<InventoryItem>(browserFallbackPublicInventoryStorageKey)
const storedBrowserFallbackInventoryMovements =
  loadBrowserStorageArray<InventoryMovement>(browserFallbackInventoryMovementStorageKey)
export const browserFallbackInventory: InventoryListResult = {
  items: storedBrowserFallbackInventoryItems,
  orderItems: [],
  orderMovements: storedBrowserFallbackInventoryMovements.filter(
    (movement) => movement.orderId
  ),
  recentMovements: storedBrowserFallbackInventoryMovements,
  totalQuantity: storedBrowserFallbackInventoryItems.reduce(
    (total, item) => total + item.quantity,
    0
  ),
}
export const browserFallbackDeliveryNotes = new Map<string, DeliveryNote>()
const browserFallbackOrderStorageKey = "order-manager:fallback-order-details"
const browserFallbackOrderInventoryStorageKey =
  "order-manager:fallback-order-inventory-stocks"
const browserFallbackDeliveryNoteStorageKey =
  "order-manager:fallback-delivery-notes"
const browserFallbackCustomerStorageKey = "order-manager:fallback-customers"
const browserFallbackProductStorageKey = "order-manager:fallback-products"
const browserFallbackCustomerInventoryBatchStorageKey =
  "order-manager:fallback-customer-inventory-batches"
const browserFallbackCustomerInventoryMovementStorageKey =
  "order-manager:fallback-customer-inventory-movements"
const browserFallbackCustomerInventoryDeliveryNoteStorageKey =
  "order-manager:fallback-customer-inventory-delivery-notes"
export const browserFallbackCustomerInventoryBatches: CustomerInventoryBatch[] = []
export const browserFallbackCustomerInventoryMovements: CustomerInventoryMovement[] = []
export const browserFallbackCustomerInventoryDeliveryNotes = new Map<
  string,
  DeliveryNote
>()
let browserFallbackInventoryMovementSequence = 0

type BrowserFallbackOrderInventoryStock = {
  color: string
  lengthMm: number
  orderId: string
  productId: string
  quantity: number
}

export function loadBrowserFallbackOrdersFromStorage() {
  return loadBrowserStorageArray<OrderDetail>(browserFallbackOrderStorageKey)
}

export function saveBrowserFallbackOrdersToStorage(orders: OrderDetail[]) {
  saveBrowserStorageJson(browserFallbackOrderStorageKey, orders)
}

export function getBrowserFallbackOrderInventoryStockKey(
  stock: Pick<
    BrowserFallbackOrderInventoryStock,
    "color" | "lengthMm" | "orderId" | "productId"
  >
) {
  return [stock.orderId, stock.productId, stock.lengthMm, stock.color].join("|")
}

export function loadBrowserFallbackCustomersFromStorage() {
  return loadBrowserStorageArray<Customer>(browserFallbackCustomerStorageKey)
}

export function loadBrowserFallbackProductsFromStorage() {
  return loadBrowserStorageArray<Product>(browserFallbackProductStorageKey)
}

export function loadBrowserFallbackOrderInventoryStocksFromStorage() {
  return loadBrowserStorageArray<BrowserFallbackOrderInventoryStock>(
    browserFallbackOrderInventoryStorageKey
  )
}

export function saveBrowserFallbackOrderInventoryStocksToStorage(
  stocks: BrowserFallbackOrderInventoryStock[]
) {
  saveBrowserStorageJson(browserFallbackOrderInventoryStorageKey, stocks)
}

export function saveBrowserFallbackInventoryToStorage() {
  saveBrowserStorageJson(
    browserFallbackPublicInventoryStorageKey,
    browserFallbackInventory.items
  )
  saveBrowserStorageJson(
    browserFallbackInventoryMovementStorageKey,
    browserFallbackInventory.recentMovements
  )
}

function getBrowserFallbackPublicInventoryQuantity(
  productId: string,
  lengthMm: number,
  color: string
) {
  return (
    browserFallbackInventory.items.find(
      (item) =>
        item.productId === productId &&
        item.lengthMm === lengthMm &&
        item.color === color
    )?.quantity ?? 0
  )
}

export function createBrowserFallbackInventoryMovement(
  movement: Omit<InventoryMovement, "createdAt" | "id">
): InventoryMovement {
  const createdAt = new Date().toISOString()
  browserFallbackInventoryMovementSequence += 1

  return {
    ...movement,
    createdAt,
    id: `fallback-movement-${Date.now()}-${String(
      browserFallbackInventoryMovementSequence
    ).padStart(6, "0")}`,
  }
}

export function appendBrowserFallbackInventoryMovements(
  movements: InventoryMovement[]
) {
  browserFallbackInventory.recentMovements.push(...movements)
  browserFallbackInventory.orderMovements.push(
    ...movements.filter((movement) => movement.orderId)
  )
  saveBrowserFallbackInventoryToStorage()
}

export function matchesBrowserFallbackInventorySearch(
  item: InventoryItem,
  search: string
) {
  if (!search) {
    return true
  }

  const haystack = [
    item.productName,
    item.moldCode,
    item.lengthMm,
    item.color,
    item.latestNote,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(search)
}

export function matchesBrowserFallbackOrderInventorySearch(
  item: OrderInventoryItem,
  search: string
) {
  if (!search) {
    return true
  }

  const haystack = [
    item.orderId,
    item.customerName,
    item.productName,
    item.moldCode,
    item.color,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(search)
}

export function matchesBrowserFallbackInventoryMovementSearch(
  movement: InventoryMovement,
  search: string
) {
  if (!search) {
    return true
  }

  const haystack = [
    movement.productName,
    movement.moldCode,
    movement.orderId,
    movement.deliveryNoteId,
    movement.color,
    movement.note,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(search)
}

export function syncBrowserFallbackDeliveryNotesFromStorage() {
  browserFallbackDeliveryNotes.clear()
  for (const [id, deliveryNote] of loadBrowserStorageRecordMap<DeliveryNote>(
    browserFallbackDeliveryNoteStorageKey
  )) {
    browserFallbackDeliveryNotes.set(id, deliveryNote)
  }
}

export function cloneBrowserFallbackDeliveryNote(deliveryNote: DeliveryNote): DeliveryNote {
  return {
    ...deliveryNote,
    extraCharges: deliveryNote.extraCharges.map((row) => ({ ...row })),
    items: deliveryNote.items.map((item) => ({ ...item })),
    priceGroups: deliveryNote.priceGroups?.map((priceGroup) => ({
      ...priceGroup,
      extraCharges: priceGroup.extraCharges.map((row) => ({ ...row })),
      items: priceGroup.items.map((item) => ({ ...item })),
    })),
    specialNote: deliveryNote.specialNote ?? "",
  }
}

export function cloneBrowserFallbackOrderDetail(detail: OrderDetail): OrderDetail {
  return {
    ...detail,
    items: detail.items.map((item) => ({ ...item })),
  }
}

export function cloneBrowserFallbackCustomerInventoryBatch(
  batch: CustomerInventoryBatch
): CustomerInventoryBatch {
  return {
    ...batch,
    deliveryNoteIds: [...batch.deliveryNoteIds],
    items: batch.items.map((item) => ({ ...item })),
  }
}

export function cloneBrowserFallbackCustomerInventoryMovement(
  movement: CustomerInventoryMovement
): CustomerInventoryMovement {
  return { ...movement }
}

export function cloneBrowserFallbackInventoryItem(item: InventoryItem): InventoryItem {
  return { ...item }
}

export function cloneBrowserFallbackOrderInventoryItem(
  item: OrderInventoryItem
): OrderInventoryItem {
  return { ...item }
}

export function cloneBrowserFallbackInventoryMovement(
  movement: InventoryMovement
): InventoryMovement {
  return { ...movement }
}

export function sortBrowserFallbackInventoryMovements(
  left: InventoryMovement,
  right: InventoryMovement
) {
  const createdAtOrder = right.createdAt.localeCompare(left.createdAt)

  return createdAtOrder !== 0 ? createdAtOrder : right.id.localeCompare(left.id)
}

export function saveBrowserFallbackDeliveryNotesToStorage() {
  saveBrowserStorageRecordMap(
    browserFallbackDeliveryNoteStorageKey,
    browserFallbackDeliveryNotes
  )
}

function getBrowserFallbackOrderInventoryQuantity(
  orderId: string,
  item: OrderDetail["items"][number],
  stocks: BrowserFallbackOrderInventoryStock[]
) {
  const productId = item.productId ?? ""
  const stock = stocks.find(
    (stockItem) =>
      stockItem.orderId === orderId &&
      stockItem.productId === productId &&
      stockItem.lengthMm === item.lengthMm &&
      stockItem.color === item.color
  )

  return stock?.quantity ?? 0
}

export function ensureBrowserFallbackOrderInventoryUnlocked(orderId: string) {
  const order = loadBrowserFallbackOrdersFromStorage().find(
    (orderItem) => orderItem.id === orderId
  )

  if (order?.inventoryLockedAt) {
    throw new Error("该订单已出库，库存已锁定")
  }
}

export function syncBrowserFallbackCustomerInventoryFromStorage() {
  browserFallbackCustomerInventoryBatches.length = 0
  browserFallbackCustomerInventoryBatches.unshift(
    ...loadBrowserStorageArray<CustomerInventoryBatch>(
      browserFallbackCustomerInventoryBatchStorageKey
    )
  )
  browserFallbackCustomerInventoryMovements.length = 0
  browserFallbackCustomerInventoryMovements.unshift(
    ...loadBrowserStorageArray<CustomerInventoryMovement>(
      browserFallbackCustomerInventoryMovementStorageKey
    )
  )
  browserFallbackCustomerInventoryDeliveryNotes.clear()
  for (const [id, deliveryNote] of loadBrowserStorageRecordMap<DeliveryNote>(
    browserFallbackCustomerInventoryDeliveryNoteStorageKey
  )) {
    browserFallbackCustomerInventoryDeliveryNotes.set(id, deliveryNote)
  }
}

export function saveBrowserFallbackCustomerInventoryToStorage() {
  saveBrowserStorageJson(
    browserFallbackCustomerInventoryBatchStorageKey,
    browserFallbackCustomerInventoryBatches
  )
  saveBrowserStorageJson(
    browserFallbackCustomerInventoryMovementStorageKey,
    browserFallbackCustomerInventoryMovements
  )
  saveBrowserStorageRecordMap(
    browserFallbackCustomerInventoryDeliveryNoteStorageKey,
    browserFallbackCustomerInventoryDeliveryNotes
  )
}

function getBrowserFallbackDateKey(value: string | null | undefined) {
  return value?.trim().replace(/-/g, "") || formatCompactDatePart(new Date())
}

export function normalizeBrowserFallbackCustomerInventoryHistoricalOrderDate(
  value: string | null | undefined
) {
  const normalized = value?.trim() ?? ""

  if (!normalized) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("历史下单日期格式必须为 YYYY-MM-DD")
  }

  return normalized
}

export function normalizeBrowserFallbackCustomerInventoryBatchItems(
  items: CreateCustomerInventoryBatchPayload["items"]
) {
  return items.map((item) => ({
    ...item,
    color: item.color.trim(),
    note: item.note.trim(),
    productId: item.productId.trim(),
  }))
}

export function resolveBrowserFallbackCustomerInventoryStockItems({
  batchId,
  existingItems = [],
  items,
  now,
  products,
}: {
  batchId: string
  existingItems?: CustomerInventoryBatch["items"]
  items: CreateCustomerInventoryBatchPayload["items"]
  now: string
  products: Product[]
}) {
  return items.map((item, index) => {
    const product = products.find((candidate) => candidate.id === item.productId)

    return {
      batchId,
      color: item.color,
      id:
        existingItems[index]?.id ??
        getBrowserFallbackCustomerInventoryStockId(batchId, index),
      lengthMm: item.lengthMm,
      moldCode: product?.moldCode ?? "",
      note: item.note,
      productId: item.productId,
      productName: product?.productName ?? "",
      quantity: item.quantity,
      updatedAt: now,
    }
  })
}

export function createBrowserFallbackCustomerInventoryImportMovements({
  batchId,
  customer,
  items,
  note,
  now,
}: {
  batchId: string
  customer: Pick<Customer, "customerName" | "id">
  items: CustomerInventoryBatch["items"]
  note: string
  now: string
}): CustomerInventoryMovement[] {
  return items.map((item, index) => ({
    batchId,
    color: item.color,
    createdAt: now,
    customerId: customer.id,
    customerName: customer.customerName,
    deliveryNoteId: null,
    deltaQuantity: item.quantity,
    id: `${batchId}-MI-${String(index + 1).padStart(3, "0")}`,
    lengthMm: item.lengthMm,
    moldCode: item.moldCode,
    movementType: "historical_import",
    note,
    productId: item.productId,
    productName: item.productName,
    quantityAfter: item.quantity,
    quantityBefore: 0,
    stockId: item.id,
  }))
}

export function normalizeBrowserFallbackDeliveryExtraCharge(
  name: string | null | undefined,
  amountX100: number
) {
  const trimmedName = (name ?? "").trim()

  if (amountX100 < 0) {
    throw new Error("收费金额不能小于 0")
  }

  if (!trimmedName) {
    return {
      amountX100: 0,
      name: "",
    }
  }

  if (amountX100 <= 0) {
    throw new Error("收费金额必须大于 0")
  }

  return {
    amountX100,
    name: trimmedName,
  }
}

export function resolveBrowserFallbackDeliveryPricing(
  order: OrderDetail,
  pricingTaxIncluded: boolean
) {
  const customer = loadBrowserFallbackCustomersFromStorage().find(
    (customerItem) => customerItem.id === order.customerId
  )
  const specialKeyword = getMatchedSpecialPricingKeyword(
    customer,
    order.note ?? ""
  )
  const processingFeeSnapshot = customer
    ? getCustomerProcessingFeesX100(
        customer,
        pricingTaxIncluded,
        order.note ?? ""
      )
    : pricingTaxIncluded === order.pricingTaxIncluded
      ? order
      : null
  const processingFees = Object.fromEntries(
    processingCategories.map((category) => [
      category.key,
      processingFeeSnapshot
        ? getProcessingFeeSnapshotValue(processingFeeSnapshot, category.key)
        : 0,
    ])
  ) as Record<ProcessingCategory, number>

  if (!Object.values(processingFees).some((fee) => fee > 0)) {
    throw new Error(
      `客户资料未设置${pricingTaxIncluded ? "含税" : "不含税"}加工费，请先维护客户资料`
    )
  }

  return {
    processingFees,
    profileName: specialKeyword ? `${specialKeyword}价` : "默认价",
    triggerKeyword: specialKeyword,
  }
}

export function validateBrowserFallbackDeliveryProcessingFees(
  requiredWeights: Record<ProcessingCategory, boolean>,
  processingFees: Record<ProcessingCategory, number>,
  pricingTaxIncluded: boolean
) {
  const pricingLabel = pricingTaxIncluded ? "含税" : "不含税"

  for (const category of Object.keys(requiredWeights) as ProcessingCategory[]) {
    if (requiredWeights[category] && processingFees[category] <= 0) {
      throw new Error(
        `${pricingLabel}${browserFallbackProcessingCategoryLabels[category]}加工费未设置，请先维护客户资料`
      )
    }
  }
}

export function resolveBrowserFallbackCustomerInventoryPricingProfile(
  customerId: string,
  batchNote: string
) {
  const specialKeyword =
    loadBrowserFallbackCustomersFromStorage()
      .find((customer) => customer.id === customerId)
      ?.specialPricingKeyword.trim() ?? ""
  const isSpecial = Boolean(specialKeyword && batchNote.includes(specialKeyword))

  return {
    profileName: isSpecial ? `${specialKeyword}价` : "默认价",
    triggerKeyword: isSpecial ? specialKeyword : "",
  }
}

export function getBrowserFallbackRequiredDeliveryWeights(
  items: CreateDeliveryNotePayload["items"]
) {
  return getBrowserFallbackRequiredDeliveryWeightsFromColors(
    items.filter((item) => item.quantity > 0).map((item) => item.color)
  )
}

function getBrowserFallbackRequiredDeliveryWeightsFromColors(colors: string[]) {
  return colors.reduce<Record<ProcessingCategory, boolean>>(
    (requiredWeights, color) => {
      const conflictError = getProcessingCategoryConflict(color)

      if (conflictError) {
        throw new Error(conflictError)
      }

      requiredWeights[getProcessingCategoryFromColor(color)] = true

      return requiredWeights
    },
    {
      billet: false,
      bridge: false,
      electrophoresis: false,
      oxidation: false,
      powder: false,
    }
  )
}

export function validateBrowserFallbackDeliveryWeightValues(
  requiredWeights: Record<ProcessingCategory, boolean>,
  weights: BrowserFallbackDeliveryWeightsPayload
) {
  if (requiredWeights.bridge && weights.bridgeWeightKgX100 <= 0) {
    throw new Error("请填写断桥重量")
  }

  if (requiredWeights.powder && weights.powderWeightKgX100 <= 0) {
    throw new Error("请填写喷涂重量")
  }

  if (requiredWeights.billet && weights.billetWeightKgX100 <= 0) {
    throw new Error("请填写坯料重量")
  }

  if (requiredWeights.oxidation && weights.oxidationWeightKgX100 <= 0) {
    throw new Error("请填写氧化重量")
  }

  if (
    requiredWeights.electrophoresis &&
    weights.electrophoresisWeightKgX100 <= 0
  ) {
    throw new Error("请填写电泳重量")
  }
}

export function validateBrowserFallbackCustomerDeliveryRequiredWeights(
  weights: BrowserFallbackDeliveryWeightsPayload,
  items: Array<{ color: string }>
) {
  validateBrowserFallbackDeliveryWeightValues(
    getBrowserFallbackRequiredDeliveryWeightsFromColors(
      items.map((item) => item.color)
    ),
    weights
  )
}

export function validateBrowserFallbackCustomerDeliveryProcessingFees(
  batch: CustomerInventoryBatch,
  items: Array<{ color: string }>
) {
  const requiredWeights = getBrowserFallbackRequiredDeliveryWeightsFromColors(
    items.map((item) => item.color)
  )
  const pricingLabel = batch.pricingTaxIncluded ? "含税" : "不含税"
  const processingFees: Record<ProcessingCategory, number> = {
    billet: batch.billetProcessingFeeX100,
    bridge: batch.bridgeProcessingFeeX100,
    electrophoresis: batch.electrophoresisProcessingFeeX100,
    oxidation: batch.oxidationProcessingFeeX100,
    powder: batch.powderProcessingFeeX100,
  }

  for (const category of Object.keys(requiredWeights) as ProcessingCategory[]) {
    if (requiredWeights[category] && processingFees[category] <= 0) {
      throw new Error(
        `${pricingLabel}${browserFallbackProcessingCategoryLabels[category]}加工费未设置`
      )
    }
  }
}

export function hasSameBrowserFallbackCustomerInventoryPricing(
  left: CustomerInventoryBatch,
  right: CustomerInventoryBatch
) {
  return (
    left.aluminumIngotPriceX100 === right.aluminumIngotPriceX100 &&
    left.pricingTaxIncluded === right.pricingTaxIncluded &&
    left.bridgeProcessingFeeX100 === right.bridgeProcessingFeeX100 &&
    left.powderProcessingFeeX100 === right.powderProcessingFeeX100 &&
    left.billetProcessingFeeX100 === right.billetProcessingFeeX100 &&
    left.oxidationProcessingFeeX100 === right.oxidationProcessingFeeX100 &&
    left.electrophoresisProcessingFeeX100 ===
      right.electrophoresisProcessingFeeX100
  )
}

export function stageBrowserFallbackCustomerInventoryDelivery({
  deliveryNoteId,
  items,
  now,
}: {
  deliveryNoteId: string
  items: BrowserFallbackStagedCustomerDeliveryItem[]
  now: string
}) {
  const stockQuantities = new Map<string, number>()
  const movements: CustomerInventoryMovement[] = []

  for (const { deliveryItem, sourceBatch, stockItem } of items) {
    const quantityBefore =
      stockQuantities.get(stockItem.id) ?? stockItem.quantity

    if (deliveryItem.quantity > quantityBefore) {
      throw new Error(`${stockItem.productName} 出库数量不能大于当前库存`)
    }

    if (!deliveryItem.groupLabel) {
      throw new Error(`${stockItem.productName} 出库分组不能为空`)
    }

    const quantityAfter = quantityBefore - deliveryItem.quantity
    stockQuantities.set(stockItem.id, quantityAfter)
    deliveryItem.orderQuantity = quantityBefore
    movements.push({
      batchId: sourceBatch.id,
      color: stockItem.color,
      createdAt: now,
      customerId: sourceBatch.customerId,
      customerName: sourceBatch.customerName,
      deliveryNoteId,
      deltaQuantity: -deliveryItem.quantity,
      id: `${deliveryNoteId}-MO-${String(movements.length + 1).padStart(
        3,
        "0"
      )}`,
      lengthMm: stockItem.lengthMm,
      moldCode: stockItem.moldCode,
      movementType: "out",
      note: deliveryItem.note
        ? `历史库存出库单 ${deliveryNoteId}，${deliveryItem.note}`
        : `历史库存出库单 ${deliveryNoteId}`,
      productId: stockItem.productId,
      productName: stockItem.productName,
      quantityAfter,
      quantityBefore,
      stockId: stockItem.id,
    })
  }

  return { movements, stockQuantities }
}

export function validateBrowserFallbackDeliveryItems(
  items: CreateDeliveryNotePayload["items"]
) {
  for (const item of items) {
    if (!item.productId.trim()) {
      throw new Error("出库商品不能为空")
    }

    if (item.lengthMm <= 0) {
      throw new Error("长度必须大于 0")
    }

    if (!item.color.trim()) {
      throw new Error("颜色不能为空")
    }
  }
}

export function validateBrowserFallbackCustomerInventoryBatchItems(
  items: CreateCustomerInventoryBatchPayload["items"],
  customerId: string,
  products: Product[]
) {
  for (const item of items) {
    const productId = item.productId.trim()

    if (!productId) {
      throw new Error("请选择商品")
    }

    if (item.lengthMm <= 0) {
      throw new Error("长度必须大于 0")
    }

    if (!item.color.trim()) {
      throw new Error("颜色不能为空")
    }

    if (item.quantity <= 0) {
      throw new Error("数量必须大于 0")
    }

    const product = products.find((productItem) => productItem.id === productId)

    if (!product?.assignedCustomerIds?.includes(customerId)) {
      throw new Error("商品不属于当前客户")
    }
  }
}

export function validateBrowserFallbackCustomerInventoryBatchProcessingFees(
  payload: CreateCustomerInventoryBatchPayload
) {
  const requiredWeights = getBrowserFallbackRequiredDeliveryWeightsFromColors(
    payload.items.map((item) => item.color)
  )
  const pricingLabel = payload.pricingTaxIncluded ? "含税" : "不含税"

  if (requiredWeights.bridge && payload.bridgeProcessingFeeX100 <= 0) {
    throw new Error(`${pricingLabel}断桥加工费未设置`)
  }

  if (requiredWeights.powder && payload.powderProcessingFeeX100 <= 0) {
    throw new Error(`${pricingLabel}喷涂加工费未设置`)
  }

  if (requiredWeights.billet && payload.billetProcessingFeeX100 <= 0) {
    throw new Error(`${pricingLabel}坯料加工费未设置`)
  }

  if (requiredWeights.oxidation && payload.oxidationProcessingFeeX100 <= 0) {
    throw new Error(`${pricingLabel}氧化加工费未设置`)
  }

  if (
    requiredWeights.electrophoresis &&
    payload.electrophoresisProcessingFeeX100 <= 0
  ) {
    throw new Error(`${pricingLabel}电泳加工费未设置`)
  }
}

export function getNextBrowserFallbackCustomerInventoryBatchId(
  payload: CreateCustomerInventoryBatchPayload
) {
  const dateKey = getBrowserFallbackDateKey(payload.historicalOrderDate)
  const prefix = "KH"
  const batchPrefix = `${prefix}-${dateKey}`
  const batchIdPattern = new RegExp(`^${batchPrefix}(\\d+)$`)
  const nextSequence =
    browserFallbackCustomerInventoryBatches.reduce((currentMax, batch) => {
      const match = batchIdPattern.exec(batch.id)

      return match ? Math.max(currentMax, Number(match[1])) : currentMax
    }, 0) + 1

  return `${batchPrefix}${String(nextSequence).padStart(3, "0")}`
}

export function getBrowserFallbackCustomerInventoryStockId(
  batchId: string,
  index: number
) {
  return `${batchId}-${String(index + 1).padStart(3, "0")}`
}

export function getNextBrowserFallbackOrderDeliveryNoteId(orderId: string) {
  const deliveryNoteIdPattern = new RegExp(`^${orderId}-(\\d+)$`)
  const nextSequence =
    Array.from(browserFallbackDeliveryNotes.keys()).reduce(
      (currentMax, deliveryNoteId) => {
        const match = deliveryNoteIdPattern.exec(deliveryNoteId)

        return match ? Math.max(currentMax, Number(match[1])) : currentMax
      },
      0
    ) + 1

  return `${orderId}-${String(nextSequence).padStart(2, "0")}`
}

export function getNextBrowserFallbackCustomerInventoryDeliveryNoteId(batchId: string) {
  const batch = browserFallbackCustomerInventoryBatches.find(
    (item) => item.id === batchId
  )
  const deliveryNoteIdPattern = new RegExp(`^${batchId}-(\\d+)$`)
  const deliveryNoteIds = [
    ...(batch?.deliveryNoteIds ?? []),
    ...browserFallbackCustomerInventoryDeliveryNotes.keys(),
  ]
  const nextSequence =
    deliveryNoteIds.reduce((currentMax, deliveryNoteId) => {
      const match = deliveryNoteIdPattern.exec(deliveryNoteId)

      return match ? Math.max(currentMax, Number(match[1])) : currentMax
    }, 0) + 1

  return `${batchId}-${String(nextSequence).padStart(2, "0")}`
}

export function getNextBrowserFallbackMergedCustomerInventoryDeliveryNoteId(
  customerName: string
) {
  const datePart = formatCompactDatePart(new Date())
  const initials =
    customerName
      .trim()
      .split("")
      .filter((char) => /[a-z0-9]/i.test(char))
      .join("")
      .slice(0, 6)
      .toUpperCase() || "KH"
  const prefix = `${initials}-CK${datePart}`
  const deliveryNoteIdPattern = new RegExp(`^${prefix}-(\\d+)$`)
  const nextNumber =
    Array.from(browserFallbackCustomerInventoryDeliveryNotes.keys()).reduce(
      (currentMax, id) => {
        const match = deliveryNoteIdPattern.exec(id)

        return match ? Math.max(currentMax, Number(match[1])) : currentMax
      },
      0
    ) + 1

  return `${prefix}-${String(nextNumber).padStart(2, "0")}`
}

export function matchesBrowserFallbackCustomerInventorySearch(
  batch: CustomerInventoryBatch,
  search: string
) {
  if (!search) {
    return true
  }

  const haystack = [
    batch.id,
    batch.customerName,
    batch.customerAddress,
    batch.historicalOrderRef,
    batch.note,
    ...batch.items.flatMap((item) => [
      item.productName,
      item.moldCode,
      item.lengthMm,
      item.color,
      item.note,
    ]),
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(search)
}

export function matchesBrowserFallbackCustomerInventoryMovementSearch(
  movement: CustomerInventoryMovement,
  search: string
) {
  if (!search) {
    return true
  }

  const haystack = [
    movement.batchId,
    movement.customerName,
    movement.deliveryNoteId,
    movement.productName,
    movement.moldCode,
    movement.color,
    movement.note,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(search)
}

function matchesBrowserFallbackCustomerInventoryDeliveryNoteSearch(
  deliveryNote: DeliveryNote,
  search: string
) {
  if (!search) {
    return true
  }

  const itemHaystack = deliveryNote.items.flatMap((item) => [
    item.sourceBatchId,
    item.productName,
    item.moldCode,
    item.color,
  ])
  const movementHaystack = browserFallbackCustomerInventoryMovements
    .filter((movement) => movement.deliveryNoteId === deliveryNote.id)
    .flatMap((movement) => [
      movement.batchId,
      movement.customerName,
      movement.productName,
      movement.moldCode,
      movement.color,
    ])
  const haystack = [
    deliveryNote.id,
    deliveryNote.customerName,
    deliveryNote.handlerName,
    deliveryNote.note,
    deliveryNote.deliveryDate,
    ...itemHaystack,
    ...movementHaystack,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(search)
}

export function getBrowserFallbackCustomerInventoryDeliveryNoteSummaries(
  search: string
) {
  return Array.from(browserFallbackCustomerInventoryDeliveryNotes.values())
    .filter((deliveryNote) =>
      matchesBrowserFallbackCustomerInventoryDeliveryNoteSearch(
        deliveryNote,
        search
      )
    )
    .map((deliveryNote): CustomerInventoryDeliveryNoteSummary => {
      const batchIds = Array.from(
        new Set(
          deliveryNote.items
            .map((item) => item.sourceBatchId?.trim() ?? "")
            .filter(Boolean)
        )
      )

      return {
        batchIds,
        createdAt: deliveryNote.createdAt,
        customerName: deliveryNote.customerName,
        deliveryDate: deliveryNote.deliveryDate,
        handlerName: deliveryNote.handlerName,
        id: deliveryNote.id,
        itemCount: deliveryNote.items.length,
        totalQuantity: deliveryNote.items.reduce(
          (total, item) => total + item.quantity,
          0
        ),
      }
    })
    .sort((left, right) => {
      const createdAtOrder = right.createdAt.localeCompare(left.createdAt)

      if (createdAtOrder !== 0) {
        return createdAtOrder
      }

      return right.id.localeCompare(left.id)
    })
    .slice(0, 80)
}

export function syncBrowserFallbackOrderInventoryFromStorage() {
  const orders = loadBrowserFallbackOrdersFromStorage()
  const stocks = loadBrowserFallbackOrderInventoryStocksFromStorage()
  browserFallbackInventory.orderItems = orders.flatMap((order) =>
    order.status === "ordered"
      ? order.items
          .filter((item) => item.productId)
          .map(
            (item) =>
              ({
                color: item.color,
                customerAddress: order.customerAddress,
                customerName: order.customerName,
                deliveryNoteId: order.deliveryNoteId,
                deliveryNoteIds: order.deliveryNoteIds,
                handlerName: order.handlerName,
                inventoryCloseDestination: order.inventoryCloseDestination,
                inventoryClosedAt: order.inventoryClosedAt,
                inventoryLockedAt: order.inventoryLockedAt,
                lengthMm: item.lengthMm,
                moldCode: item.productMoldCode,
                note: item.note ?? "",
                orderId: order.id,
                orderNote: order.note ?? "",
                orderQuantity: getBrowserFallbackOrderInventoryQuantity(
                  order.id,
                  item,
                  stocks
                ),
                orderedDate: order.orderedDate,
                pricingTaxIncluded: order.pricingTaxIncluded,
                productId: item.productId ?? "",
                productName: item.productName,
                publicQuantity: getBrowserFallbackPublicInventoryQuantity(
                  item.productId ?? "",
                  item.lengthMm,
                  item.color
                ),
                requiredQuantity: item.quantity,
              }) satisfies OrderInventoryItem
          )
      : []
  )
}

if (typeof window !== "undefined") {
  window.addEventListener("order-manager:fallback-order-upserted", (event) => {
    const order = (event as CustomEvent<OrderDetail>).detail

    if (!order) {
      return
    }

    browserFallbackInventory.orderItems =
      browserFallbackInventory.orderItems.filter(
        (item) => item.orderId !== order.id
      )

    if (order.status !== "ordered") {
      return
    }

    const stocks = loadBrowserFallbackOrderInventoryStocksFromStorage()
    browserFallbackInventory.orderItems.unshift(
      ...order.items
        .filter((item) => item.productId)
        .map(
          (item) =>
            ({
              color: item.color,
              customerAddress: order.customerAddress,
              customerName: order.customerName,
              deliveryNoteId: order.deliveryNoteId,
              deliveryNoteIds: order.deliveryNoteIds,
              handlerName: order.handlerName,
              inventoryCloseDestination: order.inventoryCloseDestination,
              inventoryClosedAt: order.inventoryClosedAt,
              inventoryLockedAt: order.inventoryLockedAt,
              lengthMm: item.lengthMm,
              moldCode: item.productMoldCode,
              note: item.note ?? "",
              orderId: order.id,
              orderNote: order.note ?? "",
              orderQuantity: getBrowserFallbackOrderInventoryQuantity(
                order.id,
                item,
                stocks
              ),
              orderedDate: order.orderedDate,
              pricingTaxIncluded: order.pricingTaxIncluded,
              productId: item.productId ?? "",
              productName: item.productName,
              publicQuantity: getBrowserFallbackPublicInventoryQuantity(
                item.productId ?? "",
                item.lengthMm,
                item.color
              ),
              requiredQuantity: item.quantity,
            }) satisfies OrderInventoryItem
      )
    )
  })
  window.addEventListener("order-manager:fallback-order-deleted", (event) => {
    const orderId = (event as CustomEvent<{ id?: string }>).detail?.id

    if (!orderId) {
      return
    }

    browserFallbackInventory.orderItems =
      browserFallbackInventory.orderItems.filter((item) => item.orderId !== orderId)
  })
}
