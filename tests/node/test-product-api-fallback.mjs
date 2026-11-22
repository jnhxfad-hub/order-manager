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

window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([
    {
      customerName: "测试客户 A",
      id: "c1",
    },
    {
      customerName: "测试客户 B",
      id: "c2",
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([
    {
      assignedCustomerIds: ["c2"],
      assignedCustomerNames: ["测试客户 B"],
      id: "PROD-001",
      moldCode: "M-000",
      productName: "已缓存边框",
      thicknessMmX100: 100,
      weightPerMeterKgX1000: 2200,
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-products",
  JSON.stringify([["c2", ["PROD-001"]]]),
);

const tempDir = await createTempModuleDir("product-api-fallback-test-");
const browserRuntimePath = new URL("../../src/lib/browser-runtime.ts", import.meta.url);
const productsApiPath = new URL(
  "../../src/features/products/api/products-api.ts",
  import.meta.url,
);
const compileProductsApi = (outputFile) =>
  compileTsModule(
    productsApiPath,
    path.join(tempDir, outputFile),
    (source) =>
      source.replace(
        'import { invoke } from "@tauri-apps/api/core"\n',
        "const invoke = async () => { throw new Error('unexpected tauri invoke') }\n",
      ).replace('from "@/lib/browser-runtime"', 'from "./browser-runtime.mjs"'),
  );

await compileTsModule(browserRuntimePath, path.join(tempDir, "browser-runtime.mjs"));
await compileProductsApi("products-api.mjs");

const {
  assignCustomerProducts,
  createProduct,
  deleteProduct,
  exportProducts,
  importProducts,
  listProductIds,
  listProducts,
  parseProductImportFile,
  setProductCustomers,
  updateProduct,
} = await import(pathToFileURL(path.join(tempDir, "products-api.mjs")).href);

assert.deepEqual(await listProductIds({ customerId: "c2" }), {
  ids: ["PROD-001"],
});
assert.equal(
  (await listProducts({ page: 1, pageSize: 10, search: "已缓存" })).products[0]
    .productName,
  "已缓存边框",
);

const createdProduct = await createProduct({
  moldCode: " M-001 ",
  productName: " 灰色边框 ",
  thicknessMmX100: 120,
  weightPerMeterKgX1000: 2500,
});
assert.equal(createdProduct.id, "PROD-002");
assert.equal(createdProduct.moldCode, "M-001");
assert.equal(createdProduct.productName, "灰色边框");
assert.deepEqual(createdProduct.assignedCustomerIds, []);
createdProduct.productName = "外部污染商品";
createdProduct.assignedCustomerIds.push("polluted-customer");
const listedCreatedProduct = (
  await listProducts({ page: 1, pageSize: 10, search: "M-001" })
).products[0];
assert.equal(listedCreatedProduct.productName, "灰色边框");
assert.deepEqual(listedCreatedProduct.assignedCustomerIds, []);
await assert.rejects(
  () =>
    createProduct({
      moldCode: "M-empty",
      productName: "  ",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    }),
  /商品名称不能为空/,
);
await assert.rejects(
  () =>
    createProduct({
      moldCode: "  ",
      productName: "空模具商品",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    }),
  /模具编号不能为空/,
);
await assert.rejects(
  () =>
    createProduct({
      moldCode: "M-zero-thickness",
      productName: "零厚度商品",
      thicknessMmX100: 0,
      weightPerMeterKgX1000: 2500,
    }),
  /厚度必须大于 0/,
);
await assert.rejects(
  () =>
    createProduct({
      moldCode: "M-zero-weight",
      productName: "零米重商品",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 0,
    }),
  /米重必须大于 0/,
);
await assert.rejects(
  () =>
    createProduct({
      moldCode: "M-001",
      productName: "重复模具商品",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    }),
  /模具编号已存在/,
);

assert.deepEqual(await importProducts({
  products: [
    {
      assignedCustomerNames: [" 测试客户 A ", "测试客户 A", " "],
      moldCode: "M-002",
      productName: "白色边框",
      thicknessMmX100: 110,
      weightPerMeterKgX1000: 2400,
    },
    {
      moldCode: "M-003",
      productName: "坯料边框",
      thicknessMmX100: 100,
      weightPerMeterKgX1000: 2300,
    },
  ],
}), { createdCount: 2 });
await assert.rejects(
  () => importProducts({ products: [] }),
  /没有可导入的商品/,
);
await assert.rejects(
  () =>
    importProducts({
      products: [
        {
          assignedCustomerNames: ["不存在客户"],
          moldCode: "M-404",
          productName: "未知归属商品",
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 2000,
        },
      ],
    }),
  /第 1 行：归属客户不存在：不存在客户/,
);
await assert.rejects(
  () =>
    importProducts({
      products: [
        {
          moldCode: "M-002",
          productName: "新商品",
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 2000,
        },
      ],
    }),
  /第 1 行：模具编号“M-002”已存在于系统商品资料中/,
);
await assert.rejects(
  () =>
    importProducts({
      products: [
        {
          moldCode: "M-002",
          productName: "白色边框",
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 2000,
        },
        {
          moldCode: "M-102",
          productName: "白色边框",
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 2000,
        },
      ],
    }),
  /第 2 行：商品名称“白色边框”在导入文件中重复/,
);
await assert.rejects(
  () =>
    importProducts({
      products: [
        {
          moldCode: "M-101",
          productName: "重复商品",
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 2000,
        },
        {
          moldCode: "M-102",
          productName: "重复商品",
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 2000,
        },
      ],
    }),
  /第 2 行：商品名称“重复商品”在导入文件中重复/,
);
await assert.rejects(
  () =>
    importProducts({
      products: [
        {
          moldCode: "M-import-empty-name",
          productName: "  ",
          thicknessMmX100: 100,
          weightPerMeterKgX1000: 2000,
        },
      ],
    }),
  /第 1 行：商品名称不能为空/,
);

assert.deepEqual(
  (await listProducts({ page: 1, pageSize: 2 })).products.map((product) => product.id),
  ["PROD-004", "PROD-001", "PROD-002", "PROD-003"],
);
const listedProducts = await listProducts({ page: 1, pageSize: 10 });
listedProducts.products[0].productName = "列表污染商品";
listedProducts.products[0].assignedCustomerNames.push("污染客户");
assert.equal(
  (await listProducts({ page: 1, pageSize: 10 })).products[0].productName,
  "坯料边框",
);
assert.deepEqual(
  (await listProducts({ page: 1, pageSize: 10 })).products[0]
    .assignedCustomerNames,
  [],
);
assert.deepEqual(
  (await listProducts({ page: 0, pageSize: 2 })).products.map(
    (product) => product.id,
  ),
  ["PROD-004", "PROD-001", "PROD-002", "PROD-003"],
);
assert.equal(
  (await listProducts({ page: 2, pageSize: 2 })).products.length,
  0,
);
assert.deepEqual(
  (await listProducts({
    assignmentStatus: " assigned ",
    page: 1,
    pageSize: 10,
  })).products.map((product) => product.id),
  ["PROD-001", "PROD-003"],
);
await assert.rejects(
  () =>
    listProducts({
      assignmentStatus: "unknown",
      page: 1,
      pageSize: 10,
    }),
  /归属状态参数无效/,
);
assert.deepEqual(await listProductIds({ search: "白色" }), {
  ids: ["PROD-003"],
});
assert.deepEqual(await listProductIds({ customerId: "c1" }), {
  ids: ["PROD-003"],
});
assert.deepEqual(
  (await exportProducts({ search: "m-00" })).products.map(
    (product) => product.productName,
  ),
  ["坯料边框", "已缓存边框", "灰色边框", "白色边框"],
);
const exportedProducts = await exportProducts({ search: "m-00" });
exportedProducts.products[1].assignedCustomerIds.push("polluted-customer");
assert.deepEqual(
  (await listProducts({ page: 1, pageSize: 10, search: "已缓存" })).products[0]
    .assignedCustomerIds,
  ["c2"],
);

assert.deepEqual(
  await assignCustomerProducts({
    customerId: "c1",
    productIds: ["PROD-002", "PROD-003"],
  }),
  {
    assignedCount: 1,
    skippedCount: 1,
  },
);
await assert.rejects(
  () => assignCustomerProducts({ customerId: "  ", productIds: ["PROD-002"] }),
  /请选择客户/,
);
await assert.rejects(
  () => assignCustomerProducts({ customerId: "c1", productIds: ["  "] }),
  /请选择商品/,
);
await assert.rejects(
  () =>
    assignCustomerProducts({
      customerId: "c1",
      productIds: ["PROD-002", "PROD-002"],
    }),
  /分配列表中存在重复商品/,
);
await assert.rejects(
  () =>
    assignCustomerProducts({
      customerId: "missing-customer",
      productIds: ["PROD-002"],
    }),
  /选择的客户不存在/,
);
await assert.rejects(
  () =>
    assignCustomerProducts({
      customerId: "c1",
      productIds: ["PROD-002", "PROD-999"],
    }),
  /商品不存在/,
);

const assignedProducts = await listProducts({
  assignmentStatus: "assigned",
  page: 1,
  pageSize: 10,
});
assert.deepEqual(
  assignedProducts.products.map((product) => product.assignedCustomerNames),
  [["测试客户 B"], ["测试客户 A"], ["测试客户 A"]],
);
assert.deepEqual(await listProductIds({ customerId: "c1" }), {
  ids: ["PROD-002", "PROD-003"],
});
assert.deepEqual(
  (await listProducts({
    assignmentStatus: "unassigned",
    page: 1,
    pageSize: 10,
  })).products.map((product) => product.id),
  ["PROD-004"],
);

const reassignedProduct = await setProductCustomers({
  customerIds: [" c2 ", "c2", " "],
  productId: " PROD-002 ",
});
assert.deepEqual(reassignedProduct.assignedCustomerIds, ["c2"]);
assert.deepEqual(reassignedProduct.assignedCustomerNames, ["测试客户 B"]);
reassignedProduct.assignedCustomerIds.push("polluted-customer");
assert.deepEqual(
  (await listProducts({ page: 1, pageSize: 10, search: "灰色边框" })).products[0]
    .assignedCustomerIds,
  ["c2"],
);
await assert.rejects(
  () => setProductCustomers({ customerIds: ["c2"], productId: "  " }),
  /商品 ID 不能为空/,
);
await assert.rejects(
  () => setProductCustomers({ customerIds: ["missing-customer"], productId: "PROD-002" }),
  /选择的客户不存在/,
);
assert.deepEqual(await listProductIds({ customerId: "c1" }), {
  ids: ["PROD-003"],
});
assert.deepEqual(await listProductIds({ customerId: "c2" }), {
  ids: ["PROD-001", "PROD-002"],
});
window.dispatchEvent(
  new CustomEvent("order-manager:fallback-customer-upserted", {
    detail: { customerName: "测试客户 B 更新", id: "c2" },
  }),
);
assert.deepEqual(
  (await listProducts({ customerId: "c2", page: 1, pageSize: 10 })).products.map(
    (product) => product.assignedCustomerNames,
  ),
  [["测试客户 B 更新"], ["测试客户 B 更新"]],
);
window.dispatchEvent(
  new CustomEvent("order-manager:fallback-customer-deleted", {
    detail: { id: "c2" },
  }),
);
assert.deepEqual(await listProductIds({ customerId: "c2" }), {
  ids: [],
});
assert.deepEqual(
  (await listProducts({ page: 1, pageSize: 10, search: "M-001" })).products[0]
    .assignedCustomerNames,
  [],
);

await assert.rejects(
  () =>
    updateProduct({
      id: "  ",
      moldCode: "M-empty-id",
      productName: "空 ID 商品",
      thicknessMmX100: 130,
      weightPerMeterKgX1000: 2600,
    }),
  /商品 ID 不能为空/,
);
await assert.rejects(
  () =>
    updateProduct({
      id: "PROD-002",
      moldCode: "M-empty-update",
      productName: "  ",
      thicknessMmX100: 130,
      weightPerMeterKgX1000: 2600,
    }),
  /商品名称不能为空/,
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      id: "ALU20260620001",
      items: [
        {
          lengthMm: 6000,
          productId: "PROD-002",
          productMoldCode: "M-001",
          productName: "灰色边框",
          quantity: 2,
          theoreticalWeightKgX100: 3000,
          thicknessMmX100: 120,
          weightPerMeterKgX1000: 2500,
        },
      ],
      status: "saved",
    },
    {
      id: "ALU20260620002",
      items: [
        {
          lengthMm: 6000,
          productId: "PROD-002",
          productMoldCode: "M-001",
          productName: "已下单灰色边框",
          quantity: 2,
          theoreticalWeightKgX100: 3000,
          thicknessMmX100: 120,
          weightPerMeterKgX1000: 2500,
        },
      ],
      status: "ordered",
    },
  ]),
);
const updatedProduct = await updateProduct({
  id: " PROD-002 ",
  moldCode: " M-001A ",
  productName: " 灰色边框改 ",
  thicknessMmX100: 130,
  weightPerMeterKgX1000: 2600,
});
assert.equal(updatedProduct.id, "PROD-002");
assert.equal(updatedProduct.moldCode, "M-001A");
assert.equal(updatedProduct.productName, "灰色边框改");
assert.deepEqual(updatedProduct.assignedCustomerIds, []);
updatedProduct.productName = "更新返回污染商品";
assert.equal(
  (await listProducts({ page: 1, pageSize: 10, search: "M-001A" })).products[0]
    .productName,
  "灰色边框改",
);
const syncedOrderDetails = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
);
assert.equal(syncedOrderDetails[0].items[0].productName, "灰色边框改");
assert.equal(syncedOrderDetails[0].items[0].productMoldCode, "M-001A");
assert.equal(syncedOrderDetails[0].items[0].thicknessMmX100, 130);
assert.equal(syncedOrderDetails[0].items[0].weightPerMeterKgX1000, 2600);
assert.equal(syncedOrderDetails[0].items[0].theoreticalWeightKgX100, 3120);
assert.equal(syncedOrderDetails[1].items[0].productName, "已下单灰色边框");
assert.equal(syncedOrderDetails[1].items[0].productMoldCode, "M-001");
assert.equal(
  dispatchedEvents.at(-1).type,
  "order-manager:fallback-order-upserted",
);
assert.equal(dispatchedEvents.at(-1).detail.id, "ALU20260620001");
dispatchedEvents.at(-1).detail.items[0].productName = "事件污染边框";
dispatchedEvents.at(-1).detail.items[0].quantity = 99;
const syncedOrderDetailsAfterEventMutation = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
);
assert.equal(
  syncedOrderDetailsAfterEventMutation[0].items[0].productName,
  "灰色边框改",
);
assert.equal(syncedOrderDetailsAfterEventMutation[0].items[0].quantity, 2);
assert.equal(
  (await listProducts({ page: 1, pageSize: 10, search: "M-001A" })).products[0]
    .productName,
  "灰色边框改",
);
await assert.rejects(
  () =>
    updateProduct({
      id: "PROD-002",
      moldCode: "M-001A",
      productName: "坯料边框",
      thicknessMmX100: 130,
      weightPerMeterKgX1000: 2600,
    }),
  /商品名称已存在/,
);
await assert.rejects(
  () =>
    updateProduct({
      id: "PROD-002",
      moldCode: "M-003",
      productName: "灰色边框改",
      thicknessMmX100: 130,
      weightPerMeterKgX1000: 2600,
    }),
  /模具编号已存在/,
);

