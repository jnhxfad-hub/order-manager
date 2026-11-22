import { invoke } from "@tauri-apps/api/core"

import type { Customer } from "@/features/customers/types"
import type { Product } from "@/features/products/types"
import {
  isTauriRuntime,
  loadBrowserStorageArray,
  saveBrowserStorageJson,
} from "@/lib/browser-runtime"

export type CreateProductPayload = {
  assignedCustomerNames?: string[]
  productName: string
  moldCode: string
  thicknessMmX100: number
  weightPerMeterKgX1000: number
}

export type UpdateProductPayload = CreateProductPayload & {
  id: string
}

export type ProductFilterParams = {
  search?: string
  customerId?: string
  assignmentStatus?: "assigned" | "unassigned"
}

export type ListProductsParams = ProductFilterParams & {
  page: number
  pageSize: number
}

export type ProductListResult = {
  products: Product[]
  total: number
}

export type ExportProductsResult = {
  products: Product[]
}

export type ProductIdsResult = {
  ids: string[]
}

export type ImportProductsPayload = {
  products: CreateProductPayload[]
}

export type ImportProductsResult = {
  createdCount: number
}

export type AssignCustomerProductsPayload = {
  customerId: string
  productIds: string[]
}

export type SetProductCustomersPayload = {
  productId: string
  customerIds: string[]
}

export type AssignCustomerProductsResult = {
  assignedCount: number
  skippedCount: number
}

export type ParseProductImportResult = {
  products: CreateProductPayload[]
  errors: string[]
}

const browserFallbackProducts: Product[] = []
const browserFallbackCustomerProducts = new Map<string, Set<string>>()
const browserFallbackCustomerNames = new Map<string, string>()
const browserFallbackProductStorageKey = "order-manager:fallback-products"
const browserFallbackCustomerProductsStorageKey =
  "order-manager:fallback-customer-products"
const browserFallbackCustomerStorageKey = "order-manager:fallback-customers"
const browserFallbackOrderStorageKey = "order-manager:fallback-order-details"
let browserFallbackProductsLoaded = false
let browserFallbackCustomerProductsLoaded = false

type BrowserFallbackProductOrderItem = {
  lengthMm: number
  productId?: string | null
  productMoldCode: string
  productName: string
  quantity: number
  theoreticalWeightKgX100: number
  thicknessMmX100: number
  weightPerMeterKgX1000: number
}

type BrowserFallbackProductOrderDetail = {
  id?: string
  items?: BrowserFallbackProductOrderItem[]
  status?: string
}

function loadBrowserFallbackCustomerNames() {
  if (browserFallbackCustomerNames.size > 0) {
    return
  }

  for (const customer of loadBrowserStorageArray<Customer>(
    browserFallbackCustomerStorageKey
  )) {
    browserFallbackCustomerNames.set(customer.id, customer.customerName)
  }
}

function saveBrowserFallbackProducts() {
  saveBrowserStorageJson(browserFallbackProductStorageKey, browserFallbackProducts)
  saveBrowserStorageJson(
    browserFallbackCustomerProductsStorageKey,
    Array.from(browserFallbackCustomerProducts.entries()).map(
      ([customerId, productIds]) => [customerId, Array.from(productIds)]
    )
  )
}

function loadBrowserFallbackProducts() {
  if (!browserFallbackProductsLoaded) {
    browserFallbackProducts.length = 0
    browserFallbackProducts.unshift(
      ...loadBrowserStorageArray<Product>(browserFallbackProductStorageKey)
    )
    browserFallbackProductsLoaded = true
  }

  if (!browserFallbackCustomerProductsLoaded) {
    browserFallbackCustomerProducts.clear()

    for (const [customerId, productIds] of loadBrowserStorageArray<
      [string, string[]]
    >(browserFallbackCustomerProductsStorageKey)) {
      browserFallbackCustomerProducts.set(customerId, new Set(productIds))
    }

    browserFallbackCustomerProductsLoaded = true
  }
}

function getBrowserFallbackAssignedCustomerNames(customerIds: string[]) {
  return customerIds.map(
    (customerId) => browserFallbackCustomerNames.get(customerId) || customerId
  )
}

function cloneBrowserFallbackProduct(product: Product): Product {
  return {
    ...product,
    assignedCustomerIds: [...product.assignedCustomerIds],
    assignedCustomerNames: [...product.assignedCustomerNames],
  }
}

function cloneBrowserFallbackProductOrderDetail<
  T extends BrowserFallbackProductOrderDetail,
>(order: T): T {
  return {
    ...order,
    items: order.items?.map((item) => ({ ...item })),
  } as T
}

