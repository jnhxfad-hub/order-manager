import assert from "node:assert/strict";
import path from "node:path";
import {
  createTempModuleDir,
  importCompiledTsModule,
} from "./test-utils.mjs";

const sourcePath = new URL("../../src/lib/processing-fees.ts", import.meta.url);
const tempDir = await createTempModuleDir("processing-fees-test-");
const source = await importCompiledTsModule(
  sourcePath,
  path.join(tempDir, "processing-fees.mjs"),
);

const {
  emptyProcessingFeeSnapshotX100,
  getProcessingCategoryConflict,
  getProcessingCategoryFromColor,
  getProcessingCategoryLabel,
  getProcessingCategoryQuantityItems,
  getProcessingFeeSnapshotValue,
  hasAnyProcessingFeeSnapshotValue,
} = source;

const emptySnapshot = emptyProcessingFeeSnapshotX100();

assert.deepEqual(emptySnapshot, {
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 0,
  electrophoresisProcessingFeeX100: 0,
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 0,
});
assert.equal(hasAnyProcessingFeeSnapshotValue(emptySnapshot), false);

const snapshot = {
  ...emptySnapshot,
  electrophoresisProcessingFeeX100: 500,
  oxidationProcessingFeeX100: 450,
};

assert.equal(getProcessingFeeSnapshotValue(snapshot, "oxidation"), 450);
assert.equal(getProcessingFeeSnapshotValue(snapshot, "electrophoresis"), 500);
assert.equal(hasAnyProcessingFeeSnapshotValue(snapshot), true);
assert.equal(getProcessingCategoryLabel("bridge"), "断桥");
assert.equal(getProcessingCategoryLabel("unknown"), "喷涂");

const cases = [
  ["坯料", "billet"],
  ["双面灰色", "bridge"],
  ["外咖啡 内白", "bridge"],
  ["国标氧化", "oxidation"],
  ["非标氧化", "oxidation"],
  ["1#色", "electrophoresis"],
  ["2#色", "electrophoresis"],
  ["3#色", "electrophoresis"],
  ["灰色", "powder"],
];

for (const [color, expected] of cases) {
  assert.equal(getProcessingCategoryFromColor(color), expected, color);
}

const conflictCases = [
  ["灰色", null],
  ["坯料", null],
  [
    "坯料双面灰",
    "颜色“坯料双面灰”同时命中坯料、断桥，请检查颜色录入",
  ],
  [
    "国标氧化 1#色",
    "颜色“国标氧化 1#色”同时命中氧化、电泳，请检查颜色录入",
  ],
];

for (const [color, expected] of conflictCases) {
  assert.equal(getProcessingCategoryConflict(color), expected, color);
}

assert.deepEqual(
  getProcessingCategoryQuantityItems([
    { color: "坯料", quantity: 2 },
    { color: "外咖啡 内白", quantity: 3 },
    { color: "灰色", quantity: 4 },
    { color: "氧化", quantity: 5 },
    { color: "1#色", quantity: 6 },
    { color: "灰色", quantity: 0 },
    { color: "", quantity: 7 },
  ]),
  [
    { label: "断桥", value: 3 },
    { label: "喷涂", value: 4 },
    { label: "坯料", value: 2 },
    { label: "氧化", value: 5 },
    { label: "电泳", value: 6 },
  ],
);

console.log("processing fee color rules ok");
