import { invoke } from "@tauri-apps/api/core"
import type {
  InventoryItem,
  InventoryListResult,
  InventoryMovement,
  OrderInventoryMovementType,
  PublicInventoryMovementType,
  RecognizedInventoryImageResult,
} from "@/features/inventory/types"
import { isTauriRuntime } from "@/lib/browser-runtime"
import {
  browserFallbackInventory,
  browserFallbackCustomerInventoryBatches,
  browserFallbackCustomerInventoryMovements,
  loadBrowserFallbackOrdersFromStorage,
  saveBrowserFallbackOrdersToStorage,
  getBrowserFallbackOrderInventoryStockKey,
  loadBrowserFallbackProductsFromStorage,
  loadBrowserFallbackOrderInventoryStocksFromStorage,
  saveBrowserFallbackOrderInventoryStocksToStorage,
  saveBrowserFallbackInventoryToStorage,
  createBrowserFallbackInventoryMovement,
  appendBrowserFallbackInventoryMovements,
  matchesBrowserFallbackInventorySearch,
  matchesBrowserFallbackOrderInventorySearch,
  matchesBrowserFallbackInventoryMovementSearch,
  cloneBrowserFallbackInventoryItem,
  cloneBrowserFallbackOrderInventoryItem,
  cloneBrowserFallbackInventoryMovement,
  sortBrowserFallbackInventoryMovements,
  ensureBrowserFallbackOrderInventoryUnlocked,
  syncBrowserFallbackCustomerInventoryFromStorage,
  saveBrowserFallbackCustomerInventoryToStorage,
  getNextBrowserFallbackCustomerInventoryBatchId,
  getBrowserFallbackCustomerInventoryStockId,
  syncBrowserFallbackOrderInventoryFromStorage,
} from "./inventory-browser-fallback"
import type {
  ListInventoryParams,
  AdjustInventoryPayload,
  AdjustOrderInventoryPayload,
  AdjustOrderInventoryBatchPayload,
  TransferPublicInventoryToOrderPayload,
  TransferOrderInventoryRemainderPayload,
  TransferOrderInventoryRemainderResult,
  CreateCustomerInventoryBatchPayload,
} from "./inventory-api-types"

export async function listInventory(params: ListInventoryParams) {
  if (!isTauriRuntime()) {
    syncBrowserFallbackOrderInventoryFromStorage()
    const search = params.search?.trim().toLowerCase() ?? ""

    return {
      items: browserFallbackInventory.items
        .filter((item) => matchesBrowserFallbackInventorySearch(item, search))
        .map(cloneBrowserFallbackInventoryItem),
      orderItems: browserFallbackInventory.orderItems
        .filter((item) =>
          matchesBrowserFallbackOrderInventorySearch(item, search)
        )
        .map(cloneBrowserFallbackOrderInventoryItem),
      orderMovements: browserFallbackInventory.orderMovements
        .sort(sortBrowserFallbackInventoryMovements)
        .map(cloneBrowserFallbackInventoryMovement),
      recentMovements: browserFallbackInventory.recentMovements
        .filter((movement) =>
          matchesBrowserFallbackInventoryMovementSearch(movement, search)
        )
        .sort(sortBrowserFallbackInventoryMovements)
        .map(cloneBrowserFallbackInventoryMovement)
        .slice(0, 50),
      totalQuantity: browserFallbackInventory.totalQuantity,
    } satisfies InventoryListResult
  }

  return invoke<InventoryListResult>("list_inventory", { params })
}