function notifyBrowserFallbackOrderUpsertedFromProduct(
  order: BrowserFallbackProductOrderDetail
) {
  window.dispatchEvent(
    new CustomEvent("order-manager:fallback-order-upserted", {
      detail: cloneBrowserFallbackProductOrderDetail(order),
    })
  )
}

if (typeof window !== "undefined") {
  window.addEventListener("order-manager:fallback-customer-upserted", (event) => {
    const customer = (event as CustomEvent<Customer>).detail

    if (customer) {
      loadBrowserFallbackProducts()
      browserFallbackCustomerNames.set(customer.id, customer.customerName)

      let hasUpdatedProducts = false
      for (const product of browserFallbackProducts) {
        if (product.assignedCustomerIds.includes(customer.id)) {
          product.assignedCustomerNames = getBrowserFallbackAssignedCustomerNames(
            product.assignedCustomerIds
          )
          hasUpdatedProducts = true
        }
      }

      if (hasUpdatedProducts) {
        saveBrowserFallbackProducts()
      }
    }
  })
  window.addEventListener("order-manager:fallback-customer-deleted", (event) => {
    const customerId = (event as CustomEvent<{ id?: string }>).detail?.id

    if (!customerId) {
      return
    }

    loadBrowserFallbackProducts()
    browserFallbackCustomerNames.delete(customerId)
    browserFallbackCustomerProducts.delete(customerId)

    let hasUpdatedProducts = false
    for (const product of browserFallbackProducts) {
      if (product.assignedCustomerIds.includes(customerId)) {
        product.assignedCustomerIds = product.assignedCustomerIds.filter(
          (assignedCustomerId) => assignedCustomerId !== customerId
        )
        product.assignedCustomerNames = getBrowserFallbackAssignedCustomerNames(
          product.assignedCustomerIds
        )
        hasUpdatedProducts = true
      }
    }

    if (hasUpdatedProducts) {
      saveBrowserFallbackProducts()
    }
  })
}

function hasBrowserFallbackProductValue(
  key: "moldCode" | "productName",
  value: string,
  excludedProductId?: string
) {
  return browserFallbackProducts.some(
    (product) => product.id !== excludedProductId && product[key] === value
  )
}

function assertBrowserFallbackProductUniqueValues(
  payload: Pick<CreateProductPayload, "moldCode" | "productName">,
  excludedProductId?: string
) {
  const productName = payload.productName.trim()
  const moldCode = payload.moldCode.trim()

  if (hasBrowserFallbackProductValue("productName", productName, excludedProductId)) {
    throw new Error("商品名称已存在")
  }

  if (hasBrowserFallbackProductValue("moldCode", moldCode, excludedProductId)) {
    throw new Error("模具编号已存在")
  }
}

function normalizeBrowserFallbackProductPayload(
  payload: CreateProductPayload,
  rowNumber?: number
): CreateProductPayload {
  const productName = payload.productName.trim()
  const moldCode = payload.moldCode.trim()
  const prefix = rowNumber ? `第 ${rowNumber} 行：` : ""

  if (!productName) {
    throw new Error(`${prefix}商品名称不能为空`)
  }

  if (!moldCode) {
    throw new Error(`${prefix}模具编号不能为空`)
  }

  if (payload.thicknessMmX100 <= 0) {
    throw new Error(`${prefix}厚度必须大于 0`)
  }

  if (payload.weightPerMeterKgX1000 <= 0) {
    throw new Error(`${prefix}米重必须大于 0`)
  }

  return {
    ...payload,
    moldCode,
    productName,
  }
}

function assertBrowserFallbackProductDeletable(id: string) {
  const orderDetails = loadBrowserStorageArray<{
    items?: { productId?: string | null }[]
    status?: string
  }>(browserFallbackOrderStorageKey)
  const isUsedByEditableOrder = orderDetails.some(
    (order) =>
      (order.status === "editing" || order.status === "saved") &&
      order.items?.some((item) => item.productId === id)
  )

  if (isUsedByEditableOrder) {
    throw new Error("有未下订单引用此商品，不能删除")
  }
}

function assertBrowserFallbackCustomerExists(customerId: string) {
  if (!browserFallbackCustomerNames.has(customerId)) {
    throw new Error("选择的客户不存在")
  }
}

function assertBrowserFallbackProductExists(productId: string) {
  if (!browserFallbackProducts.some((product) => product.id === productId)) {
    throw new Error("商品不存在")
  }
}

function loadBrowserFallbackOrderDetailsForProductUpdate() {
  return loadBrowserStorageArray<BrowserFallbackProductOrderDetail>(
    browserFallbackOrderStorageKey
  )
}

