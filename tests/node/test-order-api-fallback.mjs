import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createTempModuleDir,
  installBrowserTestWindow,
} from "./test-utils.mjs";

const { dispatchedEvents, localStorage } = installBrowserTestWindow({
  captureEvents: true,
  includeAddEventListener: true,
});

const tempDir = await createTempModuleDir("order-api-fallback-test-");
const customerPricingPath = new URL(
  "../../src/features/customers/lib/customer-pricing.ts",
  import.meta.url,
);
const browserRuntimePath = new URL("../../src/lib/browser-runtime.ts", import.meta.url);
const datetimePath = new URL("../../src/lib/datetime.ts", import.meta.url);
const processingFeesPath = new URL("../../src/lib/processing-fees.ts", import.meta.url);
const ordersApiPath = new URL(
  "../../src/features/orders/api/orders-api.ts",
  import.meta.url,
);
const compileOrdersApi = (outputFile) =>
  compileTsModule(
    ordersApiPath,
    path.join(tempDir, outputFile),
    (source) =>
      source
        .replace(
          'import { invoke } from "@tauri-apps/api/core"\n',
          "const invoke = async () => { throw new Error('unexpected tauri invoke') }\n",
        )
        .replace('from "@/lib/datetime"', 'from "./datetime.mjs"')
        .replace(
          'from "@/features/customers/lib/customer-pricing"',
          'from "./customer-pricing.mjs"',
        )
        .replace('from "@/lib/browser-runtime"', 'from "./browser-runtime.mjs"')
        .replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"'),
  );

await compileTsModule(browserRuntimePath, path.join(tempDir, "browser-runtime.mjs"));
await compileTsModule(datetimePath, path.join(tempDir, "datetime.mjs"));
await compileTsModule(processingFeesPath, path.join(tempDir, "processing-fees.mjs"));
await compileTsModule(
  customerPricingPath,
  path.join(tempDir, "customer-pricing.mjs"),
  (source) =>
    source.replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"'),
);
await compileOrdersApi("orders-api.mjs");

const {
  createOrder,
  deleteOrder,
  getOrder,
  listOrders,
  parseOrderItemImportFile,
  updateOrder,
} = await import(pathToFileURL(path.join(tempDir, "orders-api.mjs")).href);

function customerRecord(overrides = {}) {
  return {
    billetProcessingFeeTaxExcludedX100: 100,
    billetProcessingFeeTaxIncludedX100: 100,
    bridgeProcessingFeeTaxExcludedX100: 100,
    bridgeProcessingFeeTaxIncludedX100: 100,
    createdAt: "2026-06-01T08:00:00.000Z",
    customerAddress: "测试地址",
    customerName: "测试客户",
    defaultPricingTaxIncluded: true,
    electrophoresisProcessingFeeTaxExcludedX100: 100,
    electrophoresisProcessingFeeTaxIncludedX100: 100,
    id: "c1",
    oxidationProcessingFeeTaxExcludedX100: 100,
    oxidationProcessingFeeTaxIncludedX100: 100,
    phone: "13900000000",
    powderProcessingFeeTaxExcludedX100: 100,
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
    updatedAt: "2026-06-01T08:00:00.000Z",
    ...overrides,
  };
}

function productRecord(overrides = {}) {
  return {
    assignedCustomerIds: ["c1"],
    assignedCustomerNames: ["测试客户"],
    id: "p1",
    moldCode: "G5501",
    productName: "灰色边框",
    thicknessMmX100: 120,
    weightPerMeterKgX1000: 2500,
    ...overrides,
  };
}

function seedFallbackCatalog({
  customers = [customerRecord()],
  customerProducts = [["c1", ["p1", "p2", "p3"]]],
  products = [
    productRecord(),
    productRecord({
      id: "p2",
      moldCode: "G5502",
      productName: "白色边框",
      thicknessMmX100: 110,
      weightPerMeterKgX1000: 1000,
    }),
    productRecord({
      id: "p3",
      moldCode: "G5503",
      productName: "坯料边框",
      thicknessMmX100: 100,
      weightPerMeterKgX1000: 1000,
    }),
  ],
} = {}) {
  localStorage.setItem("order-manager:fallback-customers", JSON.stringify(customers));
  localStorage.setItem(
    "order-manager:fallback-customer-products",
    JSON.stringify(customerProducts),
  );
  localStorage.setItem("order-manager:fallback-products", JSON.stringify(products));
}

