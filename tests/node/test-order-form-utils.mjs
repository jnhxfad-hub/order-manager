import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createTempModuleDir,
} from "./test-utils.mjs";

const tempDir = await createTempModuleDir("order-form-utils-test-");
const customerPricingPath = new URL(
  "../../src/features/customers/lib/customer-pricing.ts",
  import.meta.url,
);
const processingFeesPath = new URL("../../src/lib/processing-fees.ts", import.meta.url);
const datetimePath = new URL("../../src/lib/datetime.ts", import.meta.url);
const moneyPath = new URL("../../src/lib/money.ts", import.meta.url);
const numberInputPath = new URL("../../src/lib/number-input.ts", import.meta.url);
const orderFormUtilsPath = new URL(
  "../../src/features/orders/lib/order-form-utils.ts",
  import.meta.url,
);

await compileTsModule(processingFeesPath, path.join(tempDir, "processing-fees.mjs"));
await compileTsModule(
  customerPricingPath,
  path.join(tempDir, "customer-pricing.mjs"),
  (source) =>
    source.replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"'),
);
await compileTsModule(datetimePath, path.join(tempDir, "datetime.mjs"));
await compileTsModule(moneyPath, path.join(tempDir, "money.mjs"));
await compileTsModule(numberInputPath, path.join(tempDir, "number-input.mjs"));
await compileTsModule(
  orderFormUtilsPath,
  path.join(tempDir, "order-form-utils.mjs"),
  (source) =>
    source
      .replace(/import type[\s\S]*?from "@\/features\/customers\/types"\n/, "")
      .replace(/import type[\s\S]*?from "@\/features\/products\/types"\n/, "")
      .replace(/import type[\s\S]*?from "@\/features\/orders\/api\/orders-api"\n/, "")
      .replace(/import type[\s\S]*?from "@\/features\/orders\/types"\n/, "")
      .replace(
        'from "@/features/customers/lib/customer-pricing"',
        'from "./customer-pricing.mjs"',
      )
      .replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"')
      .replace('from "@/lib/datetime"', 'from "./datetime.mjs"')
      .replace('from "@/lib/number-input"', 'from "./number-input.mjs"')
      .replace('from "@/lib/money"', 'from "./money.mjs"'),
);

let nextUuid = 0;
Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: {
    randomUUID: () => `test-id-${++nextUuid}`,
  },
});

const {
  areOrderDraftSnapshotsEqual,
  buildOrderItemImportPreviewRows,
  buildOrderPayload,
  calculateItemWeight,
  createDefaultOrderValues,
  createImportableOrderItemCsvRows,
  createOrderDraftSnapshot,
  createOrderItemImportTemplateCsvRows,
  createOrderItemSpecKey,
  editableItemFieldOrder,
  emptyItem,
  emptyProcessingFeeSnapshotX100,
  getMissingProcessingFeeMessage,
  getOrderItemTotals,
  getOrderFormStatus,
  getProcessingFeeSnapshotFrom,
  getProcessingFeeX100ByCategory,
  groupOrderItemsByColor,
  isAluminumIngotPriceValid,
  isBlankItem,
  isItemFieldValid,
  orderDetailToFormValues,
  requiredItemFields,
} = await import(pathToFileURL(path.join(tempDir, "order-form-utils.mjs")).href);

const {
  getCustomerProcessingFeesX100,
  getMatchedSpecialPricingKeyword,
  hasAnyCustomerProcessingFee,
} = await import(pathToFileURL(path.join(tempDir, "customer-pricing.mjs")).href);

assert.deepEqual(requiredItemFields, ["product", "lengthMm", "color", "quantity"]);
assert.deepEqual(editableItemFieldOrder, [
  "product",
  "lengthMm",
  "color",
  "quantity",
  "note",
]);

const blankItem = emptyItem();
assert.equal(blankItem.localId, "test-id-1");
assert.equal(isBlankItem(blankItem), true);

const defaultValues = createDefaultOrderValues();
assert.equal(defaultValues.items.length, 1);
assert.equal(defaultValues.items[0].localId, "test-id-2");
assert.match(defaultValues.orderedDate, /^\d{4}-\d{2}-\d{2}$/);

