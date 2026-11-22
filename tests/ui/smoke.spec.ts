import { expect, test } from "@playwright/test"

const fallbackStorageKeys = [
  "order-manager:fallback-customers",
  "order-manager:fallback-products",
  "order-manager:fallback-customer-products",
  "order-manager:fallback-order-details",
  "order-manager:fallback-order-inventory-stocks",
  "order-manager:fallback-delivery-notes",
  "order-manager:fallback-customer-inventory-batches",
  "order-manager:fallback-customer-inventory-movements",
  "order-manager:fallback-customer-inventory-delivery-notes",
]

function customerFixture(id: string, customerName: string) {
  const now = "2026-06-23T08:00:00.000Z"

  return {
    billetProcessingFeeTaxExcludedX100: 0,
    billetProcessingFeeTaxIncludedX100: 0,
    bridgeProcessingFeeTaxExcludedX100: 0,
    bridgeProcessingFeeTaxIncludedX100: 0,
    createdAt: now,
    customerAddress: "验收地址",
    customerName,
    defaultPricingTaxIncluded: true,
    electrophoresisProcessingFeeTaxExcludedX100: 0,
    electrophoresisProcessingFeeTaxIncludedX100: 0,
    id,
    oxidationProcessingFeeTaxExcludedX100: 0,
    oxidationProcessingFeeTaxIncludedX100: 0,
    phone: "13800138000",
    powderProcessingFeeTaxExcludedX100: 0,
    powderProcessingFeeTaxIncludedX100: 100,
    specialBilletProcessingFeeTaxExcludedX100: 0,
    specialBilletProcessingFeeTaxIncludedX100: 0,
    specialBridgeProcessingFeeTaxExcludedX100: 0,
    specialBridgeProcessingFeeTaxIncludedX100: 0,
    specialElectrophoresisProcessingFeeTaxExcludedX100: 0,
    specialElectrophoresisProcessingFeeTaxIncludedX100: 0,
    specialOxidationProcessingFeeTaxExcludedX100: 0,
    specialOxidationProcessingFeeTaxIncludedX100: 0,
    specialPowderProcessingFeeTaxExcludedX100: 0,
    specialPowderProcessingFeeTaxIncludedX100: 0,
    specialPricingKeyword: "",
    updatedAt: now,
  }
}

function productFixture(
  index: number,
  productName = `导入样例商品 ${String(index).padStart(2, "0")}`
) {
  return {
    assignedCustomerIds: [],
    assignedCustomerNames: [],
    id: `product-${String(index).padStart(2, "0")}`,
    moldCode: `M-${String(index).padStart(3, "0")}`,
    productName,
    thicknessMmX100: 120,
    weightPerMeterKgX1000: 2500,
  }
}

function orderDetailFixture({
  id,
  itemCount,
  productNamePrefix,
  status = "saved",
}: {
  id: string
  itemCount: number
  productNamePrefix: string
  status?: "saved" | "ordered"
}) {
  const items = Array.from({ length: itemCount }, (_, index) => {
    const itemNumber = index + 1
    const lengthMm = 3000 + itemNumber

    return {
      color: "灰色",
      id: `${id}-${String(itemNumber).padStart(3, "0")}`,
      lengthMm,
      note: `第 ${itemNumber} 行`,
      orderId: id,
      productId: `print-product-${itemNumber}`,
      productMoldCode: `P-${String(itemNumber).padStart(3, "0")}`,
      productName: `${productNamePrefix} ${String(itemNumber).padStart(2, "0")}`,
      quantity: 1,
      theoreticalWeightKgX100: Math.round(lengthMm * 2.5),
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    }
  })

  return {
    aluminumIngotPriceX100: 2000000,
    billetProcessingFeeX100: 0,
    bridgeProcessingFeeX100: 0,
    createdAt: "2026-06-23T08:00:00.000Z",
    customerAddress: "多页地址",
    customerId: "print-customer",
    customerName: "多页客户",
    deliveryNoteId: null,
    deliveryNoteIds: [],
    electrophoresisProcessingFeeX100: 0,
    handlerName: "多页经手人",
    id,
    inventoryCloseDestination: null,
    inventoryClosedAt: null,
    inventoryLockedAt: null,
    items,
    note: "多页打印备注",
    orderedDate: "2026-06-23",
    oxidationProcessingFeeX100: 0,
    powderProcessingFeeX100: 100,
    pricingTaxIncluded: true,
    status,
    totalTheoreticalWeightKgX100: items.reduce(
      (total, item) => total + item.theoreticalWeightKgX100,
      0
    ),
    updatedAt: "2026-06-23T08:00:00.000Z",
  }
}

async function clearFallbackStorage(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.evaluate((keys) => {
    for (const key of keys) {
      window.localStorage.removeItem(key)
    }
  }, fallbackStorageKeys)
}

test("scrolls list and detail card bodies without moving workspace controls", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 })
  await clearFallbackStorage(page)
  const orders = Array.from({ length: 40 }, (_, index) => orderDetailFixture({
    id: `ALU20260623${String(index).padStart(3, "0")}`,
    itemCount: index === 0 ? 40 : 1,
    productNamePrefix: "滚动验收",
    status: "ordered",
  }))
  await seedFallbackStorage(page, { "order-manager:fallback-order-details": orders })
  await page.goto("/")
  const listBody = page.locator('.workspace-card > [data-slot="table-container"]')
  await expect(page.getByRole("button", { exact: true, name: "查看订单" })).toHaveCount(40)
  const toolbar = page.getByRole("button", { exact: true, name: "新建订单" }).first()
  const before = await toolbar.boundingBox()
  await listBody.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => listBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await toolbar.boundingBox()).toEqual(before)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(900)
  await page.goto(`/orders/${orders[0].id}`)
  const detailBody = page.locator('.order-details > [data-slot="table-container"]')
  await expect(page.locator('[data-order-field="note"]')).toHaveCount(40)
  const action = page.getByRole("button", { name: "返回订单列表" })
  const actionBefore = await action.boundingBox()
  await detailBody.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => detailBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await action.boundingBox()).toEqual(actionBefore)
  await expect(page.locator('[data-order-field="note"]').last()).toBeInViewport()
  await page.emulateMedia({ media: "print" })
  expect(await page.locator("main").evaluate((element) => getComputedStyle(element).overflow)).toBe("visible")
})