function orderPayload(overrides = {}) {
  return {
    aluminumIngotPriceX100: 2000000,
    billetProcessingFeeX100: 0,
    bridgeProcessingFeeX100: 0,
    customerAddress: "测试地址",
    customerId: "c1",
    customerName: "测试客户",
    electrophoresisProcessingFeeX100: 0,
    handlerName: "测试经手人",
    id: null,
    items: [
      {
        color: "灰色",
        lengthMm: 6000,
        note: "首行",
        productId: "p1",
        productMoldCode: "G5501",
        productName: "灰色边框",
        quantity: 2,
        thicknessMmX100: 120,
        weightPerMeterKgX1000: 2500,
      },
      {
        color: "白色",
        lengthMm: 3000,
        note: null,
        productId: "p2",
        productMoldCode: "G5502",
        productName: "白色边框",
        quantity: 1,
        thicknessMmX100: 110,
        weightPerMeterKgX1000: 1000,
      },
    ],
    note: "订单备注",
    orderedDate: "2026-06-21",
    oxidationProcessingFeeX100: 0,
    powderProcessingFeeX100: 100,
    pricingTaxIncluded: true,
    status: "saved",
    ...overrides,
  };
}

seedFallbackCatalog();

const createdOrder = await createOrder(orderPayload());
assert.equal(createdOrder.id, "ALU20260621001");
assert.equal(createdOrder.items[0].id, "ALU20260621001-001");
assert.equal(createdOrder.items[0].theoreticalWeightKgX100, 3000);
assert.equal(createdOrder.items[1].theoreticalWeightKgX100, 300);
assert.equal(createdOrder.totalTheoreticalWeightKgX100, 3300);
assert.equal(dispatchedEvents.length, 1);
assert.equal(dispatchedEvents[0].type, "order-manager:fallback-order-upserted");
assert.equal(dispatchedEvents[0].detail.id, "ALU20260621001");
dispatchedEvents[0].detail.items[0].quantity = 77;
assert.equal((await getOrder("ALU20260621001")).items[0].quantity, 2);
const listedOrders = await listOrders();
listedOrders[0].customerName = "外部污染客户";
listedOrders.pop();
assert.deepEqual(
  (await listOrders()).map((order) => ({
    customerName: order.customerName,
    id: order.id,
  })),
  [{ customerName: "测试客户", id: "ALU20260621001" }],
);
await assert.rejects(
  () => createOrder(orderPayload({ id: "ALU20260621001" })),
  /订单编号已存在/,
);
await assert.rejects(() => getOrder("  "), /订单编号不能为空/);
await assert.rejects(() => createOrder(orderPayload({ customerId: "  " })), /请选择客户/);
await assert.rejects(
  () => createOrder(orderPayload({ customerId: "missing" })),
  /选择的客户不存在/,
);
await assert.rejects(
  () => createOrder(orderPayload({ customerName: "  " })),
  /客户名称不能为空/,
);
await assert.rejects(
  () => createOrder(orderPayload({ handlerName: "  " })),
  /经手人不能为空/,
);
await assert.rejects(
  () => createOrder(orderPayload({ aluminumIngotPriceX100: 0 })),
  /铝锭价必须大于 0/,
);
await assert.rejects(
  () => {
    seedFallbackCatalog({
      customers: [customerRecord({ powderProcessingFeeTaxIncludedX100: -1 })],
    });
    return createOrder(orderPayload());
  },
  /喷涂加工费不能小于 0/,
);
seedFallbackCatalog();
await assert.rejects(
  () => createOrder(orderPayload({ status: "unknown" })),
  /订单状态不正确/,
);
await assert.rejects(
  () => createOrder(orderPayload({ orderedDate: "  ", status: "ordered" })),
  /已下单订单需要下单日期/,
);
await assert.rejects(
  () => createOrder(orderPayload({ items: [] })),
  /订单至少需要一条明细/,
);
await assert.rejects(
  () =>
    createOrder(
      orderPayload({
        items: [{ ...orderPayload().items[0], productId: "  " }],
      }),
    ),
  /第 1 行：请选择商品/,
);
await assert.rejects(
  () =>
    createOrder(
      orderPayload({
        items: [{ ...orderPayload().items[0], productId: "p404" }],
      }),
    ),
  /第 1 行：请选择当前客户的商品/,
);
await assert.rejects(
  () => {
    seedFallbackCatalog({
      customers: [customerRecord({ billetProcessingFeeTaxIncludedX100: 0 })],
    });
    return createOrder(
      orderPayload({
        items: [{ ...orderPayload().items[0], productId: "p3", color: "坯料" }],
      }),
    );
  },
  /第 1 行：含税坯料加工费未设置/,
);
seedFallbackCatalog();
await assert.rejects(
  () =>
    createOrder(
      orderPayload({
        items: [{ ...orderPayload().items[0], lengthMm: 0 }],
      }),
    ),
  /第 1 行：长度必须大于 0/,
);
await assert.rejects(
  () =>
    createOrder(
      orderPayload({
        items: [{ ...orderPayload().items[0], color: "  " }],
      }),
    ),
  /第 1 行：颜色不能为空/,
);
await assert.rejects(
  () =>
    createOrder(
      orderPayload({
        items: [{ ...orderPayload().items[0], quantity: 0 }],
      }),
    ),
  /第 1 行：数量必须大于 0/,
);
assert.deepEqual(
  (await listOrders()).map((order) => order.id),
  ["ALU20260621001"],
);

