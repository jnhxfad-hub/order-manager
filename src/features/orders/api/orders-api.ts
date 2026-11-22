import { invoke } from "@tauri-apps/api/core"

import { getCustomerProcessingFeesX100 } from "@/features/customers/lib/customer-pricing"
import type { Customer } from "@/features/customers/types"
import type { Order, OrderDetail, OrderStatus } from "@/features/orders/types"
import type { Product } from "@/features/products/types"
import {
  isTauriRuntime,
  loadBrowserStorageArray,
  saveBrowserStorageJson,
} from "@/lib/browser-runtime"
import { formatCompactDatePart } from "@/lib/datetime"
import {
  getProcessingCategoryFromColor,
  getProcessingCategoryLabel,
  processingFeeSnapshotKeys,
} from "@/lib/processing-fees"

export type UpsertOrderItemPayload = {
  productId: string | null
  productName: string
  productMoldCode: string
  thicknessMmX100: number
  weightPerMeterKgX1000: number
  lengthMm: number
  color: string
  quantity: number
  note: string | null
}

export type UpsertOrderPayload = {
  id?: string | null
  customerId: string
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
  orderedDate: string | null
  note: string | null
  items: UpsertOrderItemPayload[]
}

export type ParsedOrderItemImportRow = {
  rowNumber: number
  productName: string
  lengthMm: string
  color: string
  quantity: string
  note: string
}

export type ParseOrderItemImportResult = {
  rows: ParsedOrderItemImportRow[]
  errors: string[]
}

const browserFallbackOrders: Order[] = []
const browserFallbackOrderDetails: OrderDetail[] = []
const browserFallbackCustomerProductsStorageKey =
  "order-manager:fallback-customer-products"
const browserFallbackCustomerStorageKey = "order-manager:fallback-customers"
const browserFallbackOrderStorageKey = "order-manager:fallback-order-details"
const browserFallbackProductStorageKey = "order-manager:fallback-products"
let browserFallbackOrdersLoaded = false

function createBrowserFallbackOrderSummary(detail: OrderDetail): Order {
  return {
    aluminumIngotPriceX100: detail.aluminumIngotPriceX100,
    billetProcessingFeeX100: detail.billetProcessingFeeX100,
    bridgeProcessingFeeX100: detail.bridgeProcessingFeeX100,
    createdAt: detail.createdAt,
    customerAddress: detail.customerAddress,
    customerId: detail.customerId,
    customerName: detail.customerName,
    deliveryNoteId: detail.deliveryNoteId,
    deliveryNoteIds: detail.deliveryNoteIds,
    electrophoresisProcessingFeeX100: detail.electrophoresisProcessingFeeX100,
    handlerName: detail.handlerName,
    id: detail.id,
    inventoryCloseDestination: detail.inventoryCloseDestination,
    inventoryClosedAt: detail.inventoryClosedAt,
    inventoryLockedAt: detail.inventoryLockedAt,
    orderedDate: detail.orderedDate,
    oxidationProcessingFeeX100: detail.oxidationProcessingFeeX100,
    powderProcessingFeeX100: detail.powderProcessingFeeX100,
    pricingTaxIncluded: detail.pricingTaxIncluded,
    status: detail.status,
    totalTheoreticalWeightKgX100: detail.items.reduce(
      (total, item) => total + item.theoreticalWeightKgX100,
      0
    ),
    updatedAt: detail.updatedAt,
  }
}

function cloneBrowserFallbackOrder(order: Order): Order {
  return { ...order }
}

function cloneBrowserFallbackOrderDetail(detail: OrderDetail): OrderDetail {
  return {
    ...detail,
    items: detail.items.map((item) => ({ ...item })),
  }
}

function saveBrowserFallbackOrderDetails() {
  saveBrowserStorageJson(
    browserFallbackOrderStorageKey,
    browserFallbackOrderDetails
  )
}

function compareBrowserFallbackOrdersByUpdatedAtDesc(
  left: Pick<Order, "updatedAt">,
  right: Pick<Order, "updatedAt">
) {
  const leftTime = Date.parse(left.updatedAt)
  const rightTime = Date.parse(right.updatedAt)

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return rightTime - leftTime
  }

  return right.updatedAt.localeCompare(left.updatedAt)
}