test("inserts order details above and below with focus and readonly protection", async ({ page }) => {
  await clearFallbackStorage(page)
  const order = orderDetailFixture({ id: "ALU20260623990", itemCount: 2, productNamePrefix: "插入测试" })
  const customer = customerFixture(order.customerId, order.customerName)
  const product = { ...productFixture(1, "插入商品"), assignedCustomerIds: [customer.id] }
  const orderProducts = [1, 2].map((itemNumber) => ({
    ...productFixture(itemNumber, `插入测试 ${String(itemNumber).padStart(2, "0")}`),
    assignedCustomerIds: [customer.id],
    assignedCustomerNames: [customer.customerName],
    id: `print-product-${itemNumber}`,
  }))
  await seedFallbackStorage(page, {
    "order-manager:fallback-customers": [customer],
    "order-manager:fallback-products": [product, ...orderProducts],
    "order-manager:fallback-customer-products": [
      [customer.id, [product.id, ...orderProducts.map((item) => item.id)]],
    ],
    "order-manager:fallback-order-details": [order],
  })
  await page.goto(`/orders/${order.id}`)
  const notes = page.locator('[data-order-field="note"]')
  await expect(notes).toHaveCount(2)
  await page.getByRole("button", { name: "插入明细" }).first().click()
  await page.getByRole("menuitem", { name: "上方插入" }).click()
  await expect(notes).toHaveCount(3)
  await expect(page.locator('[data-order-field="product"]').first()).toBeFocused()
  await expect(notes.nth(0)).toHaveValue("")
  await expect(notes.nth(1)).toHaveValue("第 1 行")
  await page.getByRole("button", { name: "插入明细" }).last().click()
  await page.getByRole("menuitem", { name: "下方插入" }).click()
  await expect(notes).toHaveCount(4)
  await expect(page.locator('[data-order-field="product"]').last()).toBeFocused()
  await expect(notes.nth(2)).toHaveValue("第 2 行")
  await expect(notes.nth(3)).toHaveValue("")
  await page.getByRole("button", { exact: true, name: "保存" }).click()
  await expect(page.locator('[data-order-field="product"]').first()).toHaveAttribute("aria-invalid", "true")
  await page.getByRole("button", { name: "删除明细" }).last().click()
  await page.locator('[data-order-field="product"]').first().click()
  await page.getByRole("option", { name: "插入商品" }).click()
  await page.locator('[data-order-field="lengthMm"]').first().fill("6000")
  await page.locator('[data-order-field="color"]').first().fill("灰色")
  await page.locator('[data-order-field="quantity"]').first().fill("2")
  await notes.first().fill("插入行")
  await page.getByRole("button", { exact: true, name: "保存" }).click()
  await expect.poll(() => page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem("order-manager:fallback-order-details") ?? "[]")
    return orders[0]?.items.map((item: { note: string }) => item.note)
  })).toEqual(["插入行", "第 1 行", "第 2 行"])
  // 保存成功后页面会回到订单列表（order-form-page.tsx:302），
  // 直接 reload 只会刷新列表页，所以先回到订单详情页再验证持久化。
  await page.goto(`/orders/${order.id}`)
  await expect(notes).toHaveCount(3)
  await expect(notes.first()).toHaveValue("插入行")
  await expect(notes.nth(1)).toHaveValue("第 1 行")
  await expect(notes.last()).toHaveValue("第 2 行")
  await seedFallbackStorage(page, { "order-manager:fallback-order-details": [{ ...order, status: "ordered" }] })
  await page.reload()
  await expect(page.getByRole("button", { name: "插入明细" }).first()).toBeDisabled()
  await expect(page.getByRole("button", { name: "插入明细" }).last()).toBeDisabled()
})

async function seedFallbackStorage(
  page: import("@playwright/test").Page,
  values: Record<string, unknown>
) {
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  }, values)
}

async function confirmDefaultBatchInbound(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "批量入库" }).first().click()

  const batchDialog = page.getByRole("dialog", { name: "批量入库" })

  await expect(batchDialog).toBeVisible()
  await batchDialog.getByRole("button", { name: "填入默认入库" }).click()
  await batchDialog.getByRole("button", { name: "确认入库" }).click()
  await expect(batchDialog).toHaveCount(0)
}

async function fillAllDeliveryQuantities(page: import("@playwright/test").Page) {
  const deliveryDialog = page.getByRole("dialog", { name: "新建出库单" })

  await expect(deliveryDialog).toBeVisible()
  await deliveryDialog.getByRole("button", { name: "全部出库" }).click()
}

async function expectMergedDeliverySummaryLayout(
  preview: import("@playwright/test").Locator
) {
  await expect(preview.getByText("本组应收小计")).toHaveCount(0)
  const sectionPayments = preview.locator(
    ".print-merged-delivery-note__section-payment"
  )
  await expect(sectionPayments).toHaveCount(2)
  for (const sectionPayment of await sectionPayments.all()) {
    await expect(sectionPayment).toHaveCSS("border-bottom-width", "1px")
  }
  const grandSummary = preview.locator(
    ".print-merged-delivery-note__grand-summary"
  )
  await expect(grandSummary.getByText("合并总数量")).toBeVisible()
  await expect(grandSummary.getByText("合并总重量")).toBeVisible()
  await expect(grandSummary.getByText("型材货款合计")).toBeVisible()
  await expect(grandSummary.getByText("其他费用合计")).toBeVisible()
  await expect(grandSummary).toHaveCSS("flex-wrap", "nowrap")
  const grandSummaryLayout = await grandSummary.evaluate((summary) => {
    const summaryBounds = summary.getBoundingClientRect()
    const items = Array.from(summary.children).map((item) => {
      const bounds = item.getBoundingClientRect()

      return { right: bounds.right, top: bounds.top }
    })

    return {
      fitsWithinRow: items.every(
        (item) => item.right <= summaryBounds.right + 1
      ),
      rowCount: new Set(items.map((item) => item.top)).size,
    }
  })
  expect(grandSummaryLayout).toEqual({ fitsWithinRow: true, rowCount: 1 })
}

