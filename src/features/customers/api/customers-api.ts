import { invoke } from "@tauri-apps/api/core"

import type { Customer } from "@/features/customers/types"
import {
  isTauriRuntime,
  loadBrowserStorageArray,
  saveBrowserStorageJson,
} from "@/lib/browser-runtime"

export type CustomerFormPayload = {
  customerName: string
  phone: string
  customerAddress: string
  defaultPricingTaxIncluded: boolean
  bridgeProcessingFeeTaxIncludedX100: number
  powderProcessingFeeTaxIncludedX100: number
  billetProcessingFeeTaxIncludedX100: number
  oxidationProcessingFeeTaxIncludedX100: number
  electrophoresisProcessingFeeTaxIncludedX100: number
  bridgeProcessingFeeTaxExcludedX100: number
  powderProcessingFeeTaxExcludedX100: number
  billetProcessingFeeTaxExcludedX100: number
  oxidationProcessingFeeTaxExcludedX100: number
  electrophoresisProcessingFeeTaxExcludedX100: number
  specialPricingKeyword: string
  specialBridgeProcessingFeeTaxIncludedX100: number
  specialPowderProcessingFeeTaxIncludedX100: number
  specialBilletProcessingFeeTaxIncludedX100: number
  specialOxidationProcessingFeeTaxIncludedX100: number
  specialElectrophoresisProcessingFeeTaxIncludedX100: number
  specialBridgeProcessingFeeTaxExcludedX100: number
  specialPowderProcessingFeeTaxExcludedX100: number
  specialBilletProcessingFeeTaxExcludedX100: number
  specialOxidationProcessingFeeTaxExcludedX100: number
  specialElectrophoresisProcessingFeeTaxExcludedX100: number
}

export type CreateCustomerPayload = CustomerFormPayload

export type UpdateCustomerPayload = CustomerFormPayload & {
  id: string
}

export type ListCustomersParams = {
  page: number
  pageSize: number
  quickFilter?: "all" | "missingPhone" | "missingAddress"
  search?: string
}

export type CustomerListResult = {
  allTotal: number
  customers: Customer[]
  missingAddressCount: number
  missingPhoneCount: number
  total: number
}

export type ExportCustomersResult = {
  customers: Customer[]
}

export type ImportCustomersPayload = {
  customers: CustomerFormPayload[]
}

export type ImportCustomersResult = {
  createdCount: number
}

export type ParseCustomerImportResult = {
  customers: CustomerFormPayload[]
  errors: string[]
}

const browserFallbackCustomers: Customer[] = []
const browserFallbackCustomerStorageKey = "order-manager:fallback-customers"
const browserFallbackOrderStorageKey = "order-manager:fallback-order-details"
const browserFallbackCustomerInventoryBatchStorageKey =
  "order-manager:fallback-customer-inventory-batches"

type BrowserFallbackCustomerOrderDetail = {
  customerAddress?: string
  customerId?: string | null
  customerName?: string
  id?: string
  items?: Record<string, unknown>[]
  status?: string
  updatedAt?: string
}

function saveBrowserFallbackCustomers() {
  saveBrowserStorageJson(
    browserFallbackCustomerStorageKey,
    browserFallbackCustomers
  )
}

function loadBrowserFallbackCustomers() {
  if (browserFallbackCustomers.length > 0) {
    return
  }

  browserFallbackCustomers.unshift(
    ...loadBrowserStorageArray<Customer>(browserFallbackCustomerStorageKey)
  )
}

function cloneBrowserFallbackCustomer(customer: Customer): Customer {
  return { ...customer }
}

function notifyBrowserFallbackCustomerUpserted(customer: Customer) {
  window.dispatchEvent(
    new CustomEvent("order-manager:fallback-customer-upserted", {
      detail: cloneBrowserFallbackCustomer(customer),
    })
  )
}

