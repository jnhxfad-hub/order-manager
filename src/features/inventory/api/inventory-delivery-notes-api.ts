import { invoke } from "@tauri-apps/api/core"
import type {
  DeliveryNote,
  InventoryMovement,
} from "@/features/inventory/types"
import type { OrderDetail } from "@/features/orders/types"
import { isTauriRuntime } from "@/lib/browser-runtime"
import { formatDateInputValue } from "@/lib/datetime"
import {
  browserFallbackInventory,
  browserFallbackDeliveryNotes,
  loadBrowserFallbackOrdersFromStorage,
  saveBrowserFallbackOrdersToStorage,
  getBrowserFallbackOrderInventoryStockKey,
  loadBrowserFallbackOrderInventoryStocksFromStorage,
  saveBrowserFallbackOrderInventoryStocksToStorage,
  saveBrowserFallbackInventoryToStorage,
  createBrowserFallbackInventoryMovement,
  syncBrowserFallbackDeliveryNotesFromStorage,
  cloneBrowserFallbackDeliveryNote,
  cloneBrowserFallbackOrderDetail,
  saveBrowserFallbackDeliveryNotesToStorage,
  resolveBrowserFallbackDeliveryPricing,
  validateBrowserFallbackDeliveryProcessingFees,
  getBrowserFallbackRequiredDeliveryWeights,
  validateBrowserFallbackDeliveryWeightValues,
  validateBrowserFallbackDeliveryItems,
  getNextBrowserFallbackOrderDeliveryNoteId,
  syncBrowserFallbackOrderInventoryFromStorage,
} from "./inventory-browser-fallback"
import type {
  UpdateDeliveryNoteSpecialNotePayload,
  CreateDeliveryNotePayload,
} from "./inventory-api-types"