test("can create customer, order, delivery note, and open print preview", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  await page.goto("/customers")
  await page.getByRole("button", { name: "新增客户" }).first().click()
  await page.getByLabel("客户名称").fill("冒烟客户")
  await page.locator("#powder-processing-fee-tax-included").fill("1")
  await page.locator("#default-pricing-tax-included").click()
  await page.getByRole("option", { exact: true, name: "含税" }).click()
  await page.getByRole("button", { name: "保存客户" }).click()
  await expect(page.getByText("冒烟客户")).toBeVisible()

  await page.goto("/products")
  await page.getByRole("button", { name: "新增商品" }).first().click()
  await page.getByLabel("商品名称").fill("冒烟商品")
  await page.getByLabel("模具编号").fill("M-001")
  await page.getByLabel("厚度").fill("1.20")
  await page.getByLabel("米重").fill("2.50")
  await page.getByRole("button", { name: "保存商品" }).click()
  await page.getByLabel("选择商品 冒烟商品").check()
  await page.getByRole("button", { exact: true, name: "分配客户" }).click()
  await page.locator("#assign-customer").click()
  await page.getByRole("option", { name: "冒烟客户" }).click()
  await page.getByRole("button", { name: "确认分配" }).click()
  await expect(page.getByRole("row", { name: /冒烟商品/ })).toContainText(
    "冒烟客户"
  )

  await page.goto("/orders/new")
  await page.locator('[data-order-field="customerId"]').click()
  await page.getByRole("option", { name: "冒烟客户" }).click()
  await page.locator('[data-order-field="product"]').first().click()
  await page.getByRole("option", { name: "冒烟商品" }).click()

  await page.locator('[data-order-field="handlerName"]').fill("测试经手人")
  await page.locator('[data-order-field="aluminumIngotPrice"]').fill("20000")
  await page
    .locator('[data-order-field="orderNote"]')
    .fill("特殊计价，冒烟订单备注，第二段")
  await page.locator('[data-order-field="lengthMm"]').first().fill("6000")
  await page.locator('[data-order-field="color"]').first().fill("灰色")
  await page.locator('[data-order-field="quantity"]').first().fill("1")
  await page.getByRole("button", { name: "下单" }).click()

  await expect(page.getByText("库存管理").first()).toBeVisible()
  await expect(page.getByText("当前 0 / 下单 1")).toBeVisible()
  await confirmDefaultBatchInbound(page)
  await expect(page.getByText("当前 1 / 下单 1")).toBeVisible()
  await page.getByRole("button", { name: "新建出库单" }).click()
  await expect(page.locator("#delivery-note-note")).toHaveValue(
    "冒烟订单备注，第二段"
  )
  await fillAllDeliveryQuantities(page)
  await page.locator("#delivery-powder-weight").fill("10")
  await page.getByRole("button", { name: "确认出库并预览" }).click()
  await expect(page.getByText("出库单打印预览")).toBeVisible()
  await expect(
    page
      .getByRole("dialog", { name: "出库单打印预览" })
      .getByText("冒烟订单备注，第二段")
  ).toBeVisible()
})

test("can assign imported products across pages and filter order products by customer", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const targetCustomer = customerFixture("customer-a", "分配客户")
  const otherCustomer = customerFixture("customer-b", "其他客户")
  const importedProducts = Array.from({ length: 13 }, (_, index) =>
    productFixture(index + 1)
  )
  const otherProduct = {
    ...productFixture(99, "其他客户商品"),
    assignedCustomerIds: [otherCustomer.id],
    assignedCustomerNames: [otherCustomer.customerName],
    id: "other-product",
    moldCode: "M-999",
  }

  await seedFallbackStorage(page, {
    "order-manager:fallback-customers": [targetCustomer, otherCustomer],
    "order-manager:fallback-customer-products": [
      [otherCustomer.id, [otherProduct.id]],
    ],
    "order-manager:fallback-products": [...importedProducts, otherProduct],
  })

  await page.goto("/products")
  await page.getByPlaceholder("搜索名称、模具编号").fill("导入样例")
  await page.getByLabel("每页显示条数").click()
  await page.getByRole("option", { name: "10 条" }).click()
  await expect(page.getByText("共 13 条")).toBeVisible()
  await page.getByLabel("选择当前筛选结果全部商品").check()
  await expect(page.getByText("已选择 13 条")).toBeVisible()
  await page
    .getByRole("button", { exact: true, name: "分配客户" })
    .click()
  await page.locator("#assign-customer").click()
  await page.getByRole("option", { name: targetCustomer.customerName }).click()
  await page.getByRole("button", { name: "确认分配" }).click()

  await expect(page.getByRole("row", { name: /导入样例商品 01/ })).toContainText(
    targetCustomer.customerName
  )
  await page.getByLabel("下一页").click()
  await expect(page.getByRole("row", { name: /导入样例商品 13/ })).toContainText(
    targetCustomer.customerName
  )

  await page.goto("/orders/new")
  await page.locator('[data-order-field="customerId"]').click()
  await page.getByRole("option", { name: targetCustomer.customerName }).click()
  await page.locator('[data-order-field="product"]').first().click()
  await expect(
    page.getByRole("option", { name: "导入样例商品 01" })
  ).toBeVisible()
  await expect(
    page.getByRole("option", { name: otherProduct.productName })
  ).toHaveCount(0)
})

test("can confirm batch inbound after filling default quantities", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const inboundOrder = orderDetailFixture({
    id: "ALU20260623101",
    itemCount: 1,
    productNamePrefix: "批量入库商品",
    status: "ordered",
  })

  await seedFallbackStorage(page, {
    "order-manager:fallback-order-details": [inboundOrder],
  })

  await page.goto("/inventory")
  await expect(page.getByText("当前 0 / 下单 1")).toBeVisible()
  await page.getByRole("button", { name: "批量入库" }).first().click()

  const batchDialog = page.getByRole("dialog", { name: "批量入库" })
  await expect(batchDialog).toBeVisible()
  await expect(batchDialog.locator('[data-batch-order-quantity="0"]')).toHaveValue(
    ""
  )
  await expect(batchDialog.getByRole("button", { name: "清空" })).toBeDisabled()

  await batchDialog.getByRole("button", { name: "填入默认入库" }).click()
  await expect(batchDialog.locator('[data-batch-order-quantity="0"]')).toHaveValue(
    "1"
  )
  await batchDialog.getByRole("button", { name: "确认入库" }).click()

  await expect(batchDialog).toHaveCount(0)
  await expect(page.getByText("当前 1 / 下单 1")).toBeVisible()
  await expect(page.getByText("当前库存：1")).toBeVisible()
})

test("can deliver an order twice and manually close its remainder", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const partialOrder = orderDetailFixture({
    id: "ALU20260623102",
    itemCount: 1,
    productNamePrefix: "分批出库商品",
    status: "ordered",
  })
  partialOrder.items[0]!.quantity = 5
  partialOrder.note = "无逗号订单备注"

  await seedFallbackStorage(page, {
    "order-manager:fallback-order-details": [partialOrder],
  })
  await page.goto("/inventory")
  await confirmDefaultBatchInbound(page)
  await expect(page.getByText("当前 5 / 下单 5")).toBeVisible()

  await page.getByRole("button", { name: "新建出库单" }).click()
  let deliveryDialog = page.getByRole("dialog", { name: "新建出库单" })
  await expect(deliveryDialog.locator("#delivery-note-note")).toHaveValue("")
  await deliveryDialog
    .locator('[data-delivery-note-field="quantity"]')
    .fill("2")
  await page.locator("#delivery-powder-weight").fill("10")
  await deliveryDialog.getByRole("button", { name: "确认出库并预览" }).click()
  await expect(
    page.getByRole("dialog", { name: "出库单打印预览" })
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await expect(page.getByText("当前 3 / 下单 5")).toBeVisible()
  await expect(page.getByText("部分出库 · 1 张单").first()).toBeVisible()
  await expect(page.getByRole("button", { name: "批量入库" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "新建出库单" })).toBeEnabled()

  await page.getByRole("button", { name: "新建出库单" }).click()
  deliveryDialog = page.getByRole("dialog", { name: "新建出库单" })
  await deliveryDialog
    .locator('[data-delivery-note-field="quantity"]')
    .fill("1")
  await page.locator("#delivery-powder-weight").fill("5")
  await deliveryDialog.getByRole("button", { name: "确认出库并预览" }).click()
  await expect(
    page.getByRole("dialog", { name: "出库单打印预览" })
  ).toBeVisible()
  await page.keyboard.press("Escape")

  await expect(page.getByText("当前 2 / 下单 5")).toBeVisible()
  await expect(page.getByText("部分出库 · 2 张单").first()).toBeVisible()
  await expect(
    page.getByRole("button", { name: "ALU20260623102-01" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "ALU20260623102-02" })
  ).toBeVisible()

  await page.getByRole("button", { name: "处理剩余库存" }).click()
  const remainderDialog = page.getByRole("dialog", { name: "处理剩余库存" })
  await expect(remainderDialog.getByText("当前剩余 2 支")).toBeVisible()
  await expect(
    remainderDialog.getByRole("button", { name: "转入客户库存" })
  ).toBeVisible()
  await remainderDialog.getByRole("button", { name: "转入公共库存" }).click()

  await expect(remainderDialog).toHaveCount(0)
  await expect(page.getByText("剩余已转公共库存")).toBeVisible()
  await expect(page.getByRole("button", { name: "新建出库单" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "处理剩余库存" })).toHaveCount(0)
})