function sortBrowserFallbackOrdersByUpdatedAt() {
  browserFallbackOrders.sort(compareBrowserFallbackOrdersByUpdatedAtDesc)
  browserFallbackOrderDetails.sort(compareBrowserFallbackOrdersByUpdatedAtDesc)
}

function loadBrowserFallbackOrderDetails() {
  if (browserFallbackOrdersLoaded) {
    return
  }

  const orderDetails = loadBrowserStorageArray<OrderDetail>(
    browserFallbackOrderStorageKey
  )
  browserFallbackOrders.length = 0
  browserFallbackOrderDetails.length = 0

  for (const detail of orderDetails) {
    browserFallbackOrders.push(createBrowserFallbackOrderSummary(detail))
    browserFallbackOrderDetails.push(detail)
  }

  sortBrowserFallbackOrdersByUpdatedAt()
  browserFallbackOrdersLoaded = true
}

function upsertBrowserFallbackOrderDetail(detail: OrderDetail) {
  loadBrowserFallbackOrderDetails()
  const order = createBrowserFallbackOrderSummary(detail)
  const orderIndex = browserFallbackOrders.findIndex((item) => item.id === detail.id)
  const detailIndex = browserFallbackOrderDetails.findIndex(
    (item) => item.id === detail.id
  )

  if (orderIndex === -1) {
    browserFallbackOrders.unshift(order)
  } else {
    browserFallbackOrders[orderIndex] = order
  }

  if (detailIndex === -1) {
    browserFallbackOrderDetails.unshift(detail)
  } else {
    browserFallbackOrderDetails[detailIndex] = detail
  }

  sortBrowserFallbackOrdersByUpdatedAt()
}

function notifyBrowserFallbackOrderUpserted(order: OrderDetail) {
  window.dispatchEvent(
    new CustomEvent("order-manager:fallback-order-upserted", {
      detail: cloneBrowserFallbackOrderDetail(order),
    })
  )
}

function notifyBrowserFallbackOrderDeleted(id: string) {
  window.dispatchEvent(
    new CustomEvent("order-manager:fallback-order-deleted", {
      detail: { id },
    })
  )
}

if (typeof window !== "undefined") {
  window.addEventListener("order-manager:fallback-order-upserted", (event) => {
    const order = (event as CustomEvent<OrderDetail>).detail

    if (order) {
      upsertBrowserFallbackOrderDetail(cloneBrowserFallbackOrderDetail(order))
    }
  })
}

function formatBrowserFallbackOrderId(
  orderedDate?: string | null
) {
  const datePart = getBrowserFallbackOrderDatePart(orderedDate)
  const sequence = getNextBrowserFallbackOrderSequence(datePart)

  return `ALU${datePart}${String(sequence).padStart(3, "0")}`
}

function getBrowserFallbackOrderDatePart(orderedDate?: string | null) {
  return (
    orderedDate?.trim().split("-").join("") || formatCompactDatePart(new Date())
  )
}

function getNextBrowserFallbackOrderSequence(datePart: string) {
  const orderIdPattern = new RegExp(`^ALU${datePart}(\\d+)$`)
  const maxSequence = browserFallbackOrders.reduce((currentMax, order) => {
    const match = orderIdPattern.exec(order.id)

    return match ? Math.max(currentMax, Number(match[1])) : currentMax
  }, 0)

  return maxSequence + 1
}

function getBrowserFallbackOrderId(payload: UpsertOrderPayload) {
  const existingId = payload.id?.trim()

  if (existingId) {
    return existingId
  }

  return formatBrowserFallbackOrderId(payload.orderedDate)
}

function assertBrowserFallbackOrderIdUnique(id: string) {
  if (browserFallbackOrderDetails.some((order) => order.id === id)) {
    throw new Error("订单编号已存在")
  }
}

function loadBrowserFallbackCustomer(customerId: string) {
  return loadBrowserStorageArray<Customer>(browserFallbackCustomerStorageKey).find(
    (customer) => customer.id === customerId
  )
}

function loadBrowserFallbackProduct(productId: string) {
  return loadBrowserStorageArray<Product>(browserFallbackProductStorageKey).find(
    (product) => product.id === productId
  )
}

