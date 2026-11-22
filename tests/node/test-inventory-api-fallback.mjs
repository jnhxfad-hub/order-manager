import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createTempModuleDir,
  installBrowserTestWindow,
} from "./test-utils.mjs";

const { dispatchedEvents } = installBrowserTestWindow({
  captureEvents: true,
  includeAddEventListener: true,
});

function orderDetail(overrides = {}) {
  return {
    aluminumIngotPriceX100: 2000000,
    billetProcessingFeeX100: 0,
    bridgeProcessingFeeX100: 0,
    createdAt: "2026-06-21T08:00:00.000Z",
    customerAddress: "测试地址",
    customerId: "c1",
    customerName: "测试客户",
    deliveryNoteId: null,
    deliveryNoteIds: [],
    electrophoresisProcessingFeeX100: 0,
    handlerName: "测试经手人",
    id: "ALU20260621001",
    inventoryCloseDestination: null,
    inventoryClosedAt: null,
    inventoryLockedAt: null,
    items: [
      {
        color: "灰色",
        id: "ALU20260621001-001",
        lengthMm: 6000,
        note: "订单行",
        orderId: "ALU20260621001",
        productId: "p1",
        productMoldCode: "G5501",
        productName: "灰色边框",
        quantity: 3,
        theoreticalWeightKgX100: 4500,
        thicknessMmX100: 120,
        weightPerMeterKgX1000: 2500,
      },
      {
        color: "白色",
        id: "ALU20260621001-002",
        lengthMm: 3000,
        note: null,
        orderId: "ALU20260621001",
        productId: null,
        productMoldCode: "G5502",
        productName: "白色边框",
        quantity: 1,
        theoreticalWeightKgX100: 300,
        thicknessMmX100: 110,
        weightPerMeterKgX1000: 1000,
      },
    ],
    note: "订单备注",
    orderedDate: "2026-06-21",
    oxidationProcessingFeeX100: 0,
    powderProcessingFeeX100: 100,
    pricingTaxIncluded: true,
    status: "ordered",
    totalTheoreticalWeightKgX100: 4800,
    updatedAt: "2026-06-21T08:00:00.000Z",
    ...overrides,
  };
}

function customerFixture(overrides = {}) {
  return {
    billetProcessingFeeTaxExcludedX100: 0,
    billetProcessingFeeTaxIncludedX100: 0,
    bridgeProcessingFeeTaxExcludedX100: 0,
    bridgeProcessingFeeTaxIncludedX100: 0,
    createdAt: "2026-06-21T08:00:00.000Z",
    customerAddress: "历史库存地址",
    customerName: "历史库存客户",
    defaultPricingTaxIncluded: true,
    electrophoresisProcessingFeeTaxExcludedX100: 0,
    electrophoresisProcessingFeeTaxIncludedX100: 0,
    id: "history-customer",
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
    specialPricingKeyword: "第二车",
    updatedAt: "2026-06-21T08:00:00.000Z",
    ...overrides,
  };
}

const orderCustomerFixture = customerFixture({
  customerAddress: "测试地址",
  customerName: "测试客户",
  id: "c1",
  powderProcessingFeeTaxExcludedX100: 200,
  powderProcessingFeeTaxIncludedX100: 100,
  specialPowderProcessingFeeTaxExcludedX100: 350,
  specialPricingKeyword: "加急",
});

function productFixture(overrides = {}) {
  return {
    assignedCustomerIds: ["history-customer"],
    assignedCustomerNames: ["历史库存客户"],
    id: "history-product",
    moldCode: "H-001",
    productName: "历史库存商品",
    thicknessMmX100: 120,
    weightPerMeterKgX1000: 2500,
    ...overrides,
  };
}