test("can download customer inventory template and current positive stock export", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const customer = customerFixture("bulk-customer", "批量库存客户")
  await seedFallbackStorage(page, {
    "order-manager:fallback-customers": [customer],
    "order-manager:fallback-customer-inventory-batches": [
      {
        aluminumIngotPriceX100: 2050000,
        billetProcessingFeeX100: 0,
        bridgeProcessingFeeX100: 0,
        createdAt: "2026-07-01T08:00:00.000Z",
        customerAddress: customer.customerAddress,
        customerId: customer.id,
        customerName: customer.customerName,
        deliveryNoteId: null,
        deliveryNoteIds: [],
        electrophoresisProcessingFeeX100: 0,
        hasDeliveryNote: false,
        historicalOrderDate: "2026-07-01",
        historicalOrderRef: "BULK-001",
        id: "PLKCKH-20260701001",
        itemCount: 2,
        items: [
          {
            batchId: "PLKCKH-20260701001",
            color: "喷涂灰",
            id: "PLKCKH-20260701001-001",
            lengthMm: 6000,
            moldCode: "BULK-001",
            note: "正库存",
            productId: "bulk-product",
            productName: "批量库存商品",
            quantity: 5,
            updatedAt: "2026-07-01T08:00:00.000Z",
          },
          {
            batchId: "PLKCKH-20260701001",
            color: "喷涂白",
            id: "PLKCKH-20260701001-002",
            lengthMm: 3000,
            moldCode: "BULK-001",
            note: "零库存",
            productId: "bulk-product",
            productName: "批量库存商品",
            quantity: 0,
            updatedAt: "2026-07-01T08:00:00.000Z",
          },
        ],
        note: "批量导出批次",
        oxidationProcessingFeeX100: 0,
        powderProcessingFeeX100: 100,
        pricingTaxIncluded: true,
        sourceOrderId: null,
        totalQuantity: 5,
        updatedAt: "2026-07-01T08:00:00.000Z",
      },
    ],
  })

  await page.goto("/inventory")
  await page.getByRole("button", { exact: true, name: "客户库存" }).click()
  await expect(page.getByRole("button", { name: "下载模板" })).toBeVisible()
  await expect(page.getByRole("button", { name: "批量导出" })).toBeEnabled()
  await expect(page.getByRole("button", { name: "批量导入" })).toBeVisible()

  const templateDownloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "下载模板" }).click()
  const templateDownload = await templateDownloadPromise
  expect(templateDownload.suggestedFilename()).toBe("客户库存批量导入模板.csv")

  const exportDownloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "批量导出" }).click()
  const exportDownload = await exportDownloadPromise
  expect(exportDownload.suggestedFilename()).toBe("客户库存导出.csv")

  await page.getByRole("button", { name: "批量导入" }).click()
  const importDialog = page.getByRole("dialog", { name: "批量导入客户库存" })
  await expect(importDialog).toBeVisible()
  await importDialog.getByRole("button", { name: "选择文件" }).click()
  await expect(
    importDialog.getByText("系统文件选择器只能在 Tauri 应用窗口中使用。"),
  ).toBeVisible()
})

