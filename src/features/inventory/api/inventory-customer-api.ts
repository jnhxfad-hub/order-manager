import { invoke } from "@tauri-apps/api/core"
import type {
  CustomerInventoryListResult,
  CustomerInventoryBatch,
  CustomerInventoryPrintSnapshot,
  DeliveryNote,
  DeliveryNotePriceGroup,
} from "@/features/inventory/types"
import { isTauriRuntime } from "@/lib/browser-runtime"
import { formatDateInputValue } from "@/lib/datetime"
import {
  browserFallbackCustomerInventoryBatches,
  browserFallbackCustomerInventoryMovements,
  browserFallbackCustomerInventoryDeliveryNotes,
  loadBrowserFallbackCustomersFromStorage,
  loadBrowserFallbackProductsFromStorage,
  cloneBrowserFallbackDeliveryNote,
  cloneBrowserFallbackCustomerInventoryBatch,
  cloneBrowserFallbackCustomerInventoryMovement,
  syncBrowserFallbackCustomerInventoryFromStorage,
  saveBrowserFallbackCustomerInventoryToStorage,
  normalizeBrowserFallbackCustomerInventoryHistoricalOrderDate,
  normalizeBrowserFallbackCustomerInventoryBatchItems,
  resolveBrowserFallbackCustomerInventoryStockItems,
  createBrowserFallbackCustomerInventoryImportMovements,
  normalizeBrowserFallbackDeliveryExtraCharge,
  resolveBrowserFallbackCustomerInventoryPricingProfile,
  validateBrowserFallbackCustomerDeliveryRequiredWeights,
  validateBrowserFallbackCustomerDeliveryProcessingFees,
  hasSameBrowserFallbackCustomerInventoryPricing,
  stageBrowserFallbackCustomerInventoryDelivery,
  validateBrowserFallbackCustomerInventoryBatchItems,
  validateBrowserFallbackCustomerInventoryBatchProcessingFees,
  getNextBrowserFallbackCustomerInventoryBatchId,
  getNextBrowserFallbackCustomerInventoryDeliveryNoteId,
  getNextBrowserFallbackMergedCustomerInventoryDeliveryNoteId,
  matchesBrowserFallbackCustomerInventorySearch,
  matchesBrowserFallbackCustomerInventoryMovementSearch,
  getBrowserFallbackCustomerInventoryDeliveryNoteSummaries,
  type BrowserFallbackStagedCustomerDeliveryItem,
} from "./inventory-browser-fallback"
import type {
  ListInventoryParams,
  UpdateDeliveryNoteSpecialNotePayload,
  CreateCustomerInventoryBatchPayload,
  UpdateCustomerInventoryBatchPayload,
  ParsedCustomerInventoryImportRow,
  ParseCustomerInventoryImportResult,
  ImportCustomerInventoryResult,
  CreateCustomerInventoryDeliveryNotePayload,
  AdjustCustomerInventoryStockPayload,
} from "./inventory-api-types"

export function deriveCustomerInventoryDeliveryGroupLabel(batchNote: string) {
  const [, groupLabel = ""] = batchNote.trim().split(/[，,]/, 3)

  return groupLabel.trim()
}

export async function listCustomerInventory(params: ListInventoryParams) {
  if (!isTauriRuntime()) {
    syncBrowserFallbackCustomerInventoryFromStorage()
    const search = params.search?.trim().toLowerCase() ?? ""
    const batches = browserFallbackCustomerInventoryBatches
      .filter((batch) =>
        matchesBrowserFallbackCustomerInventorySearch(batch, search)
      )
      .sort((left, right) => {
        const historicalOrderDateOrder = (
          right.historicalOrderDate ?? ""
        ).localeCompare(left.historicalOrderDate ?? "")

        if (historicalOrderDateOrder !== 0) {
          return historicalOrderDateOrder
        }

        const updatedAtOrder = right.updatedAt.localeCompare(left.updatedAt)

        if (updatedAtOrder !== 0) {
          return updatedAtOrder
        }

        return right.id.localeCompare(left.id)
      })

    return {
      batches: batches.map(cloneBrowserFallbackCustomerInventoryBatch),
      deliveryNotes: getBrowserFallbackCustomerInventoryDeliveryNoteSummaries(
        search
      ),
      recentMovements: [...browserFallbackCustomerInventoryMovements]
        .filter((movement) =>
          matchesBrowserFallbackCustomerInventoryMovementSearch(
            movement,
            search
          )
        )
        .sort((left, right) => {
          const createdAtOrder = right.createdAt.localeCompare(left.createdAt)

          if (createdAtOrder !== 0) {
            return createdAtOrder
          }

          return right.id.localeCompare(left.id)
        })
        .map(cloneBrowserFallbackCustomerInventoryMovement)
        .slice(0, 80),
      totalQuantity: browserFallbackCustomerInventoryBatches.reduce(
        (total, batch) => total + batch.totalQuantity,
        0
      ),
    } satisfies CustomerInventoryListResult
  }

  return invoke<CustomerInventoryListResult>("list_customer_inventory", { params })
}