window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    orderDetail(),
    orderDetail({
      id: "ALU20260621002",
      items: [],
      status: "saved",
    }),
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-order-inventory-stocks",
  JSON.stringify([
    {
      color: "灰色",
      lengthMm: 6000,
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 0,
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([orderCustomerFixture, customerFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([
    productFixture(),
    productFixture({
      assignedCustomerIds: [],
      assignedCustomerNames: [],
      id: "first-public-product",
      moldCode: "PUB-NEW",
      productName: "首次入库商品",
      thicknessMmX100: 110,
      weightPerMeterKgX1000: 1800,
    }),
  ]),
);

const tempDir = await createTempModuleDir("inventory-api-fallback-test-");
const customerPricingPath = new URL(
  "../../src/features/customers/lib/customer-pricing.ts",
  import.meta.url,
);
const browserRuntimePath = new URL("../../src/lib/browser-runtime.ts", import.meta.url);
const datetimePath = new URL("../../src/lib/datetime.ts", import.meta.url);
const processingFeesPath = new URL("../../src/lib/processing-fees.ts", import.meta.url);
const inventoryApiPath = new URL(
  "../../src/features/inventory/api/inventory-api.ts",
  import.meta.url,
);
const inventoryFallbackPath = new URL(
  "../../src/features/inventory/api/inventory-browser-fallback.ts",
  import.meta.url,
);
const inventoryPublicApiPath = new URL(
  "../../src/features/inventory/api/inventory-public-api.ts",
  import.meta.url,
);
const inventoryDeliveryNotesApiPath = new URL(
  "../../src/features/inventory/api/inventory-delivery-notes-api.ts",
  import.meta.url,
);
const inventoryCustomerApiPath = new URL(
  "../../src/features/inventory/api/inventory-customer-api.ts",
  import.meta.url,
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
const rewriteInventorySharedDeps = (source) =>
  source
    .replace('from "@/lib/browser-runtime"', 'from "./browser-runtime.mjs"')
    .replace(
      'from "@/features/customers/lib/customer-pricing"',
      'from "./customer-pricing.mjs"',
    )
    .replace('from "@/lib/datetime"', 'from "./datetime.mjs"')
    .replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"');
const compileInventoryFallback = (outputName) =>
  compileTsModule(
    inventoryFallbackPath,
    path.join(tempDir, outputName),
    rewriteInventorySharedDeps,
  );
const compileInventoryApiModule = (sourcePath, outputName, fallbackFile) =>
  compileTsModule(sourcePath, path.join(tempDir, outputName), (source) =>
    rewriteInventorySharedDeps(source)
      .replace(
        'import { invoke } from "@tauri-apps/api/core"\n',
        "const invoke = async () => { throw new Error('unexpected tauri invoke') }\n",
      )
      .replace('from "./inventory-browser-fallback"', `from "${fallbackFile}"`),
  );
const compileInventoryApiBarrel = (outputName, suffix) =>
  compileTsModule(inventoryApiPath, path.join(tempDir, outputName), (source) =>
    source
      .replace(
        'from "./inventory-public-api"',
        `from "./inventory-public-api${suffix}.mjs"`,
      )
      .replace(
        'from "./inventory-delivery-notes-api"',
        `from "./inventory-delivery-notes-api${suffix}.mjs"`,
      )
      .replace(
        'from "./inventory-customer-api"',
        `from "./inventory-customer-api${suffix}.mjs"`,
      ),
  );
await compileInventoryFallback("inventory-browser-fallback.mjs");
await compileInventoryApiModule(
  inventoryPublicApiPath,
  "inventory-public-api.mjs",
  "./inventory-browser-fallback.mjs",
);
await compileInventoryApiModule(
  inventoryDeliveryNotesApiPath,
  "inventory-delivery-notes-api.mjs",
  "./inventory-browser-fallback.mjs",
);
await compileInventoryApiModule(
  inventoryCustomerApiPath,
  "inventory-customer-api.mjs",
  "./inventory-browser-fallback.mjs",
);
await compileInventoryApiBarrel("inventory-api.mjs", "");

const { browserFallbackInventory } = await import(
  pathToFileURL(path.join(tempDir, "inventory-browser-fallback.mjs")).href
);

const {
  adjustCustomerInventoryStock,
  adjustInventory,
  adjustOrderInventory,
  adjustOrderInventoryBatch,
  createCustomerInventoryBatch,
  createCustomerInventoryDeliveryNote,
  createDeliveryNote,
  deriveCustomerInventoryDeliveryGroupLabel,
  getCustomerInventoryBatch,
  getCustomerInventoryDeliveryNote,
  getCustomerInventoryPrintSnapshot,
  getDeliveryNote,
  importCustomerInventoryBatches,
  listCustomerInventory,
  listInventory,
  readInventoryImagePreview,
  recognizeInventoryImage,
  transferPublicInventoryToOrder,
  transferOrderInventoryRemainder,
  updateCustomerInventoryBatch,
  updateCustomerInventoryDeliveryNoteSpecialNote,
  updateDeliveryNoteSpecialNote,
} = await import(pathToFileURL(path.join(tempDir, "inventory-api.mjs")).href);
const { formatCompactDatePart, formatDateInputValue } = await import(
  pathToFileURL(path.join(tempDir, "datetime.mjs")).href
);

assert.equal(
  deriveCustomerInventoryDeliveryGroupLabel("虎标膜，第一车，其他备注"),
  "第一车",
);
assert.equal(
  deriveCustomerInventoryDeliveryGroupLabel("虎标膜, 第二车，其他备注"),
  "第二车",
);
assert.equal(deriveCustomerInventoryDeliveryGroupLabel("虎标膜，第三车"), "第三车");
assert.equal(deriveCustomerInventoryDeliveryGroupLabel("虎标膜"), "");
assert.equal(deriveCustomerInventoryDeliveryGroupLabel("虎标膜，，其他备注"), "");

const initialInventory = await listInventory({});
assert.equal(initialInventory.items.length, 0);
assert.equal(initialInventory.orderItems.length, 1);
assert.deepEqual(initialInventory.orderItems[0], {
  color: "灰色",
  customerAddress: "测试地址",
  customerName: "测试客户",
  deliveryNoteId: null,
  deliveryNoteIds: [],
  handlerName: "测试经手人",
  inventoryCloseDestination: null,
  inventoryClosedAt: null,
  inventoryLockedAt: null,
  lengthMm: 6000,
  moldCode: "G5501",
  note: "订单行",
  orderId: "ALU20260621001",
  orderNote: "订单备注",
  orderQuantity: 0,
  orderedDate: "2026-06-21",
  pricingTaxIncluded: true,
  productId: "p1",
  productName: "灰色边框",
  publicQuantity: 0,
  requiredQuantity: 3,
});
initialInventory.orderItems[0].orderQuantity = 99;
assert.equal((await listInventory({})).orderItems[0].orderQuantity, 0);
assert.equal((await listInventory({ search: "G5501" })).orderItems.length, 1);
assert.equal((await listInventory({ search: "无匹配库存" })).orderItems.length, 0);

window.dispatchEvent(
  new CustomEvent("order-manager:fallback-order-upserted", {
    detail: orderDetail(),
  }),
);
assert.equal(browserFallbackInventory.orderItems.length, 1);
assert.equal(browserFallbackInventory.orderItems[0].orderQuantity, 0);

window.dispatchEvent(
  new CustomEvent("order-manager:fallback-order-upserted", {
    detail: orderDetail({
      id: "ALU20260621003",
      items: [
        {
          color: "坯料",
          id: "ALU20260621003-001",
          lengthMm: 1000,
          note: null,
          orderId: "ALU20260621003",
          productId: "p3",
          productMoldCode: "G5503",
          productName: "坯料边框",
          quantity: 2,
          theoreticalWeightKgX100: 200,
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 1000,
        },
      ],
    }),
  }),
);
assert.equal(browserFallbackInventory.orderItems.length, 2);
assert.equal(browserFallbackInventory.orderItems[0].orderId, "ALU20260621003");
window.dispatchEvent(
  new CustomEvent("order-manager:fallback-order-upserted", {
    detail: orderDetail({
      id: "ALU20260621003",
      items: [],
      status: "saved",
    }),
  }),
);
assert.equal(browserFallbackInventory.orderItems.length, 1);
assert.equal(browserFallbackInventory.orderItems[0].orderId, "ALU20260621001");
window.dispatchEvent(
  new CustomEvent("order-manager:fallback-order-deleted", {
    detail: { id: "ALU20260621003" },
  }),
);
assert.equal(browserFallbackInventory.orderItems.length, 1);
assert.equal(browserFallbackInventory.orderItems[0].orderId, "ALU20260621001");
assert.equal((await listInventory({})).orderItems.length, 1);

await assert.rejects(
  () =>
    adjustInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "in",
      note: "",
      productId: " ",
      quantity: 1,
    }),
  /请选择商品/,
);
await assert.rejects(
  () =>
    adjustInventory({
      color: "灰色",
      lengthMm: 0,
      movementType: "in",
      note: "",
      productId: "p1",
      quantity: 1,
    }),
  /长度必须大于 0/,
);
await assert.rejects(
  () =>
    adjustInventory({
      color: " ",
      lengthMm: 6000,
      movementType: "in",
      note: "",
      productId: "p1",
      quantity: 1,
    }),
  /颜色不能为空/,
);
await assert.rejects(
  () =>
    adjustInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "bad",
      note: "",
      productId: "p1",
      quantity: 1,
    }),
  /库存类型不正确/,
);
await assert.rejects(
  () =>
    adjustInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "in",
      note: "",
      productId: "p1",
      quantity: 0,
    }),
  /数量必须大于 0/,
);
const firstPublicInventoryItem = await adjustInventory({
  color: " 银色 ",
  lengthMm: 5000,
  movementType: " in ",
  note: " 首次入库 ",
  productId: " first-public-product ",
  quantity: 3,
});
assert.equal(firstPublicInventoryItem.productName, "首次入库商品");
assert.equal(firstPublicInventoryItem.moldCode, "PUB-NEW");
assert.equal(firstPublicInventoryItem.quantity, 3);
assert.equal(firstPublicInventoryItem.latestNote, "首次入库");
assert.equal(
  JSON.parse(
    window.localStorage.getItem("order-manager:fallback-public-inventory-stocks"),
  ).find((item) => item.productId === "first-public-product").quantity,
  3,
);
const clearedFirstPublicInventoryItem = await adjustInventory({
  color: "银色",
  lengthMm: 5000,
  movementType: "adjust",
  note: "首次盘点清零",
  productId: "first-public-product",
  quantity: 0,
});
assert.equal(clearedFirstPublicInventoryItem.quantity, 0);
assert.equal(clearedFirstPublicInventoryItem.updatedAt, null);
assert.equal(
  (await listInventory({ search: "首次入库商品" })).items.length,
  0,
);
const restockedFirstPublicInventoryItem = await adjustInventory({
  color: "银色",
  lengthMm: 5000,
  movementType: "in",
  note: "清零后再次入库",
  productId: "first-public-product",
  quantity: 2,
});
assert.equal(restockedFirstPublicInventoryItem.quantity, 2);
assert.equal(
  (await listInventory({ search: "清零后再次入库" })).recentMovements[0]
    .quantityBefore,
  0,
);
await adjustInventory({
  color: "银色",
  lengthMm: 5000,
  movementType: "adjust",
  note: "回归测试清理",
  productId: "first-public-product",
  quantity: 0,
});
await assert.rejects(
  () =>
    adjustInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "in",
      note: "",
      productId: "missing",
      quantity: 1,
    }),
  /商品不存在/,
);
browserFallbackInventory.items.push({
  color: "银色",
  latestNote: "公共库存测试",
  lengthMm: 5000,
  moldCode: "PUB-001",
  productId: "public-product",
  productName: "公共库存商品",
  quantity: 4,
  thicknessMmX100: 120,
  updatedAt: "2026-06-21T08:00:00.000Z",
  weightPerMeterKgX1000: 2500,
});
const adjustedPublicInventoryItem = await adjustInventory({
  color: "银色",
  lengthMm: 5000,
  movementType: " adjust ",
  note: "",
  productId: " public-product ",
  quantity: 0,
});
assert.equal(adjustedPublicInventoryItem.quantity, 0);
adjustedPublicInventoryItem.quantity = 99;
assert.equal((await listInventory({ search: "公共库存商品" })).items.length, 0);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "produce",
      note: "",
      orderId: " ",
      productId: "p1",
      quantity: 1,
    }),
  /请选择订单/,
);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "produce",
      note: "",
      orderId: "ALU20260621001",
      productId: " ",
      quantity: 1,
    }),
  /请选择商品/,
);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: "灰色",
      lengthMm: 0,
      movementType: "produce",
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /长度必须大于 0/,
);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: " ",
      lengthMm: 6000,
      movementType: "produce",
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /颜色不能为空/,
);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "bad",
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /订单库存类型不正确/,
);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "produce",
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 0,
    }),
  /数量必须大于 0/,
);
assert.equal(
  await adjustOrderInventory({
    color: "灰色",
    lengthMm: 6000,
    movementType: " produce ",
    note: "",
    orderId: "ALU20260621001",
    productId: "p1",
    quantity: 1,
  }),
  undefined,
);
assert.equal(
  await adjustOrderInventory({
    color: "灰色",
    lengthMm: 6000,
    movementType: " adjust ",
    note: "",
    orderId: "ALU20260621001",
    productId: "p1",
    quantity: 0,
  }),
  undefined,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "",
      orderId: " ",
    }),
  /请选择订单/,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [],
      note: "",
      orderId: "ALU20260621001",
    }),
  /请至少录入一项入库数量/,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          productId: " ",
          quantity: 1,
        },
      ],
      note: "",
      orderId: "ALU20260621001",
    }),
  /订单商品不能为空/,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [
        {
          color: "灰色",
          lengthMm: 0,
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "",
      orderId: "ALU20260621001",
    }),
  /长度必须大于 0/,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [
        {
          color: " ",
          lengthMm: 6000,
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "",
      orderId: "ALU20260621001",
    }),
  /颜色不能为空/,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          productId: "p1",
          quantity: 0,
        },
      ],
      note: "",
      orderId: "ALU20260621001",
    }),
  /入库数量必须大于 0/,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          productId: "missing-product",
          quantity: 1,
        },
      ],
      note: "不存在的订单商品",
      orderId: "ALU20260621001",
    }),
  /订单商品不存在/,
);
assert.equal(
  await adjustOrderInventoryBatch({
    items: [
      {
        color: "灰色",
        lengthMm: 6000,
        productId: "p1",
        quantity: 2,
      },
    ],
    note: "",
    orderId: "ALU20260621001",
  }),
  undefined,
);
assert.equal((await listInventory({})).orderItems[0].orderQuantity, 2);
const producedInventory = await listInventory({});
producedInventory.orderItems[0].orderQuantity = 99;
assert.equal((await listInventory({})).orderItems[0].orderQuantity, 2);
assert.equal(
  await adjustOrderInventoryBatch({
    items: [
      {
        color: " 灰色 ",
        lengthMm: 6000,
        productId: " p1 ",
        quantity: 1,
      },
    ],
    note: "",
    orderId: "ALU20260621001",
  }),
  undefined,
);
assert.equal((await listInventory({})).orderItems[0].orderQuantity, 3);
await assert.rejects(
  () =>
    transferPublicInventoryToOrder({
      color: "灰色",
      lengthMm: 6000,
      note: "",
      orderId: " ",
      productId: "p1",
      quantity: 1,
    }),
  /请选择订单/,
);
await assert.rejects(
  () =>
    transferPublicInventoryToOrder({
      color: "灰色",
      lengthMm: 6000,
      note: "",
      orderId: "ALU20260621001",
      productId: " ",
      quantity: 1,
    }),
  /请选择商品/,
);
await assert.rejects(
  () =>
    transferPublicInventoryToOrder({
      color: "灰色",
      lengthMm: 0,
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /长度必须大于 0/,
);
await assert.rejects(
  () =>
    transferPublicInventoryToOrder({
      color: " ",
      lengthMm: 6000,
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /颜色不能为空/,
);
await assert.rejects(
  () =>
    transferPublicInventoryToOrder({
      color: "灰色",
      lengthMm: 6000,
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 0,
    }),
  /转入数量必须大于 0/,
);
await assert.rejects(
  () =>
    transferPublicInventoryToOrder({
      color: "灰色",
      lengthMm: 6000,
      note: "无公共库存",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /转入数量不能大于公共库存/,
);
browserFallbackInventory.items.push({
  color: "灰色",
  latestNote: "公共库存转订单测试",
  lengthMm: 6000,
  moldCode: "G5501",
  productId: "p1",
  productName: "灰色边框",
  quantity: 1,
  thicknessMmX100: 120,
  updatedAt: "2026-06-21T08:00:00.000Z",
  weightPerMeterKgX1000: 2500,
});
assert.equal((await listInventory({})).orderItems[0].publicQuantity, 1);
assert.equal(
  await transferPublicInventoryToOrder({
    color: "灰色",
    lengthMm: 6000,
    note: "公共库存转订单",
    orderId: "ALU20260621001",
    productId: "p1",
    quantity: 1,
  }),
  undefined,
);
assert.equal((await listInventory({})).orderItems[0].orderQuantity, 4);
assert.equal((await listInventory({})).orderItems[0].publicQuantity, 0);
assert.equal(
  await adjustOrderInventory({
    color: "灰色",
    lengthMm: 6000,
    movementType: "ship",
    note: "恢复后续测试库存",
    orderId: "ALU20260621001",
    productId: "p1",
    quantity: 1,
  }),
  undefined,
);
assert.equal((await listInventory({})).orderItems[0].orderQuantity, 3);

await assert.rejects(
  () => recognizeInventoryImage("/tmp/inventory.png"),
  /请在桌面应用中识别入库图片/,
);
await assert.rejects(
  () => readInventoryImagePreview("/tmp/inventory.png"),
  /请在桌面应用中预览入库图片/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [{ name: "运费", amountX100: -1 }],
      items: [],
      note: "",
      orderId: " ",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 0,
      pricingTaxIncluded: true,
    }),
  /收费金额不能小于 0/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "空订单",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "空订单出库",
      orderId: " ",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /请选择订单/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [],
      note: "空明细出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /请至少选择一项出库明细/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "负重量",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "负重量出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: -1,
      pricingTaxIncluded: true,
    }),
  /重量不能小于 0/,
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    ...JSON.parse(
      window.localStorage.getItem("order-manager:fallback-order-details"),
    ),
    orderDetail({
      id: "ALU20260621004",
      items: [
        {
          color: "坯料",
          id: "ALU20260621004-001",
          lengthMm: 6000,
          note: "无库存订单行",
          orderId: "ALU20260621004",
          productId: "p4",
          productMoldCode: "G5504",
          productName: "无库存边框",
          quantity: 1,
          theoreticalWeightKgX100: 100,
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 1000,
        },
      ],
    }),
  ]),
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 500,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "坯料",
          lengthMm: 6000,
          note: "缺少计价且无库存",
          productId: "p4",
          quantity: 1,
        },
      ],
      note: "计价错误优先",
      orderId: "ALU20260621004",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 0,
      pricingTaxIncluded: true,
    }),
  /含税坯料加工费未设置，请先维护客户资料/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "零数量且无库存",
          productId: "p4",
          quantity: 0,
        },
      ],
      note: "无库存错误优先",
      orderId: "ALU20260621004",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 0,
      pricingTaxIncluded: true,
    }),
  /当前订单没有可出库库存/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "负数量且无库存",
          productId: "p4",
          quantity: -1,
        },
      ],
      note: "负数量错误优先",
      orderId: "ALU20260621004",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 0,
      pricingTaxIncluded: true,
    }),
  /出库数量不能小于 0/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "缺少喷涂重量",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "缺少喷涂重量出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 0,
      pricingTaxIncluded: true,
    }),
  /请填写喷涂重量/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 500,
      electrophoresisWeightKgX100: 500,
      extraCharges: [],
      items: [
        {
          color: "双面氧化 1#色",
          lengthMm: 6000,
          note: "冲突颜色",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "冲突颜色出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 500,
      powderWeightKgX100: 0,
      pricingTaxIncluded: true,
    }),
  /颜色“双面氧化 1#色”同时命中断桥、氧化、电泳，请检查颜色录入/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "空商品",
          productId: " ",
          quantity: 1,
        },
      ],
      note: "空商品出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /出库商品不能为空/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 0,
          note: "零长度",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "零长度出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /长度必须大于 0/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: " ",
          lengthMm: 6000,
          note: "空颜色",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "空颜色出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /颜色不能为空/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "零数量",
          productId: "p1",
          quantity: 0,
        },
      ],
      note: "零数量出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /请至少录入一项出库数量/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "负数量",
          productId: "p1",
          quantity: -1,
        },
      ],
      note: "负数量出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /出库数量不能小于 0/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [{ name: "运费", amountX100: -1 }],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "负收费",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "负收费出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /收费金额不能小于 0/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [{ name: "运费", amountX100: 0 }],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "零收费",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "零收费出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /收费金额必须大于 0/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "超总库存",
          productId: "p1",
          quantity: 4,
        },
      ],
      note: "超总库存出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /出库数量不能大于当前订单库存/,
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    orderDetail({
      items: [
        {
          color: "灰色",
          id: "ALU20260621001-001",
          lengthMm: 6000,
          note: "订单行",
          orderId: "ALU20260621001",
          productId: "p1",
          productMoldCode: "G5501",
          productName: "灰色边框",
          quantity: 3,
          theoreticalWeightKgX100: 4500,
          thicknessMmX100: 120,
          weightPerMeterKgX1000: 2500,
        },
        {
          color: "白色",
          id: "ALU20260621001-002",
          lengthMm: 3000,
          note: null,
          orderId: "ALU20260621001",
          productId: "p2",
          productMoldCode: "G5502",
          productName: "白色边框",
          quantity: 1,
          theoreticalWeightKgX100: 300,
          thicknessMmX100: 110,
          weightPerMeterKgX1000: 1000,
        },
      ],
    }),
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-order-inventory-stocks",
  JSON.stringify([
    {
      color: "灰色",
      lengthMm: 6000,
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 2,
    },
    {
      color: "白色",
      lengthMm: 3000,
      orderId: "ALU20260621001",
      productId: "p2",
      quantity: 2,
    },
  ]),
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "单行超库存",
          productId: "p1",
          quantity: 3,
        },
        {
          color: "白色",
          lengthMm: 3000,
          note: "补足总量",
          productId: "p2",
          quantity: 1,
        },
      ],
      note: "单行超库存出库",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /灰色边框 出库数量不能大于当前库存/,
);
assert.equal(
  JSON.parse(
    window.localStorage.getItem("order-manager:fallback-delivery-notes") ?? "{}",
  )["ALU20260621001-01"],
  undefined,
);
window.localStorage.setItem(
  "order-manager:fallback-order-inventory-stocks",
  JSON.stringify([
    {
      color: "灰色",
      lengthMm: 6000,
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 3,
    },
  ]),
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "缺失订单",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "缺失订单出库",
      orderId: "ALU404",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /订单不存在或未下单/,
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "保存单",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "保存单出库",
      orderId: "ALU20260621002",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /订单不存在或未下单/,
);