export async function createDeliveryNote(payload: CreateDeliveryNotePayload) {
  if (!isTauriRuntime()) {
    const orderId = payload.orderId.trim()
    const items = payload.items.map((item) => ({
      ...item,
      color: item.color.trim(),
      note: item.note.trim(),
      productId: item.productId.trim(),
    }))
    const extraCharges = payload.extraCharges.map((row) => {
      if (row.amountX100 < 0) throw new Error("收费金额不能小于 0")
      if (!row.name.trim()) throw new Error("请填写收费名称")
      if (!Number.isSafeInteger(row.amountX100) || row.amountX100 <= 0) {
        throw new Error("收费金额必须大于 0")
      }
      return { name: row.name.trim(), amountX100: row.amountX100 }
    })
    const totalChargesX100 = extraCharges.reduce((total, row) => total + row.amountX100, 0)
    if (!Number.isSafeInteger(totalChargesX100)) {
      throw new Error("其他费用合计超出允许范围")
    }

    if (!orderId) {
      throw new Error("请选择订单")
    }

    if (items.length === 0) {
      throw new Error("请至少选择一项出库明细")
    }

    if (
      payload.bridgeWeightKgX100 < 0 ||
      payload.powderWeightKgX100 < 0 ||
      payload.billetWeightKgX100 < 0 ||
      payload.oxidationWeightKgX100 < 0 ||
      payload.electrophoresisWeightKgX100 < 0
    ) {
      throw new Error("重量不能小于 0")
    }

    syncBrowserFallbackDeliveryNotesFromStorage()
    syncBrowserFallbackOrderInventoryFromStorage()
    const nowDate = new Date()
    const now = nowDate.toISOString()
    const order = loadBrowserFallbackOrdersFromStorage().find(
      (item) => item.id === orderId
    )

    if (!order || order.status !== "ordered") {
      throw new Error("订单不存在或未下单")
    }

    if (order.inventoryClosedAt) {
      throw new Error("该订单库存已完结，不能继续出库")
    }

    const deliveryNoteId = getNextBrowserFallbackOrderDeliveryNoteId(orderId)

    const requiredWeights = getBrowserFallbackRequiredDeliveryWeights(items)
    const pricing = resolveBrowserFallbackDeliveryPricing(
      order,
      payload.pricingTaxIncluded
    )
    validateBrowserFallbackDeliveryProcessingFees(
      requiredWeights,
      pricing.processingFees,
      payload.pricingTaxIncluded
    )

    const currentOrderQuantity = browserFallbackInventory.orderItems
      .filter((item) => item.orderId === orderId)
      .reduce((total, item) => total + item.orderQuantity, 0)
    const deliveryQuantity = items.reduce((total, item) => {
      if (item.quantity < 0) {
        throw new Error("出库数量不能小于 0")
      }

      return total + item.quantity
    }, 0)

    if (currentOrderQuantity <= 0) {
      throw new Error("当前订单没有可出库库存")
    }

    if (deliveryQuantity <= 0) {
      throw new Error("请至少录入一项出库数量")
    }

    if (deliveryQuantity > currentOrderQuantity) {
      throw new Error("出库数量不能大于当前订单库存")
    }

    validateBrowserFallbackDeliveryWeightValues(requiredWeights, payload)
    validateBrowserFallbackDeliveryItems(items)

    const stagedOrderQuantities = new Map(
      browserFallbackInventory.orderItems
        .filter((stockItem) => stockItem.orderId === orderId)
        .map((stockItem) => [
          getBrowserFallbackOrderInventoryStockKey(stockItem),
          stockItem.orderQuantity,
        ])
    )
    const resolvedItems = items.map((item) => {
      const currentStockItem = browserFallbackInventory.orderItems.find(
        (stock) =>
          stock.orderId === orderId &&
          stock.productId === item.productId &&
          stock.lengthMm === item.lengthMm &&
          stock.color === item.color
      )

      if (!currentStockItem) {
        throw new Error("订单商品不存在")
      }

      const stockKey = getBrowserFallbackOrderInventoryStockKey(currentStockItem)
      const currentQuantity = stagedOrderQuantities.get(stockKey) ?? 0

      if (item.quantity > currentQuantity) {
        throw new Error(`${currentStockItem.productName} 出库数量不能大于当前库存`)
      }

      stagedOrderQuantities.set(stockKey, currentQuantity - item.quantity)
      return {
        item,
        stockItem: { ...currentStockItem, orderQuantity: currentQuantity },
      }
    })
    const deliveryNote: DeliveryNote = {
      aluminumIngotPriceX100: order?.aluminumIngotPriceX100 ?? 2_000_000,
      billetProcessingFeeX100: pricing.processingFees.billet,
      billetWeightKgX100: payload.billetWeightKgX100,
      bridgeProcessingFeeX100: pricing.processingFees.bridge,
      bridgeWeightKgX100: payload.bridgeWeightKgX100,
      createdAt: now,
      customerAddress: order?.customerAddress ?? "",
      customerName: order?.customerName ?? "",
      deliveryDate: formatDateInputValue(nowDate),
      electrophoresisProcessingFeeX100: pricing.processingFees.electrophoresis,
      electrophoresisWeightKgX100: payload.electrophoresisWeightKgX100,
      extraCharges,
      handlerName: order?.handlerName ?? "",
      id: deliveryNoteId,
      items: resolvedItems
        .filter(({ item }) => item.quantity > 0)
        .map(({ item, stockItem }, index) => {
          return {
            color: item.color,
            id: `${deliveryNoteId}-${String(index + 1).padStart(3, "0")}`,
            lengthMm: item.lengthMm,
            moldCode: stockItem.moldCode,
            note: item.note,
            orderQuantity: stockItem.requiredQuantity,
            productId: item.productId,
            productName: stockItem.productName,
            quantity: item.quantity,
          }
        }),
      note: payload.note.trim(),
      orderId,
      oxidationProcessingFeeX100: pricing.processingFees.oxidation,
      oxidationWeightKgX100: payload.oxidationWeightKgX100,
      powderProcessingFeeX100: pricing.processingFees.powder,
      powderWeightKgX100: payload.powderWeightKgX100,
      pricingProfileName: pricing.profileName,
      pricingTaxIncluded: payload.pricingTaxIncluded,
      pricingTriggerKeyword: pricing.triggerKeyword,
      specialNote: (payload.specialNote ?? "").trim(),
    }

    const nextMovements: InventoryMovement[] = []

    resolvedItems.forEach(({ item, stockItem }) => {
      const remainingQuantity = stockItem.orderQuantity - item.quantity
      const movementNote = item.note
        ? `出库单 ${deliveryNoteId}，${item.note}`
        : `出库单 ${deliveryNoteId}`

      if (item.quantity > 0) {
        nextMovements.push(
          createBrowserFallbackInventoryMovement({
            color: item.color,
            deliveryNoteId,
            deltaQuantity: -item.quantity,
            lengthMm: item.lengthMm,
            moldCode: stockItem.moldCode,
            movementType: "ship",
            note: movementNote,
            orderId,
            productId: item.productId,
            productName: stockItem.productName,
            quantityAfter: remainingQuantity,
            quantityBefore: stockItem.orderQuantity,
          })
        )
      }

    })

    browserFallbackDeliveryNotes.set(deliveryNote.id, deliveryNote)
    saveBrowserFallbackDeliveryNotesToStorage()
    saveBrowserFallbackOrderInventoryStocksToStorage(
      loadBrowserFallbackOrderInventoryStocksFromStorage().map((stock) => {
        if (stock.orderId !== orderId) {
          return stock
        }

        return {
          ...stock,
          quantity:
            stagedOrderQuantities.get(
              getBrowserFallbackOrderInventoryStockKey(stock)
            ) ?? stock.quantity,
        }
      })
    )
    browserFallbackInventory.recentMovements.unshift(...nextMovements)
    browserFallbackInventory.orderMovements.unshift(...nextMovements)
    saveBrowserFallbackInventoryToStorage()
    const remainingOrderQuantity = Array.from(stagedOrderQuantities.values()).reduce(
      (total, quantity) => total + quantity,
      0
    )
    const orders: OrderDetail[] = loadBrowserFallbackOrdersFromStorage().map((item) =>
      item.id === orderId
        ? {
            ...item,
            deliveryNoteId: deliveryNote.id,
            deliveryNoteIds: [...item.deliveryNoteIds, deliveryNote.id],
            inventoryCloseDestination:
              remainingOrderQuantity === 0 ? ("shipped" as const) : null,
            inventoryClosedAt: remainingOrderQuantity === 0 ? now : null,
            inventoryLockedAt: item.inventoryLockedAt ?? now,
            updatedAt: now,
          }
        : item
    )
    saveBrowserFallbackOrdersToStorage(orders)
    const updatedOrder = orders.find((item) => item.id === orderId)!
    window.dispatchEvent(
      new CustomEvent("order-manager:fallback-order-upserted", {
        detail: cloneBrowserFallbackOrderDetail(updatedOrder),
      })
    )
    browserFallbackInventory.orderItems = browserFallbackInventory.orderItems.map(
      (item) =>
        item.orderId === orderId
          ? {
              ...item,
              deliveryNoteId: deliveryNote.id,
              deliveryNoteIds: [...item.deliveryNoteIds, deliveryNote.id],
              inventoryCloseDestination: updatedOrder.inventoryCloseDestination,
              inventoryClosedAt: updatedOrder.inventoryClosedAt,
              inventoryLockedAt: updatedOrder.inventoryLockedAt,
              orderQuantity:
                stagedOrderQuantities.get(
                  getBrowserFallbackOrderInventoryStockKey(item)
                ) ?? item.orderQuantity,
            }
          : item
    )
    return cloneBrowserFallbackDeliveryNote(deliveryNote)
  }

  return invoke<DeliveryNote>("create_delivery_note", { payload })
}