const customer = {
  billetProcessingFeeTaxExcludedX100: 400,
  billetProcessingFeeTaxIncludedX100: 500,
  bridgeProcessingFeeTaxExcludedX100: 600,
  bridgeProcessingFeeTaxIncludedX100: 700,
  electrophoresisProcessingFeeTaxExcludedX100: 800,
  electrophoresisProcessingFeeTaxIncludedX100: 900,
  oxidationProcessingFeeTaxExcludedX100: 1000,
  oxidationProcessingFeeTaxIncludedX100: 1100,
  powderProcessingFeeTaxExcludedX100: 1200,
  powderProcessingFeeTaxIncludedX100: 1300,
  specialBilletProcessingFeeTaxExcludedX100: 1400,
  specialBilletProcessingFeeTaxIncludedX100: 1500,
  specialBridgeProcessingFeeTaxExcludedX100: 1600,
  specialBridgeProcessingFeeTaxIncludedX100: 1700,
  specialElectrophoresisProcessingFeeTaxExcludedX100: 1800,
  specialElectrophoresisProcessingFeeTaxIncludedX100: 1900,
  specialOxidationProcessingFeeTaxExcludedX100: 2000,
  specialOxidationProcessingFeeTaxIncludedX100: 2100,
  specialPowderProcessingFeeTaxExcludedX100: 2200,
  specialPowderProcessingFeeTaxIncludedX100: 2300,
  specialPricingKeyword: "加急",
};

assert.equal(isAluminumIngotPriceValid("0"), false);
assert.equal(isAluminumIngotPriceValid("20000"), true);
assert.equal(isAluminumIngotPriceValid("12abc"), false);
assert.equal(getMatchedSpecialPricingKeyword(customer, "本单加急处理"), "加急");
assert.equal(getMatchedSpecialPricingKeyword(customer, "普通订单"), "");
assert.equal(hasAnyCustomerProcessingFee(null, true), false);
assert.equal(hasAnyCustomerProcessingFee(customer, true), true);
assert.equal(getProcessingFeeX100ByCategory(getCustomerProcessingFeesX100(customer, true), "powder"), 1300);
assert.deepEqual(getProcessingFeeSnapshotFrom({
  billetProcessingFeeX100: 1,
  bridgeProcessingFeeX100: 2,
  electrophoresisProcessingFeeX100: 3,
  oxidationProcessingFeeX100: 4,
  powderProcessingFeeX100: 5,
}), {
  billetProcessingFeeX100: 1,
  bridgeProcessingFeeX100: 2,
  electrophoresisProcessingFeeX100: 3,
  oxidationProcessingFeeX100: 4,
  powderProcessingFeeX100: 5,
});
assert.equal(
  getMissingProcessingFeeMessage({
    hasSpecialPricing: false,
    pricingTaxIncluded: true,
  }),
  "该客户未设置含税加工费，不能选择含税",
);
assert.equal(
  getMissingProcessingFeeMessage({
    hasSpecialPricing: true,
    pricingTaxIncluded: false,
  }),
  "该客户未设置特殊不含税加工费，不能保存",
);
assert.deepEqual(getCustomerProcessingFeesX100(customer, true, "普通订单"), {
  billetProcessingFeeX100: 500,
  bridgeProcessingFeeX100: 700,
  electrophoresisProcessingFeeX100: 900,
  oxidationProcessingFeeX100: 1100,
  powderProcessingFeeX100: 1300,
});
assert.deepEqual(getCustomerProcessingFeesX100(customer, false, "本单加急处理"), {
  billetProcessingFeeX100: 1400,
  bridgeProcessingFeeX100: 1600,
  electrophoresisProcessingFeeX100: 1800,
  oxidationProcessingFeeX100: 2000,
  powderProcessingFeeX100: 2200,
});
assert.deepEqual(getCustomerProcessingFeesX100(customer, false, "普通订单"), {
  billetProcessingFeeX100: 400,
  bridgeProcessingFeeX100: 600,
  electrophoresisProcessingFeeX100: 800,
  oxidationProcessingFeeX100: 1000,
  powderProcessingFeeX100: 1200,
});
assert.deepEqual(getCustomerProcessingFeesX100(customer, true, "本单加急处理"), {
  billetProcessingFeeX100: 1500,
  bridgeProcessingFeeX100: 1700,
  electrophoresisProcessingFeeX100: 1900,
  oxidationProcessingFeeX100: 2100,
  powderProcessingFeeX100: 2300,
});

const baseValues = {
  ...emptyProcessingFeeSnapshotX100(),
  aluminumIngotPrice: "20000",
  billetProcessingFeeX100: 100,
  bridgeProcessingFeeX100: 100,
  customerAddress: "测试地址",
  customerId: "c1",
  customerName: "测试客户",
  electrophoresisProcessingFeeX100: 100,
  handlerName: "测试经手人",
  items: [
    {
      color: "灰色",
      lengthMm: "6000",
      localId: "row-1",
      note: "  备注  ",
      productId: "p1",
      productMoldCode: "G5501",
      productName: "测试商品",
      quantity: "2",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    },
  ],
  note: "  订单备注  ",
  orderedDate: "2026-06-21",
  oxidationProcessingFeeX100: 100,
  powderProcessingFeeX100: 100,
  pricingTaxIncluded: true,
};