browserFallbackInventory.recentMovements.length = 0;
browserFallbackInventory.orderMovements.length = 0;
window.localStorage.setItem("order-manager:fallback-inventory-movements", "[]");
const deliveryOrder = orderDetail({
  items: [
    orderDetail().items[0],
    {
      color: "白色",
      id: "ALU20260621001-002",
      lengthMm: 4000,
      note: "订单第二行",
      orderId: "ALU20260621001",
      productId: "p2",
      productMoldCode: "G5502",
      productName: "白色边框",
      quantity: 2,
      theoreticalWeightKgX100: 800,
      thicknessMmX100: 110,
      weightPerMeterKgX1000: 1000,
    },
  ],
  note: "加急订单",
});
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    deliveryOrder,
    orderDetail({
      id: "ALU20260621002",
      items: [],
      status: "saved",
    }),
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-order-inventory-stocks",
  JSON.stringify([
    {
      color: "灰色",
      lengthMm: 6000,
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 3,
    },
    {
      color: "白色",
      lengthMm: 4000,
      orderId: "ALU20260621001",
      productId: "p2",
      quantity: 2,
    },
  ]),
);

const deliveryNote = await createDeliveryNote({
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,


  extraCharges: [
    { name: " 运费 ", amountX100: 15000 },
    { name: "装车费", amountX100: 5000 },
  ],
  items: [
    {
      color: " 灰色 ",
      lengthMm: 6000,
      note: " 本次出库 ",
      productId: " p1 ",
      quantity: 2,
    },
    {
      color: " 白色 ",
      lengthMm: 4000,
      note: "第二项出库",
      productId: " p2 ",
      quantity: 1,
    },
  ],
  note: " 出库备注 ",
  orderId: "ALU20260621001",
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 1234,
  pricingTaxIncluded: false,
});

assert.equal(deliveryNote.id, "ALU20260621001-01");
assert.equal(deliveryNote.deliveryDate, formatDateInputValue(new Date()));
assert.equal(deliveryNote.customerName, "测试客户");
assert.equal("extraChargeName" in deliveryNote, false);
assert.equal("extraChargeAmountX100" in deliveryNote, false);
assert.equal(deliveryNote.extraCharges.reduce((sum, row) => sum + row.amountX100, 0), 20000);
assert.deepEqual(deliveryNote.extraCharges, [
  { name: "运费", amountX100: 15000 },
  { name: "装车费", amountX100: 5000 },
]);
deliveryNote.extraCharges[0].name = "polluted";
assert.equal((await getDeliveryNote(deliveryNote.id)).extraCharges[0].name, "运费");
assert.equal(deliveryNote.powderProcessingFeeX100, 350);
assert.equal(deliveryNote.pricingProfileName, "加急价");
assert.equal(deliveryNote.pricingTaxIncluded, false);
assert.equal(deliveryNote.pricingTriggerKeyword, "加急");
assert.equal(deliveryNote.items.length, 2);
assert.equal(dispatchedEvents.at(-1).type, "order-manager:fallback-order-upserted");
assert.equal(dispatchedEvents.at(-1).detail.deliveryNoteId, "ALU20260621001-01");
assert.deepEqual(dispatchedEvents.at(-1).detail.deliveryNoteIds, [
  "ALU20260621001-01",
]);
dispatchedEvents.at(-1).detail.deliveryNoteId = "polluted-note";
dispatchedEvents.at(-1).detail.items[0].quantity = 99;
const storedOrderAfterDeliveryEventMutation = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
).find((order) => order.id === "ALU20260621001");
assert.equal(
  storedOrderAfterDeliveryEventMutation.deliveryNoteId,
  "ALU20260621001-01",
);
assert.deepEqual(storedOrderAfterDeliveryEventMutation.deliveryNoteIds, [
  "ALU20260621001-01",
]);
assert.ok(storedOrderAfterDeliveryEventMutation.inventoryLockedAt);
assert.equal(storedOrderAfterDeliveryEventMutation.inventoryClosedAt, null);
assert.equal(storedOrderAfterDeliveryEventMutation.inventoryCloseDestination, null);
assert.equal(storedOrderAfterDeliveryEventMutation.items[0].quantity, 3);
assert.deepEqual(deliveryNote.items[0], {
  color: "灰色",
  id: "ALU20260621001-01-001",
  lengthMm: 6000,
  moldCode: "G5501",
  note: "本次出库",
  orderQuantity: 3,
  productId: "p1",
  productName: "灰色边框",
  quantity: 2,
});
assert.deepEqual(deliveryNote.items[1], {
  color: "白色",
  id: "ALU20260621001-01-002",
  lengthMm: 4000,
  moldCode: "G5502",
  note: "第二项出库",
  orderQuantity: 2,
  productId: "p2",
  productName: "白色边框",
  quantity: 1,
});
deliveryNote.items[0].quantity = 99;
assert.equal((await getDeliveryNote("ALU20260621001-01")).items[0].quantity, 2);
assert.equal((await getDeliveryNote("ALU20260621001-01")).note, "出库备注");
const updatedDeliverySpecialNote = await updateDeliveryNoteSpecialNote({
  id: " ALU20260621001-01 ",
  specialNote: "  现场先电话确认再卸货  ",
});
assert.equal(updatedDeliverySpecialNote.specialNote, "现场先电话确认再卸货");
assert.equal(
  (await getDeliveryNote("ALU20260621001-01")).specialNote,
  "现场先电话确认再卸货",
);
const storedOrdersBeforeDuplicatePriority = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify(
    storedOrdersBeforeDuplicatePriority.filter(
      (order) => order.id !== "ALU20260621001",
    ),
  ),
);
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "重复出库",
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "重复出库备注",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /订单不存在或未下单/,
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify(storedOrdersBeforeDuplicatePriority),
);
await compileInventoryFallback("inventory-browser-fallback-reloaded.mjs");
await compileInventoryApiModule(
  inventoryPublicApiPath,
  "inventory-public-api-reloaded.mjs",
  "./inventory-browser-fallback-reloaded.mjs",
);
await compileInventoryApiModule(
  inventoryDeliveryNotesApiPath,
  "inventory-delivery-notes-api-reloaded.mjs",
  "./inventory-browser-fallback-reloaded.mjs",
);
await compileInventoryApiModule(
  inventoryCustomerApiPath,
  "inventory-customer-api-reloaded.mjs",
  "./inventory-browser-fallback-reloaded.mjs",
);
await compileInventoryApiBarrel("inventory-api-reloaded.mjs", "-reloaded");
const {
  getCustomerInventoryDeliveryNote: getReloadedCustomerInventoryDeliveryNote,
  getDeliveryNote: getReloadedDeliveryNote,
  listInventory: listReloadedInventory,
} = await import(pathToFileURL(path.join(tempDir, "inventory-api-reloaded.mjs")).href);

