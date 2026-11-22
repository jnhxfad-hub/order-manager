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

const tempDir = await createTempModuleDir("customer-api-fallback-test-");
const browserRuntimePath = new URL("../../src/lib/browser-runtime.ts", import.meta.url);
const customersApiPath = new URL(
  "../../src/features/customers/api/customers-api.ts",
  import.meta.url,
);
const compileCustomersApi = (outputFile) =>
  compileTsModule(
    customersApiPath,
    path.join(tempDir, outputFile),
    (source) =>
      source.replace(
        'import { invoke } from "@tauri-apps/api/core"\n',
        "const invoke = async () => { throw new Error('unexpected tauri invoke') }\n",
      ).replace('from "@/lib/browser-runtime"', 'from "./browser-runtime.mjs"'),
  );

await compileTsModule(browserRuntimePath, path.join(tempDir, "browser-runtime.mjs"));
await compileCustomersApi("customers-api.mjs");

const {
  createCustomer,
  deleteCustomer,
  exportCustomers,
  importCustomers,
  listCustomers,
  parseCustomerImportFile,
  updateCustomer,
} = await import(pathToFileURL(path.join(tempDir, "customers-api.mjs")).href);

function customerPayload(overrides = {}) {
  return {
    billetProcessingFeeTaxExcludedX100: 0,
    billetProcessingFeeTaxIncludedX100: 0,
    bridgeProcessingFeeTaxExcludedX100: 0,
    bridgeProcessingFeeTaxIncludedX100: 0,
    customerAddress: "默认地址",
    customerName: "默认客户",
    defaultPricingTaxIncluded: true,
    electrophoresisProcessingFeeTaxExcludedX100: 0,
    electrophoresisProcessingFeeTaxIncludedX100: 0,
    oxidationProcessingFeeTaxExcludedX100: 0,
    oxidationProcessingFeeTaxIncludedX100: 0,
    phone: "13800000000",
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
    ...overrides,
  };
}

const firstCustomer = await createCustomer(
  customerPayload({
    customerAddress: " 上海 ",
    customerName: " 有电话客户 ",
    phone: " 13800000000 ",
    specialPricingKeyword: " 特殊 ",
  }),
);
assert.equal(firstCustomer.id, "CUS-001");
assert.equal(firstCustomer.customerAddress, "上海");
assert.equal(firstCustomer.customerName, "有电话客户");
assert.equal(firstCustomer.phone, "13800000000");
assert.equal(firstCustomer.specialPricingKeyword, "特殊");
assert.equal(dispatchedEvents.length, 1);
assert.equal(dispatchedEvents[0].type, "order-manager:fallback-customer-upserted");
assert.equal(dispatchedEvents[0].detail.customerName, "有电话客户");
dispatchedEvents[0].detail.customerName = "事件污染客户";
assert.equal(
  (await listCustomers({ page: 1, pageSize: 10 })).customers[0].customerName,
  "有电话客户",
);
firstCustomer.customerName = "外部污染客户";
assert.equal(
  (await listCustomers({ page: 1, pageSize: 10 })).customers[0].customerName,
  "有电话客户",
);
await assert.rejects(
  () =>
    createCustomer(
      customerPayload({
        customerName: "有电话客户",
      }),
    ),
  /客户名称已存在/,
);
await assert.rejects(
  () => createCustomer(customerPayload({ customerName: "  " })),
  /客户名称不能为空/,
);
await assert.rejects(
  () =>
    createCustomer(
      customerPayload({ powderProcessingFeeTaxIncludedX100: -1 }),
    ),
  /含税喷涂加工费不能小于 0/,
);
await assert.rejects(
  () =>
    createCustomer(
      customerPayload({
        defaultPricingTaxIncluded: false,
        powderProcessingFeeTaxExcludedX100: 0,
      }),
    ),
  /不含税加工费未设置，不能选不含税/,
);