function syncBrowserFallbackEditableOrdersWithProduct(product: Product) {
  const orderDetails = loadBrowserFallbackOrderDetailsForProductUpdate()
  const syncedOrders: typeof orderDetails = []
  const syncedOrderDetails = orderDetails.map((order) => {
    if (order.status !== "editing" && order.status !== "saved") {
      return order
    }

    let hasUpdatedItems = false
    const items = order.items?.map((item) => {
      if (item.productId !== product.id) {
        return item
      }

      hasUpdatedItems = true
      return {
        ...item,
        productMoldCode: product.moldCode,
        productName: product.productName,
        theoreticalWeightKgX100: Math.round(
          (item.lengthMm / 1000) *
            item.quantity *
            (product.weightPerMeterKgX1000 / 10)
        ),
        thicknessMmX100: product.thicknessMmX100,
        weightPerMeterKgX1000: product.weightPerMeterKgX1000,
      }
    })

    if (!hasUpdatedItems) {
      return order
    }

    const syncedOrder = {
      ...order,
      items,
    }
    syncedOrders.push(syncedOrder)
    return syncedOrder
  })

  if (syncedOrders.length === 0) {
    return
  }

  saveBrowserStorageJson(browserFallbackOrderStorageKey, syncedOrderDetails)

  for (const order of syncedOrders) {
    notifyBrowserFallbackOrderUpsertedFromProduct(order)
  }
}

function getNextBrowserFallbackProductNumber() {
  const maxNumber = browserFallbackProducts.reduce((currentMax, product) => {
    const match = /^PROD-(\d+)$/.exec(product.id)

    return match ? Math.max(currentMax, Number(match[1])) : currentMax
  }, 0)

  return maxNumber + 1
}

function formatBrowserFallbackProductId(number: number) {
  return `PROD-${String(number).padStart(3, "0")}`
}

function filterBrowserFallbackProducts(params: ProductFilterParams) {
  const search = params.search?.trim().toLowerCase() ?? ""
  const customerId = params.customerId?.trim() ?? ""
  const assignmentStatus = params.assignmentStatus?.trim() ?? ""

  if (!["", "assigned", "unassigned"].includes(assignmentStatus)) {
    throw new Error("归属状态参数无效")
  }

  return browserFallbackProducts
    .filter((product) => {
      const assignedProducts = customerId
        ? browserFallbackCustomerProducts.get(customerId)
        : null
      const matchesCustomer = !customerId || assignedProducts?.has(product.id)
      const isAssigned = product.assignedCustomerIds.length > 0
      const matchesAssignmentStatus =
        !assignmentStatus ||
        (assignmentStatus === "assigned" && isAssigned) ||
        (assignmentStatus === "unassigned" && !isAssigned)
      const matchesSearch =
        !search ||
        product.productName.toLowerCase().includes(search) ||
        product.moldCode.toLowerCase().includes(search)

      return matchesCustomer && matchesAssignmentStatus && matchesSearch
    })
    .sort((left, right) => {
      if (left.productName < right.productName) {
        return -1
      }

      if (left.productName > right.productName) {
        return 1
      }

      return 0
    })
}

function normalizeBrowserFallbackPagination(params: ListProductsParams) {
  const page = Number.isFinite(params.page) ? Math.trunc(params.page) : 1
  const pageSize = Number.isFinite(params.pageSize)
    ? Math.trunc(params.pageSize)
    : 20

  return {
    page: Math.max(1, page),
    pageSize: Math.min(1000, Math.max(10, pageSize)),
  }
}

export async function listProducts(params: ListProductsParams) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    const filteredProducts = filterBrowserFallbackProducts(params)
    const { page, pageSize } = normalizeBrowserFallbackPagination(params)
    const start = (page - 1) * pageSize

    return {
      products: filteredProducts
        .slice(start, start + pageSize)
        .map(cloneBrowserFallbackProduct),
      total: filteredProducts.length,
    }
  }

  return invoke<ProductListResult>("list_products", { params })
}

export async function exportProducts(params: ProductFilterParams) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    return {
      products: filterBrowserFallbackProducts(params).map(
        cloneBrowserFallbackProduct
      ),
    }
  }

  return invoke<ExportProductsResult>("export_products", { params })
}

export async function listProductIds(params: ProductFilterParams) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    return {
      ids: filterBrowserFallbackProducts(params).map((product) => product.id),
    }
  }

  return invoke<ProductIdsResult>("list_product_ids", { params })
}