export async function getCustomerInventoryPrintSnapshot(customerId: string) {
  const normalizedCustomerId = customerId.trim()

  if (!isTauriRuntime()) {
    if (!normalizedCustomerId) {
      throw new Error("请选择客户")
    }

    syncBrowserFallbackCustomerInventoryFromStorage()
    const customer = loadBrowserFallbackCustomersFromStorage().find(
      (candidate) => candidate.id === normalizedCustomerId
    )

    if (!customer) {
      throw new Error("客户不存在")
    }

    const batches = browserFallbackCustomerInventoryBatches
      .filter((batch) => batch.customerId === normalizedCustomerId)
      .map((batch) => {
        const items = batch.items
          .filter((item) => item.quantity > 0)
          .map((item) => ({ ...item }))

        return {
          id: batch.id,
          historicalOrderDate: batch.historicalOrderDate,
          historicalOrderRef: batch.historicalOrderRef,
          aluminumIngotPriceX100: batch.aluminumIngotPriceX100,
          pricingTaxIncluded: batch.pricingTaxIncluded,
          bridgeProcessingFeeX100: batch.bridgeProcessingFeeX100,
          powderProcessingFeeX100: batch.powderProcessingFeeX100,
          billetProcessingFeeX100: batch.billetProcessingFeeX100,
          oxidationProcessingFeeX100: batch.oxidationProcessingFeeX100,
          electrophoresisProcessingFeeX100:
            batch.electrophoresisProcessingFeeX100,
          note: batch.note,
          totalQuantity: items.reduce(
            (total, item) => total + item.quantity,
            0
          ),
          itemCount: items.length,
          items,
        }
      })
      .filter((batch) => batch.totalQuantity > 0)
      .sort((left, right) => {
        const historicalDateOrder = (
          right.historicalOrderDate ?? ""
        ).localeCompare(left.historicalOrderDate ?? "")

        return historicalDateOrder || right.id.localeCompare(left.id)
      })

    if (batches.length === 0) {
      throw new Error("该客户暂无当前库存")
    }

    return {
      customerId: customer.id,
      customerName: customer.customerName,
      customerAddress: customer.customerAddress,
      generatedAt: new Date().toISOString(),
      totalQuantity: batches.reduce(
        (total, batch) => total + batch.totalQuantity,
        0
      ),
      itemCount: batches.reduce(
        (total, batch) => total + batch.itemCount,
        0
      ),
      batches,
    } satisfies CustomerInventoryPrintSnapshot
  }

  if (!normalizedCustomerId) {
    throw new Error("请选择客户")
  }

  return invoke<CustomerInventoryPrintSnapshot>(
    "get_customer_inventory_print_snapshot",
    { customerId: normalizedCustomerId }
  )
}

export async function getCustomerInventoryBatch(batchId: string) {
  if (!isTauriRuntime()) {
    const trimmedBatchId = batchId.trim()

    if (!trimmedBatchId) {
      throw new Error("请选择客户库存批次")
    }

    syncBrowserFallbackCustomerInventoryFromStorage()
    const batch = browserFallbackCustomerInventoryBatches.find(
      (item) => item.id === trimmedBatchId
    )

    if (!batch) {
      throw new Error("客户库存批次不存在")
    }

    return cloneBrowserFallbackCustomerInventoryBatch(batch)
  }

  return invoke<CustomerInventoryBatch>("get_customer_inventory_batch", {
    batchId,
  })
}