function cloneBrowserFallbackCustomerOrderDetail<
  T extends BrowserFallbackCustomerOrderDetail,
>(order: T): T {
  return {
    ...order,
    items: order.items?.map((item) => ({ ...item })),
  }
}

function notifyBrowserFallbackOrderUpsertedFromCustomer(
  order: BrowserFallbackCustomerOrderDetail
) {
  window.dispatchEvent(
    new CustomEvent("order-manager:fallback-order-upserted", {
      detail: cloneBrowserFallbackCustomerOrderDetail(order),
    })
  )
}

function hasBrowserFallbackCustomerName(
  customerName: string,
  excludedCustomerId?: string
) {
  return browserFallbackCustomers.some(
    (customer) =>
      customer.id !== excludedCustomerId &&
      customer.customerName === customerName
  )
}

function assertBrowserFallbackCustomerNameUnique(
  customerName: string,
  excludedCustomerId?: string
) {
  if (hasBrowserFallbackCustomerName(customerName.trim(), excludedCustomerId)) {
    throw new Error("客户名称已存在")
  }
}

function normalizeBrowserFallbackCustomerPayload(
  payload: CustomerFormPayload,
  rowNumber?: number
): CustomerFormPayload {
  const customerName = payload.customerName.trim()
  const prefix = rowNumber ? `第 ${rowNumber} 行：` : ""
  const priceFields = [
    ["含税断桥加工费", payload.bridgeProcessingFeeTaxIncludedX100],
    ["含税喷涂加工费", payload.powderProcessingFeeTaxIncludedX100],
    ["含税坯料加工费", payload.billetProcessingFeeTaxIncludedX100],
    ["含税氧化加工费", payload.oxidationProcessingFeeTaxIncludedX100],
    ["含税电泳加工费", payload.electrophoresisProcessingFeeTaxIncludedX100],
    ["不含税断桥加工费", payload.bridgeProcessingFeeTaxExcludedX100],
    ["不含税喷涂加工费", payload.powderProcessingFeeTaxExcludedX100],
    ["不含税坯料加工费", payload.billetProcessingFeeTaxExcludedX100],
    ["不含税氧化加工费", payload.oxidationProcessingFeeTaxExcludedX100],
    ["不含税电泳加工费", payload.electrophoresisProcessingFeeTaxExcludedX100],
    ["特殊断桥加工费", payload.specialBridgeProcessingFeeTaxIncludedX100],
    ["特殊喷涂加工费", payload.specialPowderProcessingFeeTaxIncludedX100],
    ["特殊坯料加工费", payload.specialBilletProcessingFeeTaxIncludedX100],
    ["特殊氧化加工费", payload.specialOxidationProcessingFeeTaxIncludedX100],
    ["特殊电泳加工费", payload.specialElectrophoresisProcessingFeeTaxIncludedX100],
    ["特殊不含税断桥加工费", payload.specialBridgeProcessingFeeTaxExcludedX100],
    ["特殊不含税喷涂加工费", payload.specialPowderProcessingFeeTaxExcludedX100],
    ["特殊不含税坯料加工费", payload.specialBilletProcessingFeeTaxExcludedX100],
    ["特殊不含税氧化加工费", payload.specialOxidationProcessingFeeTaxExcludedX100],
    [
      "特殊不含税电泳加工费",
      payload.specialElectrophoresisProcessingFeeTaxExcludedX100,
    ],
  ] as const
  const hasIncludedPrice = [
    payload.bridgeProcessingFeeTaxIncludedX100,
    payload.powderProcessingFeeTaxIncludedX100,
    payload.billetProcessingFeeTaxIncludedX100,
    payload.oxidationProcessingFeeTaxIncludedX100,
    payload.electrophoresisProcessingFeeTaxIncludedX100,
  ].some((value) => value > 0)
  const hasExcludedPrice = [
    payload.bridgeProcessingFeeTaxExcludedX100,
    payload.powderProcessingFeeTaxExcludedX100,
    payload.billetProcessingFeeTaxExcludedX100,
    payload.oxidationProcessingFeeTaxExcludedX100,
    payload.electrophoresisProcessingFeeTaxExcludedX100,
  ].some((value) => value > 0)

  if (!customerName) {
    throw new Error(`${prefix}客户名称不能为空`)
  }

  for (const [label, value] of priceFields) {
    if (value < 0) {
      throw new Error(`${prefix}${label}不能小于 0`)
    }
  }

  if (payload.defaultPricingTaxIncluded && !hasIncludedPrice) {
    throw new Error(`${prefix}含税加工费未设置，不能选含税`)
  }

  if (!payload.defaultPricingTaxIncluded && !hasExcludedPrice) {
    throw new Error(`${prefix}不含税加工费未设置，不能选不含税`)
  }

  return {
    ...payload,
    customerAddress: payload.customerAddress.trim(),
    customerName,
    phone: payload.phone.trim(),
    specialPricingKeyword: payload.specialPricingKeyword.trim(),
  }
}