const secondOrder = await createOrder(
  orderPayload({
    customerName: "测试客户 2",
    items: [
      {
        color: "坯料",
        lengthMm: 1000,
        note: null,
        productId: "p3",
        productMoldCode: "G5503",
        productName: "坯料边框",
        quantity: 1,
        thicknessMmX100: 100,
        weightPerMeterKgX1000: 1000,
      },
    ],
    orderedDate: "2026-06-22",
  }),
);
assert.equal(secondOrder.id, "ALU20260622001");
assert.equal(secondOrder.billetProcessingFeeX100, 100);
assert.deepEqual(
  (await listOrders()).map((order) => order.id),
  ["ALU20260622001", "ALU20260621001"],
);
assert.equal((await getOrder("ALU20260621001")).note, "订单备注");
const listedOrderDetail = await getOrder("ALU20260621001");
listedOrderDetail.items[0].quantity = 99;
assert.equal((await getOrder("ALU20260621001")).items[0].quantity, 2);

await new Promise((resolve) => setTimeout(resolve, 5));
const updatedOrder = await updateOrder(
  orderPayload({
    customerName: "测试客户更新",
    id: "ALU20260621001",
    items: [
      {
        color: "灰色",
        lengthMm: 6000,
        note: "更新行",
        productId: "p1",
        productMoldCode: "G5501",
        productName: "灰色边框更新",
        quantity: 3,
        thicknessMmX100: 120,
        weightPerMeterKgX1000: 2500,
      },
    ],
    note: "更新备注",
    status: "ordered",
  }),
);
assert.equal(updatedOrder.customerName, "测试客户更新");
assert.equal(updatedOrder.createdAt, createdOrder.createdAt);
assert.equal(Number.isFinite(new Date(updatedOrder.updatedAt).getTime()), true);
assert.equal(updatedOrder.status, "ordered");
assert.equal(updatedOrder.items[0].id, "ALU20260621001-001");
assert.equal(updatedOrder.items[0].productName, "灰色边框");
assert.equal(updatedOrder.items[0].theoreticalWeightKgX100, 4500);
assert.equal(updatedOrder.totalTheoreticalWeightKgX100, 4500);
assert.deepEqual(
  (await listOrders()).map((order) => order.id),
  ["ALU20260621001", "ALU20260622001"],
);
assert.equal(dispatchedEvents.length, 3);
assert.equal(dispatchedEvents[2].detail.note, "更新备注");
const externalOrderUpsertEvent = new CustomEvent(
  "order-manager:fallback-order-upserted",
  {
    detail: { ...updatedOrder, deliveryNoteId: "ALU20260621001" },
  },
);
window.dispatchEvent(externalOrderUpsertEvent);
externalOrderUpsertEvent.detail.items[0].quantity = 88;
assert.equal((await getOrder("ALU20260621001")).items[0].quantity, 3);
assert.equal(
  (await listOrders()).find((order) => order.id === "ALU20260621001")
    ?.deliveryNoteId,
  "ALU20260621001",
);

await assert.rejects(() => getOrder("ALU404"), /订单不存在/);
await assert.rejects(() => updateOrder(orderPayload({ id: null })), /订单编号不能为空/);
await assert.rejects(
  () => updateOrder(orderPayload({ id: "ALU404" })),
  /订单不存在/,
);
await assert.rejects(
  () => updateOrder(orderPayload({ id: " ALU20260621001 ", status: "saved" })),
  /已下单订单不能编辑/,
);