export async function createCustomerInventoryBatch(
  payload: CreateCustomerInventoryBatchPayload
) {
  if (!isTauriRuntime()) {
    syncBrowserFallbackCustomerInventoryFromStorage()
    const customerId = payload.customerId.trim()
    const historicalOrderRef = payload.historicalOrderRef.trim()
    const note = payload.note.trim()
    const normalizedItems =
      normalizeBrowserFallbackCustomerInventoryBatchItems(payload.items)

    if (!customerId) {
      throw new Error("请选择客户")
    }

    const historicalOrderDate =
      normalizeBrowserFallbackCustomerInventoryHistoricalOrderDate(
        payload.historicalOrderDate
      )

    if (payload.aluminumIngotPriceX100 <= 0) {
      throw new Error("铝锭价必须大于 0")
    }

    if (normalizedItems.length === 0) {
      throw new Error("请至少添加一项客户库存")
    }

    const now = new Date().toISOString()
    const customers = loadBrowserFallbackCustomersFromStorage()
    const products = loadBrowserFallbackProductsFromStorage()
    const customer = customers.find((item) => item.id === customerId)

    if (!customer) {
      throw new Error("客户不存在")
    }

    validateBrowserFallbackCustomerInventoryBatchItems(
      normalizedItems,
      customerId,
      products
    )
    validateBrowserFallbackCustomerInventoryBatchProcessingFees({
      ...payload,
      items: normalizedItems,
    })

    const batchId = getNextBrowserFallbackCustomerInventoryBatchId({
      ...payload,
      historicalOrderDate,
    })
    const items = resolveBrowserFallbackCustomerInventoryStockItems({
      batchId,
      items: normalizedItems,
      now,
      products,
    })
    const batch: CustomerInventoryBatch = {
      aluminumIngotPriceX100: payload.aluminumIngotPriceX100,
      billetProcessingFeeX100: payload.billetProcessingFeeX100,
      bridgeProcessingFeeX100: payload.bridgeProcessingFeeX100,
      createdAt: now,
      customerAddress: customer.customerAddress,
      customerId: customer.id,
      customerName: customer.customerName,
      deliveryNoteId: null,
      deliveryNoteIds: [],
      electrophoresisProcessingFeeX100: payload.electrophoresisProcessingFeeX100,
      hasDeliveryNote: false,
      historicalOrderDate,
      historicalOrderRef,
      id: batchId,
      itemCount: items.length,
      items,
      note,
      oxidationProcessingFeeX100: payload.oxidationProcessingFeeX100,
      powderProcessingFeeX100: payload.powderProcessingFeeX100,
      pricingTaxIncluded: payload.pricingTaxIncluded,
      sourceOrderId: null,
      totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
      updatedAt: now,
    }

    browserFallbackCustomerInventoryBatches.unshift(batch)
    browserFallbackCustomerInventoryMovements.unshift(
      ...createBrowserFallbackCustomerInventoryImportMovements({
        batchId,
        customer,
        items,
        note,
        now,
      })
    )
    saveBrowserFallbackCustomerInventoryToStorage()
    return
  }

  return invoke<void>("create_customer_inventory_batch", {
    payload,
  })
}

export async function parseCustomerInventoryImportFile(path: string) {
  return invoke<ParseCustomerInventoryImportResult>(
    "parse_customer_inventory_import_file",
    { path }
  )
}

export async function importCustomerInventoryBatches(
  rows: ParsedCustomerInventoryImportRow[]
) {
  if (!isTauriRuntime()) {
    syncBrowserFallbackCustomerInventoryFromStorage()
    const originalBatches = browserFallbackCustomerInventoryBatches.map(
      cloneBrowserFallbackCustomerInventoryBatch
    )
    const originalMovements = browserFallbackCustomerInventoryMovements.map(
      (movement) => ({ ...movement })
    )

    try {
      const payloads = buildBrowserFallbackCustomerInventoryImportPayloads(rows)
      const batchIds: string[] = []

      for (const payload of payloads) {
        await createCustomerInventoryBatch(payload)
        const batchId = browserFallbackCustomerInventoryBatches[0]?.id

        if (!batchId) {
          throw new Error("客户库存批量导入失败")
        }

        batchIds.push(batchId)
      }

      return {
        batchCount: batchIds.length,
        batchIds,
        itemCount: rows.length,
        totalQuantity: rows.reduce((total, row) => total + row.quantity, 0),
      } satisfies ImportCustomerInventoryResult
    } catch (error) {
      browserFallbackCustomerInventoryBatches.length = 0
      browserFallbackCustomerInventoryBatches.push(...originalBatches)
      browserFallbackCustomerInventoryMovements.length = 0
      browserFallbackCustomerInventoryMovements.push(...originalMovements)
      saveBrowserFallbackCustomerInventoryToStorage()
      throw error
    }
  }

  return invoke<ImportCustomerInventoryResult>(
    "import_customer_inventory_batches",
    { rows }
  )
}