assert.deepEqual((await getReloadedDeliveryNote("ALU20260621001-01")).extraCharges, [
  { name: "运费", amountX100: 15000 },
  { name: "装车费", amountX100: 5000 },
]);
assert.equal(
  (await getReloadedDeliveryNote("ALU20260621001-01")).specialNote,
  "现场先电话确认再卸货",
);
assert.equal(
  (await listReloadedInventory({})).items.find((item) => item.productId === "p1"),
  undefined,
);
assert.equal((await listReloadedInventory({})).recentMovements.length, 2);
await assert.rejects(() => getDeliveryNote(" "), /出库单号不能为空/);
await assert.rejects(() => getDeliveryNote("missing"), /出库单不存在/);

const postDeliveryInventory = await listInventory({});
assert.equal(postDeliveryInventory.orderItems[0].deliveryNoteId, "ALU20260621001-01");
assert.deepEqual(postDeliveryInventory.orderItems[0].deliveryNoteIds, [
  "ALU20260621001-01",
]);
assert.equal(postDeliveryInventory.orderItems[0].orderQuantity, 1);
assert.ok(postDeliveryInventory.orderItems[0].inventoryLockedAt);
assert.equal(postDeliveryInventory.orderItems[0].inventoryClosedAt, null);
assert.equal(
  postDeliveryInventory.items.find(
    (item) => ["p1", "p2"].includes(item.productId),
  ),
  undefined,
);
assert.equal(postDeliveryInventory.totalQuantity, 0);
assert.deepEqual(
  postDeliveryInventory.recentMovements.map((movement) => ({
    deltaQuantity: movement.deltaQuantity,
    movementType: movement.movementType,
    productId: movement.productId,
  })),
  [
    { deltaQuantity: -1, movementType: "ship", productId: "p2" },
    { deltaQuantity: -2, movementType: "ship", productId: "p1" },
  ],
);
assert.deepEqual(
  postDeliveryInventory.orderMovements.map((movement) => movement.id),
  postDeliveryInventory.recentMovements.map((movement) => movement.id),
);
postDeliveryInventory.recentMovements[0].deltaQuantity = 99;
assert.equal((await listInventory({})).recentMovements[0].deltaQuantity, -1);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: "灰色",
      lengthMm: 6000,
      movementType: "produce",
      note: "出库后单行入库",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /订单已出库，库存已锁定/,
);
await assert.rejects(
  () =>
    adjustOrderInventory({
      color: "不存在颜色",
      lengthMm: 1,
      movementType: "produce",
      note: "出库后错误规格",
      orderId: "ALU20260621001",
      productId: "missing-product",
      quantity: 1,
    }),
  /该订单已出库，库存已锁定/,
);
await assert.rejects(
  () =>
    adjustOrderInventoryBatch({
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          productId: "p1",
          quantity: 1,
        },
      ],
      note: "出库后批量入库",
      orderId: "ALU20260621001",
    }),
  /该订单已出库，库存已锁定/,
);
await assert.rejects(
  () =>
    transferPublicInventoryToOrder({
      color: "灰色",
      lengthMm: 6000,
      note: "出库后公共库存转入",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 1,
    }),
  /订单已出库，库存已锁定/,
);
assert.equal(
  JSON.parse(window.localStorage.getItem("order-manager:fallback-order-details"))[0]
    .deliveryNoteId,
  "ALU20260621001-01",
);

const secondDeliveryNote = await createDeliveryNote({
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraCharges: [],
  items: [
    {
      color: "灰色",
      lengthMm: 6000,
      note: "第二次出库",
      productId: "p1",
      quantity: 1,
    },
  ],
  note: "第二张出库单",
  orderId: "ALU20260621001",
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 500,
  pricingTaxIncluded: false,
});
assert.equal(secondDeliveryNote.id, "ALU20260621001-02");
assert.equal((await listInventory({})).orderItems[0].orderQuantity, 0);
assert.equal((await listInventory({})).orderItems[1].orderQuantity, 1);
assert.deepEqual((await listInventory({})).orderItems[0].deliveryNoteIds, [
  "ALU20260621001-01",
  "ALU20260621001-02",
]);

const publicRemainderResult = await transferOrderInventoryRemainder({
  destination: "public",
  note: "人工转公共库存",
  orderId: "ALU20260621001",
});
assert.deepEqual(publicRemainderResult, {
  customerInventoryBatchId: null,
  destination: "public",
  totalQuantity: 1,
});
const afterPublicRemainder = await listInventory({});
assert.equal(
  afterPublicRemainder.items.find(
    (item) =>
      item.productId === "p2" && item.lengthMm === 4000 && item.color === "白色",
  ).quantity,
  1,
);
assert.equal(afterPublicRemainder.orderItems[1].orderQuantity, 0);
const orderAfterPublicRemainder = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
).find((order) => order.id === "ALU20260621001");
assert.ok(orderAfterPublicRemainder.inventoryClosedAt);
assert.equal(orderAfterPublicRemainder.inventoryCloseDestination, "public");
await assert.rejects(
  () =>
    createDeliveryNote({
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "白色",
          lengthMm: 4000,
          note: "完结后出库",
          productId: "p2",
          quantity: 1,
        },
      ],
      note: "完结后第三张出库单",
      orderId: "ALU20260621001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      pricingTaxIncluded: true,
    }),
  /该订单库存已完结，不能继续出库/,
);

await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: " ",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-EMPTY-CUSTOMER",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "空客户",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "空客户批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /请选择客户/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 0,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-ZERO-PRICE",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "零铝锭价",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "零铝锭价批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /铝锭价必须大于 0/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-EMPTY-PRODUCT",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "空商品",
          productId: " ",
          quantity: 1,
        },
      ],
      note: "空商品批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /请选择商品/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-ZERO-LENGTH",
      items: [
        {
          color: "灰色",
          lengthMm: 0,
          note: "零长度",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "零长度批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /长度必须大于 0/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-EMPTY-COLOR",
      items: [
        {
          color: " ",
          lengthMm: 6000,
          note: "空颜色",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "空颜色批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /颜色不能为空/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-ZERO-QUANTITY",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "零数量",
          productId: "history-product",
          quantity: 0,
        },
      ],
      note: "零数量批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /数量必须大于 0/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-UNASSIGNED-PRODUCT",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "未归属商品",
          productId: "missing-product",
          quantity: 1,
        },
      ],
      note: "未归属商品批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /商品不属于当前客户/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-MISSING-FEE",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "缺少喷涂加工费",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "缺少喷涂加工费批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 0,
      pricingTaxIncluded: true,
    }),
  /含税喷涂加工费未设置/,
);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "20260620",
      historicalOrderRef: "OLD-INVALID-DATE",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "无效日期",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "无效日期批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /历史下单日期格式必须为 YYYY-MM-DD/,
);
await createCustomerInventoryBatch({
  aluminumIngotPriceX100: 2000000,
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  customerId: "history-customer",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: " 2026-06-20 ",
  historicalOrderRef: " OLD-001 ",
  items: [
    {
      color: " 灰色 ",
      lengthMm: 6000,
      note: " 补录明细 ",
      productId: " history-product ",
      quantity: 5,
    },
  ],
  note: " 补录批次 ",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 100,
  pricingTaxIncluded: true,
});

const customerInventory = await listCustomerInventory({});
assert.equal(customerInventory.batches.length, 1);
assert.equal(customerInventory.totalQuantity, 5);
assert.equal(customerInventory.recentMovements.length, 1);
assert.equal(customerInventory.recentMovements[0].movementType, "historical_import");
assert.equal(customerInventory.recentMovements[0].note, "补录批次");
customerInventory.recentMovements[0].movementType = "adjust";
assert.equal(
  (await listCustomerInventory({})).recentMovements[0].movementType,
  "historical_import",
);
assert.equal(customerInventory.batches[0].id, "KH-20260620001");
assert.equal(customerInventory.batches[0].customerName, "历史库存客户");
assert.equal(customerInventory.batches[0].historicalOrderDate, "2026-06-20");
assert.equal(customerInventory.batches[0].historicalOrderRef, "OLD-001");
assert.equal(customerInventory.batches[0].note, "补录批次");
assert.equal(customerInventory.batches[0].items[0].color, "灰色");
assert.equal(customerInventory.batches[0].items[0].note, "补录明细");
assert.equal(customerInventory.batches[0].items[0].productId, "history-product");
assert.equal(customerInventory.batches[0].items[0].productName, "历史库存商品");
assert.equal(customerInventory.batches[0].items[0].moldCode, "H-001");
customerInventory.batches[0].customerName = "列表污染客户库存";
customerInventory.batches[0].items[0].quantity = 99;
customerInventory.batches[0].deliveryNoteIds.push("polluted-note");
assert.equal((await listCustomerInventory({})).batches[0].customerName, "历史库存客户");
assert.equal((await listCustomerInventory({})).batches[0].items[0].quantity, 5);
assert.deepEqual((await listCustomerInventory({})).batches[0].deliveryNoteIds, []);
const emptyCustomerInventorySearch = await listCustomerInventory({
  search: "无匹配客户库存",
});
assert.equal(emptyCustomerInventorySearch.batches.length, 0);
assert.equal(emptyCustomerInventorySearch.recentMovements.length, 0);
assert.equal(emptyCustomerInventorySearch.totalQuantity, 5);
const productCustomerInventorySearch = await listCustomerInventory({
  search: "历史库存商品",
});
assert.equal(productCustomerInventorySearch.batches.length, 1);
assert.equal(productCustomerInventorySearch.recentMovements.length, 1);
assert.equal((await listCustomerInventory({ search: "6000" })).batches.length, 1);

await assert.rejects(
  () => getCustomerInventoryPrintSnapshot(" "),
  /请选择客户/,
);
await assert.rejects(
  () => getCustomerInventoryPrintSnapshot("missing-customer"),
  /客户不存在/,
);
await assert.rejects(
  () => getCustomerInventoryPrintSnapshot("c1"),
  /该客户暂无当前库存/,
);
const customerInventoryStorageKey =
  "order-manager:fallback-customer-inventory-batches";