await deleteOrder("ALU20260622001");
assert.deepEqual(
  (await listOrders()).map((order) => order.id),
  ["ALU20260621001"],
);
assert.equal(dispatchedEvents.length, 5);
assert.equal(dispatchedEvents[4].type, "order-manager:fallback-order-deleted");
assert.deepEqual(dispatchedEvents[4].detail, { id: "ALU20260622001" });
await assert.rejects(() => deleteOrder("  "), /订单编号不能为空/);
await assert.rejects(() => deleteOrder("ALU404"), /订单不存在/);
await assert.rejects(
  () => deleteOrder(" ALU20260621001 "),
  /已下单订单不能删除/,
);
assert.deepEqual(await parseOrderItemImportFile("/tmp/order-items.xlsx"), {
  errors: ["系统文件选择器只能在 Tauri 应用窗口中使用。"],
  rows: [],
});

const storedOrders = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
);
assert.equal(storedOrders.length, 1);
assert.equal(storedOrders[0].id, "ALU20260621001");
assert.equal(storedOrders[0].items[0].quantity, 3);

window.localStorage.clear();
seedFallbackCatalog();
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      aluminumIngotPriceX100: 2100000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      createdAt: "2026-06-20T08:00:00.000Z",
      customerAddress: "缓存地址",
      customerId: "c-cache",
      customerName: "缓存客户",
      deliveryNoteId: "ALU20260620001",
      electrophoresisProcessingFeeX100: 0,
      handlerName: "缓存经手人",
      id: "ALU20260620001",
      items: [
        {
          color: "灰色",
          id: "ALU20260620001-001",
          lengthMm: 5000,
          note: "缓存行",
          orderId: "ALU20260620001",
          productId: "p-cache",
          productMoldCode: "G-cache",
          productName: "缓存边框",
          quantity: 2,
          theoreticalWeightKgX100: 2500,
          thicknessMmX100: 120,
          weightPerMeterKgX1000: 2500,
        },
      ],
      note: "缓存备注",
      orderedDate: "2026-06-20",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
      status: "saved",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
await compileOrdersApi("orders-api-storage.mjs");
const {
  getOrder: getStoredOrder,
  listOrders: listStoredOrders,
} = await import(pathToFileURL(path.join(tempDir, "orders-api-storage.mjs")).href);
assert.deepEqual(
  (await listStoredOrders()).map((order) => ({
    deliveryNoteId: order.deliveryNoteId,
    id: order.id,
    totalTheoreticalWeightKgX100: order.totalTheoreticalWeightKgX100,
  })),
  [
    {
      deliveryNoteId: "ALU20260620001",
      id: "ALU20260620001",
      totalTheoreticalWeightKgX100: 2500,
    },
  ],
);
assert.equal((await getStoredOrder("ALU20260620001")).note, "缓存备注");

window.localStorage.clear();
seedFallbackCatalog();
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      aluminumIngotPriceX100: 2100000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      createdAt: "2026-06-20T08:00:00.000Z",
      customerAddress: "缓存地址",
      customerId: "c-cache",
      customerName: "缓存客户",
      deliveryNoteId: null,
      electrophoresisProcessingFeeX100: 0,
      handlerName: "缓存经手人",
      id: "ALU20260620001",
      items: [],
      note: "缓存备注",
      orderedDate: "2026-06-20",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
      status: "saved",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
    {
      aluminumIngotPriceX100: 2100000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      createdAt: "2026-06-21T08:00:00.000Z",
      customerAddress: "缓存地址",
      customerId: "c-cache",
      customerName: "缓存客户",
      deliveryNoteId: null,
      electrophoresisProcessingFeeX100: 0,
      handlerName: "缓存经手人",
      id: "ALU20260621003",
      items: [],
      note: "缓存断号备注",
      orderedDate: "2026-06-21",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
      status: "saved",
      updatedAt: "2026-06-22T08:00:00.000Z",
    },
  ]),
);
await compileOrdersApi("orders-api-storage-create.mjs");
const {
  createOrder: createStoredOrder,
  listOrders: listCreatedStoredOrders,
} = await import(
  pathToFileURL(path.join(tempDir, "orders-api-storage-create.mjs")).href
);
const storedCreatedOrder = await createStoredOrder(
  orderPayload({
    customerName: "缓存后新增订单",
    orderedDate: "2026-06-21",
  }),
);
assert.equal(storedCreatedOrder.id, "ALU20260621004");
assert.deepEqual(
  (await listCreatedStoredOrders()).map((order) => order.id),
  ["ALU20260621004", "ALU20260621003", "ALU20260620001"],
);

console.log("order api browser fallback rules ok");