export async function adjustInventory(payload: AdjustInventoryPayload) {
  if (!isTauriRuntime()) {
    const productId = payload.productId.trim()
    const color = payload.color.trim()
    const movementType = payload.movementType.trim()

    if (!productId) {
      throw new Error("请选择商品")
    }

    if (payload.lengthMm <= 0) {
      throw new Error("长度必须大于 0")
    }

    if (!color) {
      throw new Error("颜色不能为空")
    }

    if (!["in", "out", "adjust"].includes(movementType)) {
      throw new Error("库存类型不正确")
    }

    if (
      payload.quantity < 0 ||
      (movementType !== "adjust" && payload.quantity === 0)
    ) {
      throw new Error("数量必须大于 0")
    }

    const itemIndex = browserFallbackInventory.items.findIndex(
      (item) =>
        item.productId === productId &&
        item.lengthMm === payload.lengthMm &&
        item.color === color
    )
    const item = browserFallbackInventory.items[itemIndex]
    const product = item
      ? undefined
      : loadBrowserFallbackProductsFromStorage().find(
          (productItem) => productItem.id === productId
        )

    if (!item && !product) {
      throw new Error("商品不存在")
    }

    const quantityBefore = item?.quantity ?? 0
    const quantityAfter =
      movementType === "in"
        ? quantityBefore + payload.quantity
        : movementType === "out"
          ? quantityBefore - payload.quantity
          : payload.quantity

    if (quantityAfter < 0) {
      throw new Error("出库数量不能大于当前库存")
    }

    const adjustedItem = {
      ...(item ?? {
        color,
        latestNote: "",
        lengthMm: payload.lengthMm,
        moldCode: product?.moldCode ?? "",
        productId,
        productName: product?.productName ?? "",
        quantity: 0,
        thicknessMmX100: product?.thicknessMmX100 ?? 0,
        updatedAt: null,
        weightPerMeterKgX1000: product?.weightPerMeterKgX1000 ?? 0,
      }),
      latestNote: payload.note.trim(),
      quantity: quantityAfter,
      updatedAt: quantityAfter === 0 ? null : new Date().toISOString(),
    }

    if (quantityAfter === 0) {
      if (itemIndex >= 0) {
        browserFallbackInventory.items.splice(itemIndex, 1)
      }
    } else if (itemIndex === -1) {
      browserFallbackInventory.items.push(adjustedItem)
    } else {
      browserFallbackInventory.items[itemIndex] = adjustedItem
    }
    browserFallbackInventory.totalQuantity = browserFallbackInventory.items.reduce(
      (total, inventoryItem) => total + inventoryItem.quantity,
      0
    )
    appendBrowserFallbackInventoryMovements([
      createBrowserFallbackInventoryMovement({
        color,
        deliveryNoteId: null,
        deltaQuantity: quantityAfter - quantityBefore,
        lengthMm: payload.lengthMm,
        moldCode: adjustedItem.moldCode,
        movementType: movementType as PublicInventoryMovementType,
        note: payload.note.trim(),
        orderId: null,
        productId,
        productName: adjustedItem.productName,
        quantityAfter,
        quantityBefore,
      }),
    ])

    return cloneBrowserFallbackInventoryItem(adjustedItem)
  }

  return invoke<InventoryItem>("adjust_inventory", { payload })
}

export async function adjustOrderInventory(payload: AdjustOrderInventoryPayload) {
  if (!isTauriRuntime()) {
    const orderId = payload.orderId.trim()
    const productId = payload.productId.trim()
    const color = payload.color.trim()
    const movementType = payload.movementType.trim()

    if (!orderId) {
      throw new Error("请选择订单")
    }

    if (!productId) {
      throw new Error("请选择商品")
    }

    if (payload.lengthMm <= 0) {
      throw new Error("长度必须大于 0")
    }

    if (!color) {
      throw new Error("颜色不能为空")
    }

    if (!["produce", "ship", "adjust"].includes(movementType)) {
      throw new Error("订单库存类型不正确")
    }

    if (
      payload.quantity < 0 ||
      (movementType !== "adjust" && payload.quantity === 0)
    ) {
      throw new Error("数量必须大于 0")
    }

    syncBrowserFallbackOrderInventoryFromStorage()
    ensureBrowserFallbackOrderInventoryUnlocked(orderId)
    const stockItem = browserFallbackInventory.orderItems.find(
      (item) =>
        item.orderId === orderId &&
        item.productId === productId &&
        item.lengthMm === payload.lengthMm &&
        item.color === color
    )

    if (!stockItem) {
      throw new Error("订单商品不存在")
    }

    const quantityBefore = stockItem.orderQuantity
    const quantityAfter =
      movementType === "produce"
        ? quantityBefore + payload.quantity
        : movementType === "ship"
          ? quantityBefore - payload.quantity
          : payload.quantity

    if (quantityAfter < 0) {
      throw new Error("出库数量不能大于当前订单库存")
    }

    const stockKey = getBrowserFallbackOrderInventoryStockKey({
      color,
      lengthMm: payload.lengthMm,
      orderId,
      productId,
    })
    const stockByKey = new Map(
      loadBrowserFallbackOrderInventoryStocksFromStorage().map((stock) => [
        getBrowserFallbackOrderInventoryStockKey(stock),
        stock,
      ])
    )
    stockByKey.set(stockKey, {
      color,
      lengthMm: payload.lengthMm,
      orderId,
      productId,
      quantity: quantityAfter,
    })
    saveBrowserFallbackOrderInventoryStocksToStorage(Array.from(stockByKey.values()))
    syncBrowserFallbackOrderInventoryFromStorage()
    appendBrowserFallbackInventoryMovements([
      createBrowserFallbackInventoryMovement({
        color,
        deliveryNoteId: null,
        deltaQuantity: quantityAfter - quantityBefore,
        lengthMm: payload.lengthMm,
        moldCode: stockItem.moldCode,
        movementType: movementType as OrderInventoryMovementType,
        note: payload.note.trim(),
        orderId,
        productId,
        productName: stockItem.productName,
        quantityAfter,
        quantityBefore,
      }),
    ])

    return
  }

  return invoke<void>("adjust_order_inventory", { payload })
}