function buildBrowserFallbackCustomerInventoryImportPayloads(
  rows: ParsedCustomerInventoryImportRow[]
) {
  if (rows.length === 0) {
    throw new Error("没有可导入的客户库存")
  }

  const customers = loadBrowserFallbackCustomersFromStorage()
  const products = loadBrowserFallbackProductsFromStorage()
  const groups = new Map<string, ParsedCustomerInventoryImportRow[]>()

  for (const row of rows) {
    const batchKey = row.batchKey.trim()

    if (!batchKey) {
      throw new Error(`第 ${row.rowNumber} 行：导入批次标识不能为空`)
    }

    const groupRows = groups.get(batchKey)

    if (groupRows) {
      groupRows.push(row)
    } else {
      groups.set(batchKey, [row])
    }
  }

  return [...groups.entries()].map(([batchKey, groupRows]) => {
    const first = groupRows[0]

    for (const row of groupRows.slice(1)) {
      if (!isSameBrowserFallbackCustomerInventoryImportBatch(first, row)) {
        throw new Error(
          `第 ${row.rowNumber} 行：批次 ${batchKey} 的客户、日期、价格或批次备注与同批次前一行不一致`
        )
      }
    }

    const customer = customers.find(
      (candidate) => candidate.customerName === first.customerName.trim()
    )

    if (!customer) {
      throw new Error(
        `第 ${first.rowNumber} 行：客户不存在：${first.customerName}`
      )
    }

    const detailKeys = new Set<string>()
    const items = groupRows.map((row) => {
      const product = products.find(
        (candidate) =>
          candidate.productName === row.productName.trim() &&
          candidate.moldCode === row.moldCode.trim() &&
          candidate.assignedCustomerIds.includes(customer.id)
      )

      if (!product) {
        throw new Error(
          `第 ${row.rowNumber} 行：商品与模具编号不匹配，或商品未分配给客户：${row.productName} / ${row.moldCode}`
        )
      }

      const detailKey = `${product.id}:${row.lengthMm}:${row.color.trim()}`

      if (detailKeys.has(detailKey)) {
        throw new Error(
          `第 ${row.rowNumber} 行：批次 ${batchKey} 内商品、长度和颜色重复`
        )
      }

      detailKeys.add(detailKey)
      return {
        color: row.color.trim(),
        lengthMm: row.lengthMm,
        note: row.itemNote.trim(),
        productId: product.id,
        quantity: row.quantity,
      }
    })
    const payload = {
      aluminumIngotPriceX100: first.aluminumIngotPriceX100,
      billetProcessingFeeX100: first.billetProcessingFeeX100,
      bridgeProcessingFeeX100: first.bridgeProcessingFeeX100,
      customerId: customer.id,
      electrophoresisProcessingFeeX100:
        first.electrophoresisProcessingFeeX100,
      historicalOrderDate: first.historicalOrderDate,
      historicalOrderRef: first.historicalOrderRef.trim(),
      items,
      note: first.batchNote.trim(),
      oxidationProcessingFeeX100: first.oxidationProcessingFeeX100,
      powderProcessingFeeX100: first.powderProcessingFeeX100,
      pricingTaxIncluded: first.pricingTaxIncluded,
    } satisfies CreateCustomerInventoryBatchPayload

    validateBrowserFallbackCustomerInventoryBatchItems(
      items,
      customer.id,
      products
    )
    validateBrowserFallbackCustomerInventoryBatchProcessingFees(payload)
    return payload
  })
}

function isSameBrowserFallbackCustomerInventoryImportBatch(
  left: ParsedCustomerInventoryImportRow,
  right: ParsedCustomerInventoryImportRow
) {
  return (
    left.customerName.trim() === right.customerName.trim() &&
    left.historicalOrderDate === right.historicalOrderDate &&
    left.historicalOrderRef.trim() === right.historicalOrderRef.trim() &&
    left.aluminumIngotPriceX100 === right.aluminumIngotPriceX100 &&
    left.pricingTaxIncluded === right.pricingTaxIncluded &&
    left.bridgeProcessingFeeX100 === right.bridgeProcessingFeeX100 &&
    left.powderProcessingFeeX100 === right.powderProcessingFeeX100 &&
    left.billetProcessingFeeX100 === right.billetProcessingFeeX100 &&
    left.oxidationProcessingFeeX100 === right.oxidationProcessingFeeX100 &&
    left.electrophoresisProcessingFeeX100 ===
      right.electrophoresisProcessingFeeX100 &&
    left.batchNote.trim() === right.batchNote.trim()
  )
}