export async function createProduct(payload: CreateProductPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    const normalizedPayload = normalizeBrowserFallbackProductPayload(payload)
    assertBrowserFallbackProductUniqueValues(normalizedPayload)
    const product: Product = {
      id: formatBrowserFallbackProductId(getNextBrowserFallbackProductNumber()),
      ...normalizedPayload,
      assignedCustomerIds: [],
      assignedCustomerNames: [],
    }

    browserFallbackProducts.unshift(product)
    saveBrowserFallbackProducts()
    return cloneBrowserFallbackProduct(product)
  }

  return invoke<Product>("create_product", { payload })
}

export async function importProducts(payload: ImportProductsPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    loadBrowserFallbackCustomerNames()
    if (payload.products.length === 0) {
      throw new Error("没有可导入的商品")
    }

    const start = getNextBrowserFallbackProductNumber()
    const customerIdsByName = new Map(
      Array.from(browserFallbackCustomerNames.entries()).map(
        ([customerId, customerName]) => [customerName, customerId]
      )
    )
    const importedProductNames = new Set<string>()
    const importedMoldCodes = new Set<string>()

    payload.products.forEach((product, index) => {
      const rowNumber = index + 1
      const normalizedProduct = normalizeBrowserFallbackProductPayload(
        product,
        rowNumber
      )
      const productName = normalizedProduct.productName
      const moldCode = normalizedProduct.moldCode

      if (importedProductNames.has(productName)) {
        throw new Error(
          `第 ${rowNumber} 行：商品名称“${productName}”在导入文件中重复`
        )
      }

      if (importedMoldCodes.has(moldCode)) {
        throw new Error(
          `第 ${rowNumber} 行：模具编号“${moldCode}”在导入文件中重复`
        )
      }

      importedProductNames.add(productName)
      importedMoldCodes.add(moldCode)
    })

    payload.products.forEach((product, index) => {
      const rowNumber = index + 1
      const normalizedProduct = normalizeBrowserFallbackProductPayload(
        product,
        rowNumber
      )
      const productName = normalizedProduct.productName
      const moldCode = normalizedProduct.moldCode

      if (hasBrowserFallbackProductValue("productName", productName)) {
        throw new Error(
          `第 ${rowNumber} 行：商品名称“${productName}”已存在于系统商品资料中`
        )
      }

      if (hasBrowserFallbackProductValue("moldCode", moldCode)) {
        throw new Error(
          `第 ${rowNumber} 行：模具编号“${moldCode}”已存在于系统商品资料中`
        )
      }
    })

    const products = payload.products.map((product, index) => {
      const normalizedProduct = normalizeBrowserFallbackProductPayload(product)
      const assignedCustomerNames = Array.from(
        new Set(
          (normalizedProduct.assignedCustomerNames ?? [])
            .map((customerName) => customerName.trim())
            .filter(Boolean)
        )
      )
      const assignedCustomerIds = assignedCustomerNames.flatMap((customerName) => {
        const customerId = customerIdsByName.get(customerName)

        return customerId ? [customerId] : []
      })

      if (assignedCustomerIds.length !== assignedCustomerNames.length) {
        const missingCustomerName = assignedCustomerNames.find(
          (customerName) => !customerIdsByName.has(customerName)
        )

        throw new Error(`第 ${index + 1} 行：归属客户不存在：${missingCustomerName}`)
      }

      const newProduct: Product = {
        id: formatBrowserFallbackProductId(start + index),
        moldCode: normalizedProduct.moldCode,
        productName: normalizedProduct.productName,
        thicknessMmX100: normalizedProduct.thicknessMmX100,
        weightPerMeterKgX1000: normalizedProduct.weightPerMeterKgX1000,
        assignedCustomerIds,
        assignedCustomerNames:
          getBrowserFallbackAssignedCustomerNames(assignedCustomerIds),
      }

      for (const customerId of assignedCustomerIds) {
        const productIds =
          browserFallbackCustomerProducts.get(customerId) ?? new Set<string>()

        productIds.add(newProduct.id)
        browserFallbackCustomerProducts.set(customerId, productIds)
      }

      return newProduct
    })

    browserFallbackProducts.unshift(...products)
    saveBrowserFallbackProducts()
    return { createdCount: products.length }
  }

  return invoke<ImportProductsResult>("import_products", { payload })
}

export async function parseProductImportFile(path: string) {
  if (!isTauriRuntime()) {
    return {
      products: [],
      errors: ["系统文件选择器只能在 Tauri 应用窗口中使用。"],
    }
  }

  return invoke<ParseProductImportResult>("parse_product_import_file", { path })
}