export async function adjustOrderInventoryBatch(
  payload: AdjustOrderInventoryBatchPayload
) {
  if (!isTauriRuntime()) {
    const orderId = payload.orderId.trim()
    const items = payload.items.map((item) => ({
      ...item,
      color: item.color.trim(),
      productId: item.productId.trim(),
    }))

    if (!orderId) {
      throw new Error("请选择订单")
    }

    if (items.length === 0) {
      throw new Error("请至少录入一项入库数量")
    }

    for (const item of items) {
      if (!item.productId) {
        throw new Error("订单商品不能为空")
      }

      if (item.lengthMm <= 0) {
        throw new Error("长度必须大于 0")
      }

      if (!item.color) {
        throw new Error("颜色不能为空")
      }

      if (item.quantity <= 0) {
        throw new Error("入库数量必须大于 0")
      }
    }

    syncBrowserFallbackOrderInventoryFromStorage()
    ensureBrowserFallbackOrderInventoryUnlocked(orderId)
    const currentStocks = loadBrowserFallbackOrderInventoryStocksFromStorage()
    const stockByKey = new Map(
      currentStocks.map((stock) => [
        getBrowserFallbackOrderInventoryStockKey(stock),
        stock,
      ])
    )
    const nextMovements: InventoryMovement[] = []

    for (const item of items) {
      const orderItem = browserFallbackInventory.orderItems.find(
        (stockItem) =>
          stockItem.orderId === orderId &&
          stockItem.productId === item.productId &&
          stockItem.lengthMm === item.lengthMm &&
          stockItem.color === item.color
      )

      if (!orderItem) {
        throw new Error("订单商品不存在")
      }

      const stockKey = getBrowserFallbackOrderInventoryStockKey({
        color: item.color,
        lengthMm: item.lengthMm,
        orderId,
        productId: item.productId,
      })
      const existingStock = stockByKey.get(stockKey)
      const currentQuantity =
        existingStock?.quantity ??
        orderItem.orderQuantity
      const quantityAfter = currentQuantity + item.quantity

      stockByKey.set(stockKey, {
        color: item.color,
        lengthMm: item.lengthMm,
        orderId,
        productId: item.productId,
        quantity: quantityAfter,
      })
      nextMovements.push(
        createBrowserFallbackInventoryMovement({
          color: item.color,
          deliveryNoteId: null,
          deltaQuantity: item.quantity,
          lengthMm: item.lengthMm,
          moldCode: orderItem.moldCode,
          movementType: "produce",
          note: payload.note.trim(),
          orderId,
          productId: item.productId,
          productName: orderItem.productName,
          quantityAfter,
          quantityBefore: currentQuantity,
        })
      )
    }

    saveBrowserFallbackOrderInventoryStocksToStorage(
      Array.from(stockByKey.values())
    )
    syncBrowserFallbackOrderInventoryFromStorage()
    appendBrowserFallbackInventoryMovements(nextMovements)
    return
  }

  return invoke<void>("adjust_order_inventory_batch", { payload })
}