function loadBrowserFallbackOrderDetailsForCustomerDelete() {
  return loadBrowserStorageArray<BrowserFallbackCustomerOrderDetail>(
    browserFallbackOrderStorageKey
  )
}

function assertBrowserFallbackCustomerDeletable(id: string) {
  const orderDetails = loadBrowserFallbackOrderDetailsForCustomerDelete()
  const isUsedByEditableOrder = orderDetails.some(
    (order) =>
      order.customerId === id &&
      (order.status === "editing" || order.status === "saved")
  )

  if (isUsedByEditableOrder) {
    throw new Error("有未下订单引用此客户，不能删除")
  }

  const customerInventoryBatches = loadBrowserStorageArray<{
    customerId: string
  }>(browserFallbackCustomerInventoryBatchStorageKey)
  const hasHistoricalInventory = customerInventoryBatches.some(
    (batch) => batch.customerId === id
  )

  if (hasHistoricalInventory) {
    throw new Error("有客户历史库存批次引用此客户，不能删除")
  }
}

function syncBrowserFallbackEditableOrdersWithCustomer(customer: Customer) {
  const orderDetails = loadBrowserFallbackOrderDetailsForCustomerDelete()
  const syncedOrders: typeof orderDetails = []
  const syncedOrderDetails = orderDetails.map((order) => {
    if (
      order.customerId !== customer.id ||
      (order.status !== "editing" && order.status !== "saved")
    ) {
      return order
    }

    const syncedOrder = {
      ...order,
      customerAddress: customer.customerAddress,
      customerName: customer.customerName,
      updatedAt: customer.updatedAt,
    }
    syncedOrders.push(syncedOrder)
    return syncedOrder
  })

  if (syncedOrders.length === 0) {
    return
  }

  saveBrowserStorageJson(browserFallbackOrderStorageKey, syncedOrderDetails)

  for (const order of syncedOrders) {
    notifyBrowserFallbackOrderUpsertedFromCustomer(order)
  }
}

function detachBrowserFallbackOrderedOrdersFromCustomer(id: string) {
  const orderDetails = loadBrowserFallbackOrderDetailsForCustomerDelete()
  const detachedOrders: typeof orderDetails = []
  const detachedOrderDetails = orderDetails.map((order) => {
    if (order.customerId !== id || order.status !== "ordered") {
      return order
    }

    const detachedOrder = { ...order, customerId: null }
    detachedOrders.push(detachedOrder)
    return detachedOrder
  })

  if (detachedOrders.length === 0) {
    return
  }

  saveBrowserStorageJson(browserFallbackOrderStorageKey, detachedOrderDetails)

  for (const order of detachedOrders) {
    notifyBrowserFallbackOrderUpsertedFromCustomer(order)
  }
}