export async function updateProduct(payload: UpdateProductPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    const productId = payload.id.trim()

    if (!productId) {
      throw new Error("商品 ID 不能为空")
    }

    const normalizedPayload = normalizeBrowserFallbackProductPayload(payload)
    const index = browserFallbackProducts.findIndex(
      (product) => product.id === productId
    )

    if (index === -1) {
      throw new Error("商品不存在")
    }

    assertBrowserFallbackProductUniqueValues(normalizedPayload, productId)
    const product: Product = {
      ...normalizedPayload,
      id: productId,
      assignedCustomerIds: browserFallbackProducts[index].assignedCustomerIds,
      assignedCustomerNames: browserFallbackProducts[index].assignedCustomerNames,
    }
    browserFallbackProducts[index] = product
    syncBrowserFallbackEditableOrdersWithProduct(product)
    saveBrowserFallbackProducts()
    return cloneBrowserFallbackProduct(product)
  }

  return invoke<Product>("update_product", { payload })
}

export async function deleteProduct(id: string) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    const productId = id.trim()

    if (!productId) {
      throw new Error("商品 ID 不能为空")
    }

    assertBrowserFallbackProductDeletable(productId)
    const index = browserFallbackProducts.findIndex(
      (product) => product.id === productId
    )

    if (index === -1) {
      throw new Error("商品不存在")
    }

    browserFallbackProducts.splice(index, 1)
    for (const productIds of browserFallbackCustomerProducts.values()) {
      productIds.delete(productId)
    }
    saveBrowserFallbackProducts()
    return
  }

  return invoke<void>("delete_product", { id })
}

export async function assignCustomerProducts(
  payload: AssignCustomerProductsPayload
) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    loadBrowserFallbackCustomerNames()
    const customerId = payload.customerId.trim()
    const productIds = payload.productIds
      .map((productId) => productId.trim())
      .filter(Boolean)

    if (!customerId) {
      throw new Error("请选择客户")
    }

    if (productIds.length === 0) {
      throw new Error("请选择商品")
    }

    const ids = new Set<string>()

    for (const productId of productIds) {
      if (ids.has(productId)) {
        throw new Error("分配列表中存在重复商品")
      }

      ids.add(productId)
    }

    assertBrowserFallbackCustomerExists(customerId)

    for (const productId of productIds) {
      assertBrowserFallbackProductExists(productId)
    }

    const assignedProducts =
      browserFallbackCustomerProducts.get(customerId) ?? new Set<string>()
    const customerName = browserFallbackCustomerNames.get(customerId) ?? customerId

    let assignedCount = 0

    for (const product of browserFallbackProducts) {
      if (ids.has(product.id) && !assignedProducts.has(product.id)) {
        assignedProducts.add(product.id)
        assignedCount += 1
        product.assignedCustomerIds = [
          ...product.assignedCustomerIds,
          customerId,
        ]
        product.assignedCustomerNames = [
          ...product.assignedCustomerNames,
          customerName,
        ]
      }
    }

    browserFallbackCustomerProducts.set(customerId, assignedProducts)
    saveBrowserFallbackProducts()
    return {
      assignedCount,
      skippedCount: productIds.length - assignedCount,
    }
  }

  return invoke<AssignCustomerProductsResult>("assign_customer_products", {
    payload,
  })
}

export async function setProductCustomers(payload: SetProductCustomersPayload) {
  if (!isTauriRuntime()) {
    loadBrowserFallbackProducts()
    loadBrowserFallbackCustomerNames()
    const productId = payload.productId.trim()

    if (!productId) {
      throw new Error("商品 ID 不能为空")
    }

    const customerIds = Array.from(
      new Set(
        payload.customerIds
          .map((customerId) => customerId.trim())
          .filter(Boolean)
      )
    )
    assertBrowserFallbackProductExists(productId)

    for (const customerId of customerIds) {
      assertBrowserFallbackCustomerExists(customerId)
    }

    const product = browserFallbackProducts.find(
      (item) => item.id === productId
    )

    if (!product) {
      throw new Error("商品不存在")
    }

    product.assignedCustomerIds = customerIds
    product.assignedCustomerNames =
      getBrowserFallbackAssignedCustomerNames(customerIds)

    for (const [customerId, productIds] of browserFallbackCustomerProducts) {
      if (customerIds.includes(customerId)) {
        productIds.add(product.id)
      } else {
        productIds.delete(product.id)
      }
    }

    for (const customerId of customerIds) {
      if (!browserFallbackCustomerProducts.has(customerId)) {
        browserFallbackCustomerProducts.set(customerId, new Set([product.id]))
      }
    }

    saveBrowserFallbackProducts()

    return cloneBrowserFallbackProduct(product)
  }

  return invoke<Product>("set_product_customers", { payload })
}