export async function recognizeInventoryImage(
  path: string,
  rotationDegrees = 0
) {
  if (!isTauriRuntime()) {
    throw new Error("请在桌面应用中识别入库图片")
  }

  return invoke<RecognizedInventoryImageResult>("recognize_inventory_image", {
    payload: { path, rotationDegrees },
  })
}

export async function readInventoryImagePreview(path: string) {
  if (!isTauriRuntime()) {
    throw new Error("请在桌面应用中预览入库图片")
  }

  return invoke<string>("read_inventory_image_preview", {
    payload: { path },
  })
}

export async function transferPublicInventoryToOrder(
  payload: TransferPublicInventoryToOrderPayload
) {
  if (!isTauriRuntime()) {
    const orderId = payload.orderId.trim()
    const productId = payload.productId.trim()
    const color = payload.color.trim()

    if (!orderId) {
      throw new Error("请选择订单")
    }

    if (!productId) {
      throw new Error("请选择商品")
    }

    if (payload.lengthMm <= 0) {
      throw new Error("长度必须大于 0")
    }

    if (!color) {
      throw new Error("颜色不能为空")
    }

    if (payload.quantity <= 0) {
      throw new Error("转入数量必须大于 0")
    }

    syncBrowserFallbackOrderInventoryFromStorage()
    ensureBrowserFallbackOrderInventoryUnlocked(orderId)
    const orderStockItem = browserFallbackInventory.orderItems.find(
      (item) =>
        item.orderId === orderId &&
        item.productId === productId &&
        item.lengthMm === payload.lengthMm &&
        item.color === color
    )

    if (!orderStockItem) {
      throw new Error("订单商品不存在")
    }

    const publicItemIndex = browserFallbackInventory.items.findIndex(
      (item) =>
        item.productId === productId &&
        item.lengthMm === payload.lengthMm &&
        item.color === color
    )
    const publicItem = browserFallbackInventory.items[publicItemIndex]
    const publicQuantityBefore = publicItem?.quantity ?? 0

    if (publicQuantityBefore < payload.quantity) {
      throw new Error("转入数量不能大于公共库存")
    }

    const publicQuantityAfter = publicQuantityBefore - payload.quantity
    const orderQuantityBefore = orderStockItem.orderQuantity
    const orderQuantityAfter = orderQuantityBefore + payload.quantity

    if (publicQuantityAfter === 0) {
      browserFallbackInventory.items.splice(publicItemIndex, 1)
    } else {
      browserFallbackInventory.items[publicItemIndex] = {
        ...publicItem,
        latestNote: payload.note.trim(),
        quantity: publicQuantityAfter,
        updatedAt: new Date().toISOString(),
      }
    }

    const stockKey = getBrowserFallbackOrderInventoryStockKey({
      color,
      lengthMm: payload.lengthMm,
      orderId,
      productId,
    })
    const stockByKey = new Map(
      loadBrowserFallbackOrderInventoryStocksFromStorage().map((stock) => [
        getBrowserFallbackOrderInventoryStockKey(stock),
        stock,
      ])
    )
    stockByKey.set(stockKey, {
      color,
      lengthMm: payload.lengthMm,
      orderId,
      productId,
      quantity: orderQuantityAfter,
    })
    saveBrowserFallbackOrderInventoryStocksToStorage(Array.from(stockByKey.values()))
    browserFallbackInventory.totalQuantity = browserFallbackInventory.items.reduce(
      (total, item) => total + item.quantity,
      0
    )
    appendBrowserFallbackInventoryMovements([
      createBrowserFallbackInventoryMovement({
        color,
        deliveryNoteId: null,
        deltaQuantity: -payload.quantity,
        lengthMm: payload.lengthMm,
        moldCode: orderStockItem.moldCode,
        movementType: "transfer_public",
        note: payload.note.trim(),
        orderId,
        productId,
        productName: orderStockItem.productName,
        quantityAfter: publicQuantityAfter,
        quantityBefore: publicQuantityBefore,
      }),
      createBrowserFallbackInventoryMovement({
        color,
        deliveryNoteId: null,
        deltaQuantity: payload.quantity,
        lengthMm: payload.lengthMm,
        moldCode: orderStockItem.moldCode,
        movementType: "transfer_public",
        note: payload.note.trim(),
        orderId,
        productId,
        productName: orderStockItem.productName,
        quantityAfter: orderQuantityAfter,
        quantityBefore: orderQuantityBefore,
      }),
    ])
    syncBrowserFallbackOrderInventoryFromStorage()

    return
  }

  return invoke<void>("transfer_public_inventory_to_order", { payload })
}