export async function updateCustomerInventoryBatch(
  payload: UpdateCustomerInventoryBatchPayload
) {
  if (!isTauriRuntime()) {
    syncBrowserFallbackCustomerInventoryFromStorage()
    const batchId = payload.batchId.trim()
    const customerId = payload.customerId.trim()
    const historicalOrderRef = payload.historicalOrderRef.trim()
    const note = payload.note.trim()
    const normalizedItems =
      normalizeBrowserFallbackCustomerInventoryBatchItems(payload.items)

    if (!batchId) {
      throw new Error("请选择客户库存批次")
    }

    if (!customerId) {
      throw new Error("请选择客户")
    }

    const historicalOrderDate =
      normalizeBrowserFallbackCustomerInventoryHistoricalOrderDate(
        payload.historicalOrderDate
      )

    if (payload.aluminumIngotPriceX100 <= 0) {
      throw new Error("铝锭价必须大于 0")
    }

    if (normalizedItems.length === 0) {
      throw new Error("请至少添加一项客户库存")
    }

    const batchIndex = browserFallbackCustomerInventoryBatches.findIndex(
      (item) => item.id === batchId
    )

    if (batchIndex === -1) {
      throw new Error("客户库存批次不存在")
    }

    const currentBatch = browserFallbackCustomerInventoryBatches[batchIndex]

    if (currentBatch.hasDeliveryNote) {
      throw new Error("该客户库存批次已出库，不能修改")
    }

    const now = new Date().toISOString()
    const customers = loadBrowserFallbackCustomersFromStorage()
    const products = loadBrowserFallbackProductsFromStorage()
    const customer = customers.find((item) => item.id === customerId)

    if (!customer) {
      throw new Error("客户不存在")
    }

    validateBrowserFallbackCustomerInventoryBatchItems(
      normalizedItems,
      customerId,
      products
    )
    validateBrowserFallbackCustomerInventoryBatchProcessingFees({
      ...payload,
      items: normalizedItems,
    })

    const items = resolveBrowserFallbackCustomerInventoryStockItems({
      batchId,
      existingItems: currentBatch.items,
      items: normalizedItems,
      now,
      products,
    })

    browserFallbackCustomerInventoryBatches[batchIndex] = {
      ...currentBatch,
      aluminumIngotPriceX100: payload.aluminumIngotPriceX100,
      billetProcessingFeeX100: payload.billetProcessingFeeX100,
      bridgeProcessingFeeX100: payload.bridgeProcessingFeeX100,
      customerAddress: customer.customerAddress,
      customerId: customer.id,
      customerName: customer.customerName,
      electrophoresisProcessingFeeX100: payload.electrophoresisProcessingFeeX100,
      historicalOrderDate,
      historicalOrderRef,
      itemCount: items.length,
      items,
      note,
      oxidationProcessingFeeX100: payload.oxidationProcessingFeeX100,
      powderProcessingFeeX100: payload.powderProcessingFeeX100,
      pricingTaxIncluded: payload.pricingTaxIncluded,
      totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
      updatedAt: now,
    }
    const retainedMovements = browserFallbackCustomerInventoryMovements.filter(
      (movement) =>
        movement.batchId !== batchId ||
        movement.movementType !== "historical_import"
    )
    browserFallbackCustomerInventoryMovements.length = 0
    browserFallbackCustomerInventoryMovements.push(
      ...createBrowserFallbackCustomerInventoryImportMovements({
        batchId,
        customer,
        items,
        note,
        now,
      }),
      ...retainedMovements
    )
    saveBrowserFallbackCustomerInventoryToStorage()
    return
  }

  return invoke<void>("update_customer_inventory_batch", {
    payload,
  })
}