function getNextBrowserFallbackCustomerNumber() {
  const maxNumber = browserFallbackCustomers.reduce((currentMax, customer) => {
    const match = /^CUS-(\d+)$/.exec(customer.id)

    return match ? Math.max(currentMax, Number(match[1])) : currentMax
  }, 0)

  return maxNumber + 1
}

function formatBrowserFallbackCustomerId(number: number) {
  return `CUS-${String(number).padStart(3, "0")}`
}

function resolveBrowserFallbackCustomerQuickFilter(
  quickFilter: ListCustomersParams["quickFilter"] | undefined
) {
  const resolvedQuickFilter = quickFilter?.trim() ?? "all"

  if (
    !["all", "missingPhone", "missingAddress"].includes(resolvedQuickFilter)
  ) {
    throw new Error("客户筛选参数无效")
  }

  return resolvedQuickFilter
}

function compareCustomerNames(left: string, right: string) {
  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}

function getBrowserFallbackFilteredCustomers(params: ListCustomersParams) {
  const search = params.search?.trim().toLowerCase() ?? ""
  const quickFilter = resolveBrowserFallbackCustomerQuickFilter(
    params.quickFilter
  )
  const searchedCustomers = search
    ? browserFallbackCustomers.filter(
        (customer) =>
          customer.customerName.toLowerCase().includes(search) ||
          customer.phone.toLowerCase().includes(search) ||
          customer.customerAddress.toLowerCase().includes(search)
      )
    : browserFallbackCustomers

  return searchedCustomers
    .filter((customer) => {
      if (quickFilter === "missingPhone") {
        return !customer.phone.trim()
      }

      if (quickFilter === "missingAddress") {
        return !customer.customerAddress.trim()
      }

      return true
    })
    .sort((left, right) => {
      const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt)

      if (updatedAtOrder !== 0) {
        return updatedAtOrder
      }

      return compareCustomerNames(left.customerName, right.customerName)
    })
}

function normalizeBrowserFallbackPagination(params: ListCustomersParams) {
  const page = Number.isFinite(params.page) ? Math.trunc(params.page) : 1
  const pageSize = Number.isFinite(params.pageSize)
    ? Math.trunc(params.pageSize)
    : 20

  return {
    page: Math.max(1, page),
    pageSize: Math.min(1000, Math.max(10, pageSize)),
  }
}

export async function listCustomers(params: ListCustomersParams) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackCustomers()
    const filteredCustomers = getBrowserFallbackFilteredCustomers(params)
    const { page, pageSize } = normalizeBrowserFallbackPagination(params)
    const start = (page - 1) * pageSize

    return {
      allTotal: browserFallbackCustomers.length,
      customers: filteredCustomers
        .slice(start, start + pageSize)
        .map(cloneBrowserFallbackCustomer),
      missingAddressCount: browserFallbackCustomers.filter(
        (customer) => !customer.customerAddress.trim()
      ).length,
      missingPhoneCount: browserFallbackCustomers.filter(
        (customer) => !customer.phone.trim()
      ).length,
      total: filteredCustomers.length,
    }
  }

  return invoke<CustomerListResult>("list_customers", { params })
}

export async function exportCustomers(params: ListCustomersParams) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackCustomers()
    const filteredCustomers = getBrowserFallbackFilteredCustomers(params)

    return { customers: filteredCustomers.map(cloneBrowserFallbackCustomer) }
  }

  return invoke<ExportCustomersResult>("export_customers", { params })
}

export async function createCustomer(payload: CreateCustomerPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackCustomers()
    const normalizedPayload = normalizeBrowserFallbackCustomerPayload(payload)
    assertBrowserFallbackCustomerNameUnique(normalizedPayload.customerName)
    const now = new Date().toISOString()
    const customer: Customer = {
      id: formatBrowserFallbackCustomerId(getNextBrowserFallbackCustomerNumber()),
      ...normalizedPayload,
      createdAt: now,
      updatedAt: now,
    }

    browserFallbackCustomers.unshift(customer)
    saveBrowserFallbackCustomers()
    notifyBrowserFallbackCustomerUpserted(customer)
    return cloneBrowserFallbackCustomer(customer)
  }

  return invoke<Customer>("create_customer", { payload })
}