function isBrowserFallbackProductAssignedToCustomer(
  product: Product,
  customerId: string
) {
  const customerProducts = loadBrowserStorageArray<[string, string[]]>(
    browserFallbackCustomerProductsStorageKey
  )
  const assignedProductIds = customerProducts.find(
    ([assignedCustomerId]) => assignedCustomerId === customerId
  )?.[1]

  if (assignedProductIds) {
    return assignedProductIds.includes(product.id)
  }

  return product.assignedCustomerIds.includes(customerId)
}

function normalizeBrowserFallbackOrderPayload(
  payload: UpsertOrderPayload
): UpsertOrderPayload {
  const customerId = payload.customerId.trim()
  const customerName = payload.customerName.trim()
  const customerAddress = payload.customerAddress.trim()
  const handlerName = payload.handlerName.trim()
  const status = payload.status.trim() as OrderStatus
  const orderedDate = payload.orderedDate?.trim() || null
  const note = payload.note?.trim() || null

  if (!customerId) {
    throw new Error("请选择客户")
  }

  const customer = loadBrowserFallbackCustomer(customerId)

  if (!customer) {
    throw new Error("选择的客户不存在")
  }

  const processingFees = getCustomerProcessingFeesX100(
    customer,
    payload.pricingTaxIncluded,
    note ?? ""
  )

  if (!customerName) {
    throw new Error("客户名称不能为空")
  }

  if (!handlerName) {
    throw new Error("经手人不能为空")
  }

  if (payload.aluminumIngotPriceX100 <= 0) {
    throw new Error("铝锭价必须大于 0")
  }

  for (const { key, label } of [
    { key: "bridge", label: "断桥" },
    { key: "powder", label: "喷涂" },
    { key: "billet", label: "坯料" },
    { key: "oxidation", label: "氧化" },
    { key: "electrophoresis", label: "电泳" },
  ] as const) {
    const value = processingFees[processingFeeSnapshotKeys[key]]

    if (value < 0) {
      throw new Error(`${label}加工费不能小于 0`)
    }
  }

  if (!["editing", "saved", "ordered"].includes(status)) {
    throw new Error("订单状态不正确")
  }

  if (status === "ordered" && !orderedDate) {
    throw new Error("已下单订单需要下单日期")
  }

  if (payload.items.length === 0) {
    throw new Error("订单至少需要一条明细")
  }

  const items = payload.items.map((item, index) => {
    const productId = item.productId?.trim() || null
    const color = item.color.trim()

    if (!productId) {
      throw new Error(`第 ${index + 1} 行：请选择商品`)
    }

    const product = loadBrowserFallbackProduct(productId)

    if (
      !product ||
      !isBrowserFallbackProductAssignedToCustomer(product, customerId)
    ) {
      throw new Error(`第 ${index + 1} 行：请选择当前客户的商品`)
    }

    if (item.lengthMm <= 0) {
      throw new Error(`第 ${index + 1} 行：长度必须大于 0`)
    }

    if (!color) {
      throw new Error(`第 ${index + 1} 行：颜色不能为空`)
    }

    if (item.quantity <= 0) {
      throw new Error(`第 ${index + 1} 行：数量必须大于 0`)
    }

    const processingCategory = getProcessingCategoryFromColor(color)
    const processingFeeX100 =
      processingFees[processingFeeSnapshotKeys[processingCategory]]

    if (processingFeeX100 <= 0) {
      const pricingLabel = payload.pricingTaxIncluded ? "含税" : "不含税"

      throw new Error(
        `第 ${index + 1} 行：${pricingLabel}${getProcessingCategoryLabel(processingCategory)}加工费未设置`
      )
    }

    return {
      ...item,
      productId,
      productName: product.productName,
      productMoldCode: product.moldCode,
      thicknessMmX100: product.thicknessMmX100,
      weightPerMeterKgX1000: product.weightPerMeterKgX1000,
      color,
      note: item.note?.trim() || null,
    }
  })

  return {
    ...payload,
    customerId,
    customerName,
    customerAddress,
    handlerName,
    billetProcessingFeeX100: processingFees.billetProcessingFeeX100,
    bridgeProcessingFeeX100: processingFees.bridgeProcessingFeeX100,
    electrophoresisProcessingFeeX100:
      processingFees.electrophoresisProcessingFeeX100,
    oxidationProcessingFeeX100: processingFees.oxidationProcessingFeeX100,
    powderProcessingFeeX100: processingFees.powderProcessingFeeX100,
    status,
    orderedDate,
    note,
    items,
  }
}