await assert.rejects(
  () => importCustomers({ customers: [] }),
  /没有可导入的客户/,
);
await assert.rejects(
  () =>
    importCustomers({
      customers: [
        customerPayload({ customerName: "导入重复客户" }),
        customerPayload({ customerName: "导入重复客户" }),
      ],
    }),
  /第 2 行：客户名称重复/,
);
await assert.rejects(
  () =>
    importCustomers({
      customers: [
        customerPayload({ customerName: "有电话客户" }),
        customerPayload({ customerName: "有电话客户" }),
      ],
    }),
  /第 2 行：客户名称重复/,
);
await assert.rejects(
  () =>
    importCustomers({
      customers: [customerPayload({ customerName: "有电话客户" })],
    }),
  /客户名称已存在/,
);
await assert.rejects(
  () =>
    importCustomers({
      customers: [customerPayload({ customerName: "  " })],
    }),
  /第 1 行：客户名称不能为空/,
);
await assert.rejects(
  () =>
    importCustomers({
      customers: [
        customerPayload({ specialPowderProcessingFeeTaxIncludedX100: -1 }),
      ],
    }),
  /第 1 行：特殊喷涂加工费不能小于 0/,
);

assert.deepEqual(
  await importCustomers({
    customers: [
      customerPayload({
        customerAddress: "",
        customerName: "无地址客户",
        phone: "13900000000",
      }),
      customerPayload({
        customerAddress: "杭州",
        customerName: "无电话客户",
        phone: "",
      }),
    ],
  }),
  { createdCount: 2 },
);
assert.equal(dispatchedEvents.length, 3);
assert.deepEqual(
  dispatchedEvents.slice(1).map((event) => event.detail.customerName),
  ["无地址客户", "无电话客户"],
);

const firstPage = await listCustomers({ page: 1, pageSize: 2 });
assert.equal(firstPage.allTotal, 3);
assert.equal(firstPage.total, 3);
assert.equal(firstPage.missingAddressCount, 1);
assert.equal(firstPage.missingPhoneCount, 1);
firstPage.customers[0].customerName = "列表污染客户";
assert.equal(
  (await listCustomers({ page: 1, pageSize: 10 })).customers[0].customerName,
  "无地址客户",
);
assert.deepEqual(
  firstPage.customers.map((customer) => customer.id),
  ["CUS-002", "CUS-003", "CUS-001"],
);
assert.deepEqual(
  (await listCustomers({ page: 0, pageSize: 2 })).customers.map(
    (customer) => customer.id,
  ),
  ["CUS-002", "CUS-003", "CUS-001"],
);
assert.deepEqual(
  (await listCustomers({ page: 2, pageSize: 2 })).customers.map(
    (customer) => customer.id,
  ),
  [],
);
assert.deepEqual(
  (await listCustomers({
    page: 1,
    pageSize: 10,
    quickFilter: "missingAddress",
  })).customers.map((customer) => customer.customerName),
  ["无地址客户"],
);
assert.deepEqual(
  (await listCustomers({
    page: 1,
    pageSize: 10,
    quickFilter: "missingPhone",
  })).customers.map((customer) => customer.customerName),
  ["无电话客户"],
);
assert.deepEqual(
  (await listCustomers({
    page: 1,
    pageSize: 10,
    quickFilter: " missingPhone ",
  })).customers.map((customer) => customer.customerName),
  ["无电话客户"],
);
await assert.rejects(
  () =>
    listCustomers({
      page: 1,
      pageSize: 10,
      quickFilter: "unknown",
    }),
  /客户筛选参数无效/,
);
assert.deepEqual(
  (await listCustomers({ page: 1, pageSize: 10, search: "杭州" })).customers.map(
    (customer) => customer.customerName,
  ),
  ["无电话客户"],
);
assert.deepEqual(
  (await exportCustomers({
    page: 1,
    pageSize: 10,
    quickFilter: "missingPhone",
  })).customers.map((customer) => customer.id),
  ["CUS-003"],
);
const exportedCustomers = await exportCustomers({ page: 1, pageSize: 10 });
exportedCustomers.customers[0].customerName = "导出污染客户";
assert.equal(
  (await listCustomers({ page: 1, pageSize: 10 })).customers[0].customerName,
  "无地址客户",
);