export async function createCustomerInventoryDeliveryNote(
  payload: CreateCustomerInventoryDeliveryNotePayload
) {
  if (!isTauriRuntime()) {
    syncBrowserFallbackCustomerInventoryFromStorage()
    const handlerName = payload.handlerName.trim()
    const rawPriceGroupPayloads =
      payload.priceGroups && payload.priceGroups.length > 0
        ? payload.priceGroups
        : [
            {
              batchIds: payload.batchIds ?? (payload.batchId ? [payload.batchId] : []),
              billetWeightKgX100: payload.billetWeightKgX100,
              bridgeWeightKgX100: payload.bridgeWeightKgX100,
              electrophoresisWeightKgX100: payload.electrophoresisWeightKgX100,
              extraChargeAmountX100: payload.extraChargeAmountX100,
              extraChargeName: payload.extraChargeName,
              items: payload.items,
              oxidationWeightKgX100: payload.oxidationWeightKgX100,
              powderWeightKgX100: payload.powderWeightKgX100,
            },
          ]
    const priceGroupPayloads = rawPriceGroupPayloads.map((priceGroup) => ({
      ...priceGroup,
      batchIds: Array.from(
        new Set(
          priceGroup.batchIds
            .map((batchId) => batchId.trim())
            .filter(Boolean)
        )
      ),
      items: priceGroup.items.map((item) => ({
        ...item,
        stockId: item.stockId.trim(),
      })),
    }))
    const batchIds = Array.from(
      new Set(
        [
          payload.batchId,
          ...(payload.batchIds ?? []),
          ...priceGroupPayloads.flatMap((priceGroup) => priceGroup.batchIds),
        ]
          .map((id) => id?.trim() ?? "")
          .filter(Boolean)
      )
    )

    if (batchIds.length === 0) {
      throw new Error("请选择客户库存批次")
    }

    if (!handlerName) {
      throw new Error("请输入经手人")
    }

    if (priceGroupPayloads.every((priceGroup) => priceGroup.items.length === 0)) {
      throw new Error("请至少选择一项出库明细")
    }

    const batches = batchIds.map((batchId) => {
      const batch = browserFallbackCustomerInventoryBatches.find(
        (item) => item.id === batchId
      )

      if (!batch) {
        throw new Error("客户库存批次不存在")
      }

      return batch
    })
    const batch = batches[0]

    if (!batch) {
      throw new Error("客户库存批次不存在")
    }

    if (batches.some((item) => item.customerId !== batch.customerId)) {
      throw new Error("只能合并同一客户的库存批次")
    }

    const nowDate = new Date()
    const now = nowDate.toISOString()
    const deliveryNoteId =
      batches.length === 1
        ? getNextBrowserFallbackCustomerInventoryDeliveryNoteId(batch.id)
        : getNextBrowserFallbackMergedCustomerInventoryDeliveryNoteId(
            batch.customerName
          )
    let deliveryItemIndex = 0
    const stagedDeliveryItems: BrowserFallbackStagedCustomerDeliveryItem[] = []
    const priceGroups: DeliveryNotePriceGroup[] = priceGroupPayloads.flatMap(
      (priceGroup, priceGroupIndex) => {
        if (
          priceGroup.bridgeWeightKgX100 < 0 ||
          priceGroup.powderWeightKgX100 < 0 ||
          priceGroup.billetWeightKgX100 < 0 ||
          priceGroup.oxidationWeightKgX100 < 0 ||
          priceGroup.electrophoresisWeightKgX100 < 0
        ) {
          throw new Error("重量不能小于 0")
        }

        const groupBatchIds =
          priceGroup.batchIds.length > 0 ? priceGroup.batchIds : batchIds
        const groupBatches = groupBatchIds.map((batchId) => {
          const matchedBatch = batches.find((item) => item.id === batchId)

          if (!matchedBatch) {
            throw new Error("客户库存批次不存在")
          }

          return matchedBatch
        })
        const groupBatch = groupBatches[0]

        if (!groupBatch) {
          throw new Error("请选择客户库存批次")
        }

        if (priceGroup.items.some((item) => item.quantity < 0)) {
          throw new Error("出库数量不能小于 0")
        }

        const groupDeliveryQuantity = priceGroup.items.reduce(
          (total, item) => total + item.quantity,
          0
        )

        if (groupDeliveryQuantity <= 0) {
          return []
        }

        const priceGroupId = `${deliveryNoteId}-PG-${String(
          priceGroupIndex + 1
        ).padStart(3, "0")}`
        const groupDeliveryItems = priceGroup.items
          .filter((item) => item.quantity > 0)
          .map((item) => {
            if (!item.stockId) {
              throw new Error("出库商品不能为空")
            }

            const sourceBatch = browserFallbackCustomerInventoryBatches.find(
              (candidate) =>
                candidate.items.some((stock) => stock.id === item.stockId)
            )
            const selectedSourceBatch = groupBatches.find(
              (candidate) => candidate.id === sourceBatch?.id
            )
            const stockItem = sourceBatch?.items.find(
              (stock) => stock.id === item.stockId
            )

            if (!sourceBatch || !stockItem) {
              throw new Error("客户库存商品不存在")
            }

            if (!selectedSourceBatch) {
              throw new Error("出库明细不属于所选客户库存批次")
            }

            if (
              selectedSourceBatch.customerId !== groupBatch.customerId ||
              selectedSourceBatch.customerId !== batch.customerId
            ) {
              throw new Error("出库明细必须属于同一客户")
            }

            const groupLabel =
              item.groupLabel?.trim() ||
              deriveCustomerInventoryDeliveryGroupLabel(sourceBatch.note)

            deliveryItemIndex += 1
            const itemNote = item.note.trim()
            const deliveryItem: DeliveryNote["items"][number] = {
              color: stockItem.color,
              groupLabel,
              id: `${deliveryNoteId}-${String(deliveryItemIndex).padStart(
                3,
                "0"
              )}`,
              lengthMm: stockItem.lengthMm,
              moldCode: stockItem.moldCode,
              note: itemNote,
              orderQuantity: stockItem.quantity,
              priceGroupId,
              productId: stockItem.productId,
              productName: stockItem.productName,
              quantity: item.quantity,
              sourceBatchId: selectedSourceBatch.id,
              sourceBatchNote: selectedSourceBatch.note,
            }

            stagedDeliveryItems.push({
              deliveryItem,
              sourceBatch: selectedSourceBatch,
              stockItem,
            })

            return deliveryItem
          })

        if (groupDeliveryItems.length === 0) {
          return []
        }

        if (
          groupBatches.some(
            (item) =>
              !hasSameBrowserFallbackCustomerInventoryPricing(
                item,
                groupBatch
              )
          )
        ) {
          throw new Error("合并出库的批次价格快照必须一致，请拆开出库")
        }

        validateBrowserFallbackCustomerDeliveryRequiredWeights(
          priceGroup,
          groupDeliveryItems
        )
        validateBrowserFallbackCustomerDeliveryProcessingFees(
          groupBatch,
          groupDeliveryItems
        )

        const extraCharge = normalizeBrowserFallbackDeliveryExtraCharge(
          priceGroup.extraChargeName,
          priceGroup.extraChargeAmountX100
        )
        const pricingProfile =
          resolveBrowserFallbackCustomerInventoryPricingProfile(
            groupBatch.customerId,
            groupBatch.note
          )

        return [
          {
            aluminumIngotPriceX100: groupBatch.aluminumIngotPriceX100,
            billetProcessingFeeX100: groupBatch.billetProcessingFeeX100,
            billetWeightKgX100: priceGroup.billetWeightKgX100,
            bridgeProcessingFeeX100: groupBatch.bridgeProcessingFeeX100,
            bridgeWeightKgX100: priceGroup.bridgeWeightKgX100,
            electrophoresisProcessingFeeX100:
              groupBatch.electrophoresisProcessingFeeX100,
            electrophoresisWeightKgX100:
              priceGroup.electrophoresisWeightKgX100,
            extraCharges: extraCharge.name
              ? [{ name: extraCharge.name, amountX100: extraCharge.amountX100 }]
              : [],
            id: priceGroupId,
            items: groupDeliveryItems,
            oxidationProcessingFeeX100: groupBatch.oxidationProcessingFeeX100,
            oxidationWeightKgX100: priceGroup.oxidationWeightKgX100,
            powderProcessingFeeX100: groupBatch.powderProcessingFeeX100,
            powderWeightKgX100: priceGroup.powderWeightKgX100,
            pricingProfileName: pricingProfile.profileName,
            pricingTaxIncluded: groupBatch.pricingTaxIncluded,
            pricingTriggerKeyword: pricingProfile.triggerKeyword,
            title:
              priceGroupPayloads.length > 1
                ? `计价方案${priceGroupIndex + 1}`
                : "计价方案",
          },
        ]
      }
    )
    const {
      movements: stagedDeliveryMovements,
      stockQuantities: stagedStockQuantities,
    } = stageBrowserFallbackCustomerInventoryDelivery({
      deliveryNoteId,
      items: stagedDeliveryItems,
      now,
    })
    const deliveryItems = priceGroups.flatMap((priceGroup) => priceGroup.items)

    if (deliveryItems.length === 0) {
      throw new Error("请至少录入一项出库数量")
    }

    const firstPriceGroup = priceGroups[0]

    if (!firstPriceGroup) {
      throw new Error("请至少录入一项出库数量")
    }

    const note: DeliveryNote = {
      aluminumIngotPriceX100: firstPriceGroup.aluminumIngotPriceX100,
      billetProcessingFeeX100: firstPriceGroup.billetProcessingFeeX100,
      billetWeightKgX100: firstPriceGroup.billetWeightKgX100,
      bridgeProcessingFeeX100: firstPriceGroup.bridgeProcessingFeeX100,
      bridgeWeightKgX100: firstPriceGroup.bridgeWeightKgX100,
      createdAt: now,
      customerAddress: batch.customerAddress,
      customerName: batch.customerName,
      deliveryDate: formatDateInputValue(nowDate),
      electrophoresisProcessingFeeX100:
        firstPriceGroup.electrophoresisProcessingFeeX100,
      electrophoresisWeightKgX100: firstPriceGroup.electrophoresisWeightKgX100,
      extraCharges: firstPriceGroup.extraCharges.map((row) => ({ ...row })),
      handlerName,
      id: deliveryNoteId,
      items: deliveryItems,
      note: payload.note.trim(),
      orderId: batches.map((item) => item.id).join("、"),
      oxidationProcessingFeeX100: firstPriceGroup.oxidationProcessingFeeX100,
      oxidationWeightKgX100: firstPriceGroup.oxidationWeightKgX100,
      powderProcessingFeeX100: firstPriceGroup.powderProcessingFeeX100,
      powderWeightKgX100: firstPriceGroup.powderWeightKgX100,
      priceGroups,
      pricingProfileName: firstPriceGroup.pricingProfileName,
      pricingTaxIncluded: firstPriceGroup.pricingTaxIncluded,
      pricingTriggerKeyword: firstPriceGroup.pricingTriggerKeyword,
      specialNote: (payload.specialNote ?? "").trim(),
    }
    for (const batchId of batchIds) {
      const batchIndex = browserFallbackCustomerInventoryBatches.findIndex(
        (item) => item.id === batchId
      )
      const currentBatch = browserFallbackCustomerInventoryBatches[batchIndex]

      if (!currentBatch) {
        continue
      }

      const nextItems = currentBatch.items.map((stockItem) => {
        const stagedQuantity = stagedStockQuantities.get(stockItem.id)

        if (stagedQuantity === undefined) {
          return stockItem
        }

        return {
          ...stockItem,
          quantity: stagedQuantity,
          updatedAt: now,
        }
      })
      const deliveryNoteIds = Array.from(
        new Set([...currentBatch.deliveryNoteIds, deliveryNoteId])
      )

      browserFallbackCustomerInventoryBatches[batchIndex] = {
        ...currentBatch,
        deliveryNoteId,
        deliveryNoteIds,
        hasDeliveryNote: true,
        items: nextItems,
        totalQuantity: nextItems.reduce(
          (total, item) => total + item.quantity,
          0
        ),
        updatedAt: now,
      }
    }
    browserFallbackCustomerInventoryMovements.unshift(
      ...stagedDeliveryMovements
    )
    browserFallbackCustomerInventoryDeliveryNotes.set(deliveryNoteId, note)
    saveBrowserFallbackCustomerInventoryToStorage()
    return cloneBrowserFallbackDeliveryNote(note)
  }

  return invoke<DeliveryNote>("create_customer_inventory_delivery_note", {
    payload,
  })
}