export async function listOrders() {
  if (!isTauriRuntime()) {
    loadBrowserFallbackOrderDetails()
    return browserFallbackOrders.map(cloneBrowserFallbackOrder)
  }

  return invoke<Order[]>("list_orders")
}

export async function getOrder(id: string) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackOrderDetails()
    const orderId = id.trim()

    if (!orderId) {
      throw new Error("订单编号不能为空")
    }

    const order = browserFallbackOrderDetails.find((item) => item.id === orderId)

    if (!order) {
      throw new Error("订单不存在")
    }

    return cloneBrowserFallbackOrderDetail(order)
  }

  return invoke<OrderDetail>("get_order", { id })
}

export async function createOrder(payload: UpsertOrderPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackOrderDetails()
    const normalizedPayload = normalizeBrowserFallbackOrderPayload(payload)
    const now = new Date().toISOString()
    const id = getBrowserFallbackOrderId(normalizedPayload)
    assertBrowserFallbackOrderIdUnique(id)
    const totalTheoreticalWeightKgX100 = normalizedPayload.items.reduce(
      (total, item) =>
        total +
        Math.round(
          (item.lengthMm / 1000) *
            item.quantity *
            (item.weightPerMeterKgX1000 / 10)
        ),
      0
    )
    const order: Order = {
      id,
      customerId: normalizedPayload.customerId,
      customerName: normalizedPayload.customerName,
      customerAddress: normalizedPayload.customerAddress,
      handlerName: normalizedPayload.handlerName,
      aluminumIngotPriceX100: normalizedPayload.aluminumIngotPriceX100,
      pricingTaxIncluded: normalizedPayload.pricingTaxIncluded,
      bridgeProcessingFeeX100: normalizedPayload.bridgeProcessingFeeX100,
      powderProcessingFeeX100: normalizedPayload.powderProcessingFeeX100,
      billetProcessingFeeX100: normalizedPayload.billetProcessingFeeX100,
      oxidationProcessingFeeX100: normalizedPayload.oxidationProcessingFeeX100,
      electrophoresisProcessingFeeX100:
        normalizedPayload.electrophoresisProcessingFeeX100,
      status: normalizedPayload.status,
      totalTheoreticalWeightKgX100,
      orderedDate: normalizedPayload.orderedDate,
      createdAt: now,
      deliveryNoteId: null,
      deliveryNoteIds: [],
      inventoryCloseDestination: null,
      inventoryClosedAt: null,
      inventoryLockedAt: null,
      updatedAt: now,
    }
    const detail: OrderDetail = {
      ...order,
      note: normalizedPayload.note,
      items: normalizedPayload.items.map((item, index) => ({
        id: `${id}-${String(index + 1).padStart(3, "0")}`,
        orderId: id,
        productId: item.productId,
        productName: item.productName,
        productMoldCode: item.productMoldCode,
        thicknessMmX100: item.thicknessMmX100,
        weightPerMeterKgX1000: item.weightPerMeterKgX1000,
        lengthMm: item.lengthMm,
        color: item.color,
        quantity: item.quantity,
        theoreticalWeightKgX100: Math.round(
          (item.lengthMm / 1000) *
            item.quantity *
            (item.weightPerMeterKgX1000 / 10)
        ),
        note: item.note,
      })),
    }

    browserFallbackOrders.unshift(order)
    browserFallbackOrderDetails.unshift(detail)
    sortBrowserFallbackOrdersByUpdatedAt()
    saveBrowserFallbackOrderDetails()
    notifyBrowserFallbackOrderUpserted(detail)
    return cloneBrowserFallbackOrderDetail(detail)
  }

  return invoke<OrderDetail>("create_order", { payload })
}