const updatedCustomer = await updateCustomer(
  customerPayload({
    customerAddress: "苏州",
    customerName: "无电话客户更新",
    id: "CUS-003",
    phone: "13700000000",
  }),
);
assert.equal(
  (await listCustomers({ page: 1, pageSize: 10 })).customers[0].id,
  updatedCustomer.id,
);
assert.equal(updatedCustomer.customerName, "无电话客户更新");
assert.equal(dispatchedEvents.length, 4);
assert.equal(dispatchedEvents[3].detail.id, "CUS-003");
dispatchedEvents[3].detail.customerName = "更新事件污染客户";
assert.equal(
  (await listCustomers({ page: 1, pageSize: 10 })).customers[0].customerName,
  "无电话客户更新",
);
updatedCustomer.customerName = "更新返回污染客户";
assert.equal(
  (await listCustomers({ page: 1, pageSize: 10 })).customers[0].customerName,
  "无电话客户更新",
);
await assert.rejects(
  () =>
    updateCustomer(
      customerPayload({
        customerName: "有电话客户",
        id: "CUS-003",
      }),
    ),
  /客户名称已存在/,
);

window.localStorage.setItem(
  "order-manager:fallback-customer-inventory-batches",
  JSON.stringify([{ customerId: "CUS-003" }]),
);
await assert.rejects(
  () => deleteCustomer("CUS-003"),
  /有客户历史库存批次引用此客户，不能删除/,
);
await deleteCustomer("CUS-002");
assert.equal((await listCustomers({ page: 1, pageSize: 10 })).allTotal, 2);
await assert.rejects(() => deleteCustomer("CUS-404"), /客户不存在/);
await assert.rejects(
  () =>
    updateCustomer(
      customerPayload({
        id: "CUS-404",
      }),
    ),
  /客户不存在/,
);
assert.deepEqual(await parseCustomerImportFile("/tmp/customers.xlsx"), {
  customers: [],
  errors: ["系统文件选择器只能在 Tauri 应用窗口中使用。"],
});