test("can create customer history stock, partially deliver, and reprint note", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const historyCustomer = customerFixture("history-customer", "历史库存客户")
  const historyProduct = {
    ...productFixture(88, "历史库存商品"),
    assignedCustomerIds: [historyCustomer.id],
    assignedCustomerNames: [historyCustomer.customerName],
    id: "history-product",
    moldCode: "H-001",
  }

  await seedFallbackStorage(page, {
    "order-manager:fallback-customers": [historyCustomer],
    "order-manager:fallback-customer-products": [
      [historyCustomer.id, [historyProduct.id]],
    ],
    "order-manager:fallback-products": [historyProduct],
  })

  await page.goto("/inventory")
  await page.getByRole("button", { exact: true, name: "客户库存" }).click()
  await page.getByRole("button", { name: "新增客户库存" }).first().click()

  const batchDialog = page.getByRole("dialog", { name: "新增客户历史库存" })
  await expect(batchDialog).toBeVisible()
  await batchDialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: historyCustomer.customerName }).click()
  const historicalOrderDateInput = batchDialog.locator(
    "#customer-inventory-date",
  )
  await expect(historicalOrderDateInput).toHaveAttribute("type", "date")
  await historicalOrderDateInput.fill("2026-06-20")
  await batchDialog.locator("#customer-inventory-ref").fill("OLD-001")
  await batchDialog.getByPlaceholder("0.00").first().fill("20000")
  await batchDialog
    .locator('[data-customer-inventory-field="product"]')
    .first()
    .click()
  await page.getByRole("option", { name: historyProduct.productName }).click()
  await batchDialog
    .locator('[data-customer-inventory-field="lengthMm"]')
    .first()
    .fill("6000")
  await batchDialog
    .locator('[data-customer-inventory-field="color"]')
    .first()
    .fill("灰色")
  await batchDialog.getByPlaceholder("0.00").nth(1).fill("1")
  await batchDialog
    .locator('[data-customer-inventory-field="quantity"]')
    .first()
    .fill("5")
  await batchDialog
    .locator('[data-customer-inventory-field="note"]')
    .first()
    .fill("补录明细")
  const fullBatchNote = "虎标膜，第一车，补录批次"
  await batchDialog.locator("#customer-inventory-note").fill(fullBatchNote)
  await batchDialog.getByRole("button", { name: "保存客户库存" }).click()

  await expect(batchDialog).toHaveCount(0)
  const batchRow = page.locator(
    '[data-customer-inventory-batch="KH-20260620001"]',
  )
  await expect(batchRow).toBeVisible()
  await expect(batchRow).toContainText("5")

  await batchRow.getByRole("button", { exact: true, name: "出库" }).click()
  const deliveryDialog = page.getByRole("dialog", { name: "客户库存出库" })
  await expect(deliveryDialog).toBeVisible()
  await expect(deliveryDialog.getByText(fullBatchNote, { exact: true })).toBeVisible()
  await expect(
    deliveryDialog.locator(
      '[data-customer-inventory-delivery-field="groupLabel"]',
    ),
  ).toHaveAttribute("placeholder", "默认 第一车")
  await deliveryDialog
    .locator('[data-customer-inventory-delivery-field="handler"]')
    .fill("历史经手人")
  await deliveryDialog
    .locator('[data-customer-inventory-delivery-field="extraChargeName"]')
    .fill("装车费")
  await deliveryDialog
    .locator('[data-customer-inventory-delivery-field="extraChargeAmount"]')
    .fill("50")
  await deliveryDialog
    .locator('[data-customer-inventory-delivery-field="quantity"]')
    .first()
    .fill("2")
  await deliveryDialog
    .locator('[data-customer-inventory-delivery-field="powderWeightKg"]')
    .fill("12.34")
  await deliveryDialog
    .locator('[data-customer-inventory-delivery-field="delivery-note"]')
    .fill("客户库存出库备注")
  await deliveryDialog
    .getByRole("button", { name: "确认出库并预览" })
    .click()

  const deliveryPreview = page.getByRole("dialog", {
    name: "出库单打印预览",
  })
  await expect(deliveryPreview).toBeVisible()
  await expect(deliveryPreview.getByText("历史库存客户")).toBeVisible()
  await expect(deliveryPreview.getByText("KH-20260620001").first()).toBeVisible()
  await expect(deliveryPreview.getByText("历史库存商品")).toBeVisible()
  await expect(deliveryPreview.getByText("型材货款小计")).toBeVisible()
  await expect(
    deliveryPreview.getByText("其他费用", { exact: true })
  ).toBeVisible()
  await expect(deliveryPreview.getByText("其他费用小计")).toBeVisible()
  await expect(deliveryPreview.getByText("装车费")).toBeVisible()
  await expect(deliveryPreview.getByText("应收合计大写")).toBeVisible()
  await expect(deliveryPreview.getByText("应收合计小写")).toBeVisible()
  await expect(
    deliveryPreview.getByText("补录明细", { exact: true })
  ).toHaveCSS("text-align", "center")
  await page.keyboard.press("Escape")

  await expect(page.getByText("出库单已创建，出库 1 项，共 2 支")).toBeVisible()
  await expect(batchRow).toContainText("3")
  await page.getByRole("button", { name: "预览/补打" }).click()
  await expect(deliveryPreview).toBeVisible()
  await expect(deliveryPreview.getByText("客户库存出库备注")).toBeVisible()
})

