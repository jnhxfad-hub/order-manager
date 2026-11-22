import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createTempModuleDir,
  installBrowserTestWindow,
} from "./test-utils.mjs";

const tempDir = await createTempModuleDir("shared-utils-test-");
const modules = [
  "browser-runtime",
  "csv",
  "datetime",
  "errors",
  "file-path",
  "measurement",
  "money",
  "number-input",
];

for (const moduleName of modules) {
  await compileTsModule(
    new URL(`../../src/lib/${moduleName}.ts`, import.meta.url),
    path.join(tempDir, `${moduleName}.mjs`),
  );
}

const { createCsv } = await import(pathToFileURL(path.join(tempDir, "csv.mjs")).href);
const {
  isTauriRuntime,
  loadBrowserStorageArray,
  loadBrowserStorageJson,
  loadBrowserStorageRecordMap,
  saveBrowserStorageJson,
  saveBrowserStorageRecordMap,
} = await import(pathToFileURL(path.join(tempDir, "browser-runtime.mjs")).href);
const {
  formatAppDate,
  formatAppDateTime,
  formatCompactDatePart,
  formatDateInputValue,
  formatIsoDate,
  formatTimestamp,
} = await import(pathToFileURL(path.join(tempDir, "datetime.mjs")).href);
const { getErrorCode, getErrorMessage } = await import(
  pathToFileURL(path.join(tempDir, "errors.mjs")).href
);
const { getFileNameFromPath } = await import(
  pathToFileURL(path.join(tempDir, "file-path.mjs")).href
);
const {
  formatTheoreticalWeightKg,
  formatThicknessMm,
  formatWeightPerMeterKg,
} = await import(pathToFileURL(path.join(tempDir, "measurement.mjs")).href);
const {
  formatCurrencyX100,
  formatMoneyInput,
  formatOptionalCurrencyX100,
  formatPlainMoneyX100,
  parseMoneyToX100,
} = await import(pathToFileURL(path.join(tempDir, "money.mjs")).href);
const { parseIntegerInput } = await import(
  pathToFileURL(path.join(tempDir, "number-input.mjs")).href
);

assert.equal(parseMoneyToX100(""), 0);
assert.equal(parseMoneyToX100(" 12.3 "), 1230);
assert.equal(parseMoneyToX100("12."), 1200);
assert.equal(parseMoneyToX100("12.345"), null);
assert.equal(parseMoneyToX100("-1"), null);
assert.equal(formatCurrencyX100(1234), "¥12.34");
assert.equal(formatOptionalCurrencyX100(0), "未设置");
assert.equal(formatOptionalCurrencyX100(0, "无"), "无");
assert.equal(formatMoneyInput(0), "");
assert.equal(formatMoneyInput(1200), "12.00");
assert.equal(formatPlainMoneyX100(1200), "12.00");

assert.equal(parseIntegerInput("0012"), 12);
assert.equal(parseIntegerInput("12abc"), null);
assert.equal(parseIntegerInput("12.0"), null);
assert.equal(parseIntegerInput("-1"), null);
assert.equal(parseIntegerInput(String(Number.MAX_SAFE_INTEGER + 1)), null);

const fixedDate = new Date(2026, 5, 21, 9, 5);
assert.equal(formatDateInputValue(fixedDate), "2026-06-21");
assert.equal(formatCompactDatePart(fixedDate), "20260621");
assert.equal(formatTimestamp(fixedDate), "20260621-0905");
assert.equal(formatIsoDate("2026-06-21"), "2026-06-21");
assert.equal(formatIsoDate(null, "无日期"), "无日期");
assert.equal(formatIsoDate("not-a-date"), "-");
assert.equal(formatAppDate(null, "无日期"), "无日期");
assert.equal(formatAppDateTime(null, { fallback: "无时间" }), "无时间");
assert.equal(formatAppDateTime("not-a-date"), "-");

