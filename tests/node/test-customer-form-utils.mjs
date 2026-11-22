import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createTempModuleDir,
} from "./test-utils.mjs";

const tempDir = await createTempModuleDir("customer-form-utils-test-");
const moneyPath = new URL("../../src/lib/money.ts", import.meta.url);
const processingFeesPath = new URL("../../src/lib/processing-fees.ts", import.meta.url);
const customerFormUtilsPath = new URL(
  "../../src/features/customers/lib/customer-form-utils.ts",
  import.meta.url,
);

await compileTsModule(moneyPath, path.join(tempDir, "money.mjs"));
await compileTsModule(processingFeesPath, path.join(tempDir, "processing-fees.mjs"));
await compileTsModule(
  customerFormUtilsPath,
  path.join(tempDir, "customer-form-utils.mjs"),
  (source) =>
    source
      .replace(/import type[\s\S]*?from "@\/features\/customers\/api\/customers-api"\n/, "")
      .replace(/import type[\s\S]*?from "@\/features\/customers\/types"\n/, "")
      .replace('from "@/lib/money"', 'from "./money.mjs"')
      .replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"'),
);

const {
  buildMoneyPayload,
  buildProcessingFeeExportHeaders,
  buildProcessingFeeExportValues,
  customerFormDefaultValues,
  customerToFormValues,
  excludedProcessingFeeFields,
  formatCustomerMoneyX100,
  getDefaultPricingLabel,
  getDefaultProcessingFees,
  getProcessingFeeValue,
  getProcessingFeeValues,
  getSpecialProcessingFees,
  hasAnyConfiguredMoney,
  hasConfiguredMoney,
  includedProcessingFeeFields,
  parseProcessingFeeValues,
  processingFeeFieldsWithGroupLabels,
  resolveDefaultPricing,
  validateMoney,
  validatePhone,
} = await import(pathToFileURL(path.join(tempDir, "customer-form-utils.mjs")).href);

assert.equal(validatePhone(""), null);
assert.equal(validatePhone("138 0000-0000"), null);
assert.equal(validatePhone("abc"), "请输入正确的手机号");
assert.equal(validateMoney("12.34", "喷涂加工费"), null);
assert.equal(
  validateMoney("12.345", "喷涂加工费"),
  "喷涂加工费只能输入非负金额，最多两位小数",
);
assert.equal(formatCustomerMoneyX100(0), "未设置");
assert.equal(formatCustomerMoneyX100(1234), "¥12.34");

assert.equal(hasConfiguredMoney("0"), false);
assert.equal(hasConfiguredMoney("0.01"), true);
assert.equal(hasConfiguredMoney("abc"), false);
assert.equal(
  hasAnyConfiguredMoney(
    { ...customerFormDefaultValues, powderProcessingFeeTaxIncluded: "10" },
    includedProcessingFeeFields,
  ),
  true,
);
assert.equal(
  hasAnyConfiguredMoney(customerFormDefaultValues, excludedProcessingFeeFields),
  false,
);

assert.deepEqual(resolveDefaultPricing("", true, false), {
  error: undefined,
  value: "included",
});
assert.deepEqual(resolveDefaultPricing("included", false, true), {
  error: "默认计价对应的加工费已清空，请重新选择",
  value: "",
});
assert.deepEqual(resolveDefaultPricing("excluded", true, true), {
  error: undefined,
  value: "excluded",
});
assert.equal(getDefaultPricingLabel("included"), "含税");
assert.equal(getDefaultPricingLabel("excluded"), "不含税");
assert.equal(getDefaultPricingLabel(""), "请先填写加工费");

const formValues = {
  ...customerFormDefaultValues,
  billetProcessingFeeTaxIncluded: "1",
  bridgeProcessingFeeTaxIncluded: "2",
  electrophoresisProcessingFeeTaxIncluded: "3",
  oxidationProcessingFeeTaxIncluded: "4",
  powderProcessingFeeTaxIncluded: "5",
  specialPowderProcessingFeeTaxExcluded: "6.5",
};
const parsedFees = parseProcessingFeeValues(formValues);
assert.equal(parsedFees.billetProcessingFeeTaxIncluded, 100);
assert.equal(parsedFees.powderProcessingFeeTaxIncluded, 500);
assert.equal(parsedFees.specialPowderProcessingFeeTaxExcluded, 650);
assert.equal(parsedFees.bridgeProcessingFeeTaxExcluded, 0);
assert.equal(
  parseProcessingFeeValues({
    ...customerFormDefaultValues,
    powderProcessingFeeTaxIncluded: "abc",
  }).powderProcessingFeeTaxIncluded,
  null,
);
assert.equal(buildMoneyPayload(parsedFees).powderProcessingFeeTaxIncludedX100, 500);
assert.equal(buildMoneyPayload(parsedFees).specialPowderProcessingFeeTaxExcludedX100, 650);
assert.equal(buildMoneyPayload(parsedFees).bridgeProcessingFeeTaxExcludedX100, 0);