assert.equal(buildOrderPayload({ ...baseValues, customerId: "" }, "saved"), "请选择客户");
assert.equal(
  buildOrderPayload({ ...baseValues, aluminumIngotPrice: "0" }, "saved"),
  "铝锭价必须大于 0",
);
assert.equal(
  buildOrderPayload(
    {
      ...baseValues,
      items: [{ ...baseValues.items[0], quantity: "2abc" }],
    },
    "saved",
  ),
  "第 1 行：数量必须大于 0",
);
assert.equal(
  buildOrderPayload(
    {
      ...baseValues,
      powderProcessingFeeX100: 0,
    },
    "saved",
  ),
  "第 1 行：含税喷涂加工费未设置",
);

const payload = buildOrderPayload(baseValues, "ordered", "ALU20260621001");
assert.equal(typeof payload, "object");
assert.deepEqual(payload, {
  aluminumIngotPriceX100: 2000000,
  billetProcessingFeeX100: 100,
  bridgeProcessingFeeX100: 100,
  customerAddress: "测试地址",
  customerId: "c1",
  customerName: "测试客户",
  electrophoresisProcessingFeeX100: 100,
  handlerName: "测试经手人",
  id: "ALU20260621001",
  items: [
    {
      color: "灰色",
      lengthMm: 6000,
      note: "备注",
      productId: "p1",
      productMoldCode: "G5501",
      productName: "测试商品",
      quantity: 2,
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    },
  ],
  note: "订单备注",
  orderedDate: "2026-06-21",
  oxidationProcessingFeeX100: 100,
  powderProcessingFeeX100: 100,
  pricingTaxIncluded: true,
  status: "ordered",
});

assert.equal(isItemFieldValid(baseValues.items[0], "product"), true);
assert.equal(isItemFieldValid({ ...baseValues.items[0], lengthMm: "12abc" }, "lengthMm"), false);
assert.equal(isBlankItem({ ...baseValues.items[0], productId: "", productName: "", lengthMm: "", color: "", quantity: "", note: "" }), true);
assert.equal(createOrderItemSpecKey(" 测试商品 ", 6000, " 灰色 "), "测试商品\u00006000\u0000灰色");
assert.equal(calculateItemWeight(baseValues.items[0]), 3000);
assert.equal(calculateItemWeight({ ...baseValues.items[0], weightPerMeterKgX1000: 0 }), 0);
const orderItemImportTemplateRows = createOrderItemImportTemplateCsvRows();
assert.deepEqual(orderItemImportTemplateRows[0], [
  "商品名称",
  "长度(mm)",
  "颜色",
  "数量",
  "备注",
]);
assert.deepEqual(
  createImportableOrderItemCsvRows([
    {
      color: "灰色",
      lengthMm: 6000,
      note: "导出备注",
      productMoldCode: "G5501",
      productName: "测试商品",
      quantity: 2,
      theoreticalWeightKgX100: 3000,
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    },
  ]),
  [
    orderItemImportTemplateRows[0],
    ["测试商品", 6000, "灰色", 2, "导出备注"],
  ],
);
assert.deepEqual(
  getOrderItemTotals([
    { quantity: 2, theoreticalWeightKgX100: 3000 },
    { quantity: 3, theoreticalWeightKgX100: 4500 },
  ]),
  {
    totalQuantity: 5,
    totalTheoreticalWeightKgX100: 7500,
  },
);

const snapshot = createOrderDraftSnapshot(baseValues);
assert.equal(areOrderDraftSnapshotsEqual(snapshot, createOrderDraftSnapshot(baseValues)), true);
assert.equal(
  areOrderDraftSnapshotsEqual(
    snapshot,
    createOrderDraftSnapshot({ ...baseValues, orderedDate: "2026-06-22" }),
  ),
  false,
);

const orderFormValues = orderDetailToFormValues({
  aluminumIngotPriceX100: 2000000,
  billetProcessingFeeX100: 100,
  bridgeProcessingFeeX100: 200,
  customerAddress: "测试地址",
  customerId: null,
  customerName: "测试客户",
  electrophoresisProcessingFeeX100: 300,
  handlerName: "测试经手人",
  items: [
    {
      color: "灰色",
      id: "ALU20260621001-001",
      lengthMm: 6000,
      note: null,
      productId: null,
      productMoldCode: "G5501",
      productName: "测试商品",
      quantity: 2,
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 2500,
    },
  ],
  note: null,
  orderedDate: "2026-06-21",
  oxidationProcessingFeeX100: 400,
  powderProcessingFeeX100: 500,
  pricingTaxIncluded: false,
});
assert.equal(orderFormValues.customerId, "");
assert.equal(orderFormValues.aluminumIngotPrice, "20000.00");
assert.equal(orderFormValues.items[0].localId, "ALU20260621001-001");
assert.equal(orderFormValues.items[0].productId, "");
assert.equal(orderFormValues.items[0].note, "");