export async function importCustomers(payload: ImportCustomersPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackCustomers()
    if (payload.customers.length === 0) {
      throw new Error("没有可导入的客户")
    }

    const importedCustomerNames = new Set<string>()
    const normalizedCustomers = payload.customers.map((customer, index) =>
      normalizeBrowserFallbackCustomerPayload(customer, index + 1)
    )

    normalizedCustomers.forEach((customer, index) => {
      const customerName = customer.customerName

      if (importedCustomerNames.has(customerName)) {
        throw new Error(`第 ${index + 1} 行：客户名称重复`)
      }

      importedCustomerNames.add(customerName)
    })
    normalizedCustomers.forEach((customer) => {
      assertBrowserFallbackCustomerNameUnique(customer.customerName)
    })

    const now = new Date().toISOString()
    const start = getNextBrowserFallbackCustomerNumber()
    const customers = normalizedCustomers.map((customer, index) => ({
      id: formatBrowserFallbackCustomerId(start + index),
      ...customer,
      createdAt: now,
      updatedAt: now,
    }))

    browserFallbackCustomers.unshift(...customers)
    saveBrowserFallbackCustomers()
    for (const customer of customers) {
      notifyBrowserFallbackCustomerUpserted(customer)
    }
    return { createdCount: customers.length }
  }

  return invoke<ImportCustomersResult>("import_customers", { payload })
}

export async function parseCustomerImportFile(path: string) {
  if (!isTauriRuntime()) {
    return {
      customers: [],
      errors: ["系统文件选择器只能在 Tauri 应用窗口中使用。"],
    }
  }

  return invoke<ParseCustomerImportResult>("parse_customer_import_file", {
    path,
  })
}

export async function updateCustomer(payload: UpdateCustomerPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackCustomers()
    const customerId = payload.id.trim()

    if (!customerId) {
      throw new Error("客户 ID 不能为空")
    }

    const normalizedPayload = normalizeBrowserFallbackCustomerPayload(payload)
    const index = browserFallbackCustomers.findIndex(
      (customer) => customer.id === customerId
    )

    if (index === -1) {
      throw new Error("客户不存在")
    }

    assertBrowserFallbackCustomerNameUnique(
      normalizedPayload.customerName,
      customerId
    )
    const current = browserFallbackCustomers[index]
    const customer: Customer = {
      ...current,
      ...normalizedPayload,
      id: customerId,
      updatedAt: new Date().toISOString(),
    }

    browserFallbackCustomers[index] = customer
    syncBrowserFallbackEditableOrdersWithCustomer(customer)
    saveBrowserFallbackCustomers()
    notifyBrowserFallbackCustomerUpserted(customer)
    return cloneBrowserFallbackCustomer(customer)
  }

  return invoke<Customer>("update_customer", { payload })
}

export async function deleteCustomer(id: string) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackCustomers()
    const customerId = id.trim()

    if (!customerId) {
      throw new Error("客户 ID 不能为空")
    }

    assertBrowserFallbackCustomerDeletable(customerId)
    const index = browserFallbackCustomers.findIndex(
      (customer) => customer.id === customerId
    )

    if (index === -1) {
      throw new Error("客户不存在")
    }

    browserFallbackCustomers.splice(index, 1)
    detachBrowserFallbackOrderedOrdersFromCustomer(customerId)
    saveBrowserFallbackCustomers()
    window.dispatchEvent(
      new CustomEvent("order-manager:fallback-customer-deleted", {
        detail: { id: customerId },
      })
    )
    return
  }

  return invoke<void>("delete_customer", { id })
}