export async function createCustomerInventoryDeliveryNotes(
  payloads: CreateCustomerInventoryDeliveryNotePayload[]
) {
  const notes: DeliveryNote[] = []

  for (const payload of payloads) {
    notes.push(await createCustomerInventoryDeliveryNote(payload))
  }

  return notes
}

export async function adjustCustomerInventoryStock(
  payload: AdjustCustomerInventoryStockPayload
) {
  if (!isTauriRuntime()) {
    syncBrowserFallbackCustomerInventoryFromStorage()
    const stockId = payload.stockId.trim()

    if (!stockId) {
      throw new Error("请选择客户库存明细")
    }

    if (payload.quantity < 0) {
      throw new Error("盘点数量不能小于 0")
    }

    const now = new Date().toISOString()

    for (const [batchIndex, batch] of browserFallbackCustomerInventoryBatches.entries()) {
      const stockIndex = batch.items.findIndex((item) => item.id === stockId)

      if (stockIndex === -1) {
        continue
      }

      const stockItem = batch.items[stockIndex]

      if (payload.quantity === stockItem.quantity) {
        throw new Error("盘点数量未变化")
      }

      const nextItems = [...batch.items]
      nextItems[stockIndex] = {
        ...stockItem,
        quantity: payload.quantity,
        updatedAt: now,
      }
      browserFallbackCustomerInventoryBatches[batchIndex] = {
        ...batch,
        items: nextItems,
        totalQuantity: nextItems.reduce((total, item) => total + item.quantity, 0),
        updatedAt: now,
      }
      browserFallbackCustomerInventoryMovements.unshift({
        batchId: batch.id,
        color: stockItem.color,
        createdAt: now,
        customerId: batch.customerId,
        customerName: batch.customerName,
        deliveryNoteId: null,
        deltaQuantity: payload.quantity - stockItem.quantity,
        id: `${batch.id}-MA-${Date.now()}`,
        lengthMm: stockItem.lengthMm,
        moldCode: stockItem.moldCode,
        movementType: "adjust",
        note: payload.note.trim() || "客户库存盘点",
        productId: stockItem.productId,
        productName: stockItem.productName,
        quantityAfter: payload.quantity,
        quantityBefore: stockItem.quantity,
        stockId: stockItem.id,
      })
      saveBrowserFallbackCustomerInventoryToStorage()
      return
    }

    throw new Error("客户库存商品不存在")
  }

  return invoke<void>("adjust_customer_inventory_stock", {
    payload,
  })
}