const products = [
  {
    id: "p1",
    moldCode: "G5501",
    productName: "测试商品",
    thicknessMmX100: 120,
    weightPerMeterKgX1000: 2500,
  },
];
const importRows = buildOrderItemImportPreviewRows(
  [
    {
      color: "灰色",
      lengthMm: "6000",
      note: "导入备注",
      productName: "测试商品",
      quantity: "3",
      rowNumber: 1,
    },
    {
      color: "灰色",
      lengthMm: "6000",
      note: "",
      productName: "测试商品",
      quantity: "1",
      rowNumber: 2,
    },
    {
      color: "",
      lengthMm: "6.5",
      note: "",
      productName: "未知商品",
      quantity: "",
      rowNumber: 3,
    },
  ],
  products,
  [],
);

assert.equal(importRows[0].errors.length, 0);
assert.equal(importRows[0].item.localId, "test-id-3");
assert.deepEqual(importRows[1].errors, ["同一商品、长度、颜色不能重复"]);
assert.deepEqual(importRows[2].errors, [
  "当前客户商品中未找到该商品",
  "长度必须为正整数",
  "颜色不能为空",
  "数量不能为空",
]);

assert.deepEqual(getOrderFormStatus({ hasUnsavedChanges: true, isSaving: false, savedStatus: "saved" }), {
  className: "border-amber-200 bg-amber-50 text-amber-700",
  label: "未保存",
});
assert.deepEqual(getOrderFormStatus({ hasUnsavedChanges: false, isSaving: true, savedStatus: null }), {
  className: "border-muted bg-muted text-muted-foreground",
  label: "保存中",
});
assert.deepEqual(getOrderFormStatus({ hasUnsavedChanges: false, isSaving: false, savedStatus: "ordered" }), {
  className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  label: "已下单",
});
assert.deepEqual(getOrderFormStatus({ hasUnsavedChanges: false, isSaving: false, savedStatus: null }), {
  className: "border-muted bg-muted text-muted-foreground",
  label: "新建",
});
assert.deepEqual(getOrderFormStatus({ hasUnsavedChanges: false, isSaving: false, savedStatus: "saved" }), {
  className: "border-blue-200 bg-blue-50 text-blue-700",
  label: "已保存",
});

const colorGroupingRows = [
  { ...emptyItem(), color: "灰色", quantity: "2", note: "灰色A" },
  { ...emptyItem(), color: "白色", quantity: "3", note: "白色B" },
  { ...emptyItem(), color: " 灰色 ", quantity: "4", note: "灰色C" },
  { ...emptyItem(), color: "坯料", quantity: "5", note: "坯料D" },
  { ...emptyItem(), color: "白色", quantity: "6", note: "白色E" },
];
const originalColorGroupingRows = structuredClone(colorGroupingRows);
const groupedColorRows = groupOrderItemsByColor(colorGroupingRows);
assert.deepEqual(groupedColorRows, [
  colorGroupingRows[0],
  colorGroupingRows[2],
  colorGroupingRows[1],
  colorGroupingRows[4],
  colorGroupingRows[3],
]);
assert.deepEqual(colorGroupingRows, originalColorGroupingRows);
assert.equal(groupedColorRows[1], colorGroupingRows[2]);
assert.deepEqual(groupOrderItemsByColor(groupedColorRows), groupedColorRows);
const colorGroupingForm = { ...createDefaultOrderValues(), items: colorGroupingRows };
assert.equal(areOrderDraftSnapshotsEqual(
  createOrderDraftSnapshot(colorGroupingForm),
  createOrderDraftSnapshot({ ...colorGroupingForm, items: groupedColorRows }),
), false);

assert.deepEqual(groupOrderItemsByColor([]), []);
assert.deepEqual(groupOrderItemsByColor([colorGroupingRows[0]]), [colorGroupingRows[0]]);
const blankColorRows = [
  { ...emptyItem(), color: "" },
  colorGroupingRows[0],
  { ...emptyItem(), color: "  " },
];
assert.deepEqual(groupOrderItemsByColor(blankColorRows), [
  blankColorRows[0], blankColorRows[2], blankColorRows[1],
]);

console.log("order form utility rules ok");