test("can paginate customer inventory by rendered A4 height", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const targetCustomer = customerFixture(
    "inventory-print-customer",
    "多页库存客户"
  )
  const otherCustomer = customerFixture(
    "other-inventory-customer",
    "其他库存客户"
  )
  const now = "2026-07-15T08:00:00.000Z"
  const longGroupLabel =
    "这是需要自动换行并且必须完整显示不能出现省略号的较长分组名称"
  const longInventoryNote = "这是必须保持单行并且上下左右居中的较长库存备注"
  const longProductName = "GR70 23mm 圆弧压线（0.9）"
  const targetItems = [
    ...Array.from({ length: 79 }, (_, index) => {
      const number = index + 1

      return {
        batchId: "PRINT-BATCH-001",
        color: number === 79 ? "坯料" : "灰色",
        id: `print-stock-${number}`,
        lengthMm: 6000 + number,
        moldCode: `PRINT-${String(number).padStart(3, "0")}`,
        note: number === 1 ? longInventoryNote : `库存明细 ${number}`,
        productId: `print-product-${number}`,
        productName:
          number === 1
            ? longProductName
            : `多页库存商品 ${String(number).padStart(2, "0")}`,
        quantity: 1,
        updatedAt: now,
      }
    }),
    {
      batchId: "PRINT-BATCH-001",
      color: "灰色",
      id: "print-stock-zero",
      lengthMm: 6000,
      moldCode: "PRINT-ZERO",
      note: "不应打印",
      productId: "print-product-zero",
      productName: "零库存商品",
      quantity: 0,
      updatedAt: now,
    },
  ]
  const makeBatch = ({
    customer,
    historicalOrderDate,
    historicalOrderRef,
    id,
    items,
  }: {
    customer: ReturnType<typeof customerFixture>
    historicalOrderDate: string
    historicalOrderRef: string
    id: string
    items: typeof targetItems
  }) => ({
    aluminumIngotPriceX100: 2000000,
    billetProcessingFeeX100: 100,
    bridgeProcessingFeeX100: 100,
    createdAt: now,
    customerAddress: customer.customerAddress,
    customerId: customer.id,
    customerName: customer.customerName,
    deliveryNoteId: null,
    deliveryNoteIds: [],
    electrophoresisProcessingFeeX100: 0,
    hasDeliveryNote: false,
    historicalOrderDate,
    historicalOrderRef,
    id,
    itemCount: items.length,
    items,
    note: "整客户库存打印",
    oxidationProcessingFeeX100: 0,
    powderProcessingFeeX100: 100,
    pricingTaxIncluded: true,
    sourceOrderId: null,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    updatedAt: now,
  })
  const targetBatchSpecs = [
    { date: "2026-05-01", itemCount: 4 },
    ...Array.from({ length: 7 }, () => ({
      date: "2025-11-05",
      itemCount: 4,
    })),
    ...Array.from({ length: 4 }, () => ({
      date: "2025-04-07",
      itemCount: 4,
    })),
    ...[4, 4, 4, 7].map((itemCount) => ({
      date: "2025-03-24",
      itemCount,
    })),
    ...Array.from({ length: 3 }, () => ({
      date: "2025-03-18",
      itemCount: 4,
    })),
  ]
  let targetItemOffset = 0
  const targetBatches = targetBatchSpecs.map((group, groupIndex) => {
    const id = `PRINT-BATCH-${String(groupIndex + 1).padStart(3, "0")}`
    const items = targetItems
      .slice(targetItemOffset, targetItemOffset + group.itemCount)
      .map((item) => ({ ...item, batchId: id }))

    targetItemOffset += group.itemCount

    if (groupIndex === 0) {
      items.push({ ...targetItems.at(-1), batchId: id } as (typeof items)[number])
    }

    return makeBatch({
      customer: targetCustomer,
      historicalOrderDate: group.date,
      historicalOrderRef: `PRINT-OLD-${groupIndex + 1}`,
      id,
      items,
    })
  })
  const otherItems = [
    {
      ...targetItems[0],
      batchId: "OTHER-BATCH-001",
      id: "other-stock-1",
      productName: "其他客户商品",
    },
  ]

  await seedFallbackStorage(page, {
    "order-manager:fallback-customer-inventory-batches": [
      ...targetBatches,
      makeBatch({
        customer: otherCustomer,
        historicalOrderDate: "2026-07-01",
        historicalOrderRef: "OTHER-OLD-1",
        id: "OTHER-BATCH-001",
        items: otherItems,
      }),
    ],
    "order-manager:fallback-customers": [targetCustomer, otherCustomer],
  })

  await page.goto("/inventory")
  await page.getByRole("button", { exact: true, name: "客户库存" }).click()
  await page.getByRole("button", { name: "打印客户库存" }).click()

  const selectDialog = page.getByRole("dialog", { name: "打印客户库存" })
  await expect(selectDialog).toBeVisible()
  await selectDialog.getByRole("combobox").click()
  await page.getByRole("option", { name: /多页库存客户/ }).click()
  await selectDialog
    .getByRole("button", { name: "下一步：设置分组" })
    .click()

  const groupDialog = page.getByRole("dialog", {
    name: "设置库存打印分组",
  })
  await expect(groupDialog).toBeVisible()
  await groupDialog
    .getByLabel("批次 PRINT-BATCH-001 分组")
    .fill(longGroupLabel)
  await groupDialog.getByLabel("批次 PRINT-BATCH-002 分组").fill("第二分组")
  await groupDialog.getByRole("button", { name: "预览库存清单" }).click()

  const preview = page.getByRole("dialog", { name: "客户库存打印预览" })
  await expect(preview).toBeVisible()
  await expect(preview.getByText("客户库存清单").first()).toBeVisible()
  await expect(preview.getByText("多页库存客户").first()).toBeVisible()
  await expect(
    preview.getByText("历史下单日期：2026-05-01").first()
  ).toBeVisible()
  await expect(preview.getByText("19 批").first()).toBeVisible()
  const firstPriceSummary = preview
    .locator(".print-customer-inventory__price-meta")
    .first()
  await expect(firstPriceSummary).toContainText("铝锭价")
  await expect(firstPriceSummary).toContainText("¥20,000.00")
  await expect(firstPriceSummary).toContainText("计价方式含税")
  await expect(firstPriceSummary).toContainText("断桥加工费¥1.00")
  await expect(firstPriceSummary).toContainText("喷涂加工费¥1.00")
  await expect(firstPriceSummary).toContainText("坯料加工费¥1.00")
  await expect(firstPriceSummary).not.toContainText("氧化加工费")
  await expect(firstPriceSummary).not.toContainText("电泳加工费")
  const longGroupCell = preview.getByText(longGroupLabel, { exact: true })
  await expect(longGroupCell).toBeVisible()
  await expect(preview.getByText("第二分组", { exact: true })).toBeVisible()
  await expect(preview.getByRole("columnheader", { name: "分组" }).first()).toBeVisible()
  const longProductCell = preview.getByText(longProductName, { exact: true })
  await expect(longProductCell).toBeVisible()
  expect(
    await longProductCell.evaluate((element) => {
      const cell = element.closest("td")

      return cell ? cell.scrollWidth <= cell.clientWidth : false
    })
  ).toBe(true)
  await expect(preview.getByText("多页库存商品 79")).toBeVisible()
  await expect(preview.getByText("当前库存合计")).toBeVisible()
  await expect(preview.getByText("零库存商品")).toHaveCount(0)
  await expect(preview.getByText("其他客户商品")).toHaveCount(0)
  const longRemarkCell = preview.getByText(longInventoryNote, { exact: true })
  await expect(longRemarkCell).toBeVisible()
  const longRemarkStyle = await longRemarkCell.evaluate((element) => {
    const style = window.getComputedStyle(element)

    return {
      textAlign: style.textAlign,
      verticalAlign: style.verticalAlign,
      whiteSpace: style.whiteSpace,
    }
  })
  expect(longRemarkStyle).toEqual({
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  })
  const longGroupStyle = await longGroupCell.evaluate((element) => {
    const style = window.getComputedStyle(element.parentElement ?? element)

    return {
      overflow: style.overflow,
      overflowWrap: style.overflowWrap,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    }
  })
  expect(longGroupStyle).toEqual({
    overflow: "visible",
    overflowWrap: "anywhere",
    textOverflow: "clip",
    whiteSpace: "normal",
  })
  await preview.getByRole("button", { name: "修改分组" }).click()
  await expect(groupDialog).toBeVisible()
  await groupDialog
    .getByLabel("批次 PRINT-BATCH-001 分组")
    .fill("第一分组已修改")
  await groupDialog.getByRole("button", { name: "预览库存清单" }).click()
  await expect(preview).toBeVisible()
  await expect(
    preview.getByText("第一分组已修改", { exact: true })
  ).toBeVisible()
  const previewPages = preview.locator(
    ".print-customer-inventory .print-order__page"
  )
  expect(await previewPages.count()).toBeGreaterThan(1)
  const pageRowCounts = await previewPages.evaluateAll((pages) =>
    pages.map((printPage) =>
      [...printPage.querySelectorAll("tbody")].reduce(
        (total, tableBody) => total + tableBody.querySelectorAll("tr").length,
        0
      )
    )
  )
  expect(pageRowCounts.reduce((total, rowCount) => total + rowCount, 0)).toBe(79)
  const pageHeights = await previewPages.evaluateAll((pages) =>
    pages.map((printPage) => printPage.getBoundingClientRect().height)
  )
  expect(
    Math.max(...pageHeights),
    `客户库存 A4 预览页高度：${pageHeights.join(", ")}`
  ).toBeLessThanOrEqual(1130)
  const footerFlowGaps = await previewPages.evaluateAll((pages) =>
    pages.map((printPage) => {
      const footer = printPage.querySelector(".print-order__footer")
      const previousContent = footer?.previousElementSibling

      return footer && previousContent
        ? footer.getBoundingClientRect().top -
            previousContent.getBoundingClientRect().bottom
        : Number.POSITIVE_INFINITY
    })
  )
  expect(
    Math.max(...footerFlowGaps),
    `客户库存页脚与前一内容块间距：${footerFlowGaps.join(", ")}`
  ).toBeLessThanOrEqual(1)
  const batchPageIndexes = await previewPages.evaluateAll((pages) => {
    const indexesByBatch = new Map<string, Set<number>>()

    pages.forEach((printPage, pageIndex) => {
      for (const row of printPage.querySelectorAll<HTMLElement>(
        "[data-customer-inventory-print-batch]"
      )) {
        const batchId = row.dataset.customerInventoryPrintBatch

        if (batchId) {
          const pageIndexes = indexesByBatch.get(batchId) ?? new Set<number>()

          pageIndexes.add(pageIndex)
          indexesByBatch.set(batchId, pageIndexes)
        }
      }
    })

    return [...indexesByBatch.values()].map((pageIndexes) => [
      ...pageIndexes,
    ])
  })
  expect(batchPageIndexes.every((pageIndexes) => pageIndexes.length === 1)).toBe(
    true
  )

  await page.keyboard.press("Escape")
  await seedFallbackStorage(page, {
    "order-manager:fallback-customer-inventory-batches": [
      makeBatch({
        customer: targetCustomer,
        historicalOrderDate: "2026-05-01",
        historicalOrderRef: "OVERSIZED-OLD-1",
        id: "OVERSIZED-BATCH-001",
        items: targetItems,
      }),
    ],
    "order-manager:fallback-customers": [targetCustomer],
  })
  await page.goto("/inventory")
  await page.getByRole("button", { exact: true, name: "客户库存" }).click()
  await page.getByRole("button", { name: "打印客户库存" }).click()
  await expect(selectDialog).toBeVisible()
  await selectDialog.getByRole("combobox").click()
  await page.getByRole("option", { name: /多页库存客户/ }).click()
  await selectDialog
    .getByRole("button", { name: "下一步：设置分组" })
    .click()
  await expect(groupDialog).toBeVisible()
  await groupDialog.getByRole("button", { name: "预览库存清单" }).click()
  await expect(groupDialog).toBeVisible()
  await expect(
    groupDialog.getByText(/批次 OVERSIZED-BATCH-001.*无法完整放入一张 A4/)
  ).toBeVisible()
})