const originalCustomerInventoryStorage = window.localStorage.getItem(
  customerInventoryStorageKey,
);
const storedCustomerInventoryBatches = JSON.parse(
  originalCustomerInventoryStorage,
);
storedCustomerInventoryBatches[0].items.push({
  ...storedCustomerInventoryBatches[0].items[0],
  id: "zero-stock-item",
  quantity: 0,
});
window.localStorage.setItem(
  customerInventoryStorageKey,
  JSON.stringify(storedCustomerInventoryBatches),
);
const printSnapshot = await getCustomerInventoryPrintSnapshot(
  " history-customer ",
);
assert.equal(printSnapshot.customerName, "历史库存客户");
assert.equal(printSnapshot.customerAddress, "历史库存地址");
assert.equal(printSnapshot.batches.length, 1);
assert.equal(printSnapshot.batches[0].id, "KH-20260620001");
assert.equal(printSnapshot.batches[0].aluminumIngotPriceX100, 2000000);
assert.equal(printSnapshot.batches[0].pricingTaxIncluded, true);
assert.equal(printSnapshot.batches[0].bridgeProcessingFeeX100, 0);
assert.equal(printSnapshot.batches[0].powderProcessingFeeX100, 100);
assert.equal(printSnapshot.batches[0].billetProcessingFeeX100, 0);
assert.equal(printSnapshot.batches[0].oxidationProcessingFeeX100, 0);
assert.equal(printSnapshot.batches[0].electrophoresisProcessingFeeX100, 0);
assert.equal(printSnapshot.batches[0].itemCount, 1);
assert.equal(printSnapshot.batches[0].totalQuantity, 5);
assert.equal(printSnapshot.batches[0].items[0].quantity, 5);
assert.equal(printSnapshot.itemCount, 1);
assert.equal(printSnapshot.totalQuantity, 5);
assert.match(printSnapshot.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
printSnapshot.batches[0].items[0].quantity = 99;
assert.equal(
  (
    await getCustomerInventoryPrintSnapshot("history-customer")
  ).batches[0].items[0].quantity,
  5,
);
window.localStorage.setItem(
  customerInventoryStorageKey,
  originalCustomerInventoryStorage,
);

await assert.rejects(
  () => getCustomerInventoryBatch(" "),
  /请选择客户库存批次/,
);
const customerBatch = await getCustomerInventoryBatch("KH-20260620001");
assert.equal(customerBatch.items[0].quantity, 5);
customerBatch.items[0].quantity = 99;
assert.equal(
  (await getCustomerInventoryBatch("KH-20260620001")).items[0].quantity,
  5,
);

await assert.rejects(
  () =>
    updateCustomerInventoryBatch({
      aluminumIngotPriceX100: 2100000,
      batchId: " ",
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-EMPTY-BATCH",
      items: customerBatch.items.map((item) => ({
        color: item.color,
        lengthMm: item.lengthMm,
        note: item.note,
        productId: item.productId,
        quantity: item.quantity,
      })),
      note: "空批次更新",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 120,
      pricingTaxIncluded: true,
    }),
  /请选择客户库存批次/,
);
await assert.rejects(
  () =>
    updateCustomerInventoryBatch({
      aluminumIngotPriceX100: 2100000,
      batchId: "KH-20260620001",
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: " ",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-EMPTY-CUSTOMER",
      items: customerBatch.items.map((item) => ({
        color: item.color,
        lengthMm: item.lengthMm,
        note: item.note,
        productId: item.productId,
        quantity: item.quantity,
      })),
      note: "空客户更新",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 120,
      pricingTaxIncluded: true,
    }),
  /请选择客户/,
);
await assert.rejects(
  () =>
    updateCustomerInventoryBatch({
      aluminumIngotPriceX100: 0,
      batchId: "KH-20260620001",
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-ZERO-PRICE",
      items: customerBatch.items.map((item) => ({
        color: item.color,
        lengthMm: item.lengthMm,
        note: item.note,
        productId: item.productId,
        quantity: item.quantity,
      })),
      note: "零铝锭价更新",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 120,
      pricingTaxIncluded: true,
    }),
  /铝锭价必须大于 0/,
);
await assert.rejects(
  () =>
    updateCustomerInventoryBatch({
      aluminumIngotPriceX100: 2100000,
      batchId: "KH-20260620001",
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-EMPTY-ITEMS",
      items: [],
      note: "空明细更新",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 120,
      pricingTaxIncluded: true,
    }),
  /请至少添加一项客户库存/,
);
await assert.rejects(
  () =>
    updateCustomerInventoryBatch({
      aluminumIngotPriceX100: 2100000,
      batchId: "KH-20260620001",
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-UNASSIGNED-PRODUCT",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "未归属商品更新",
          productId: "missing-product",
          quantity: 1,
        },
      ],
      note: "未归属商品更新",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 120,
      pricingTaxIncluded: true,
    }),
  /商品不属于当前客户/,
);
await assert.rejects(
  () =>
    updateCustomerInventoryBatch({
      aluminumIngotPriceX100: 2100000,
      batchId: "KH-20260620001",
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-MISSING-FEE",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "缺少喷涂加工费更新",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "缺少喷涂加工费更新",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 0,
      pricingTaxIncluded: true,
    }),
  /含税喷涂加工费未设置/,
);
await updateCustomerInventoryBatch({
  aluminumIngotPriceX100: 2100000,
  batchId: "KH-20260620001",
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  customerId: "history-customer",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: "2026-06-20",
  historicalOrderRef: " OLD-001-A ",
  items: [
    {
      color: " 灰色 ",
      lengthMm: 6000,
      note: " 修改后明细 ",
      productId: " history-product ",
      quantity: 6,
    },
  ],
  note: " 虎标膜，后批次，修改后批次 ",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 120,
  pricingTaxIncluded: true,
});
const updatedCustomerBatch = await getCustomerInventoryBatch("KH-20260620001");
assert.equal(updatedCustomerBatch.aluminumIngotPriceX100, 2100000);
assert.equal(updatedCustomerBatch.historicalOrderRef, "OLD-001-A");
assert.equal(updatedCustomerBatch.items[0].color, "灰色");
assert.equal(updatedCustomerBatch.items[0].productId, "history-product");
assert.equal(updatedCustomerBatch.items[0].productName, "历史库存商品");
assert.equal(updatedCustomerBatch.items[0].quantity, 6);
assert.equal(updatedCustomerBatch.items[0].note, "修改后明细");
assert.equal(updatedCustomerBatch.note, "虎标膜，后批次，修改后批次");
const updatedHistoricalImportMovements = (
  await listCustomerInventory({ search: "修改后批次" })
).recentMovements.filter(
  (movement) =>
    movement.batchId === updatedCustomerBatch.id &&
    movement.movementType === "historical_import",
);
assert.equal(updatedHistoricalImportMovements.length, 1);
assert.equal(updatedHistoricalImportMovements[0].quantityAfter, 6);
assert.equal(
  updatedHistoricalImportMovements[0].note,
  "虎标膜，后批次，修改后批次",
);
assert.equal(
  (await listCustomerInventory({ search: "补录批次" })).recentMovements.length,
  0,
);
const customerInventoryBatchesWithMissingDeliveryFee = JSON.parse(
  window.localStorage.getItem(
    "order-manager:fallback-customer-inventory-batches",
  ) ?? "[]",
);
customerInventoryBatchesWithMissingDeliveryFee[0].powderProcessingFeeX100 = 0;
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-batches",
  JSON.stringify(customerInventoryBatchesWithMissingDeliveryFee),
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "missing-batch",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [
        {
          note: "不存在批次优先",
          quantity: -1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "不存在批次优先于负数校验",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: -1,
    }),
  /客户库存批次不存在/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [
        {
          note: "损坏价格快照",
          quantity: 1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "缺加工费客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    }),
  /含税喷涂加工费未设置/,
);
customerInventoryBatchesWithMissingDeliveryFee[0].powderProcessingFeeX100 = 120;
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-batches",
  JSON.stringify(customerInventoryBatchesWithMissingDeliveryFee),
);
assert.equal(
  (await getCustomerInventoryBatch("KH-20260620001")).items[0].quantity,
  6,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: " ",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: " ",
      items: [
        {
          note: "空批次优先",
          quantity: 1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "空批次客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: -1,
    }),
  /请选择客户库存批次/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: " ",
      items: [
        {
          note: "空经手人",
          quantity: 1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "空经手人客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    }),
  /请输入经手人/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [],
      note: "空明细客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    }),
  /请至少选择一项出库明细/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [
        {
          note: "负重量",
          quantity: 1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "负重量客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: -1,
    }),
  /重量不能小于 0/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [
        {
          note: "负数量",
          quantity: -1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "负数量客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    }),
  /出库数量不能小于 0/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [
        {
          note: "不存在明细",
          quantity: 1,
          stockId: "missing-stock",
        },
      ],
      note: "不存在明细客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    }),
  /客户库存商品不存在/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [],
      note: "空库存 ID",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
      priceGroups: [
        {
          batchIds: [" ", "KH-20260620001", "KH-20260620001"],
          billetWeightKgX100: 0,
          bridgeWeightKgX100: 0,
          electrophoresisWeightKgX100: 0,
          extraChargeAmountX100: 0,
          extraChargeName: "",
          items: [
            {
              note: "空库存 ID",
              quantity: 1,
              stockId: " ",
            },
          ],
          oxidationWeightKgX100: 0,
          powderWeightKgX100: 500,
        },
      ],
    }),
  /出库商品不能为空/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [
        {
          note: "超库存",
          quantity: 7,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "超库存客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    }),
  /历史库存商品 出库数量不能大于当前库存/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "历史经手人",
      items: [
        {
          note: "缺少喷涂重量",
          quantity: 1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "缺少喷涂重量客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 0,
    }),
  /请填写喷涂重量/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: "KH-20260620001",
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "装车费",
      handlerName: "历史经手人",
      items: [
        {
          note: "零收费",
          quantity: 1,
          stockId: updatedCustomerBatch.items[0].id,
        },
      ],
      note: "零收费客户库存出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    }),
  /收费金额必须大于 0/,
);

const customerDeliveryNote = await createCustomerInventoryDeliveryNote({
  batchId: "KH-20260620001",
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraChargeAmountX100: 5000,
  extraChargeName: "装车费",
  handlerName: "历史经手人",
  items: [
    {
      note: "部分出库",
      quantity: 2,
      stockId: ` ${updatedCustomerBatch.items[0].id} `,
    },
  ],
  note: "客户库存出库备注",
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 1234,
});
assert.equal(customerDeliveryNote.id, "KH-20260620001-01");
assert.equal(
  customerDeliveryNote.deliveryDate,
  formatDateInputValue(new Date()),
);
assert.equal(customerDeliveryNote.orderId, "KH-20260620001");
assert.equal(customerDeliveryNote.customerName, "历史库存客户");
assert.deepEqual(customerDeliveryNote.extraCharges, [{ name: "装车费", amountX100: 5000 }]);
assert.equal(customerDeliveryNote.pricingProfileName, "默认价");
assert.equal(customerDeliveryNote.pricingTriggerKeyword, "");
assert.equal(customerDeliveryNote.items.length, 1);
assert.equal(customerDeliveryNote.items[0].orderQuantity, 6);
assert.equal(customerDeliveryNote.items[0].quantity, 2);
assert.equal(customerDeliveryNote.items[0].groupLabel, "后批次");
assert.equal(customerDeliveryNote.items[0].sourceBatchId, "KH-20260620001");
assert.equal(customerDeliveryNote.items[0].productName, "历史库存商品");
customerDeliveryNote.items[0].quantity = 99;
customerDeliveryNote.priceGroups[0].items[0].quantity = 88;
assert.equal(
  (await getCustomerInventoryDeliveryNote("KH-20260620001-01")).items[0]
    .quantity,
  2,
);
assert.equal(
  (await getCustomerInventoryDeliveryNote("KH-20260620001-01")).priceGroups[0]
    .items[0].quantity,
  2,
);
assert.equal(
  (await getCustomerInventoryDeliveryNote("KH-20260620001-01")).note,
  "客户库存出库备注",
);
const updatedCustomerDeliverySpecialNote =
  await updateCustomerInventoryDeliveryNoteSpecialNote({
    id: " KH-20260620001-01 ",
    specialNote: "  客户库存单独提示  ",
  });
assert.equal(updatedCustomerDeliverySpecialNote.specialNote, "客户库存单独提示");
assert.equal(
  (await getCustomerInventoryDeliveryNote("KH-20260620001-01")).specialNote,
  "客户库存单独提示",
);
assert.equal(
  (await getReloadedCustomerInventoryDeliveryNote("KH-20260620001-01"))
    .extraCharges[0].name,
  "装车费",
);
assert.equal(
  (await getReloadedCustomerInventoryDeliveryNote("KH-20260620001-01"))
    .specialNote,
  "客户库存单独提示",
);
assert.equal(
  (await listCustomerInventory({ search: "客户库存出库备注" })).deliveryNotes
    .length,
  1,
);
assert.equal(
  (await listCustomerInventory({ search: "历史库存商品" })).deliveryNotes.length,
  1,
);

const postCustomerDelivery = await getCustomerInventoryBatch("KH-20260620001");
assert.equal(postCustomerDelivery.hasDeliveryNote, true);
assert.equal(postCustomerDelivery.deliveryNoteId, "KH-20260620001-01");
assert.deepEqual(postCustomerDelivery.deliveryNoteIds, ["KH-20260620001-01"]);
assert.equal(postCustomerDelivery.items[0].quantity, 4);
assert.equal(postCustomerDelivery.totalQuantity, 4);

await assert.rejects(
  () =>
    updateCustomerInventoryBatch({
      ...updatedCustomerBatch,
      batchId: "KH-20260620001",
      customerId: "history-customer",
    }),
  /该客户库存批次已出库，不能修改/,
);
await assert.rejects(
  () =>
    adjustCustomerInventoryStock({
      note: "空明细盘点",
      quantity: 3,
      stockId: " ",
    }),
  /请选择客户库存明细/,
);
await assert.rejects(
  () =>
    adjustCustomerInventoryStock({
      note: "负数量盘点",
      quantity: -1,
      stockId: postCustomerDelivery.items[0].id,
    }),
  /盘点数量不能小于 0/,
);
await assert.rejects(
  () =>
    adjustCustomerInventoryStock({
      note: "不存在明细盘点",
      quantity: 3,
      stockId: "missing-stock",
    }),
  /客户库存商品不存在/,
);
await assert.rejects(
  () =>
    adjustCustomerInventoryStock({
      note: "未变化盘点",
      quantity: postCustomerDelivery.items[0].quantity,
      stockId: postCustomerDelivery.items[0].id,
    }),
  /盘点数量未变化/,
);
await adjustCustomerInventoryStock({
  note: "   ",
  quantity: 3,
  stockId: postCustomerDelivery.items[0].id,
});
const adjustedCustomerBatch = await getCustomerInventoryBatch("KH-20260620001");
assert.equal(adjustedCustomerBatch.items[0].quantity, 3);
assert.equal(adjustedCustomerBatch.totalQuantity, 3);
assert.equal(
  (await listCustomerInventory({ search: "客户库存盘点" })).recentMovements[0]
    .note,
  "客户库存盘点",
);
assert.equal((await listCustomerInventory({ search: "历史库存商品" })).batches.length, 1);
await assert.rejects(
  () =>
    createCustomerInventoryBatch({
      aluminumIngotPriceX100: 2200000,
      billetProcessingFeeX100: 100,
      bridgeProcessingFeeX100: 100,
      customerId: "history-customer",
      electrophoresisProcessingFeeX100: 100,
      historicalOrderDate: "2026-06-19",
      historicalOrderRef: "OLD-CONFLICT",
      items: [
        {
          color: "双面氧化 1#色",
          lengthMm: 6000,
          note: "冲突颜色明细",
          productId: "history-product",
          quantity: 1,
        },
      ],
      note: "前冲突",
      oxidationProcessingFeeX100: 100,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
    }),
  /颜色“双面氧化 1#色”同时命中断桥、氧化、电泳，请检查颜色录入/,
);
await createCustomerInventoryBatch({
  aluminumIngotPriceX100: 2200000,
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  customerId: "history-customer",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: "2026-06-21",
  historicalOrderRef: "OLD-002",
  items: [
    {
      color: "灰色",
      lengthMm: 6000,
      note: "多价格明细 A",
      productId: "history-product",
      quantity: 4,
    },
  ],
  note: "前第一车",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 130,
  pricingTaxIncluded: true,
});
await createCustomerInventoryBatch({
  aluminumIngotPriceX100: 2300000,
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  customerId: "history-customer",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: "2026-06-22",
  historicalOrderRef: "OLD-003",
  items: [
    {
      color: "灰色",
      lengthMm: 6000,
      note: "多价格明细 B",
      productId: "history-product",
      quantity: 5,
    },
  ],
  note: "前第二车",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 140,
  pricingTaxIncluded: true,
});
const mergedBatchA = await getCustomerInventoryBatch("KH-20260621001");
const mergedBatchB = await getCustomerInventoryBatch("KH-20260622001");
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchIds: [mergedBatchA.id, mergedBatchB.id],
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "零数量价格组经手人",
      items: [],
      note: "零数量价格组跳过价格校验",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1000,
      priceGroups: [
        {
          batchIds: [mergedBatchA.id, mergedBatchB.id],
          billetWeightKgX100: 0,
          bridgeWeightKgX100: 0,
          electrophoresisWeightKgX100: 0,
          extraChargeAmountX100: 0,
          extraChargeName: "",
          items: [
            {
              groupLabel: "零数量组",
              note: "零数量组",
              quantity: 0,
              stockId: mergedBatchA.items[0].id,
            },
          ],
          oxidationWeightKgX100: 0,
          powderWeightKgX100: 0,
        },
        {
          batchIds: [mergedBatchA.id],
          billetWeightKgX100: 0,
          bridgeWeightKgX100: 0,
          electrophoresisWeightKgX100: 0,
          extraChargeAmountX100: 0,
          extraChargeName: "",
          items: [
            {
              groupLabel: "有效组",
              note: "空库存 ID",
              quantity: 1,
              stockId: " ",
            },
          ],
          oxidationWeightKgX100: 0,
          powderWeightKgX100: 500,
        },
      ],
    }),
  /出库商品不能为空/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchIds: [mergedBatchA.id],
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "重复库存经手人",
      items: [],
      note: "重复库存累计超限",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1000,
      priceGroups: [
        {
          batchIds: [mergedBatchA.id],
          billetWeightKgX100: 0,
          bridgeWeightKgX100: 0,
          electrophoresisWeightKgX100: 0,
          extraChargeAmountX100: 0,
          extraChargeName: "",
          items: [
            {
              groupLabel: "第一组",
              note: "重复库存 A",
              quantity: 3,
              stockId: mergedBatchA.items[0].id,
            },
          ],
          oxidationWeightKgX100: 0,
          powderWeightKgX100: 500,
        },
        {
          batchIds: [mergedBatchA.id],
          billetWeightKgX100: 0,
          bridgeWeightKgX100: 0,
          electrophoresisWeightKgX100: 0,
          extraChargeAmountX100: 0,
          extraChargeName: "",
          items: [
            {
              groupLabel: "第二组",
              note: "重复库存 B",
              quantity: 3,
              stockId: mergedBatchA.items[0].id,
            },
          ],
          oxidationWeightKgX100: 0,
          powderWeightKgX100: 500,
        },
      ],
    }),
  /历史库存商品 出库数量不能大于当前库存/,
);
assert.equal(
  (await getCustomerInventoryBatch(mergedBatchA.id)).items[0].quantity,
  4,
);
assert.equal(
  (await listCustomerInventory({ search: "重复库存累计超限" })).deliveryNotes
    .length,
  0,
);
assert.equal(
  (await listCustomerInventory({ search: "重复库存累计超限" }))
    .recentMovements.length,
  0,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: mergedBatchA.id,
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "合并经手人",
      items: [
        {
          groupLabel: "第二车",
          note: "批次外明细",
          quantity: 1,
          stockId: mergedBatchB.items[0].id,
        },
      ],
      note: "批次外明细出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1000,
    }),
  /出库明细不属于所选客户库存批次/,
);
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchIds: [mergedBatchA.id, mergedBatchB.id],
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "合并经手人",
      items: [
        {
          groupLabel: "第一车",
          note: "合并 A",
          quantity: 1,
          stockId: mergedBatchA.items[0].id,
        },
        {
          groupLabel: "第二车",
          note: "合并 B",
          quantity: 1,
          stockId: mergedBatchB.items[0].id,
        },
      ],
      note: "错误合并出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1000,
      priceGroups: [
        {
          batchIds: [mergedBatchA.id, mergedBatchB.id],
          billetWeightKgX100: 0,
          bridgeWeightKgX100: 0,
          electrophoresisWeightKgX100: 0,
          extraChargeAmountX100: 0,
          extraChargeName: "",
          items: [
            {
              groupLabel: "第一车",
              note: "合并 A",
              quantity: 1,
              stockId: mergedBatchA.items[0].id,
            },
            {
              groupLabel: "第二车",
              note: "合并 B",
              quantity: 1,
              stockId: mergedBatchB.items[0].id,
            },
          ],
          oxidationWeightKgX100: 0,
          powderWeightKgX100: 1000,
        },
      ],
    }),
  /合并出库的批次价格快照必须一致/,
);
await createCustomerInventoryBatch({
  aluminumIngotPriceX100: 2200000,
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  customerId: "history-customer",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: "2026-06-23",
  historicalOrderRef: "OLD-004",
  items: [
    {
      color: "灰色",
      lengthMm: 6000,
      note: "缺分组明细",
      productId: "history-product",
      quantity: 2,
    },
  ],
  note: "短",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 130,
  pricingTaxIncluded: true,
});
const missingGroupLabelBatch = await getCustomerInventoryBatch("KH-20260623001");
await assert.rejects(
  () =>
    createCustomerInventoryDeliveryNote({
      batchId: missingGroupLabelBatch.id,
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      handlerName: "缺分组经手人",
      items: [
        {
          groupLabel: "",
          note: "缺分组",
          quantity: 1,
          stockId: missingGroupLabelBatch.items[0].id,
        },
      ],
      note: "缺分组出库",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1000,
    }),
  /历史库存商品 出库分组不能为空/,
);
const mergedCustomerDeliveryNote = await createCustomerInventoryDeliveryNote({
  batchIds: [mergedBatchA.id, mergedBatchB.id],
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraChargeAmountX100: 0,
  extraChargeName: "",
  handlerName: "合并经手人",
  items: [
    {
      groupLabel: "第一车",
      note: "合并 A",
      quantity: 2,
      stockId: mergedBatchA.items[0].id,
    },
    {
      groupLabel: "第二车",
      note: "合并 B",
      quantity: 3,
      stockId: mergedBatchB.items[0].id,
    },
  ],
  note: "多价格合并出库",
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 1100,
  priceGroups: [
    {
      batchIds: [mergedBatchA.id],
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 1000,
      extraChargeName: "装车费",
      items: [
        {
          groupLabel: "第一车",
          note: "合并 A",
          quantity: 2,
          stockId: mergedBatchA.items[0].id,
        },
      ],
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1100,
    },
    {
      batchIds: [mergedBatchB.id],
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      items: [
        {
          groupLabel: "第二车",
          note: "合并 B",
          quantity: 3,
          stockId: mergedBatchB.items[0].id,
        },
      ],
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1200,
    },
  ],
});
assert.match(mergedCustomerDeliveryNote.id, /^KH-CK\d{8}-01$/);
assert.equal(
  mergedCustomerDeliveryNote.orderId,
  `${mergedBatchA.id}、${mergedBatchB.id}`,
);
assert.equal(mergedCustomerDeliveryNote.items.length, 2);
assert.equal(
  mergedCustomerDeliveryNote.items[0].id,
  `${mergedCustomerDeliveryNote.id}-001`,
);
assert.equal(mergedCustomerDeliveryNote.priceGroups.length, 2);
assert.equal(mergedCustomerDeliveryNote.priceGroups[0].items[0].priceGroupId, `${mergedCustomerDeliveryNote.id}-PG-001`);
assert.equal(mergedCustomerDeliveryNote.priceGroups[0].pricingProfileName, "默认价");
assert.equal(mergedCustomerDeliveryNote.priceGroups[0].pricingTriggerKeyword, "");
assert.equal(mergedCustomerDeliveryNote.priceGroups[1].powderWeightKgX100, 1200);
assert.equal(mergedCustomerDeliveryNote.priceGroups[1].pricingProfileName, "第二车价");
assert.equal(
  mergedCustomerDeliveryNote.priceGroups[1].pricingTriggerKeyword,
  "第二车",
);
assert.equal(
  (await listCustomerInventory({ search: mergedCustomerDeliveryNote.id }))
    .deliveryNotes.length,
  1,
);
assert.equal(
  (await getCustomerInventoryDeliveryNote(mergedCustomerDeliveryNote.id))
    .priceGroups.length,
  2,
);
const repeatedStockDeliveryNote = await createCustomerInventoryDeliveryNote({
  batchIds: [mergedBatchA.id],
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraChargeAmountX100: 0,
  extraChargeName: "",
  handlerName: "重复库存经手人",
  items: [],
  note: "重复库存合法出库",
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 1000,
  priceGroups: [
    {
      batchIds: [mergedBatchA.id],
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      items: [
        {
          groupLabel: "第一组",
          note: "重复库存 A",
          quantity: 1,
          stockId: mergedBatchA.items[0].id,
        },
      ],
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    },
    {
      batchIds: [mergedBatchA.id],
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraChargeAmountX100: 0,
      extraChargeName: "",
      items: [
        {
          groupLabel: "第二组",
          note: "重复库存 B",
          quantity: 1,
          stockId: mergedBatchA.items[0].id,
        },
      ],
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 500,
    },
  ],
});
assert.deepEqual(
  repeatedStockDeliveryNote.items.map((item) => ({
    orderQuantity: item.orderQuantity,
    quantity: item.quantity,
  })),
  [
    { orderQuantity: 2, quantity: 1 },
    { orderQuantity: 1, quantity: 1 },
  ],
);
assert.equal(
  (await getCustomerInventoryBatch(mergedBatchA.id)).items[0].quantity,
  0,
);
const repeatedStockMovements = (
  await listCustomerInventory({ search: repeatedStockDeliveryNote.id })
).recentMovements.filter(
  (movement) => movement.deliveryNoteId === repeatedStockDeliveryNote.id,
);
assert.deepEqual(
  repeatedStockMovements.map((movement) => ({
    deltaQuantity: movement.deltaQuantity,
    quantityAfter: movement.quantityAfter,
    quantityBefore: movement.quantityBefore,
  })),
  [
    { deltaQuantity: -1, quantityAfter: 0, quantityBefore: 1 },
    { deltaQuantity: -1, quantityAfter: 1, quantityBefore: 2 },
  ],
);
await assert.rejects(
  () => getCustomerInventoryDeliveryNote(" "),
  /出库单号不能为空/,
);
await assert.rejects(
  () => getCustomerInventoryDeliveryNote("note-1"),
  /历史库存出库单不存在/,
);

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([customerFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([productFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-batches",
  JSON.stringify([
    {
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      createdAt: "2026-06-20T08:00:00.000Z",
      customerAddress: "历史地址",
      customerId: "history-customer",
      customerName: "历史库存客户",
      deliveryNoteId: null,
      deliveryNoteIds: [],
      electrophoresisProcessingFeeX100: 0,
      hasDeliveryNote: false,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-GAP",
      id: "KH-20260620003",
      itemCount: 0,
      items: [],
      note: "断号缓存批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
      totalQuantity: 0,
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-movements",
  JSON.stringify([]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-delivery-notes",
  JSON.stringify({}),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-delivery-notes",
  JSON.stringify({}),
);
await createCustomerInventoryBatch({
  aluminumIngotPriceX100: 2000000,
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  customerId: "history-customer",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: "2026-06-20",
  historicalOrderRef: "OLD-GAP-NEXT",
  items: [
    {
      color: "灰色",
      lengthMm: 6000,
      note: "断号后新增",
      productId: "history-product",
      quantity: 1,
    },
  ],
  note: "断号后新增批次",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 100,
  pricingTaxIncluded: true,
});
assert.deepEqual(
  (await listCustomerInventory({ search: "OLD-GAP-NEXT" })).batches.map(
    (batch) => batch.id,
  ),
  ["KH-20260620004"],
);

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([customerFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([productFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-batches",
  JSON.stringify([
    {
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      createdAt: "2026-06-20T08:00:00.000Z",
      customerAddress: "历史地址",
      customerId: "history-customer",
      customerName: "历史库存客户",
      deliveryNoteId: "KH-20260620001-03",
      deliveryNoteIds: ["KH-20260620001-03"],
      electrophoresisProcessingFeeX100: 0,
      hasDeliveryNote: true,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "OLD-DELIVERY-GAP",
      id: "KH-20260620001",
      itemCount: 1,
      items: [
        {
          batchId: "KH-20260620001",
          color: "灰色",
          id: "KH-20260620001-001",
          lengthMm: 6000,
          moldCode: "H-001",
          note: "断号出库明细",
          productId: "history-product",
          productName: "历史库存商品",
          quantity: 3,
          updatedAt: "2026-06-20T08:00:00.000Z",
        },
      ],
      note: "虎标膜，断号分组，断号出库批次",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
      totalQuantity: 3,
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-movements",
  JSON.stringify([]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-delivery-notes",
  JSON.stringify({}),
);
const gapCustomerDeliveryNote = await createCustomerInventoryDeliveryNote({
  batchId: "KH-20260620001",
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraChargeAmountX100: 0,
  extraChargeName: "",
  handlerName: "断号出库经手人",
  items: [
    {
      note: "断号后新增出库",
      quantity: 1,
      stockId: "KH-20260620001-001",
    },
  ],
  note: "断号后新增出库单",
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 500,
});
assert.equal(gapCustomerDeliveryNote.id, "KH-20260620001-04");
assert.equal(gapCustomerDeliveryNote.items[0].groupLabel, "断号分组");

const mergedGapDatePart = formatCompactDatePart(new Date());
const mergedGapExistingId = `KH-CK${mergedGapDatePart}-03`;
window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([customerFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([productFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-batches",
  JSON.stringify([
    {
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      createdAt: "2026-06-20T08:00:00.000Z",
      customerAddress: "历史地址",
      customerId: "history-customer",
      customerName: "历史库存客户",
      deliveryNoteId: null,
      deliveryNoteIds: [],
      electrophoresisProcessingFeeX100: 0,
      hasDeliveryNote: false,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "MERGE-GAP-A",
      id: "KH-20260620001",
      itemCount: 1,
      items: [
        {
          batchId: "KH-20260620001",
          color: "灰色",
          id: "KH-20260620001-001",
          lengthMm: 6000,
          moldCode: "H-001",
          note: "合并断号 A",
          productId: "history-product",
          productName: "历史库存商品",
          quantity: 2,
          updatedAt: "2026-06-20T08:00:00.000Z",
        },
      ],
      note: "合并断号批次 A",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
      totalQuantity: 2,
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
    {
      aluminumIngotPriceX100: 2000000,
      billetProcessingFeeX100: 0,
      bridgeProcessingFeeX100: 0,
      createdAt: "2026-06-20T08:00:00.000Z",
      customerAddress: "历史地址",
      customerId: "history-customer",
      customerName: "历史库存客户",
      deliveryNoteId: null,
      deliveryNoteIds: [],
      electrophoresisProcessingFeeX100: 0,
      hasDeliveryNote: false,
      historicalOrderDate: "2026-06-20",
      historicalOrderRef: "MERGE-GAP-B",
      id: "KH-20260620002",
      itemCount: 1,
      items: [
        {
          batchId: "KH-20260620002",
          color: "灰色",
          id: "KH-20260620002-001",
          lengthMm: 6000,
          moldCode: "H-001",
          note: "合并断号 B",
          productId: "history-product",
          productName: "历史库存商品",
          quantity: 2,
          updatedAt: "2026-06-20T08:00:00.000Z",
        },
      ],
      note: "合并断号批次 B",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 100,
      pricingTaxIncluded: true,
      totalQuantity: 2,
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-movements",
  JSON.stringify([]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-delivery-notes",
  JSON.stringify({
    [mergedGapExistingId]: {
      id: mergedGapExistingId,
    },
  }),
);
const mergedGapCustomerDeliveryNote = await createCustomerInventoryDeliveryNote({
  batchIds: ["KH-20260620001", "KH-20260620002"],
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraChargeAmountX100: 0,
  extraChargeName: "",
  handlerName: "合并断号经手人",
  items: [
    {
      groupLabel: "A",
      note: "合并断号 A",
      quantity: 1,
      stockId: "KH-20260620001-001",
    },
    {
      groupLabel: "B",
      note: "合并断号 B",
      quantity: 1,
      stockId: "KH-20260620002-001",
    },
  ],
  note: "合并断号后新增出库单",
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 500,
});
assert.equal(mergedGapCustomerDeliveryNote.id, `KH-CK${mergedGapDatePart}-04`);

window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-batches",
  JSON.stringify([]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-movements",
  JSON.stringify([]),
);
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([customerFixture()]),
);
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([
    productFixture(),
    productFixture({
      id: "history-product-2",
      moldCode: "H-002",
      productName: "历史库存商品二",
    }),
    productFixture({
      assignedCustomerIds: [],
      assignedCustomerNames: [],
      id: "unassigned-product",
      moldCode: "H-003",
      productName: "未分配商品",
    }),
  ]),
);

const importRow = (overrides = {}) => ({
  aluminumIngotPriceX100: 2050000,
  batchKey: "IMPORT-A",
  batchNote: "批次备注",
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  color: "喷涂灰",
  customerName: "历史库存客户",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: "2026-07-01",
  historicalOrderRef: "OLD-001",
  itemNote: "明细备注",
  lengthMm: 6000,
  moldCode: "H-001",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 100,
  pricingTaxIncluded: true,
  productName: "历史库存商品",
  quantity: 5,
  rowNumber: 2,
  ...overrides,
});

const imported = await importCustomerInventoryBatches([
  importRow(),
  importRow({
    batchKey: "IMPORT-B",
    historicalOrderRef: "OLD-002",
    moldCode: "H-002",
    productName: "历史库存商品二",
    quantity: 7,
    rowNumber: 3,
  }),
]);
assert.equal(imported.batchCount, 2);
assert.equal(imported.itemCount, 2);
assert.equal(imported.totalQuantity, 12);
const importedBatches = JSON.parse(
  window.localStorage.getItem(
    "order-manager:fallback-customer-inventory-batches",
  ),
);
const importedMovements = JSON.parse(
  window.localStorage.getItem(
    "order-manager:fallback-customer-inventory-movements",
  ),
);
assert.equal(importedBatches.length, 2);
assert.equal(
  importedBatches.reduce((total, batch) => total + batch.totalQuantity, 0),
  12,
);
assert.equal(
  importedMovements.filter(
    (movement) => movement.movementType === "historical_import",
  ).length,
  2,
);

await assert.rejects(
  importCustomerInventoryBatches([
    importRow({ batchKey: "ROLLBACK-A", historicalOrderRef: "ROLLBACK-A" }),
    importRow({
      batchKey: "ROLLBACK-B",
      historicalOrderDate: "2026/07/01",
      historicalOrderRef: "ROLLBACK-B",
      rowNumber: 3,
    }),
  ]),
  /日期格式/,
);
assert.equal(
  JSON.parse(
    window.localStorage.getItem(
      "order-manager:fallback-customer-inventory-batches",
    ),
  ).length,
  2,
);

await assert.rejects(
  importCustomerInventoryBatches([
    importRow({
      batchKey: "UNASSIGNED",
      moldCode: "H-003",
      productName: "未分配商品",
    }),
  ]),
  /商品未分配给客户/,
);
await assert.rejects(
  importCustomerInventoryBatches([
    importRow({ batchKey: "DUPLICATE" }),
    importRow({ batchKey: "DUPLICATE", rowNumber: 3 }),
  ]),
  /商品、长度和颜色重复/,
);

const exportedBatchId = importedBatches[0].id;
const reimported = await importCustomerInventoryBatches([
  importRow({
    batchKey: exportedBatchId,
    historicalOrderRef: "REIMPORT-EXPORTED-BATCH",
  }),
]);
assert.equal(reimported.batchCount, 1);
assert.notEqual(reimported.batchIds[0], exportedBatchId);
assert.equal(
  JSON.parse(
    window.localStorage.getItem(
      "order-manager:fallback-customer-inventory-batches",
    ),
  ).length,
  3,
);

const customerRemainderOrderId = "ALU20260701001";
window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-delivery-notes",
  JSON.stringify({}),
);
const customerRemainderOrder = orderDetail({
  customerAddress: "历史库存地址",
  customerId: "history-customer",
  customerName: "历史库存客户",
  id: customerRemainderOrderId,
  items: [
    {
      color: "喷涂灰",
      id: `${customerRemainderOrderId}-001`,
      lengthMm: 6000,
      note: "客户库存转入明细",
      orderId: customerRemainderOrderId,
      productId: "history-product",
      productMoldCode: "H-001",
      productName: "历史库存商品",
      quantity: 5,
      theoreticalWeightKgX100: 7500,
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    },
  ],
  note: "虎标膜，客户库存转入订单完整备注",
  orderedDate: "2026-07-01",
  powderProcessingFeeX100: 100,
});
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    ...JSON.parse(
      window.localStorage.getItem("order-manager:fallback-order-details") ?? "[]",
    ),
    customerRemainderOrder,
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-order-inventory-stocks",
  JSON.stringify([
    ...JSON.parse(
      window.localStorage.getItem("order-manager:fallback-order-inventory-stocks") ??
        "[]",
    ),
    {
      color: "喷涂灰",
      lengthMm: 6000,
      orderId: customerRemainderOrderId,
      productId: "history-product",
      quantity: 5,
    },
  ]),
);
const customerRemainderFirstDelivery = await createDeliveryNote({
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraCharges: [],
  items: [
    {
      color: "喷涂灰",
      lengthMm: 6000,
      note: "首次部分出库",
      productId: "history-product",
      quantity: 2,
    },
  ],
  note: "客户库存转入前出库",
  orderId: customerRemainderOrderId,
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 500,
  pricingTaxIncluded: true,
});
assert.equal(customerRemainderFirstDelivery.id, `${customerRemainderOrderId}-01`);

const customerRemainderResult = await transferOrderInventoryRemainder({
  destination: "customer",
  note: "人工转客户库存",
  orderId: customerRemainderOrderId,
});
assert.equal(customerRemainderResult.destination, "customer");
assert.equal(customerRemainderResult.totalQuantity, 3);
assert.ok(customerRemainderResult.customerInventoryBatchId);
const customerRemainderBatch = (await listCustomerInventory({})).batches.find(
  (batch) => batch.id === customerRemainderResult.customerInventoryBatchId,
);
assert.equal(customerRemainderBatch.sourceOrderId, customerRemainderOrderId);
assert.equal(customerRemainderBatch.historicalOrderDate, "2026-07-01");
assert.equal(customerRemainderBatch.historicalOrderRef, customerRemainderOrderId);
assert.equal(customerRemainderBatch.aluminumIngotPriceX100, 2000000);
assert.equal(customerRemainderBatch.pricingTaxIncluded, true);
assert.equal(customerRemainderBatch.powderProcessingFeeX100, 100);
assert.equal(customerRemainderBatch.note, "虎标膜，客户库存转入订单完整备注");
assert.equal(customerRemainderBatch.totalQuantity, 3);
assert.equal(customerRemainderBatch.items[0].quantity, 3);
assert.ok(
  (await listCustomerInventory({})).recentMovements.some(
    (movement) =>
      movement.batchId === customerRemainderBatch.id &&
      movement.movementType === "transfer_order" &&
      movement.deltaQuantity === 3 &&
      movement.note === "人工转客户库存",
  ),
);
assert.ok(
  (await listInventory({})).recentMovements.some(
    (movement) =>
      movement.orderId === customerRemainderOrderId &&
      movement.movementType === "transfer_customer" &&
      movement.deltaQuantity === -3 &&
      movement.note === "人工转客户库存",
  ),
);
const storedCustomerRemainderOrder = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
).find((order) => order.id === customerRemainderOrderId);
assert.ok(storedCustomerRemainderOrder.inventoryClosedAt);
assert.equal(storedCustomerRemainderOrder.inventoryCloseDestination, "customer");
await assert.rejects(
  transferOrderInventoryRemainder({
    destination: "customer",
    note: "重复转客户库存",
    orderId: customerRemainderOrderId,
  }),
  /该订单库存已完结/,
);

const detachedCustomerPublicOrderId = "ALU20260701002";
const detachedCustomerOrder = orderDetail({
  customerId: null,
  customerName: "已删除客户快照",
  id: detachedCustomerPublicOrderId,
  inventoryLockedAt: "2026-07-01T08:00:00.000Z",
  items: [
    {
      ...orderDetail().items[0],
      id: `${detachedCustomerPublicOrderId}-001`,
      orderId: detachedCustomerPublicOrderId,
      quantity: 2,
    },
  ],
});
const detachedCustomerTargetOrderId = "ALU20260701003";
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    ...JSON.parse(
      window.localStorage.getItem("order-manager:fallback-order-details") ?? "[]",
    ),
    detachedCustomerOrder,
    {
      ...detachedCustomerOrder,
      id: detachedCustomerTargetOrderId,
      items: detachedCustomerOrder.items.map((item) => ({
        ...item,
        id: `${detachedCustomerTargetOrderId}-001`,
        orderId: detachedCustomerTargetOrderId,
      })),
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-order-inventory-stocks",
  JSON.stringify([
    ...JSON.parse(
      window.localStorage.getItem("order-manager:fallback-order-inventory-stocks") ??
        "[]",
    ),
    {
      color: "灰色",
      lengthMm: 6000,
      orderId: detachedCustomerPublicOrderId,
      productId: "p1",
      quantity: 2,
    },
    {
      color: "灰色",
      lengthMm: 6000,
      orderId: detachedCustomerTargetOrderId,
      productId: "p1",
      quantity: 2,
    },
  ]),
);
const detachedCustomerPublicResult = await transferOrderInventoryRemainder({
  destination: "public",
  note: "已删除客户订单转公共库存",
  orderId: detachedCustomerPublicOrderId,
});
assert.equal(detachedCustomerPublicResult.destination, "public");
assert.equal(detachedCustomerPublicResult.totalQuantity, 2);
await assert.rejects(
  transferOrderInventoryRemainder({
    destination: "customer",
    note: "已删除客户订单转客户库存",
    orderId: detachedCustomerTargetOrderId,
  }),
  /订单客户不存在/,
);

const deliveryGapOrderId = "ALU20260702001";
const deliveryGapExistingId = `${deliveryGapOrderId}-03`;
const deliveryGapOrder = orderDetail({
  deliveryNoteId: deliveryGapExistingId,
  deliveryNoteIds: [deliveryGapExistingId],
  id: deliveryGapOrderId,
  inventoryLockedAt: "2026-07-02T08:00:00.000Z",
  items: [
    {
      ...orderDetail().items[0],
      id: `${deliveryGapOrderId}-001`,
      orderId: deliveryGapOrderId,
      quantity: 2,
    },
  ],
  orderedDate: "2026-07-02",
});
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    ...JSON.parse(
      window.localStorage.getItem("order-manager:fallback-order-details") ?? "[]",
    ),
    deliveryGapOrder,
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-order-inventory-stocks",
  JSON.stringify([
    ...JSON.parse(
      window.localStorage.getItem("order-manager:fallback-order-inventory-stocks") ??
        "[]",
    ),
    {
      color: "灰色",
      lengthMm: 6000,
      orderId: deliveryGapOrderId,
      productId: "p1",
      quantity: 2,
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-delivery-notes",
  JSON.stringify({
    [deliveryGapExistingId]: {
      id: deliveryGapExistingId,
      orderId: deliveryGapOrderId,
    },
  }),
);
const deliveryAfterGap = await createDeliveryNote({
  billetWeightKgX100: 0,
  bridgeWeightKgX100: 0,
  electrophoresisWeightKgX100: 0,
  extraCharges: [],
  items: [
    {
      color: "灰色",
      lengthMm: 6000,
      note: "断号后出库",
      productId: "p1",
      quantity: 1,
    },
  ],
  note: "断号后新增出库单",
  orderId: deliveryGapOrderId,
  oxidationWeightKgX100: 0,
  powderWeightKgX100: 500,
  pricingTaxIncluded: true,
});
assert.equal(deliveryAfterGap.id, `${deliveryGapOrderId}-04`);
assert.deepEqual(
  JSON.parse(window.localStorage.getItem("order-manager:fallback-order-details")).find(
    (order) => order.id === deliveryGapOrderId,
  ).deliveryNoteIds,
  [deliveryGapExistingId, `${deliveryGapOrderId}-04`],
);

console.log("inventory api browser fallback rules ok");