const customer = {
  billetProcessingFeeTaxExcludedX100: 100,
  billetProcessingFeeTaxIncludedX100: 200,
  bridgeProcessingFeeTaxExcludedX100: 300,
  bridgeProcessingFeeTaxIncludedX100: 400,
  customerAddress: "测试地址",
  customerName: "测试客户",
  defaultPricingTaxIncluded: true,
  electrophoresisProcessingFeeTaxExcludedX100: 500,
  electrophoresisProcessingFeeTaxIncludedX100: 600,
  id: "c1",
  phone: "13800000000",
  oxidationProcessingFeeTaxExcludedX100: 700,
  oxidationProcessingFeeTaxIncludedX100: 800,
  powderProcessingFeeTaxExcludedX100: 900,
  powderProcessingFeeTaxIncludedX100: 1000,
  specialBilletProcessingFeeTaxExcludedX100: 0,
  specialBilletProcessingFeeTaxIncludedX100: 1100,
  specialBridgeProcessingFeeTaxExcludedX100: 0,
  specialBridgeProcessingFeeTaxIncludedX100: 1200,
  specialElectrophoresisProcessingFeeTaxExcludedX100: 0,
  specialElectrophoresisProcessingFeeTaxIncludedX100: 1300,
  specialOxidationProcessingFeeTaxExcludedX100: 0,
  specialOxidationProcessingFeeTaxIncludedX100: 1400,
  specialPowderProcessingFeeTaxExcludedX100: 0,
  specialPowderProcessingFeeTaxIncludedX100: 1500,
  specialPricingKeyword: "加急",
};

assert.equal(getProcessingFeeValue(customer, "powder", true), 1000);
assert.equal(getProcessingFeeValue(customer, "powder", false), 900);
assert.equal(getProcessingFeeValue(customer, "powder", true, true), 1500);
assert.deepEqual(getProcessingFeeValues(customer, true).slice(0, 2), [
  { category: "断桥", value: 400 },
  { category: "喷涂", value: 1000 },
]);
assert.deepEqual(getDefaultProcessingFees(customer), [
  { category: "断桥", value: 400 },
  { category: "喷涂", value: 1000 },
  { category: "坯料", value: 200 },
  { category: "氧化", value: 800 },
  { category: "电泳", value: 600 },
]);
assert.deepEqual(getSpecialProcessingFees(customer), [
  { category: "断桥", value: 1200 },
  { category: "喷涂", value: 1500 },
  { category: "坯料", value: 1100 },
  { category: "氧化", value: 1400 },
  { category: "电泳", value: 1300 },
]);
assert.deepEqual(getSpecialProcessingFees({ ...customer, specialPricingKeyword: "" }), []);

assert.deepEqual(buildProcessingFeeExportHeaders("含税", includedProcessingFeeFields), [
  "含税断桥加工费",
  "含税喷涂加工费",
  "含税坯料加工费",
  "含税氧化加工费",
  "含税电泳加工费",
]);
assert.deepEqual(buildProcessingFeeExportValues(customer, includedProcessingFeeFields), [
  "4.00",
  "10.00",
  "2.00",
  "8.00",
  "6.00",
]);
assert.equal(processingFeeFieldsWithGroupLabels[0].groupLabel, "含税");
assert.equal(processingFeeFieldsWithGroupLabels.at(-1).groupLabel, "特殊不含税");

assert.deepEqual(customerToFormValues(customer), {
  billetProcessingFeeTaxExcluded: "1.00",
  billetProcessingFeeTaxIncluded: "2.00",
  bridgeProcessingFeeTaxExcluded: "3.00",
  bridgeProcessingFeeTaxIncluded: "4.00",
  customerAddress: "测试地址",
  customerName: "测试客户",
  defaultPricingTaxIncluded: "included",
  electrophoresisProcessingFeeTaxExcluded: "5.00",
  electrophoresisProcessingFeeTaxIncluded: "6.00",
  oxidationProcessingFeeTaxExcluded: "7.00",
  oxidationProcessingFeeTaxIncluded: "8.00",
  phone: "13800000000",
  powderProcessingFeeTaxExcluded: "9.00",
  powderProcessingFeeTaxIncluded: "10.00",
  specialBilletProcessingFeeTaxExcluded: "",
  specialBilletProcessingFeeTaxIncluded: "11.00",
  specialBridgeProcessingFeeTaxExcluded: "",
  specialBridgeProcessingFeeTaxIncluded: "12.00",
  specialElectrophoresisProcessingFeeTaxExcluded: "",
  specialElectrophoresisProcessingFeeTaxIncluded: "13.00",
  specialOxidationProcessingFeeTaxExcluded: "",
  specialOxidationProcessingFeeTaxIncluded: "14.00",
  specialPowderProcessingFeeTaxExcluded: "",
  specialPowderProcessingFeeTaxIncluded: "15.00",
  specialPricingKeyword: "加急",
});

console.log("customer form utility rules ok");