test("can open multi-page sales order and delivery note print previews", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const salesOrder = orderDetailFixture({
    id: "ALU20260623099",
    itemCount: 23,
    productNamePrefix: "销售多页商品",
  })

  await seedFallbackStorage(page, {
    "order-manager:fallback-order-details": [salesOrder],
  })

  await page.goto(`/orders/${salesOrder.id}`)
  await page.getByRole("button", { name: "打印订单" }).click()

  const orderPreview = page.getByRole("dialog", { name: "打印预览" })
  await expect(orderPreview).toBeVisible()
  await expect(orderPreview.getByText("第 2 / 2 页")).toBeVisible()
  await expect(orderPreview.getByText("销售多页商品 23")).toBeVisible()
  await expect(orderPreview.getByText("理论预估重量")).toBeVisible()
  await expect(
    orderPreview.locator(".print-sales-order tbody tr").first().locator("td").nth(9)
  ).toHaveCSS("text-align", "center")
  await page.keyboard.press("Escape")

  const deliveryOrder = orderDetailFixture({
    id: "ALU20260623100",
    itemCount: 37,
    productNamePrefix: "出库多页商品",
    status: "ordered",
  })

  await seedFallbackStorage(page, {
    "order-manager:fallback-order-details": [deliveryOrder],
  })

  await page.goto("/inventory")
  await expect(page.getByText("当前 0 / 下单 37")).toBeVisible()
  await confirmDefaultBatchInbound(page)
  await expect(page.getByText("当前 37 / 下单 37")).toBeVisible()
  await page.getByRole("button", { name: "新建出库单" }).click()
  await fillAllDeliveryQuantities(page)
  await page.locator("#delivery-powder-weight").fill("100")
  await page.locator("#delivery-charge-name-0").fill("运费")
  await page.locator("#delivery-charge-amount-0").fill("200")
  await page.getByRole("button", { name: "确认出库并预览" }).click()

  const deliveryPreview = page.getByRole("dialog", {
    name: "出库单打印预览",
  })
  await expect(deliveryPreview).toBeVisible()
  await expect(deliveryPreview.getByText("第 2 / 2 页")).toBeVisible()
  await expect(deliveryPreview.getByText("出库多页商品 37")).toBeVisible()
  await expect(deliveryPreview.getByText("货款明细")).toBeVisible()
  await expect(deliveryPreview.getByText("型材货款小计")).toBeVisible()
  await expect(
    deliveryPreview.getByText("其他费用", { exact: true })
  ).toBeVisible()
  await expect(deliveryPreview.getByText("其他费用小计")).toBeVisible()
  await expect(deliveryPreview.getByText("运费")).toBeVisible()
  await expect(deliveryPreview.getByText("应收合计大写")).toBeVisible()
  await expect(deliveryPreview.getByText("应收合计小写")).toBeVisible()
  await expect(deliveryPreview.getByText("其他", { exact: true })).toHaveCount(0)
  const paymentLayout = await deliveryPreview
    .locator(".print-delivery-note__payment")
    .evaluate((payment) => {
      const goodsBreakdown = payment.querySelector<HTMLElement>(
        ".print-delivery-note__payment-breakdown:not(.print-delivery-note__extra-charge-breakdown)"
      )
      const goodsItems = goodsBreakdown?.querySelector<HTMLElement>(
        ".print-delivery-note__payment-breakdown-items"
      )
      const goodsSubtotal = goodsBreakdown?.querySelector<HTMLElement>(
        ".print-delivery-note__payment-breakdown-subtotal"
      )
      const extraBreakdown = payment.querySelector<HTMLElement>(
        ".print-delivery-note__extra-charge-breakdown"
      )
      const extraItems = extraBreakdown?.querySelector<HTMLElement>(
        ".print-delivery-note__payment-breakdown-items"
      )
      const extraSubtotal = extraBreakdown?.querySelector<HTMLElement>(
        ".print-delivery-note__payment-breakdown-subtotal"
      )
      const paymentUpper = payment.querySelector<HTMLElement>(
        ".print-delivery-note__payment-upper"
      )
      const paymentLower = payment.querySelector<HTMLElement>(
        ".print-delivery-note__payment-lower"
      )

      if (
        !goodsBreakdown ||
        !goodsItems ||
        !goodsSubtotal ||
        !extraBreakdown ||
        !extraItems ||
        !extraSubtotal ||
        !paymentUpper ||
        !paymentLower
      ) {
        return null
      }

      const paymentStyle = window.getComputedStyle(payment)
      const goodsStyle = window.getComputedStyle(goodsBreakdown)
      const extraStyle = window.getComputedStyle(extraBreakdown)

      return {
        breakdownBackgroundsMatch:
          goodsStyle.backgroundColor === extraStyle.backgroundColor,
        extraBorderBottomWidth: extraStyle.borderBottomWidth,
        extraBorderTopWidth: extraStyle.borderTopWidth,
        extraSubtotalBelowItems:
          extraSubtotal.getBoundingClientRect().top >=
          extraItems.getBoundingClientRect().bottom,
        goodsBorderBottomWidth: goodsStyle.borderBottomWidth,
        paymentBorderBottomWidth: paymentStyle.borderBottomWidth,
        paymentLowerWhiteSpace:
          window.getComputedStyle(paymentLower).whiteSpace,
        paymentUpperWhiteSpace:
          window.getComputedStyle(paymentUpper).whiteSpace,
        subtotalBelowItems:
          goodsSubtotal.getBoundingClientRect().top >=
          goodsItems.getBoundingClientRect().bottom,
      }
    })
  expect(paymentLayout).toEqual({
    breakdownBackgroundsMatch: true,
    extraBorderBottomWidth: "0px",
    extraBorderTopWidth: "0px",
    extraSubtotalBelowItems: true,
    goodsBorderBottomWidth: "0px",
    paymentBorderBottomWidth: "1px",
    paymentLowerWhiteSpace: "nowrap",
    paymentUpperWhiteSpace: "nowrap",
    subtotalBelowItems: true,
  })
  await expect(
    deliveryPreview
      .locator(".print-delivery-note__table tbody tr")
      .first()
      .locator("td")
      .nth(7)
  ).toHaveCSS("text-align", "center")
})