const storedCustomers = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-customers"),
);
assert.deepEqual(
  storedCustomers.map((customer) => customer.id),
  ["CUS-003", "CUS-001"],
);

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([
    {
      id: "CUS-001",
      ...customerPayload({
        customerAddress: "缓存地址",
        customerName: "缓存客户",
      }),
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
    {
      id: "CUS-003",
      ...customerPayload({
        customerAddress: "缓存断号地址",
        customerName: "缓存断号客户",
      }),
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
await compileCustomersApi("customers-api-storage.mjs");
const {
  createCustomer: createStoredCustomer,
  listCustomers: listStoredCustomers,
} = await import(
  pathToFileURL(path.join(tempDir, "customers-api-storage.mjs")).href
);
const storedCreatedCustomer = await createStoredCustomer(
  customerPayload({ customerName: "缓存后新增客户" }),
);
assert.equal(storedCreatedCustomer.id, "CUS-004");
assert.deepEqual(
  (await listStoredCustomers({ page: 1, pageSize: 10 })).customers.map(
    (customer) => customer.id,
  ),
  ["CUS-004", "CUS-001", "CUS-003"],
);

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([
    {
      id: "CUS-001",
      ...customerPayload({
        customerAddress: "缓存地址",
        customerName: "导入前缓存客户",
      }),
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
await compileCustomersApi("customers-api-storage-import.mjs");
const {
  importCustomers: importStoredCustomers,
  listCustomers: listImportedStoredCustomers,
} = await import(
  pathToFileURL(path.join(tempDir, "customers-api-storage-import.mjs")).href
);
await importStoredCustomers({
  customers: [customerPayload({ customerName: "缓存后导入客户" })],
});
assert.deepEqual(
  (await listImportedStoredCustomers({ page: 1, pageSize: 10 })).customers.map(
    (customer) => customer.id,
  ),
  ["CUS-002", "CUS-001"],
);

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([
    {
      id: "CUS-001",
      ...customerPayload({
        customerAddress: "缓存地址",
        customerName: "待更新缓存客户",
      }),
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      customerAddress: "旧缓存地址",
      customerId: "CUS-001",
      customerName: "旧缓存客户",
      id: "ALU20260620001",
      items: [
        {
          productId: "PROD-001",
          quantity: 2,
        },
      ],
      status: "saved",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
    {
      customerAddress: "已下单旧地址",
      customerId: "CUS-001",
      customerName: "已下单旧客户",
      id: "ALU20260620002",
      status: "ordered",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
await compileCustomersApi("customers-api-storage-update.mjs");
const {
  listCustomers: listUpdatedStoredCustomers,
  updateCustomer: updateStoredCustomer,
} = await import(
  pathToFileURL(path.join(tempDir, "customers-api-storage-update.mjs")).href
);
await assert.rejects(
  () => updateStoredCustomer(customerPayload({ id: "  " })),
  /客户 ID 不能为空/,
);
await assert.rejects(
  () =>
    updateStoredCustomer(
      customerPayload({
        customerName: "  ",
        id: "CUS-001",
      }),
    ),
  /客户名称不能为空/,
);
await updateStoredCustomer(
  customerPayload({
    customerAddress: " 缓存地址更新 ",
    customerName: " 已更新缓存客户 ",
    id: " CUS-001 ",
    phone: " 13700000000 ",
  }),
);
const updatedStoredCustomer = (
  await listUpdatedStoredCustomers({ page: 1, pageSize: 10 })
).customers[0];
assert.equal(updatedStoredCustomer.customerAddress, "缓存地址更新");
assert.equal(updatedStoredCustomer.customerName, "已更新缓存客户");
assert.equal(updatedStoredCustomer.phone, "13700000000");
const syncedOrders = JSON.parse(
  window.localStorage.getItem("order-manager:fallback-order-details"),
);
assert.equal(syncedOrders[0].customerAddress, "缓存地址更新");
assert.equal(syncedOrders[0].customerName, "已更新缓存客户");
assert.equal(
  Number.isFinite(new Date(syncedOrders[0].updatedAt).getTime()),
  true,
);
assert.equal(syncedOrders[1].customerAddress, "已下单旧地址");
assert.equal(syncedOrders[1].customerName, "已下单旧客户");
assert.equal(dispatchedEvents.at(-2).type, "order-manager:fallback-order-upserted");
assert.equal(dispatchedEvents.at(-2).detail.id, "ALU20260620001");
dispatchedEvents.at(-2).detail.items[0].quantity = 99;
assert.equal(
  JSON.parse(window.localStorage.getItem("order-manager:fallback-order-details"))[0]
    .items[0].quantity,
  2,
);
assert.equal(dispatchedEvents.at(-1).type, "order-manager:fallback-customer-upserted");

window.localStorage.clear();
window.localStorage.setItem(
  "order-manager:fallback-customers",
  JSON.stringify([
    {
      id: "CUS-001",
      ...customerPayload({
        customerAddress: "缓存地址",
        customerName: "待删除缓存客户",
      }),
      createdAt: "2026-06-20T08:00:00.000Z",
      updatedAt: "2026-06-20T08:00:00.000Z",
    },
  ]),
);
await compileCustomersApi("customers-api-storage-delete.mjs");
const {
  deleteCustomer: deleteStoredCustomer,
  listCustomers: listDeletedStoredCustomers,
} = await import(
  pathToFileURL(path.join(tempDir, "customers-api-storage-delete.mjs")).href
);
await assert.rejects(() => deleteStoredCustomer("  "), /客户 ID 不能为空/);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      customerId: "CUS-001",
      id: "ALU20260621001",
      status: "saved",
    },
  ]),
);
await assert.rejects(
  () => deleteStoredCustomer("CUS-001"),
  /有未下订单引用此客户，不能删除/,
);
assert.equal(
  (await listDeletedStoredCustomers({ page: 1, pageSize: 10 })).total,
  1,
);
window.localStorage.setItem(
  "order-manager:fallback-order-details",
  JSON.stringify([
    {
      customerId: "CUS-001",
      id: "ALU20260621001",
      status: "ordered",
    },
  ]),
);
await deleteStoredCustomer(" CUS-001 ");
assert.equal(
  (await listDeletedStoredCustomers({ page: 1, pageSize: 10 })).total,
  0,
);
assert.equal(
  JSON.parse(window.localStorage.getItem("order-manager:fallback-order-details"))[0]
    .customerId,
  null,
);
assert.equal(dispatchedEvents.at(-2).type, "order-manager:fallback-order-upserted");
assert.equal(dispatchedEvents.at(-2).detail.id, "ALU20260621001");
assert.equal(dispatchedEvents.at(-1).type, "order-manager:fallback-customer-deleted");
assert.deepEqual(dispatchedEvents.at(-1).detail, { id: "CUS-001" });

console.log("customer api browser fallback rules ok");