export async function transferOrderInventoryRemainder(
  payload: TransferOrderInventoryRemainderPayload
) {
  if (!isTauriRuntime()) {
    const orderId = payload.orderId.trim()
    if (!orderId) throw new Error("请选择订单")
    if (!(["public", "customer"] as const).includes(payload.destination)) {
      throw new Error("请选择剩余库存去向")
    }

    syncBrowserFallbackOrderInventoryFromStorage()
    syncBrowserFallbackCustomerInventoryFromStorage()
    const orders = loadBrowserFallbackOrdersFromStorage()
    const order = orders.find((item) => item.id === orderId)
    if (!order || order.status !== "ordered") throw new Error("订单不存在或未下单")
    if (!order.inventoryLockedAt) throw new Error("订单首次出库后才能处理剩余库存")
    if (order.inventoryClosedAt) throw new Error("该订单库存已完结")
    const stockItems = browserFallbackInventory.orderItems.filter(
      (item) => item.orderId === orderId && item.orderQuantity > 0
    )
    const totalQuantity = stockItems.reduce(
      (total, item) => total + item.orderQuantity,
      0
    )
    if (totalQuantity <= 0) throw new Error("当前订单没有剩余库存")

    const now = new Date().toISOString()
    const note = payload.note.trim() || `订单 ${orderId} 剩余库存转入`
    const movements: InventoryMovement[] = []
    let customerInventoryBatchId: string | null = null

    if (payload.destination === "public") {
      for (const stock of stockItems) {
        const publicIndex = browserFallbackInventory.items.findIndex(
          (item) =>
            item.productId === stock.productId &&
            item.lengthMm === stock.lengthMm &&
            item.color === stock.color
        )
        const publicBefore =
          publicIndex >= 0 ? browserFallbackInventory.items[publicIndex].quantity : 0
        const publicAfter = publicBefore + stock.orderQuantity
        if (publicIndex >= 0) {
          browserFallbackInventory.items[publicIndex] = {
            ...browserFallbackInventory.items[publicIndex],
            latestNote: note,
            quantity: publicAfter,
            updatedAt: now,
          }
        } else {
          const detail = order.items.find(
            (item) =>
              item.productId === stock.productId &&
              item.lengthMm === stock.lengthMm &&
              item.color === stock.color
          )
          browserFallbackInventory.items.push({
            color: stock.color,
            latestNote: note,
            lengthMm: stock.lengthMm,
            moldCode: stock.moldCode,
            productId: stock.productId,
            productName: stock.productName,
            quantity: publicAfter,
            thicknessMmX100: detail?.thicknessMmX100 ?? 0,
            updatedAt: now,
            weightPerMeterKgX1000: detail?.weightPerMeterKgX1000 ?? 0,
          })
        }
        movements.push(
          createBrowserFallbackInventoryMovement({
            color: stock.color,
            deliveryNoteId: null,
            deltaQuantity: -stock.orderQuantity,
            lengthMm: stock.lengthMm,
            moldCode: stock.moldCode,
            movementType: "transfer_public",
            note,
            orderId,
            productId: stock.productId,
            productName: stock.productName,
            quantityAfter: 0,
            quantityBefore: stock.orderQuantity,
          }),
          createBrowserFallbackInventoryMovement({
            color: stock.color,
            deliveryNoteId: null,
            deltaQuantity: stock.orderQuantity,
            lengthMm: stock.lengthMm,
            moldCode: stock.moldCode,
            movementType: "transfer_public",
            note,
            orderId,
            productId: stock.productId,
            productName: stock.productName,
            quantityAfter: publicAfter,
            quantityBefore: publicBefore,
          })
        )
      }
    } else {
      if (!order.customerId) throw new Error("订单客户不存在")
      const batchPayload: CreateCustomerInventoryBatchPayload = {
        aluminumIngotPriceX100: order.aluminumIngotPriceX100,
        billetProcessingFeeX100: order.billetProcessingFeeX100,
        bridgeProcessingFeeX100: order.bridgeProcessingFeeX100,
        customerId: order.customerId,
        electrophoresisProcessingFeeX100: order.electrophoresisProcessingFeeX100,
        historicalOrderDate: order.orderedDate,
        historicalOrderRef: orderId,
        items: stockItems.map((stock) => ({
          color: stock.color,
          lengthMm: stock.lengthMm,
          note: stock.note,
          productId: stock.productId,
          quantity: stock.orderQuantity,
        })),
        note: order.note ?? "",
        oxidationProcessingFeeX100: order.oxidationProcessingFeeX100,
        powderProcessingFeeX100: order.powderProcessingFeeX100,
        pricingTaxIncluded: order.pricingTaxIncluded,
      }
      customerInventoryBatchId = getNextBrowserFallbackCustomerInventoryBatchId(batchPayload)
      const batchItems = stockItems.map((stock, index) => ({
        batchId: customerInventoryBatchId!,
        color: stock.color,
        id: getBrowserFallbackCustomerInventoryStockId(
          customerInventoryBatchId!,
          index
        ),
        lengthMm: stock.lengthMm,
        moldCode: stock.moldCode,
        note: stock.note,
        productId: stock.productId,
        productName: stock.productName,
        quantity: stock.orderQuantity,
        updatedAt: now,
      }))
      browserFallbackCustomerInventoryBatches.unshift({
        ...batchPayload,
        createdAt: now,
        customerAddress: order.customerAddress,
        customerName: order.customerName,
        deliveryNoteId: null,
        deliveryNoteIds: [],
        hasDeliveryNote: false,
        id: customerInventoryBatchId,
        itemCount: batchItems.length,
        items: batchItems,
        sourceOrderId: orderId,
        totalQuantity,
        updatedAt: now,
      })
      browserFallbackCustomerInventoryMovements.unshift(
        ...batchItems.map((item, index) => ({
          batchId: customerInventoryBatchId,
          color: item.color,
          createdAt: now,
          customerId: order.customerId,
          customerName: order.customerName,
          deliveryNoteId: null,
          deltaQuantity: item.quantity,
          id: `${customerInventoryBatchId}-MO-${String(index + 1).padStart(3, "0")}`,
          lengthMm: item.lengthMm,
          moldCode: item.moldCode,
          movementType: "transfer_order" as const,
          note,
          productId: item.productId,
          productName: item.productName,
          quantityAfter: item.quantity,
          quantityBefore: 0,
          stockId: item.id,
        }))
      )
      movements.push(
        ...stockItems.map((stock) =>
          createBrowserFallbackInventoryMovement({
            color: stock.color,
            deliveryNoteId: null,
            deltaQuantity: -stock.orderQuantity,
            lengthMm: stock.lengthMm,
            moldCode: stock.moldCode,
            movementType: "transfer_customer",
            note,
            orderId,
            productId: stock.productId,
            productName: stock.productName,
            quantityAfter: 0,
            quantityBefore: stock.orderQuantity,
          })
        )
      )
      saveBrowserFallbackCustomerInventoryToStorage()
    }

    saveBrowserFallbackOrderInventoryStocksToStorage(
      loadBrowserFallbackOrderInventoryStocksFromStorage().map((stock) =>
        stock.orderId === orderId ? { ...stock, quantity: 0 } : stock
      )
    )
    browserFallbackInventory.recentMovements.unshift(...movements)
    browserFallbackInventory.orderMovements.unshift(...movements)
    const updatedOrders = orders.map((item) =>
      item.id === orderId
        ? {
            ...item,
            inventoryCloseDestination: payload.destination,
            inventoryClosedAt: now,
            updatedAt: now,
          }
        : item
    )
    saveBrowserFallbackOrdersToStorage(updatedOrders)
    saveBrowserFallbackInventoryToStorage()
    syncBrowserFallbackOrderInventoryFromStorage()

    return { customerInventoryBatchId, destination: payload.destination, totalQuantity }
  }

  return invoke<TransferOrderInventoryRemainderResult>(
    "transfer_order_inventory_remainder",
    { payload }
  )
}