test("separates merged delivery goods payments and extra charges", async ({
  page,
}) => {
  await clearFallbackStorage(page)

  const firstOrderId = "ALU20260623101"
  const secondOrderId = "ALU20260623102"
  const firstDeliveryNoteId = `${firstOrderId}-01`
  const secondDeliveryNoteId = `${secondOrderId}-01`
  const firstOrder = {
    ...orderDetailFixture({
      id: firstOrderId,
      itemCount: 1,
      productNamePrefix: "合并出库商品一",
      status: "ordered",
    }),
    deliveryNoteId: firstDeliveryNoteId,
    deliveryNoteIds: [firstDeliveryNoteId],
    inventoryCloseDestination: "shipped",
    inventoryClosedAt: "2026-06-23T09:00:00.000Z",
    inventoryLockedAt: "2026-06-23T09:00:00.000Z",
  }
  const secondOrder = {
    ...orderDetailFixture({
      id: secondOrderId,
      itemCount: 1,
      productNamePrefix: "合并出库商品二",
      status: "ordered",
    }),
    deliveryNoteId: secondDeliveryNoteId,
    deliveryNoteIds: [secondDeliveryNoteId],
    inventoryCloseDestination: "shipped",
    inventoryClosedAt: "2026-06-23T10:00:00.000Z",
    inventoryLockedAt: "2026-06-23T10:00:00.000Z",
  }

  function deliveryNoteFixture({
    deliveryNoteId,
    extraChargeAmountX100,
    extraChargeName,
    order,
    powderProcessingFeeX100,
    powderWeightKgX100,
  }: {
    deliveryNoteId: string
    extraChargeAmountX100: number
    extraChargeName: string
    order: typeof firstOrder
    powderProcessingFeeX100: number
    powderWeightKgX100: number
  }) {
    const item = order.items[0]

    return {
      aluminumIngotPriceX100: order.aluminumIngotPriceX100,
      billetProcessingFeeX100: 0,
      billetWeightKgX100: 0,
      bridgeProcessingFeeX100: 0,
      bridgeWeightKgX100: 0,
      createdAt: "2026-06-23T10:00:00.000Z",
      customerAddress: order.customerAddress,
      customerName: order.customerName,
      deliveryDate: "2026-06-23",
      electrophoresisProcessingFeeX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [{ name: extraChargeName, amountX100: extraChargeAmountX100 }],
      handlerName: order.handlerName,
      id: deliveryNoteId,
      items: [
        {
          color: item.color,
          id: `${deliveryNoteId}-001`,
          lengthMm: item.lengthMm,
          moldCode: item.productMoldCode,
          note: item.note,
          orderQuantity: item.quantity,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
        },
      ],
      note: "合并出库打印备注",
      orderId: order.id,
      oxidationProcessingFeeX100: 0,
      oxidationWeightKgX100: 0,
      powderProcessingFeeX100,
      powderWeightKgX100,
      pricingProfileName: "默认价",
      pricingTaxIncluded: true,
      pricingTriggerKeyword: "",
    }
  }

  const firstDeliveryNote = deliveryNoteFixture({
    deliveryNoteId: firstDeliveryNoteId,
    extraChargeAmountX100: 10_000,
    extraChargeName: "运费",
    order: firstOrder,
    powderProcessingFeeX100: 100,
    powderWeightKgX100: 10_000,
  })
  firstDeliveryNote.note = "第一车备注"
  const secondDeliveryNote = deliveryNoteFixture({
    deliveryNoteId: secondDeliveryNoteId,
    extraChargeAmountX100: 5_000,
    extraChargeName: "装车费",
    order: secondOrder,
    powderProcessingFeeX100: 200,
    powderWeightKgX100: 20_000,
  })
  secondDeliveryNote.note = "第二车备注"

  await seedFallbackStorage(page, {
    "order-manager:fallback-delivery-notes": {
      [firstDeliveryNoteId]: firstDeliveryNote,
      [secondDeliveryNoteId]: secondDeliveryNote,
    },
    "order-manager:fallback-order-details": [firstOrder, secondOrder],
    "order-manager:fallback-order-inventory-stocks": [
      {
        color: firstOrder.items[0].color,
        lengthMm: firstOrder.items[0].lengthMm,
        orderId: firstOrder.id,
        productId: firstOrder.items[0].productId,
        quantity: 0,
      },
      {
        color: secondOrder.items[0].color,
        lengthMm: secondOrder.items[0].lengthMm,
        orderId: secondOrder.id,
        productId: secondOrder.items[0].productId,
        quantity: 0,
      },
    ],
  })

  await page.goto("/inventory")
  await page.getByRole("button", { name: "合并出库单" }).click()
  const mergeDialog = page.getByRole("dialog", { name: "合并出库单" })
  await expect(mergeDialog).toBeVisible()
  const firstDeliveryRow = mergeDialog
    .getByRole("row")
    .filter({ hasText: firstOrderId })
  const secondDeliveryRow = mergeDialog
    .getByRole("row")
    .filter({ hasText: secondOrderId })
  await firstDeliveryRow.locator('input[type="checkbox"]').check()
  await secondDeliveryRow.locator('input[type="checkbox"]').check()
  await expect(firstDeliveryRow.getByPlaceholder(/同价多单必填/)).toHaveValue(
    "第一车备注"
  )
  await expect(secondDeliveryRow.getByPlaceholder(/同价多单必填/)).toHaveValue(
    "第二车备注"
  )
  await mergeDialog.getByRole("button", { name: "预览合并单" }).click()

  const preview = page.getByRole("dialog", { name: "出库单打印预览" })
  await expect(preview).toBeVisible()
  await expect(preview.getByText("型材货款小计")).toHaveCount(2)
  await expect(preview.getByText("其他费用", { exact: true })).toHaveCount(2)
  await expect(preview.getByText("其他费用小计")).toHaveCount(2)
  await expect(preview.getByText("运费")).toBeVisible()
  await expect(preview.getByText("装车费")).toBeVisible()
  await expectMergedDeliverySummaryLayout(preview)
  await expect(preview.getByText("合并应收大写")).toBeVisible()
  await expect(preview.getByText("合并应收小写")).toBeVisible()
})