await assert.rejects(() => deleteProduct("  "), /商品 ID 不能为空/);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      id: "ALU20260621001",
      items: [{ productId: "PROD-002" }],
      status: "saved",
    },
  ]),
);
await assert.rejects(
  () => deleteProduct("PROD-002"),
  /有未下订单引用此商品，不能删除/,
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      id: "ALU20260621001",
      items: [{ productId: "PROD-002" }],
      status: "ordered",
    },
  ]),
);
await deleteProduct("PROD-002");
assert.deepEqual(await listProductIds({ customerId: "c2" }), {
  ids: [],
});
await assert.rejects(
  () =>
    updateProduct({
      id: "PROD-404",
      moldCode: "M-404",
      productName: "不存在",
      thicknessMmX100: 100,
      weightPerMeterKgX1000: 1000,
    }),
  /商品不存在/,
);
assert.deepEqual(await parseProductImportFile("/tmp/products.xlsx"), {
  errors: ["系统文件选择器只能在 Tauri 应用窗口中使用。"],
  products: [],
});

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([
    {
      assignedCustomerIds: [],
      assignedCustomerNames: [],
      id: "PROD-001",
      moldCode: "M-CACHE",
      productName: "缓存商品",
      thicknessMmX100: 100,
      weightPerMeterKgX1000: 2200,
    },
    {
      assignedCustomerIds: [],
      assignedCustomerNames: [],
      id: "PROD-003",
      moldCode: "M-CACHE-GAP",
      productName: "缓存断号商品",
      thicknessMmX100: 100,
      weightPerMeterKgX1000: 2200,
    },
  ]),
);
await compileProductsApi("products-api-storage-create.mjs");
const {
  createProduct: createStoredProduct,
  listProducts: listStoredProducts,
} = await import(
  pathToFileURL(path.join(tempDir, "products-api-storage-create.mjs")).href
);
const storedCreatedProduct = await createStoredProduct({
  moldCode: "M-CREATED",
  productName: "缓存后新增商品",
  thicknessMmX100: 120,
  weightPerMeterKgX1000: 2500,
});
assert.equal(storedCreatedProduct.id, "PROD-004");
assert.deepEqual(
  (await listStoredProducts({ page: 1, pageSize: 10 })).products.map(
    (product) => product.id,
  ),
  ["PROD-004", "PROD-001", "PROD-003"],
);

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([{ customerName: "缓存归属客户", id: "c-cache" }]),
);
window.localStorage.setItem(
  "order-manager:fallback-products",
  JSON.stringify([
    {
      assignedCustomerIds: ["c-cache"],
      assignedCustomerNames: ["缓存归属客户"],
      id: "PROD-001",
      moldCode: "M-ASSIGNED",
      productName: "缓存归属商品",
      thicknessMmX100: 110,
      weightPerMeterKgX1000: 2300,
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-customer-products",
  JSON.stringify([["c-cache", ["PROD-001"]]]),
);
await compileProductsApi("products-api-storage-assigned.mjs");
const {
  listProductIds: listAssignedStoredProductIds,
  listProducts: listAssignedStoredProducts,
} = await import(
  pathToFileURL(path.join(tempDir, "products-api-storage-assigned.mjs")).href
);
assert.deepEqual(await listAssignedStoredProductIds({ customerId: "c-cache" }), {
  ids: ["PROD-001"],
});
assert.deepEqual(
  (await listAssignedStoredProducts({ page: 1, pageSize: 10 })).products[0]
    .assignedCustomerNames,
  ["缓存归属客户"],
);

console.log("product api browser fallback rules ok");