const appDate = formatAppDate("2026-06-21");
assert.match(appDate, /2026/);
assert.match(appDate, /06/);
assert.match(appDate, /21/);

const appDateTime = formatAppDateTime("2026-06-21T09:05:00", {
  includeYear: true,
});
assert.match(appDateTime, /2026/);
assert.match(appDateTime, /09/);
assert.match(appDateTime, /05/);

assert.equal(getErrorMessage(null), undefined);
assert.equal(getErrorMessage("保存失败"), "保存失败");
assert.equal(getErrorMessage(new Error("网络错误")), "网络错误");
assert.equal(getErrorMessage({ code: "UNKNOWN" }), "操作失败");
assert.equal(getErrorMessage({ code: "UNKNOWN" }, "自定义失败"), "自定义失败");
assert.equal(
  getErrorMessage({ code: "CUSTOMER_NOT_FOUND", message: "客户不存在" }),
  "客户不存在",
);
assert.equal(getErrorMessage({ message: " " }), "操作失败");
assert.equal(getErrorCode({ code: "CUSTOMER_NOT_FOUND", message: "客户不存在" }), "CUSTOMER_NOT_FOUND");
assert.equal(getErrorCode({ code: " " }), undefined);
assert.equal(getErrorCode(new Error("网络错误")), undefined);

assert.equal(formatThicknessMm(125), "1.25");
assert.equal(formatWeightPerMeterKg(2500), "2.500");
assert.equal(formatTheoreticalWeightKg(1234), "12.34");

assert.equal(
  createCsv([
    ["商品", "备注"],
    ["70 边框", '含逗号, 换行\n和"引号"'],
    ["空值", null],
  ]),
  '\uFEFF商品,备注\r\n70 边框,"含逗号, 换行\n和""引号"""\r\n空值,\r\n',
);

assert.equal(getFileNameFromPath("/Users/test/订单.csv"), "订单.csv");
assert.equal(getFileNameFromPath("C:\\Users\\test\\订单.csv"), "订单.csv");
assert.equal(
  getFileNameFromPath("file:///Users/test/%E8%AE%A2%E5%8D%95.csv"),
  "订单.csv",
);
assert.equal(
  getFileNameFromPath("file:///Users/test/%E5%AE%A2%E6%88%B7%20A.csv"),
  "客户 A.csv",
);

installBrowserTestWindow();
assert.equal(isTauriRuntime(), false);
assert.deepEqual(loadBrowserStorageArray("missing-array"), []);
assert.equal(loadBrowserStorageJson("missing-json", "fallback"), "fallback");
window.localStorage.setItem("broken-json", "{");
assert.equal(loadBrowserStorageJson("broken-json", "fallback"), "fallback");
saveBrowserStorageJson("array", [{ id: "one" }]);
assert.deepEqual(loadBrowserStorageArray("array"), [{ id: "one" }]);
saveBrowserStorageRecordMap(
  "record-map",
  new Map([
    ["first", { value: 1 }],
    ["second", { value: 2 }],
  ]),
);
assert.deepEqual(Array.from(loadBrowserStorageRecordMap("record-map")), [
  ["first", { value: 1 }],
  ["second", { value: 2 }],
]);
window.__TAURI_INTERNALS__ = {};
assert.equal(isTauriRuntime(), true);

const browserEvents = installBrowserTestWindow({ includeAddEventListener: true });
const receivedDetails = [];
const firstListener = (event) => receivedDetails.push(`first:${event.detail}`);
const secondListener = (event) => receivedDetails.push(`second:${event.detail}`);
window.addEventListener("order-manager:test-event", firstListener);
window.addEventListener("order-manager:test-event", secondListener);
window.removeEventListener("order-manager:test-event", firstListener);
window.dispatchEvent(
  new CustomEvent("order-manager:test-event", { detail: "payload" }),
);
assert.deepEqual(receivedDetails, ["second:payload"]);
assert.equal(browserEvents.listeners.get("order-manager:test-event").length, 1);

console.log("shared utility rules ok");