export async function updateOrder(payload: UpsertOrderPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackOrderDetails()
    const id = payload.id?.trim()

    if (!id) {
      throw new Error("订单编号不能为空")
    }

    const index = browserFallbackOrders.findIndex(
      (order) => order.id === id
    )

    if (index === -1) {
      throw new Error("订单不存在")
    }

    if (browserFallbackOrders[index].status === "ordered") {
      throw new Error("已下单订单不能编辑")
    }

    const normalizedPayload = normalizeBrowserFallbackOrderPayload({
      ...payload,
      id,
    })
    const existingOrder = browserFallbackOrders[index]
    const items = normalizedPayload.items.map((item, itemIndex) => ({
      id: `${id}-${String(itemIndex + 1).padStart(3, "0")}`,
      orderId: id,
      productId: item.productId,
      productName: item.productName,
      productMoldCode: item.productMoldCode,
      thicknessMmX100: item.thicknessMmX100,
      weightPerMeterKgX1000: item.weightPerMeterKgX1000,
      lengthMm: item.lengthMm,
      color: item.color,
      quantity: item.quantity,
      theoreticalWeightKgX100: Math.round(
        (item.lengthMm / 1000) *
          item.quantity *
          (item.weightPerMeterKgX1000 / 10)
      ),
      note: item.note,
    }))
    const order: Order = {
      id,
      customerId: normalizedPayload.customerId,
      customerName: normalizedPayload.customerName,
      customerAddress: normalizedPayload.customerAddress,
      handlerName: normalizedPayload.handlerName,
      aluminumIngotPriceX100: normalizedPayload.aluminumIngotPriceX100,
      pricingTaxIncluded: normalizedPayload.pricingTaxIncluded,
      bridgeProcessingFeeX100: normalizedPayload.bridgeProcessingFeeX100,
      powderProcessingFeeX100: normalizedPayload.powderProcessingFeeX100,
      billetProcessingFeeX100: normalizedPayload.billetProcessingFeeX100,
      oxidationProcessingFeeX100: normalizedPayload.oxidationProcessingFeeX100,
      electrophoresisProcessingFeeX100:
        normalizedPayload.electrophoresisProcessingFeeX100,
      status: normalizedPayload.status,
      totalTheoreticalWeightKgX100: items.reduce(
        (total, item) => total + item.theoreticalWeightKgX100,
        0
      ),
      orderedDate: normalizedPayload.orderedDate,
      createdAt: existingOrder.createdAt,
      deliveryNoteId: existingOrder.deliveryNoteId,
      deliveryNoteIds: existingOrder.deliveryNoteIds,
      inventoryCloseDestination: existingOrder.inventoryCloseDestination,
      inventoryClosedAt: existingOrder.inventoryClosedAt,
      inventoryLockedAt: existingOrder.inventoryLockedAt,
      updatedAt: new Date().toISOString(),
    }
    const detail: OrderDetail = {
      ...order,
      note: normalizedPayload.note,
      items,
    }

    browserFallbackOrders[index] = order
    const detailIndex = browserFallbackOrderDetails.findIndex(
      (orderDetail) => orderDetail.id === id
    )

    if (detailIndex === -1) {
      browserFallbackOrderDetails.unshift(detail)
    } else {
      browserFallbackOrderDetails[detailIndex] = detail
    }
    sortBrowserFallbackOrdersByUpdatedAt()
    saveBrowserFallbackOrderDetails()
    notifyBrowserFallbackOrderUpserted(detail)
    return cloneBrowserFallbackOrderDetail(detail)
  }

  return invoke<OrderDetail>("update_order", { payload })
}

export async function deleteOrder(id: string) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackOrderDetails()
    const orderId = id.trim()

    if (!orderId) {
      throw new Error("订单编号不能为空")
    }

    const orderIndex = browserFallbackOrders.findIndex(
      (order) => order.id === orderId
    )
    const detailIndex = browserFallbackOrderDetails.findIndex(
      (order) => order.id === orderId
    )

    if (orderIndex === -1) {
      throw new Error("订单不存在")
    }

    if (browserFallbackOrders[orderIndex].status === "ordered") {
      throw new Error("已下单订单不能删除")
    }

    browserFallbackOrders.splice(orderIndex, 1)

    if (detailIndex !== -1) {
      browserFallbackOrderDetails.splice(detailIndex, 1)
    }

    saveBrowserFallbackOrderDetails()
    notifyBrowserFallbackOrderDeleted(orderId)
    return
  }

  return invoke<void>("delete_order", { id })
}

export async function parseOrderItemImportFile(path: string) {
  if (!isTauriRuntime()) {
    return {
      rows: [],
      errors: ["系统文件选择器只能在 Tauri 应用窗口中使用。"],
    }
  }

  return invoke<ParseOrderItemImportResult>("parse_order_item_import_file", {
    path,
  })
}