export async function getCustomerInventoryDeliveryNote(id: string) {
  if (!isTauriRuntime()) {
    const deliveryNoteId = id.trim()

    if (!deliveryNoteId) {
      throw new Error("出库单号不能为空")
    }

    syncBrowserFallbackCustomerInventoryFromStorage()
    const deliveryNote =
      browserFallbackCustomerInventoryDeliveryNotes.get(deliveryNoteId)

    if (!deliveryNote) {
      throw new Error("历史库存出库单不存在")
    }

    return cloneBrowserFallbackDeliveryNote(deliveryNote)
  }

  return invoke<DeliveryNote>("get_customer_inventory_delivery_note", { id })
}

export async function updateCustomerInventoryDeliveryNoteSpecialNote(
  payload: UpdateDeliveryNoteSpecialNotePayload,
) {
  if (!isTauriRuntime()) {
    const deliveryNoteId = payload.id.trim()

    if (!deliveryNoteId) {
      throw new Error("出库单号不能为空")
    }

    syncBrowserFallbackCustomerInventoryFromStorage()
    const deliveryNote =
      browserFallbackCustomerInventoryDeliveryNotes.get(deliveryNoteId)

    if (!deliveryNote) {
      throw new Error("历史库存出库单不存在")
    }

    const updatedDeliveryNote = {
      ...deliveryNote,
      specialNote: payload.specialNote.trim(),
    }

    browserFallbackCustomerInventoryDeliveryNotes.set(
      deliveryNoteId,
      updatedDeliveryNote,
    )
    saveBrowserFallbackCustomerInventoryToStorage()
    return cloneBrowserFallbackDeliveryNote(updatedDeliveryNote)
  }

  return invoke<DeliveryNote>(
    "update_customer_inventory_delivery_note_special_note",
    { payload },
  )
}