export async function getDeliveryNote(id: string) {
  if (!isTauriRuntime()) {
    const deliveryNoteId = id.trim()

    if (!deliveryNoteId) {
      throw new Error("出库单号不能为空")
    }

    syncBrowserFallbackDeliveryNotesFromStorage()
    const deliveryNote = browserFallbackDeliveryNotes.get(deliveryNoteId)

    if (!deliveryNote) {
      throw new Error("出库单不存在")
    }

    return cloneBrowserFallbackDeliveryNote(deliveryNote)
  }

  return invoke<DeliveryNote>("get_delivery_note", { id })
}

export async function updateDeliveryNoteSpecialNote(
  payload: UpdateDeliveryNoteSpecialNotePayload,
) {
  if (!isTauriRuntime()) {
    const deliveryNoteId = payload.id.trim()

    if (!deliveryNoteId) {
      throw new Error("出库单号不能为空")
    }

    syncBrowserFallbackDeliveryNotesFromStorage()
    const deliveryNote = browserFallbackDeliveryNotes.get(deliveryNoteId)

    if (!deliveryNote) {
      throw new Error("出库单不存在")
    }

    const updatedDeliveryNote = {
      ...deliveryNote,
      specialNote: payload.specialNote.trim(),
    }

    browserFallbackDeliveryNotes.set(deliveryNoteId, updatedDeliveryNote)
    saveBrowserFallbackDeliveryNotesToStorage()
    return cloneBrowserFallbackDeliveryNote(updatedDeliveryNote)
  }

  return invoke<DeliveryNote>("update_delivery_note_special_note", { payload })
}
