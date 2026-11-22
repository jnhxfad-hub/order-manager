import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileTsModule,
  createTempModuleDir,
} from "./test-utils.mjs";

const tempDir = await createTempModuleDir("inventory-utils-test-");
const processingFeesPath = new URL("../../src/lib/processing-fees.ts", import.meta.url);
const numberInputPath = new URL("../../src/lib/number-input.ts", import.meta.url);
const moneyPath = new URL("../../src/lib/money.ts", import.meta.url);
const datetimePath = new URL("../../src/lib/datetime.ts", import.meta.url);
const inventoryUtilsPath = new URL(
  "../../src/features/inventory/lib/inventory-utils.ts",
  import.meta.url,
);
const inventoryDialogStatePath = new URL(
  "../../src/features/inventory/lib/inventory-dialog-state.ts",
  import.meta.url,
);
const inventoryDialogStateModulePaths = [
  "inventory-dialog-state-types.ts",
  "inventory-dialog-state-forms.ts",
  "inventory-dialog-state-merge.ts",
  "inventory-dialog-state-customer-batch.ts",
  "inventory-dialog-state-delivery-note.ts",
  "inventory-dialog-state-form-updates.ts",
  "inventory-dialog-state-submit.ts",
  "inventory-dialog-state-customer-delivery.ts",
  "inventory-dialog-state-batch-order.ts",
].map(
  (file) => new URL(`../../src/features/inventory/lib/${file}`, import.meta.url),
);
const customerInventoryPrintPath = new URL(
  "../../src/features/inventory/lib/customer-inventory-print.ts",
  import.meta.url,
);
const customerInventoryImportPath = new URL(
  "../../src/features/inventory/lib/customer-inventory-import.ts",
  import.meta.url,
);

await compileTsModule(processingFeesPath, path.join(tempDir, "processing-fees.mjs"));
await compileTsModule(numberInputPath, path.join(tempDir, "number-input.mjs"));
await compileTsModule(moneyPath, path.join(tempDir, "money.mjs"));
await compileTsModule(datetimePath, path.join(tempDir, "datetime.mjs"));
await compileTsModule(
  inventoryUtilsPath,
  path.join(tempDir, "inventory-utils.mjs"),
  (source) =>
    source
      .replace(/import type[\s\S]*?from "@\/features\/inventory\/types"\n/, "")
      .replace(/import type[\s\S]*?from "@\/features\/inventory\/api\/inventory-api"\n/, "")
      .replace('from "@/lib/datetime"', 'from "./datetime.mjs"')
      .replace('from "@/lib/number-input"', 'from "./number-input.mjs"')
      .replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"'),
);
const rewriteDialogStateDeps = (source) =>
  source
    .replace(
      'from "@/features/inventory/lib/inventory-utils"',
      'from "./inventory-utils.mjs"',
    )
    .replace('from "@/lib/money"', 'from "./money.mjs"')
    .replace('from "@/lib/number-input"', 'from "./number-input.mjs"')
    .replace('from "@/lib/processing-fees"', 'from "./processing-fees.mjs"')
    .replace(
      /from "\.\/inventory-dialog-state-([a-z-]+)"/g,
      'from "./inventory-dialog-state-$1.mjs"',
    );
for (const modulePath of inventoryDialogStateModulePaths) {
  const fileName = modulePath.pathname.split("/").pop().replace(/\.ts$/, ".mjs");
  await compileTsModule(
    modulePath,
    path.join(tempDir, fileName),
    rewriteDialogStateDeps,
  );
}
await compileTsModule(
  inventoryDialogStatePath,
  path.join(tempDir, "inventory-dialog-state.mjs"),
  rewriteDialogStateDeps,
);
await compileTsModule(
  customerInventoryPrintPath,
  path.join(tempDir, "customer-inventory-print.mjs"),
);
await compileTsModule(
  customerInventoryImportPath,
  path.join(tempDir, "customer-inventory-import.mjs"),
  (source) =>
    source
      .replace(/import type[\s\S]*?from "@\/features\/inventory\/types"\n/, "")
      .replace('from "@/lib/money"', 'from "./money.mjs"'),
);

const {
  buildMergedDeliveryNote,
  buildMergedDeliveryNoteFromPersistedDeliveryNote,
  buildMergedDeliveryNotePreview,
  buildBatchOrderImageRecognitionMatches,
  buildCustomerInventoryDeliveryGroups,
  buildCustomerInventoryDeliveryPriceGroups,
  buildOrderInventoryGroups,
  createCustomerInventoryDeliveryWeightRows,
  dedupeBatchOrderImageRecognitionMatches,
  deliveryWeightFields,
  filterOrderInventoryGroups,
  formatMovementSpec,
  getBatchOrderInventoryNotice,
  getCustomerInventoryBatchPriceGroupKey,
  getCustomerInventoryBatchCategoryQuantityItems,
  getCustomerInventoryBatchRequiredCategories,
  getCustomerInventoryBatchRowWeightX100,
  getCustomerInventoryBatchTotalQuantity,
  getCustomerInventoryBatchTotalTheoreticalWeightX100,
  getCustomerInventoryDeliveryCreateResult,
  getCustomerInventoryDeliveryNoteIds,
  getCustomerInventoryDeliveryTotalQuantity,
  getDeliveredOrderGroups,
  getDeliveredOrderGroupsByDeliveryNoteId,
  getDeliveryNotePrintPreviewState,
  getDeliveryNoteNotice,
  getInventoryDetailKey,
  getInventoryNoticeClassName,
  getInventoryOverviewStats,
  getMergedDeliveryNotePrintRows,
  getMergedDeliveryNoteCustomerName,
  getMissingRequiredMergedDeliveryGroupIds,
  getOrderGroupStats,
  getOrderInventoryFilterCounts,
  getOrderInventoryStatus,
  getOrderInventoryNotice,
  getPublicInventoryNotice,
  getRecognizedOrderMoldCode,
  getRequiredCustomerInventoryDeliveryPriceGroupWeightFields,
  getRequiredDeliveryWeights,
  getTransferInventoryNotice,
  groupCustomerInventoryBatchesByPrice,
  inventoryViews,
  matchesOrderInventoryFilter,
  movementText,
  normalizeInventoryColorGroup,
  normalizeInventoryLengthMm,
  normalizeMoldCode,
  normalizeOcrMoldCodeForLookup,
  orderInventoryFilters,
  parseWeightKgToX100,
  selectDeliveredOrderGroupsByDeliveryNoteIds,
  withRecognizedOrderMoldCode,
} = await import(pathToFileURL(path.join(tempDir, "inventory-utils.mjs")).href);
const {
  createCustomerInventoryExportCsvRows,
  createCustomerInventoryImportTemplateCsvRows,
  customerInventoryImportHeaders,
  getCustomerInventoryExportItemCount,
} = await import(
  pathToFileURL(path.join(tempDir, "customer-inventory-import.mjs")).href
);
const {
  applyCustomerInventoryBatchRowProduct,
  applyCustomerInventoryBatchRowProductAtIndex,
  applyCustomerInventoryBatchRowProductState,
  applyCustomerInventoryProcessingFees,
  applyBatchOrderImageRecognitionMatches,
  appendBatchOrderImageRecognitionMatches,
  appendBatchOrderImageRecognitionRawTexts,
  appendCustomerInventoryBatchRow,
  appendCustomerInventoryBatchRowState,
  clearBatchOrderQuantities,
  clearBatchOrderQuantityState,
  clearCustomerInventoryAdjustFormError,
  clearCustomerInventoryBatchFormError,
  clearDeliveryNoteFormError,
  clearCustomerInventoryDeliveryRowErrors,
  clearCustomerInventoryBatchRowProducts,
  clearCustomerInventoryDeliveryQuantities,
  clearCustomerInventoryDeliveryQuantityState,
  clearDeliveryNoteRowErrors,
  clearDeliveryNoteQuantities,
  clearInventoryFormError,
  clearOrderInventoryFormError,
  clearTransferInventoryFormError,
  clearCustomerInventoryBatchFormErrorState,
  collectBatchOrderAdjustmentItems,
  collectBatchOrderAdjustmentSubmitState,
  collectCustomerInventoryAdjustmentSubmitState,
  collectCustomerInventoryBatchSubmitState,
  collectCustomerInventoryDeliverySubmitState,
  collectDeliveryNoteSubmitState,
  collectInventoryAdjustmentSubmitState,
  collectMergeDeliveryNoteSubmitState,
  collectOrderInventoryAdjustmentSubmitState,
  collectTransferInventorySubmitState,
  createBatchOrderDialogApplyState,
  createBatchOrderDialogCloseState,
  createBatchOrderDialogOpenState,
  createBatchOrderImageRecognitionApplyState,
  createBatchOrderImageRecognitionDuplicateSelectionState,
  createBatchOrderImagePreviewFailureState,
  createBatchOrderImagePreviewRotationState,
  createBatchOrderImageRawTextToggleState,
  createBatchOrderImagePreview,
  createBatchOrderImagePreviewDialogState,
  createBatchOrderRows,
  createBatchOrderSuccessDialogState,
  createCustomerInventoryAdjustFormValues,
  createCustomerInventoryBatchDialogCloseState,
  createCustomerInventoryBatchDialogApplyState,
  createCustomerInventoryBatchDialogOpenState,
  createCustomerInventoryBatchDialogValuesFromBatch,
  createCustomerInventoryBatchFormValuesFromBatch,
  createCustomerInventoryImportErrorState,
  createCustomerInventoryImportFileSelectionState,
  createCustomerInventoryImportParseSuccessState,
  createCustomerInventoryBatchMissingProcessingFeesState,
  createCustomerInventoryBatchNoteFeesState,
  createCustomerInventoryBatchPricingFeesState,
  createCustomerInventoryBatchRowFromStockItem,
  createCustomerInventoryBatchRowsFromBatch,
  createCustomerInventoryDeliveryCreateSuccessState,
  createCustomerInventoryDeliveryDialogApplyState,
  createCustomerInventoryDeliveryDialogCloseState,
  createCustomerInventoryDeliveryDialogOpenState,
  createCustomerInventoryDeliveryDialogValues,
  createCustomerInventoryDeliverySuccessDialogState,
  createCustomerInventoryDeliveryPriceGroupFormValues,
  createCustomerInventoryDeliveryRows,
  createEmptyCustomerInventoryBatchDialogApplyState,
  createEmptyCustomerInventoryBatchDialogValues,
  createEmptyCustomerInventoryImportPreviewState,
  createEmptyCustomerInventoryDeliveryDialogApplyState,
  createEmptyCustomerInventoryDeliveryDialogValues,
  createDeliveryNoteCreateSuccessState,
  createDeliveryNoteDialogApplyState,
  createDeliveryNoteDialogCloseState,
  createDeliveryNoteDialogOpenState,
  createDeliveryNoteDialogValues,
  createDeliveryNoteFormErrorState,
  createDeliveryNotePrintPreviewRequestState,
  createDeliveryNotePrintPreviewSuccessState,
  createDeliveryNoteSuccessDialogState,
  createDeliveryNoteFormValues,
  createDeliveryNoteRows,
  createEmptyDeliveryNoteDialogApplyState,
  createEmptyDeliveryNoteDialogValues,
  createEmptyDeliveryNoteFormErrorState,
  createEmptyBatchOrderDialogApplyState,
  createBatchOrderImageRecognitionConfirmState,
  createCustomerInventoryAdjustDialogCloseState,
  createEmptyCustomerInventoryAdjustDialogApplyState,
  createEmptyInventoryDialogApplyState,
  createEmptyOrderInventoryDialogApplyState,
  createEmptyTransferInventoryDialogApplyState,
  createCustomerInventoryAdjustDialogApplyState,
  createCustomerInventoryAdjustDialogOpenState,
  createInventoryDialogApplyState,
  createInventoryDialogCloseState,
  createInventoryDialogOpenState,
  createInventoryFormValues,
  createEmptyMergeDeliveryNoteDialogApplyState,
  createMergeDeliveryNoteDialogApplyState,
  createMergeDeliveryNoteDialogCloseState,
  createMergeDeliveryNoteDialogOpenState,
  createMergeDeliveryNoteDialogValues,
  createMergeDeliveryNoteIds,
  createMergeDeliveryNotePreviewSuccessState,
  createMergeDeliveryNoteSelectionApplyState,
  createMergeDeliveryNoteSubmitRequestState,
  createOrderInventoryDialogApplyState,
  createOrderInventoryDialogCloseState,
  createOrderInventoryDialogOpenState,
  createOrderInventoryFormValues,
  createTransferInventoryDialogApplyState,
  createTransferInventoryDialogCloseState,
  createTransferInventoryDialogOpenState,
  createTransferInventoryFormValues,
  defaultCustomerInventoryAdjustFormValues,
  defaultCustomerInventoryBatchFormValues,
  defaultCustomerInventoryBatchRow,
  defaultDeliveryNoteFormValues,
  defaultBatchOrderImageRecognitionUiState,
  defaultInventoryFormValues,
  defaultMergeDeliveryNoteDialogValues,
  defaultOrderInventoryFormValues,
  defaultTransferInventoryFormValues,
  deriveDeliveryNoteDefaultNote,
  fillBatchOrderRequiredQuantities,
  fillBatchOrderRequiredQuantityState,
  fillCustomerInventoryDeliveryCurrentQuantities,
  fillCustomerInventoryDeliveryQuantityState,
  fillMissingCustomerInventoryProcessingFees,
  fillDeliveryNoteCurrentQuantities,
  getBatchOrderEnteredQuantity,
  getBatchOrderImageRecognitionFailureMessage,
  getCustomerInventoryDeliveryDialogState,
  getDeliveryNoteTotalQuantity,
  getDeliveryNoteTransferQuantity,
  getDeliveryWeightState,
  getCustomerInventoryImportFileName,
  getFirstInvalidCustomerInventoryDeliveryFocusTarget,
  getFirstInvalidDeliveryNoteFocusTarget,
  getNextCustomerInventoryDetailFocusTarget,
  getNextCustomerInventoryDeliveryFocusTarget,
  normalizeCustomerInventoryHistoricalOrderDate,
  getOrderInventoryQuantitySuggestion,
  parseDeliveryExtraCharge,
  parseDeliveryExtraCharges,
  prepareBatchOrderImageRecognitionPaths,
  mergeBatchOrderImageRecognitionSuccessState,
  mergeBatchOrderRecognizedImagePaths,
  mergeDeliveryNoteGroupsWithNoteDefaults,
  removeCustomerInventoryBatchRow,
  removeCustomerInventoryBatchRowState,
  rotateBatchOrderImagePreviews,
  selectCustomerInventoryBatchesByIds,
  toggleCustomerInventoryDeliveryBatchId,
  toggleCustomerInventoryDeliveryBatchSelectionState,
  toggleMergeDeliveryNoteSelection,
  updateCustomerInventoryDeliveryGroupLabel,
  updateCustomerInventoryDeliveryGroupLabelState,
  updateCustomerInventoryDeliveryFormFieldState,
  updateCustomerInventoryDeliveryPriceGroupFormFieldState,
  updateCustomerInventoryDeliveryRowNote,
  updateCustomerInventoryDeliveryRowNoteState,
  updateCustomerInventoryDeliveryRowQuantity,
  updateCustomerInventoryDeliveryRowQuantityState,
  updateCustomerInventoryAdjustFormField,
  updateCustomerInventoryAdjustFormFieldState,
  updateCustomerInventoryBatchCustomerWithFees,
  updateCustomerInventoryBatchCustomerState,
  updateCustomerInventoryBatchFormField,
  updateCustomerInventoryBatchFormFieldState,
  updateCustomerInventoryBatchNoteWithFees,
  updateCustomerInventoryBatchPricingWithFees,
  updateCustomerInventoryBatchRowField,
  updateCustomerInventoryBatchRowFieldState,
  updateBatchOrderNoteState,
  updateBatchOrderQuantityState,
  updateBatchOrderRowQuantity,
  updateDeliveryNoteFormField,
  clearDeliveryNoteFormFieldErrorState,
  updateDeliveryNoteFormFieldState,
  updateDeliveryNotePriceGroupFormField,
  clearDeliveryNoteQuantityState,
  fillDeliveryNoteQuantityState,
  updateDeliveryNoteRow,
  updateDeliveryNoteRowState,
  updateInventoryFormField,
  updateInventoryFormFieldState,
  updateMergeDeliveryNoteGroupLabel,
  updateMergeDeliveryNoteGroupLabelState,
  updateMergeDeliveryNoteSpecialNoteState,
  updateOrderInventoryFormField,
  updateOrderInventoryFormFieldState,
  updateTransferInventoryFormField,
  updateTransferInventoryFormFieldState,
} = await import(
  pathToFileURL(path.join(tempDir, "inventory-dialog-state.mjs")).href
);
const {
  buildCustomerInventoryPrintTableGroups,
  createCustomerInventoryPrintGroupLabels,
  getDefaultCustomerInventoryPrintGroupLabel,
  normalizeCustomerInventoryPrintGroupLabels,
  paginateMeasuredCustomerInventoryPrintSnapshot,
  paginateCustomerInventoryPrintSnapshot,
} = await import(
  pathToFileURL(path.join(tempDir, "customer-inventory-print.mjs")).href
);

assert.equal(movementText.produce, "订单入库");
assert.deepEqual(
  inventoryViews.map((view) => view.value),
  ["orders", "customer", "stock", "movements"],
);
assert.deepEqual(
  orderInventoryFilters.map((filter) => filter.value),
  ["all", "pending", "stocked", "delivered", "overstock"],
);
assert.deepEqual(
  deliveryWeightFields.map((field) => field.key),
  [
    "bridgeWeightKg",
    "powderWeightKg",
    "billetWeightKg",
    "oxidationWeightKg",
    "electrophoresisWeightKg",
  ],
);
assert.equal(formatMovementSpec({ color: "", lengthMm: null }), "-");
assert.equal(formatMovementSpec({ color: "灰色", lengthMm: null }), "灰色");
assert.equal(formatMovementSpec({ color: "", lengthMm: 6000 }), "6000mm");
assert.equal(formatMovementSpec({ color: "灰色", lengthMm: 6000 }), "6000mm · 灰色");
assert.match(getInventoryNoticeClassName("success"), /emerald/);
assert.match(getInventoryNoticeClassName("warning"), /amber/);
assert.match(getInventoryNoticeClassName("info"), /sky/);
assert.equal(
  getPublicInventoryNotice({ movementType: "adjust", quantity: 8 }),
  "公共库存已盘点为 8 支",
);
assert.equal(
  getPublicInventoryNotice({ movementType: "in", quantity: 3 }),
  "公共库存已入库，数量 3 支",
);
assert.equal(
  getOrderInventoryNotice({
    movementType: "adjust",
    orderId: "ALU20260621001",
    quantity: 8,
  }),
  "订单 ALU20260621001 库存已盘点为 8 支",
);
assert.equal(
  getOrderInventoryNotice({
    movementType: "ship",
    orderId: "ALU20260621001",
    quantity: 2,
  }),
  "订单 ALU20260621001 已出库 2 支",
);
assert.equal(
  getBatchOrderInventoryNotice({
    items: [{ quantity: 2 }, { quantity: 3 }],
    orderId: "ALU20260621001",
  }),
  "订单 ALU20260621001 已批量入库 2 项，共 5 支",
);
assert.equal(
  getTransferInventoryNotice({
    orderId: "ALU20260621001",
    quantity: 4,
  }),
  "订单 ALU20260621001 已从公共库存转入 4 支",
);
assert.deepEqual(defaultInventoryFormValues, {
  color: "",
  lengthMm: "",
  movementType: "in",
  note: "",
  productId: "",
  quantity: "",
});
const inventoryFormWithQuantity = updateInventoryFormField({
  key: "quantity",
  value: "8",
  values: defaultInventoryFormValues,
});
assert.equal(inventoryFormWithQuantity.quantity, "8");
assert.equal(defaultInventoryFormValues.quantity, "");
assert.deepEqual(
  clearInventoryFormError(
    { color: "请输入颜色", quantity: "请输入数量" },
    "quantity",
  ),
  { color: "请输入颜色", quantity: undefined },
);
assert.deepEqual(
  updateInventoryFormFieldState({
    errors: { color: "请输入颜色", quantity: "请输入数量" },
    key: "quantity",
    value: "8",
    values: defaultInventoryFormValues,
  }),
  {
    errors: { color: "请输入颜色", quantity: undefined },
    values: {
      ...defaultInventoryFormValues,
      quantity: "8",
    },
  },
);
assert.deepEqual(
  createInventoryFormValues({
    color: "灰色",
    lengthMm: 6000,
    productId: "p1",
  }),
  {
    color: "灰色",
    lengthMm: "6000",
    movementType: "in",
    note: "",
    productId: "p1",
    quantity: "",
  },
);
const inventoryDialogValues = createInventoryFormValues({
  color: "灰色",
  lengthMm: 6000,
  productId: "p1",
});
assert.deepEqual(
  createInventoryDialogApplyState(inventoryDialogValues),
  {
    errors: {},
    values: {
      color: "灰色",
      lengthMm: "6000",
      movementType: "in",
      note: "",
      productId: "p1",
      quantity: "",
    },
  },
);
assert.deepEqual(createInventoryDialogOpenState(inventoryDialogValues), {
  dialogApplyState: createInventoryDialogApplyState(inventoryDialogValues),
  open: true,
});
assert.deepEqual(createInventoryDialogCloseState(), {
  dialogApplyState: createEmptyInventoryDialogApplyState(),
  open: false,
});
assert.deepEqual(createEmptyInventoryDialogApplyState(), {
  errors: {},
  values: defaultInventoryFormValues,
});
assert.deepEqual(
  collectInventoryAdjustmentSubmitState({
    currentQuantity: 5,
    values: {
      color: " 灰色 ",
      lengthMm: "6000",
      movementType: "out",
      note: " 出库备注 ",
      productId: "p1",
      quantity: "3",
    },
  }),
  {
    errors: {},
    payload: {
      color: "灰色",
      lengthMm: 6000,
      movementType: "out",
      note: "出库备注",
      productId: "p1",
      quantity: 3,
    },
  },
);
assert.deepEqual(
  collectInventoryAdjustmentSubmitState({
    currentQuantity: 2,
    values: {
      color: "",
      lengthMm: "0",
      movementType: "out",
      note: "",
      productId: "",
      quantity: "3",
    },
  }).errors,
  {
    color: "请输入颜色",
    lengthMm: "请输入长度",
    productId: "请选择商品",
    quantity: "出库数量不能大于当前库存",
  },
);
assert.deepEqual(defaultCustomerInventoryAdjustFormValues, {
  batchId: "",
  color: "",
  currentQuantity: 0,
  lengthMm: 0,
  moldCode: "",
  note: "",
  productName: "",
  quantity: "",
  stockId: "",
});
const customerInventoryAdjustFormWithNote =
  updateCustomerInventoryAdjustFormField({
    key: "note",
    value: "盘点备注",
    values: defaultCustomerInventoryAdjustFormValues,
  });
assert.equal(customerInventoryAdjustFormWithNote.note, "盘点备注");
assert.equal(defaultCustomerInventoryAdjustFormValues.note, "");
assert.deepEqual(
  clearCustomerInventoryAdjustFormError(
    { form: "请选择客户库存明细", quantity: "请输入实际库存" },
    "quantity",
  ),
  { form: "请选择客户库存明细", quantity: undefined },
);
assert.deepEqual(
  updateCustomerInventoryAdjustFormFieldState({
    errors: { form: "请选择客户库存明细", quantity: "请输入实际库存" },
    key: "quantity",
    value: "8",
    values: defaultCustomerInventoryAdjustFormValues,
  }),
  {
    errors: { form: "请选择客户库存明细", quantity: undefined },
    values: {
      ...defaultCustomerInventoryAdjustFormValues,
      quantity: "8",
    },
  },
);
assert.deepEqual(
  createCustomerInventoryAdjustFormValues({
    batch: { id: "KH-20260623001" },
    item: {
      color: "灰色",
      id: "stock-1",
      lengthMm: 6000,
      moldCode: "G5501",
      productName: "灰色边框",
      quantity: 5,
    },
  }),
  {
    batchId: "KH-20260623001",
    color: "灰色",
    currentQuantity: 5,
    lengthMm: 6000,
    moldCode: "G5501",
    note: "",
    productName: "灰色边框",
    quantity: "5",
    stockId: "stock-1",
  },
);
const customerInventoryAdjustDialogValues =
  createCustomerInventoryAdjustFormValues({
    batch: { id: "KH-20260623001" },
    item: {
      color: "灰色",
      id: "stock-1",
      lengthMm: 6000,
      moldCode: "G5501",
      productName: "灰色边框",
      quantity: 5,
    },
  });
assert.deepEqual(
  createCustomerInventoryAdjustDialogApplyState(
    customerInventoryAdjustDialogValues,
  ),
  {
    errors: {},
    values: {
      batchId: "KH-20260623001",
      color: "灰色",
      currentQuantity: 5,
      lengthMm: 6000,
      moldCode: "G5501",
      note: "",
      productName: "灰色边框",
      quantity: "5",
      stockId: "stock-1",
    },
  },
);
assert.deepEqual(
  createCustomerInventoryAdjustDialogOpenState(
    customerInventoryAdjustDialogValues,
  ),
  {
    dialogApplyState: createCustomerInventoryAdjustDialogApplyState(
      customerInventoryAdjustDialogValues,
    ),
    open: true,
  },
);
assert.deepEqual(createCustomerInventoryAdjustDialogCloseState(), {
  dialogApplyState: createEmptyCustomerInventoryAdjustDialogApplyState(),
  open: false,
});
assert.deepEqual(createEmptyCustomerInventoryAdjustDialogApplyState(), {
  errors: {},
  values: defaultCustomerInventoryAdjustFormValues,
});
assert.deepEqual(
  collectCustomerInventoryAdjustmentSubmitState({
    batchId: "KH-20260623001",
    color: "灰色",
    currentQuantity: 5,
    lengthMm: 6000,
    moldCode: "G5501",
    note: " 盘点备注 ",
    productName: "灰色边框",
    quantity: "4",
    stockId: "stock-1",
  }),
  {
    errors: {},
    payload: {
      note: "盘点备注",
      quantity: 4,
      stockId: "stock-1",
    },
  },
);
assert.deepEqual(
  collectCustomerInventoryAdjustmentSubmitState({
    batchId: "",
    color: "",
    currentQuantity: 5,
    lengthMm: 0,
    moldCode: "",
    note: "",
    productName: "",
    quantity: "5",
    stockId: "",
  }),
  {
    errors: {
      form: "请选择客户库存明细",
      quantity: "盘点数量未变化",
    },
    payload: null,
  },
);
assert.equal(defaultTransferInventoryFormValues.quantity, "");
const transferFormWithQuantity = updateTransferInventoryFormField({
  key: "quantity",
  value: "2",
  values: defaultTransferInventoryFormValues,
});
assert.equal(transferFormWithQuantity.quantity, "2");
assert.equal(defaultTransferInventoryFormValues.quantity, "");
assert.deepEqual(
  clearTransferInventoryFormError(
    { quantity: "转入数量必须大于 0" },
    "quantity",
  ),
  { quantity: undefined },
);
assert.deepEqual(
  updateTransferInventoryFormFieldState({
    errors: { quantity: "转入数量必须大于 0" },
    key: "quantity",
    value: "2",
    values: defaultTransferInventoryFormValues,
  }),
  {
    errors: { quantity: undefined },
    values: {
      ...defaultTransferInventoryFormValues,
      quantity: "2",
    },
  },
);
assert.deepEqual(
  createTransferInventoryFormValues({
    color: "灰色",
    lengthMm: 6000,
    moldCode: "G5501",
    orderId: "ALU20260621001",
    orderQuantity: 2,
    productId: "p1",
    productName: "灰色边框",
    publicQuantity: 5,
    requiredQuantity: 5,
  }),
  {
    color: "灰色",
    currentQuantity: 2,
    lengthMm: 6000,
    moldCode: "G5501",
    note: "",
    orderId: "ALU20260621001",
    productId: "p1",
    productName: "灰色边框",
    publicQuantity: 5,
    quantity: "3",
    requiredQuantity: 5,
  },
);
const transferInventoryDialogValues = createTransferInventoryFormValues({
  color: "灰色",
  lengthMm: 6000,
  moldCode: "G5501",
  orderId: "ALU20260621001",
  orderQuantity: 2,
  productId: "p1",
  productName: "灰色边框",
  publicQuantity: 5,
  requiredQuantity: 5,
});
assert.deepEqual(
  createTransferInventoryDialogApplyState(transferInventoryDialogValues),
  {
    errors: {},
    values: {
      color: "灰色",
      currentQuantity: 2,
      lengthMm: 6000,
      moldCode: "G5501",
      note: "",
      orderId: "ALU20260621001",
      productId: "p1",
      productName: "灰色边框",
      publicQuantity: 5,
      quantity: "3",
      requiredQuantity: 5,
    },
  },
);
assert.deepEqual(
  createTransferInventoryDialogOpenState(transferInventoryDialogValues),
  {
    dialogApplyState: createTransferInventoryDialogApplyState(
      transferInventoryDialogValues,
    ),
    open: true,
  },
);
assert.deepEqual(createTransferInventoryDialogCloseState(), {
  dialogApplyState: createEmptyTransferInventoryDialogApplyState(),
  open: false,
});
assert.deepEqual(createEmptyTransferInventoryDialogApplyState(), {
  errors: {},
  values: defaultTransferInventoryFormValues,
});
assert.equal(
  createTransferInventoryFormValues({
    color: "灰色",
    lengthMm: 6000,
    moldCode: "G5501",
    orderId: "ALU20260621001",
    orderQuantity: 5,
    productId: "p1",
    productName: "灰色边框",
    publicQuantity: 5,
    requiredQuantity: 5,
  }).quantity,
  "",
);
assert.deepEqual(
  collectTransferInventorySubmitState({
    color: "灰色",
    currentQuantity: 0,
    lengthMm: 6000,
    moldCode: "G5501",
    note: "",
    orderId: "ALU20260621001",
    productId: "p1",
    productName: "灰色边框",
    publicQuantity: 5,
    quantity: "3",
    requiredQuantity: 5,
  }),
  {
    errors: {},
    payload: {
      color: "灰色",
      lengthMm: 6000,
      note: "转入订单 ALU20260621001",
      orderId: "ALU20260621001",
      productId: "p1",
      quantity: 3,
    },
  },
);
assert.deepEqual(
  collectTransferInventorySubmitState({
    color: "灰色",
    currentQuantity: 0,
    lengthMm: 6000,
    moldCode: "G5501",
    note: "",
    orderId: "ALU20260621001",
    productId: "p1",
    productName: "灰色边框",
    publicQuantity: 2,
    quantity: "3",
    requiredQuantity: 5,
  }),
  {
    errors: {
      quantity: "转入数量不能大于公共库存",
    },
    payload: null,
  },
);
assert.equal(
  getDeliveryNoteNotice({
    items: [{ quantity: 2 }, { quantity: 3 }],
  }),
  "出库单已创建，出库 2 项，共 5 支",
);
const createDeliveryNoteFixture = (overrides = {}) => ({
  aluminumIngotPriceX100: 2_000_000,
  billetProcessingFeeX100: 80_000,
  billetWeightKgX100: 0,
  bridgeProcessingFeeX100: 130_000,
  bridgeWeightKgX100: 0,
  createdAt: "2026-06-24T08:00:00Z",
  customerAddress: "客户地址",
  customerName: "合并客户",
  deliveryDate: "2026-06-24",
  electrophoresisProcessingFeeX100: 100_000,
  electrophoresisWeightKgX100: 0,
  extraCharges: [],
  handlerName: "经手人",
  id: "ALU20260624001",
  items: [
    {
      color: "灰色",
      id: "item-1",
      lengthMm: 6000,
      moldCode: "G7001",
      note: "",
      orderQuantity: 3,
      productId: "p1",
      productName: "70边框",
      quantity: 3,
    },
  ],
  note: "",
  orderId: "ALU20260624001",
  oxidationProcessingFeeX100: 90_000,
  oxidationWeightKgX100: 0,
  powderProcessingFeeX100: 110_000,
  powderWeightKgX100: 1_000,
  pricingProfileName: "默认价",
  pricingTaxIncluded: true,
  pricingTriggerKeyword: "",
  specialNote: "",
  ...overrides,
});
const mergedDeliveryNote = buildMergedDeliveryNote({
  customGroupsByDeliveryNoteId: {
    ALU20260624001: "第一车",
    ALU20260624002: "第一车",
    ALU20260624003: "第二车",
  },
  deliveryDate: "2026-06-24",
  id: "HD20260624",
  notes: [
    createDeliveryNoteFixture(),
    createDeliveryNoteFixture({
      id: "ALU20260624002",
      items: [
        {
          color: "灰色",
          id: "item-1",
          lengthMm: 6000,
          moldCode: "G7001",
          note: "",
          orderQuantity: 2,
          productId: "p1",
          productName: "70边框",
          quantity: 2,
        },
      ],
      orderId: "ALU20260624002",
      extraCharges: [{ name: "运费", amountX100: 10_000 }],
      powderWeightKgX100: 800,
    }),
    createDeliveryNoteFixture({
      aluminumIngotPriceX100: 2_020_000,
      id: "ALU20260624003",
      items: [
        {
          color: "白色",
          id: "item-1",
          lengthMm: 5000,
          moldCode: "G8001",
          note: "",
          orderQuantity: 4,
          productId: "p2",
          productName: "80边框",
          quantity: 4,
        },
      ],
      orderId: "ALU20260624003",
      extraCharges: [{ name: "装车费", amountX100: 20_000 }],
      powderWeightKgX100: 1_200,
    }),
  ],
});
assert.deepEqual(
  getMissingRequiredMergedDeliveryGroupIds(
    [
      createDeliveryNoteFixture(),
      createDeliveryNoteFixture({
        id: "ALU20260624002",
        orderId: "ALU20260624002",
      }),
      createDeliveryNoteFixture({
        aluminumIngotPriceX100: 2_020_000,
        id: "ALU20260624003",
        orderId: "ALU20260624003",
      }),
    ],
    { ALU20260624001: "第一车" },
  ),
  ["ALU20260624002"],
);
assert.deepEqual(
  getMissingRequiredMergedDeliveryGroupIds(
    [
      createDeliveryNoteFixture(),
      createDeliveryNoteFixture({
        aluminumIngotPriceX100: 2_020_000,
        id: "ALU20260624003",
        orderId: "ALU20260624003",
      }),
    ],
    {},
  ),
  [],
);
const mergedDeliveryNotePreview = buildMergedDeliveryNotePreview({
  customGroupsByDeliveryNoteId: {
    ALU20260624001: "第一车",
    ALU20260624002: "第二车",
  },
  notes: [
    createDeliveryNoteFixture(),
    createDeliveryNoteFixture({
      id: "ALU20260624002",
      orderId: "ALU20260624002",
    }),
  ],
  now: new Date(2026, 5, 24),
  specialNote: "合并特殊提示",
});
assert.equal(mergedDeliveryNotePreview.errorMessage, null);
assert.equal(mergedDeliveryNotePreview.mergedDeliveryNote?.id, "HD20260624");
assert.equal(
  mergedDeliveryNotePreview.mergedDeliveryNote?.deliveryDate,
  "2026-06-24",
);
assert.equal(
  mergedDeliveryNotePreview.mergedDeliveryNote?.specialNote,
  "合并特殊提示",
);
assert.deepEqual(
  mergedDeliveryNotePreview.mergedDeliveryNote?.sourceDeliveryNoteIds,
  ["ALU20260624001", "ALU20260624002"],
);
assert.deepEqual(
  buildMergedDeliveryNotePreview({
    notes: [
      createDeliveryNoteFixture(),
      createDeliveryNoteFixture({
        customerName: "另一个客户",
        id: "ALU20260624002",
        orderId: "ALU20260624002",
      }),
    ],
    now: new Date(2026, 5, 24),
  }),
  {
    errorMessage: "只能合并同一客户的出库单",
    mergedDeliveryNote: null,
  },
);
assert.deepEqual(
  buildMergedDeliveryNotePreview({
    customGroupsByDeliveryNoteId: { ALU20260624001: "第一车" },
    notes: [
      createDeliveryNoteFixture(),
      createDeliveryNoteFixture({
        id: "ALU20260624002",
        orderId: "ALU20260624002",
      }),
    ],
    now: new Date(2026, 5, 24),
  }),
  {
    errorMessage:
      "同一计价方案下包含多张出库单，请填写分组说明：ALU20260624002",
    mergedDeliveryNote: null,
  },
);
assert.equal(mergedDeliveryNote.priceGroups.length, 2);
assert.deepEqual(
  mergedDeliveryNote.priceGroups.map((group) => group.items.length),
  [2, 1],
);
assert.deepEqual(
  mergedDeliveryNote.priceGroups.map((group) => group.title),
  ["计价方案1", "计价方案2"],
);
assert.deepEqual(
  mergedDeliveryNote.priceGroups.map((group) => group.sourceDeliveryNoteIds),
  [["ALU20260624001", "ALU20260624002"], ["ALU20260624003"]],
);
assert.deepEqual(
  mergedDeliveryNote.priceGroups[0].items.map((item) => item.quantity),
  [3, 2],
);
assert.equal(mergedDeliveryNote.priceGroups[0].powderWeightKgX100, 1_800);
assert.deepEqual(mergedDeliveryNote.priceGroups[0].extraCharges, [{ name: "运费", amountX100: 10000 }]);
assert.deepEqual(mergedDeliveryNote.priceGroups[1].extraCharges, [{ name: "装车费", amountX100: 20000 }]);
assert.deepEqual(
  getMergedDeliveryNotePrintRows(mergedDeliveryNote.priceGroups[0].items).map(
    (row) => [row.customGroup, row.showCustomGroup, row.customGroupRowSpan],
  ),
  [
    ["第一车", true, 2],
    ["第一车", false, 0],
  ],
);
assert.deepEqual(
  getMergedDeliveryNotePrintRows(mergedDeliveryNote.priceGroups[1].items).map(
    (row) => [row.customGroup, row.showCustomGroup, row.customGroupRowSpan],
  ),
  [["第二车", true, 1]],
);
const mergedDeliveryNoteWithMixedExtraCharges = buildMergedDeliveryNote({
  customGroupsByDeliveryNoteId: {
    ALU20260624001: "第一车",
    ALU20260624002: "第二车",
  },
  deliveryDate: "2026-06-24",
  id: "HD20260624-2",
  notes: [
    createDeliveryNoteFixture({
      extraCharges: [{ name: "运费", amountX100: 10_000 }],
    }),
    createDeliveryNoteFixture({
      extraCharges: [{ name: "装车费", amountX100: 20_000 }],
      id: "ALU20260624002",
      orderId: "ALU20260624002",
    }),
  ],
});
assert.equal(mergedDeliveryNoteWithMixedExtraCharges.priceGroups.length, 1);
assert.equal(mergedDeliveryNoteWithMixedExtraCharges.priceGroups[0].extraCharges.reduce((sum, row) => sum + row.amountX100, 0), 30000);
assert.deepEqual(
  getMergedDeliveryNotePrintRows([
    {
      ...mergedDeliveryNoteWithMixedExtraCharges.priceGroups[0].items[0],
      customGroup: "",
    },
    mergedDeliveryNoteWithMixedExtraCharges.priceGroups[0].items[1],
  ]).map((row) => [row.customGroup, row.showCustomGroup, row.customGroupRowSpan]),
  [
    ["", false, 0],
    ["第二车", true, 1],
  ],
);
const persistedMergedDeliveryNote = buildMergedDeliveryNoteFromPersistedDeliveryNote({
  ...createDeliveryNoteFixture({
    id: "KH-CK20260624001",
    orderId: "KH-20260623001、KH-20260624001",
    specialNote: "客户库存合并特殊提示",
  }),
  priceGroups: [
    {
      aluminumIngotPriceX100: 2_000_000,
      billetProcessingFeeX100: 80_000,
      billetWeightKgX100: 0,
      bridgeProcessingFeeX100: 130_000,
      bridgeWeightKgX100: 0,
      electrophoresisProcessingFeeX100: 100_000,
      electrophoresisWeightKgX100: 0,
      extraCharges: [{ name: "装车费", amountX100: 10_000 }],
      id: "KH-CK20260624001-PG-001",
      items: [
        {
          color: "灰色",
          groupLabel: "第一车",
          id: "KH-CK20260624001-001",
          lengthMm: 6000,
          moldCode: "G7001",
          note: "A",
          orderQuantity: 4,
          priceGroupId: "KH-CK20260624001-PG-001",
          productId: "p1",
          productName: "70边框",
          quantity: 2,
          sourceBatchId: "KH-20260623001",
          sourceBatchNote: "前第一车",
        },
      ],
      oxidationProcessingFeeX100: 90_000,
      oxidationWeightKgX100: 0,
      powderProcessingFeeX100: 110_000,
      powderWeightKgX100: 1_000,
      pricingProfileName: "默认价",
      pricingTaxIncluded: true,
      pricingTriggerKeyword: "",
      title: "计价方案1",
    },
    {
      aluminumIngotPriceX100: 2_020_000,
      billetProcessingFeeX100: 80_000,
      billetWeightKgX100: 0,
      bridgeProcessingFeeX100: 130_000,
      bridgeWeightKgX100: 0,
      electrophoresisProcessingFeeX100: 100_000,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      id: "KH-CK20260624001-PG-002",
      items: [
        {
          color: "白色",
          groupLabel: "第二车",
          id: "KH-CK20260624001-002",
          lengthMm: 5000,
          moldCode: "G8001",
          note: "B",
          orderQuantity: 5,
          priceGroupId: "KH-CK20260624001-PG-002",
          productId: "p2",
          productName: "80边框",
          quantity: 3,
          sourceBatchId: "KH-20260624001",
          sourceBatchNote: "前第二车",
        },
      ],
      oxidationProcessingFeeX100: 90_000,
      oxidationWeightKgX100: 0,
      powderProcessingFeeX100: 110_000,
      powderWeightKgX100: 1_200,
      pricingProfileName: "默认价",
      pricingTaxIncluded: true,
      pricingTriggerKeyword: "",
      title: "计价方案2",
    },
  ],
});
assert.equal(persistedMergedDeliveryNote.id, "KH-CK20260624001");
assert.equal(
  persistedMergedDeliveryNote.specialNote,
  "客户库存合并特殊提示",
);
assert.deepEqual(
  persistedMergedDeliveryNote.priceGroups.map((group) => [
    group.id,
    group.items[0].customGroup,
    group.items[0].sourceDeliveryNoteId,
    group.items[0].sourceOrderId,
  ]),
  [
    ["KH-CK20260624001-PG-001", "第一车", "KH-CK20260624001", "KH-20260623001"],
    ["KH-CK20260624001-PG-002", "第二车", "KH-CK20260624001", "KH-20260624001"],
  ],
);
assert.deepEqual(getCustomerInventoryDeliveryCreateResult([]), {
  currentDeliveryNote: null,
  currentMergedDeliveryNote: null,
  message: "客户库存出库已创建",
});
const singleCustomerInventoryDeliveryNote = createDeliveryNoteFixture();
const singleCustomerInventoryDeliveryCreateResult =
  getCustomerInventoryDeliveryCreateResult([
    singleCustomerInventoryDeliveryNote,
  ]);
assert.equal(
  singleCustomerInventoryDeliveryCreateResult.currentDeliveryNote.id,
  "ALU20260624001",
);
assert.equal(
  singleCustomerInventoryDeliveryCreateResult.currentMergedDeliveryNote,
  null,
);
assert.equal(
  singleCustomerInventoryDeliveryCreateResult.message,
  "出库单已创建，出库 1 项，共 3 支",
);
assert.deepEqual(
  createCustomerInventoryDeliveryCreateSuccessState([
    singleCustomerInventoryDeliveryNote,
  ]),
  {
    ...singleCustomerInventoryDeliveryCreateResult,
    ...createCustomerInventoryDeliverySuccessDialogState(),
  },
);
const persistedCustomerInventoryDeliveryNote = {
  ...createDeliveryNoteFixture({
    id: "KH-CK20260624001",
    orderId: "KH-20260623001、KH-20260624001",
  }),
  priceGroups: persistedMergedDeliveryNote.priceGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      groupLabel: item.customGroup,
      priceGroupId: group.id,
    })),
  })),
};
const persistedCustomerInventoryDeliveryCreateResult =
  getCustomerInventoryDeliveryCreateResult([
    persistedCustomerInventoryDeliveryNote,
  ]);
assert.equal(
  persistedCustomerInventoryDeliveryCreateResult.currentDeliveryNote,
  null,
);
assert.equal(
  persistedCustomerInventoryDeliveryCreateResult.currentMergedDeliveryNote.id,
  "KH-CK20260624001",
);
assert.equal(
  persistedCustomerInventoryDeliveryCreateResult.message,
  "客户库存合并出库已创建",
);
assert.deepEqual(
  createCustomerInventoryDeliveryCreateSuccessState([
    persistedCustomerInventoryDeliveryNote,
  ]),
  {
    ...persistedCustomerInventoryDeliveryCreateResult,
    ...createCustomerInventoryDeliverySuccessDialogState(),
  },
);
const singlePrintPreviewDeliveryNote = createDeliveryNoteFixture();
const singleDeliveryNotePrintPreviewState = getDeliveryNotePrintPreviewState(
  singlePrintPreviewDeliveryNote,
);
assert.equal(
  singleDeliveryNotePrintPreviewState.currentDeliveryNote.id,
  "ALU20260624001",
);
assert.equal(singleDeliveryNotePrintPreviewState.currentMergedDeliveryNote, null);
assert.deepEqual(
  createDeliveryNotePrintPreviewSuccessState(singlePrintPreviewDeliveryNote),
  {
    ...singleDeliveryNotePrintPreviewState,
    printOpen: true,
  },
);
assert.deepEqual(createDeliveryNotePrintPreviewRequestState(), {
  currentMergedDeliveryNote: null,
  errors: {},
});
const persistedMergedPrintPreviewDeliveryNote = {
  ...createDeliveryNoteFixture({
    id: "KH-CK20260624001",
    orderId: "KH-20260623001、KH-20260624001",
  }),
  priceGroups: persistedMergedDeliveryNote.priceGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      groupLabel: item.customGroup,
      priceGroupId: group.id,
    })),
  })),
};
const mergedDeliveryNotePrintPreviewState = getDeliveryNotePrintPreviewState(
  persistedMergedPrintPreviewDeliveryNote,
);
assert.equal(mergedDeliveryNotePrintPreviewState.currentDeliveryNote, null);
assert.equal(
  mergedDeliveryNotePrintPreviewState.currentMergedDeliveryNote.id,
  "KH-CK20260624001",
);
assert.deepEqual(
  createDeliveryNotePrintPreviewSuccessState(
    persistedMergedPrintPreviewDeliveryNote,
  ),
  {
    ...mergedDeliveryNotePrintPreviewState,
    printOpen: true,
  },
);
const fallbackCustomerInventoryDeliveryCreateResult =
  getCustomerInventoryDeliveryCreateResult(
    [
      createDeliveryNoteFixture(),
      createDeliveryNoteFixture({
        id: "KH-20260625001-01",
        orderId: "KH-20260625001",
      }),
    ],
    new Date(2026, 5, 25),
  );
assert.equal(
  fallbackCustomerInventoryDeliveryCreateResult.currentDeliveryNote,
  null,
);
assert.equal(
  fallbackCustomerInventoryDeliveryCreateResult.currentMergedDeliveryNote.id,
  "ALU20260624001",
);
assert.equal(
  fallbackCustomerInventoryDeliveryCreateResult.message,
  "客户库存合并出库已创建，生成 2 张出库单",
);
assert.equal(
  buildMergedDeliveryNoteFromPersistedDeliveryNote(createDeliveryNoteFixture()),
  null,
);
assert.equal(
  getMergedDeliveryNoteCustomerName([
    { customerName: "合并客户" },
    { customerName: "合并客户" },
  ]),
  "合并客户",
);
assert.equal(
  getMergedDeliveryNoteCustomerName([
    { customerName: "合并客户" },
    { customerName: "其他客户" },
  ]),
  null,
);
assert.equal(getMergedDeliveryNoteCustomerName([]), null);
assert.deepEqual(
  getCustomerInventoryDeliveryNoteIds({
    deliveryNoteId: "KH-20260623001-01",
    deliveryNoteIds: [
      "KH-20260623001-01",
      "KH-20260623001-02",
      "KH-20260623001-02",
    ],
  }),
  ["KH-20260623001-01", "KH-20260623001-02"],
);

const customerInventoryDeliveryBatches = [
  {
    id: "KH-20260623001",
    note: "前第一车,备注",
    totalQuantity: 8,
  },
  {
    id: "KH-20260624001",
    note: "前第二车",
    totalQuantity: 4,
  },
];
assert.deepEqual(
  selectCustomerInventoryBatchesByIds(customerInventoryDeliveryBatches, [
    "KH-20260624001",
    "missing",
    "KH-20260623001",
  ]),
  [customerInventoryDeliveryBatches[1], customerInventoryDeliveryBatches[0]],
);
assert.deepEqual(
  toggleCustomerInventoryDeliveryBatchId({
    batchId: "KH-20260623001",
    checked: true,
    selectedBatchIds: ["KH-20260624001"],
  }),
  ["KH-20260624001", "KH-20260623001"],
);
assert.deepEqual(
  toggleCustomerInventoryDeliveryBatchSelectionState({
    batchId: "KH-20260623001",
    checked: true,
    selectedBatchIds: ["KH-20260624001"],
  }),
  {
    selectedBatchIds: ["KH-20260624001", "KH-20260623001"],
  },
);
assert.deepEqual(
  toggleCustomerInventoryDeliveryBatchId({
    batchId: "KH-20260624001",
    checked: true,
    selectedBatchIds: ["KH-20260624001"],
  }),
  ["KH-20260624001"],
);
assert.deepEqual(
  toggleCustomerInventoryDeliveryBatchId({
    batchId: "KH-20260624001",
    checked: false,
    selectedBatchIds: ["KH-20260624001", "KH-20260623001"],
  }),
  ["KH-20260623001"],
);
const customerInventoryDeliveryRows = [
  {
    batchId: "KH-20260623001",
    batchNote: "前第一车,备注",
    color: "灰色",
    currentQuantity: 5,
    groupLabel: "",
    lengthMm: 6000,
    moldCode: "G5501",
    note: "出库行 A",
    productName: "灰色边框",
    quantity: "2",
    stockId: "stock-1",
  },
  {
    batchId: "KH-20260623001",
    batchNote: "前第一车,备注",
    color: "坯料",
    currentQuantity: 3,
    groupLabel: "",
    lengthMm: 3000,
    moldCode: "G5502",
    note: "出库行 B",
    productName: "坯料边框",
    quantity: "",
    stockId: "stock-2",
  },
  {
    batchId: "KH-20260624001",
    batchNote: "前第二车",
    color: "氧化",
    currentQuantity: 4,
    groupLabel: "手填分组",
    lengthMm: 5000,
    moldCode: "G5503",
    note: "出库行 C",
    productName: "氧化边框",
    quantity: "3",
    stockId: "stock-3",
  },
];
assert.equal(
  getCustomerInventoryDeliveryTotalQuantity(customerInventoryDeliveryRows),
  5,
);
assert.deepEqual(
  updateCustomerInventoryDeliveryGroupLabel(
    customerInventoryDeliveryRows,
    "KH-20260623001",
    "新分组",
  ).map((row) => row.groupLabel),
  ["新分组", "新分组", "手填分组"],
);
assert.deepEqual(
  updateCustomerInventoryDeliveryGroupLabelState({
    batchId: "KH-20260623001",
    errors: {
      "batch-KH-20260623001-groupLabel": "请填写分组",
      handlerName: "保留经手人错误",
    },
    groupLabel: "新分组",
    rows: customerInventoryDeliveryRows,
  }),
  {
    errors: {
      "batch-KH-20260623001-groupLabel": undefined,
      handlerName: "保留经手人错误",
    },
    rows: [
      { ...customerInventoryDeliveryRows[0], groupLabel: "新分组" },
      { ...customerInventoryDeliveryRows[1], groupLabel: "新分组" },
      customerInventoryDeliveryRows[2],
    ],
  },
);
assert.deepEqual(
  updateCustomerInventoryDeliveryRowQuantity(
    customerInventoryDeliveryRows,
    "stock-2",
    "3",
  ).map((row) => row.quantity),
  ["2", "3", "3"],
);
assert.deepEqual(
  updateCustomerInventoryDeliveryRowQuantityState({
    errors: {
      "stock-2": "数量错误",
      form: "请至少录入一项出库数量",
      handlerName: "保留经手人错误",
    },
    quantity: "3",
    rows: customerInventoryDeliveryRows,
    stockId: "stock-2",
  }),
  {
    errors: {
      "stock-2": undefined,
      form: "请至少录入一项出库数量",
      handlerName: "保留经手人错误",
    },
    rows: [
      customerInventoryDeliveryRows[0],
      { ...customerInventoryDeliveryRows[1], quantity: "3" },
      customerInventoryDeliveryRows[2],
    ],
  },
);
assert.deepEqual(
  updateCustomerInventoryDeliveryRowNote(
    customerInventoryDeliveryRows,
    "stock-3",
    "改备注",
  ).map((row) => row.note),
  ["出库行 A", "出库行 B", "改备注"],
);
assert.deepEqual(
  updateCustomerInventoryDeliveryRowNoteState({
    note: "改备注",
    rows: customerInventoryDeliveryRows,
    stockId: "stock-3",
  }),
  {
    rows: [
      customerInventoryDeliveryRows[0],
      customerInventoryDeliveryRows[1],
      { ...customerInventoryDeliveryRows[2], note: "改备注" },
    ],
  },
);
assert.deepEqual(
  clearCustomerInventoryDeliveryRowErrors(
    {
      "stock-1": "数量错误",
      "stock-3": "数量错误",
      form: "请至少录入一项出库数量",
      handlerName: "保留经手人错误",
    },
    customerInventoryDeliveryRows,
  ),
  {
    "stock-1": undefined,
    "stock-2": undefined,
    "stock-3": undefined,
    form: undefined,
    handlerName: "保留经手人错误",
  },
);
assert.deepEqual(
  fillCustomerInventoryDeliveryQuantityState({
    errors: {
      "stock-1": "数量错误",
      "stock-3": "数量错误",
      form: "请至少录入一项出库数量",
      handlerName: "保留经手人错误",
    },
    rows: customerInventoryDeliveryRows,
  }),
  {
    errors: {
      "stock-1": undefined,
      "stock-2": undefined,
      "stock-3": undefined,
      form: undefined,
      handlerName: "保留经手人错误",
    },
    rows: [
      { ...customerInventoryDeliveryRows[0], quantity: "5" },
      { ...customerInventoryDeliveryRows[1], quantity: "3" },
      { ...customerInventoryDeliveryRows[2], quantity: "4" },
    ],
  },
);
assert.deepEqual(
  clearCustomerInventoryDeliveryQuantityState({
    errors: {
      "stock-1": "数量错误",
      "stock-3": "数量错误",
      form: "请至少录入一项出库数量",
      handlerName: "保留经手人错误",
    },
    rows: customerInventoryDeliveryRows,
  }),
  {
    errors: {
      "stock-1": undefined,
      "stock-2": undefined,
      "stock-3": undefined,
      form: undefined,
      handlerName: "保留经手人错误",
    },
    rows: [
      { ...customerInventoryDeliveryRows[0], quantity: "" },
      { ...customerInventoryDeliveryRows[1], quantity: "" },
      { ...customerInventoryDeliveryRows[2], quantity: "" },
    ],
  },
);
assert.deepEqual(
  createCustomerInventoryDeliveryWeightRows(
    customerInventoryDeliveryRows.slice(0, 1),
    "current",
  ).map((row) => ({
    currentQuantity: row.currentQuantity,
    quantity: row.quantity,
    requiredQuantity: row.requiredQuantity,
  })),
  [{ currentQuantity: 5, quantity: "5", requiredQuantity: 5 }],
);
const customerInventoryDeliveryPriceGroups =
  buildCustomerInventoryDeliveryPriceGroups(
    customerInventoryDeliveryBatches,
    customerInventoryDeliveryRows,
    [
      { batchIds: ["KH-20260623001"], key: "price-a" },
      { batchIds: ["KH-20260624001"], key: "price-b" },
    ],
  );
assert.deepEqual(
  customerInventoryDeliveryPriceGroups.map((group) => ({
    batchIds: group.batchIds,
    currentQuantity: group.currentQuantity,
    rowCount: group.rows.length,
    title: group.title,
    totalQuantity: group.totalQuantity,
  })),
  [
    {
      batchIds: ["KH-20260623001"],
      currentQuantity: 8,
      rowCount: 2,
      title: "计价方案1",
      totalQuantity: 2,
    },
    {
      batchIds: ["KH-20260624001"],
      currentQuantity: 4,
      rowCount: 1,
      title: "计价方案2",
      totalQuantity: 3,
    },
  ],
);
const customerInventoryDeliveryFocusContext = {
  priceGroups: customerInventoryDeliveryPriceGroups,
  requiredWeights: getRequiredDeliveryWeights(
    createCustomerInventoryDeliveryWeightRows(
      customerInventoryDeliveryRows,
      "entered",
    ),
  ),
  rows: customerInventoryDeliveryRows,
  visibleWeightFields: deliveryWeightFields.filter(
    (field) =>
      getRequiredDeliveryWeights(
        createCustomerInventoryDeliveryWeightRows(
          customerInventoryDeliveryRows,
          "current",
        ),
      )[field.category],
  ),
};
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { kind: "handler" },
    customerInventoryDeliveryFocusContext,
  ),
  {
    field: "powderWeightKg",
    kind: "price-group-weight",
    priceGroupKey: "price-a",
  },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { kind: "handler" },
    {
      ...customerInventoryDeliveryFocusContext,
      priceGroups: customerInventoryDeliveryPriceGroups.slice(0, 1),
    },
  ),
  { field: "extraChargeName", kind: "field" },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { field: "extraChargeName", kind: "extra-charge" },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "extraChargeAmount", kind: "field" },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { field: "extraChargeAmount", kind: "extra-charge" },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "powderWeightKg", kind: "field" },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { fieldIndex: 0, kind: "weight" },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "oxidationWeightKg", kind: "field" },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { fieldIndex: 2, kind: "weight" },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "quantity", kind: "row", rowIndex: 0 },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { fieldIndex: 0, kind: "price-group-weight", priceGroupIndex: 0 },
    customerInventoryDeliveryFocusContext,
  ),
  {
    field: "extraChargeName",
    kind: "price-group-field",
    priceGroupKey: "price-a",
  },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    {
      field: "extraChargeName",
      kind: "price-group-extra-charge",
      priceGroupIndex: 0,
    },
    customerInventoryDeliveryFocusContext,
  ),
  {
    field: "extraChargeAmount",
    kind: "price-group-field",
    priceGroupKey: "price-a",
  },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    {
      field: "extraChargeAmount",
      kind: "price-group-extra-charge",
      priceGroupIndex: 0,
    },
    customerInventoryDeliveryFocusContext,
  ),
  {
    field: "oxidationWeightKg",
    kind: "price-group-weight",
    priceGroupKey: "price-b",
  },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    {
      field: "extraChargeAmount",
      kind: "price-group-extra-charge",
      priceGroupIndex: 1,
    },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "quantity", kind: "row", rowIndex: 0 },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { field: "quantity", kind: "row", rowIndex: 0 },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "quantity", kind: "row", rowIndex: 1 },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { field: "quantity", kind: "row", rowIndex: 2 },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "note", kind: "row", rowIndex: 0 },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { field: "note", kind: "row", rowIndex: 2 },
    customerInventoryDeliveryFocusContext,
  ),
  { field: "delivery-note", kind: "field" },
);
assert.deepEqual(
  getNextCustomerInventoryDeliveryFocusTarget(
    { field: "extraChargeAmount", kind: "extra-charge" },
    {
      priceGroups: [],
      requiredWeights: {
        billet: false,
        bridge: false,
        electrophoresis: false,
        oxidation: false,
        powder: false,
      },
      rows: [],
      visibleWeightFields: [],
    },
  ),
  { field: "delivery-note", kind: "field" },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { handlerName: "请输入经手人" },
    hasMultiplePriceGroups: false,
    priceGroups: [],
    rows: customerInventoryDeliveryRows,
  }),
  { field: "handler", kind: "field" },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { powderWeightKg: "请填写喷涂重量" },
    hasMultiplePriceGroups: false,
    priceGroups: [],
    rows: customerInventoryDeliveryRows,
  }),
  { field: "powderWeightKg", kind: "field" },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { extraChargeAmount: "收费金额必须大于 0" },
    hasMultiplePriceGroups: false,
    priceGroups: [],
    rows: customerInventoryDeliveryRows,
  }),
  { field: "extraChargeAmount", kind: "field" },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { "price-b-oxidationWeightKg": "请填写氧化重量" },
    hasMultiplePriceGroups: true,
    priceGroups: customerInventoryDeliveryPriceGroups,
    rows: customerInventoryDeliveryRows,
  }),
  {
    field: "oxidationWeightKg",
    kind: "price-group-weight",
    priceGroupKey: "price-b",
  },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { "price-a-extraChargeName": "请填写收费名称" },
    hasMultiplePriceGroups: true,
    priceGroups: customerInventoryDeliveryPriceGroups,
    rows: customerInventoryDeliveryRows,
  }),
  {
    field: "extraChargeName",
    kind: "price-group-field",
    priceGroupKey: "price-a",
  },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { "batch-KH-20260623001-groupLabel": "请输入分组" },
    hasMultiplePriceGroups: true,
    priceGroups: customerInventoryDeliveryPriceGroups,
    rows: customerInventoryDeliveryRows,
  }),
  { batchId: "KH-20260623001", kind: "group-label" },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { "stock-3": "出库数量不能大于当前库存" },
    hasMultiplePriceGroups: true,
    priceGroups: customerInventoryDeliveryPriceGroups,
    rows: customerInventoryDeliveryRows,
  }),
  { field: "quantity", kind: "row", rowIndex: 2 },
);
assert.deepEqual(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: { form: "请至少录入一项出库数量" },
    hasMultiplePriceGroups: true,
    priceGroups: customerInventoryDeliveryPriceGroups,
    rows: customerInventoryDeliveryRows,
  }),
  { field: "quantity", kind: "row", rowIndex: 0 },
);
assert.equal(
  getFirstInvalidCustomerInventoryDeliveryFocusTarget({
    errors: {},
    hasMultiplePriceGroups: true,
    priceGroups: customerInventoryDeliveryPriceGroups,
    rows: customerInventoryDeliveryRows,
  }),
  null,
);
assert.deepEqual(
  getRequiredCustomerInventoryDeliveryPriceGroupWeightFields(
    customerInventoryDeliveryPriceGroups[0],
  ).map((field) => field.key),
  ["powderWeightKg"],
);
assert.deepEqual(
  buildCustomerInventoryDeliveryGroups(
    customerInventoryDeliveryRows,
    (batchNote) => batchNote.slice(1).split(",")[0],
  ),
  [
    {
      batchId: "KH-20260623001",
      batchNote: "前第一车,备注",
      currentQuantity: 8,
      defaultGroupLabel: "第一车",
      deliveryQuantity: 2,
      groupLabel: "",
      itemCount: 2,
    },
    {
      batchId: "KH-20260624001",
      batchNote: "前第二车",
      currentQuantity: 4,
      defaultGroupLabel: "第二车",
      deliveryQuantity: 3,
      groupLabel: "手填分组",
      itemCount: 1,
    },
  ],
);
const customerInventoryDeliveryFormBase = {
  extraCharges: [{ name: "", amount: "" }],
  billetWeightKg: "",
  bridgeWeightKg: "",
  electrophoresisWeightKg: "",
  extraChargeAmount: "",
  extraChargeName: "",
  handlerName: "",
  note: "",
  oxidationWeightKg: "",
  powderWeightKg: "",
  pricingTaxIncluded: true,
  specialNote: "",
};
assert.deepEqual(
  collectCustomerInventoryDeliverySubmitState({
    defaultGroupLabel: (batchNote) => batchNote.slice(1).split(",")[0],
    formValues: {
      ...customerInventoryDeliveryFormBase,
      handlerName: " 经手人 ",
      note: " 合并备注 ",
    },
    hasMultiplePriceGroups: true,
    priceGroupFormValues: {
      "price-a": {
        ...customerInventoryDeliveryFormBase,
        extraChargeAmount: "10",
        extraChargeName: "装车费",
        powderWeightKg: "12.50",
      },
      "price-b": {
        ...customerInventoryDeliveryFormBase,
        oxidationWeightKg: "8",
      },
    },
    priceGroups: customerInventoryDeliveryPriceGroups,
    rows: customerInventoryDeliveryRows,
  }),
  {
    errors: {},
    payloads: [
      {
        batchId: "KH-20260623001",
        batchIds: ["KH-20260623001", "KH-20260624001"],
        billetWeightKgX100: 0,
        bridgeWeightKgX100: 0,
        electrophoresisWeightKgX100: 0,
        extraChargeAmountX100: 1000,
        extraChargeName: "装车费",
        handlerName: "经手人",
        items: [
          {
            groupLabel: "第一车",
            note: "出库行 A",
            quantity: 2,
            stockId: "stock-1",
          },
          {
            groupLabel: "手填分组",
            note: "出库行 C",
            quantity: 3,
            stockId: "stock-3",
          },
        ],
        note: "合并备注",
        oxidationWeightKgX100: 0,
        powderWeightKgX100: 1250,
        priceGroups: [
          {
            batchIds: ["KH-20260623001"],
            billetWeightKgX100: 0,
            bridgeWeightKgX100: 0,
            electrophoresisWeightKgX100: 0,
            extraChargeAmountX100: 1000,
            extraChargeName: "装车费",
            items: [
              {
                groupLabel: "第一车",
                note: "出库行 A",
                quantity: 2,
                stockId: "stock-1",
              },
            ],
            oxidationWeightKgX100: 0,
            powderWeightKgX100: 1250,
          },
          {
            batchIds: ["KH-20260624001"],
            billetWeightKgX100: 0,
            bridgeWeightKgX100: 0,
            electrophoresisWeightKgX100: 0,
            extraChargeAmountX100: 0,
            extraChargeName: "",
            items: [
              {
                groupLabel: "手填分组",
                note: "出库行 C",
                quantity: 3,
                stockId: "stock-3",
              },
            ],
            oxidationWeightKgX100: 800,
            powderWeightKgX100: 0,
          },
        ],
        specialNote: "",
      },
    ],
  },
);
assert.deepEqual(
  collectCustomerInventoryDeliverySubmitState({
    defaultGroupLabel: () => "",
    formValues: customerInventoryDeliveryFormBase,
    hasMultiplePriceGroups: false,
    priceGroupFormValues: {},
    priceGroups: customerInventoryDeliveryPriceGroups.slice(0, 1),
    rows: [{ ...customerInventoryDeliveryRows[0], quantity: "2" }],
  }),
  {
    errors: {
      "batch-KH-20260623001-groupLabel": "请输入分组",
      handlerName: "请输入经手人",
      form: "请至少录入一项出库数量",
    },
    payloads: [],
  },
);
assert.deepEqual(
  collectCustomerInventoryDeliverySubmitState({
    defaultGroupLabel: (batchNote) => batchNote.slice(1).split(",")[0],
    formValues: {
      ...customerInventoryDeliveryFormBase,
      handlerName: "经手人",
    },
    hasMultiplePriceGroups: false,
    priceGroupFormValues: {},
    priceGroups: customerInventoryDeliveryPriceGroups.slice(0, 1),
    rows: [{ ...customerInventoryDeliveryRows[0], quantity: "6" }],
  }),
  {
    errors: {
      "stock-1": "出库数量不能大于当前库存",
      form: "请至少录入一项出库数量",
    },
    payloads: [],
  },
);
assert.deepEqual(
  collectCustomerInventoryDeliverySubmitState({
    defaultGroupLabel: (batchNote) => batchNote.slice(1).split(",")[0],
    formValues: {
      ...customerInventoryDeliveryFormBase,
      extraChargeAmount: "10",
      handlerName: "经手人",
    },
    hasMultiplePriceGroups: false,
    priceGroupFormValues: {},
    priceGroups: customerInventoryDeliveryPriceGroups.slice(0, 1),
    rows: [{ ...customerInventoryDeliveryRows[0], quantity: "2" }],
  }),
  {
    errors: {
      extraChargeName: "请填写收费名称",
      powderWeightKg: "请填写喷涂重量",
    },
    payloads: [],
  },
);
assert.deepEqual(
  collectCustomerInventoryDeliverySubmitState({
    defaultGroupLabel: (batchNote) => batchNote.slice(1).split(",")[0],
    formValues: customerInventoryDeliveryFormBase,
    hasMultiplePriceGroups: false,
    priceGroupFormValues: {},
    priceGroups: [],
    rows: [],
    selectedBatch: null,
  }),
  {
    errors: {
      form: "请选择客户库存批次",
    },
    payloads: [],
  },
);

const customerInventoryBatchRows = [
  {
    color: "灰色",
    lengthMm: "6000",
    moldCode: "G5501",
    note: "",
    productId: "p1",
    productName: "灰色边框",
    quantity: "5",
    thicknessMmX100: 120,
    weightPerMeterKgX1000: 1200,
  },
  {
    color: "坯料",
    lengthMm: "3000",
    moldCode: "G5502",
    note: "",
    productId: "p2",
    productName: "坯料边框",
    quantity: "3",
    thicknessMmX100: 100,
    weightPerMeterKgX1000: 850,
  },
  {
    color: "氧化",
    lengthMm: "5000",
    moldCode: "G5503",
    note: "",
    productId: "p3",
    productName: "氧化边框",
    quantity: "",
    thicknessMmX100: 100,
    weightPerMeterKgX1000: 900,
  },
  {
    color: "",
    lengthMm: "abc",
    moldCode: "G5504",
    note: "",
    productId: "p4",
    productName: "无效边框",
    quantity: "2",
    thicknessMmX100: 100,
    weightPerMeterKgX1000: 1000,
  },
];
assert.deepEqual(defaultCustomerInventoryBatchFormValues, {
  aluminumIngotPrice: "",
  batchId: "",
  billetProcessingFee: "",
  bridgeProcessingFee: "",
  customerId: "",
  electrophoresisProcessingFee: "",
  historicalOrderDate: "",
  historicalOrderRef: "",
  note: "",
  oxidationProcessingFee: "",
  powderProcessingFee: "",
  pricingTaxIncluded: true,
});
const customerInventoryFeeValues = {
  billetProcessingFeeX100: 8000,
  bridgeProcessingFeeX100: 12000,
  electrophoresisProcessingFeeX100: 16000,
  oxidationProcessingFeeX100: 15000,
  powderProcessingFeeX100: 11000,
};
assert.deepEqual(
  applyCustomerInventoryProcessingFees({
    fees: customerInventoryFeeValues,
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      bridgeProcessingFee: "旧值",
      note: "原备注",
    },
  }),
  {
    ...defaultCustomerInventoryBatchFormValues,
    billetProcessingFee: "80.00",
    bridgeProcessingFee: "120.00",
    electrophoresisProcessingFee: "160.00",
    note: "原备注",
    oxidationProcessingFee: "150.00",
    powderProcessingFee: "110.00",
  },
);
assert.deepEqual(
  fillMissingCustomerInventoryProcessingFees({
    fees: customerInventoryFeeValues,
    fields: [
      {
        formKey: "bridgeProcessingFee",
        snapshotKey: "bridgeProcessingFeeX100",
      },
      {
        formKey: "powderProcessingFee",
        snapshotKey: "powderProcessingFeeX100",
      },
      {
        formKey: "billetProcessingFee",
        snapshotKey: "billetProcessingFeeX100",
      },
    ],
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      bridgeProcessingFee: "99",
    },
  }),
  {
    ...defaultCustomerInventoryBatchFormValues,
    billetProcessingFee: "80.00",
    bridgeProcessingFee: "99",
    powderProcessingFee: "110.00",
  },
);
assert.deepEqual(
  fillMissingCustomerInventoryProcessingFees({
    fees: {
      ...customerInventoryFeeValues,
      powderProcessingFeeX100: 0,
    },
    fields: [
      {
        formKey: "powderProcessingFee",
        snapshotKey: "powderProcessingFeeX100",
      },
    ],
    values: defaultCustomerInventoryBatchFormValues,
  }),
  defaultCustomerInventoryBatchFormValues,
);
assert.deepEqual(
  createCustomerInventoryBatchMissingProcessingFeesState({
    fees: customerInventoryFeeValues,
    fields: [
      {
        formKey: "powderProcessingFee",
        snapshotKey: "powderProcessingFeeX100",
      },
    ],
    values: defaultCustomerInventoryBatchFormValues,
  }),
  {
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      powderProcessingFee: "110.00",
    },
  },
);
assert.deepEqual(
  updateCustomerInventoryBatchNoteWithFees({
    fees: customerInventoryFeeValues,
    note: "特殊备注",
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      note: "旧备注",
      powderProcessingFee: "旧值",
    },
  }),
  {
    ...defaultCustomerInventoryBatchFormValues,
    billetProcessingFee: "80.00",
    bridgeProcessingFee: "120.00",
    electrophoresisProcessingFee: "160.00",
    note: "特殊备注",
    oxidationProcessingFee: "150.00",
    powderProcessingFee: "110.00",
  },
);
assert.deepEqual(
  createCustomerInventoryBatchNoteFeesState({
    fees: customerInventoryFeeValues,
    note: "特殊备注",
    values: defaultCustomerInventoryBatchFormValues,
  }),
  {
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      billetProcessingFee: "80.00",
      bridgeProcessingFee: "120.00",
      electrophoresisProcessingFee: "160.00",
      note: "特殊备注",
      oxidationProcessingFee: "150.00",
      powderProcessingFee: "110.00",
    },
  },
);
const customerInventoryBatchFormWithRef = updateCustomerInventoryBatchFormField({
  key: "historicalOrderRef",
  value: "外部单号-001",
  values: defaultCustomerInventoryBatchFormValues,
});
assert.equal(customerInventoryBatchFormWithRef.historicalOrderRef, "外部单号-001");
assert.equal(defaultCustomerInventoryBatchFormValues.historicalOrderRef, "");
assert.deepEqual(
  clearCustomerInventoryBatchFormError(
    { customerId: "请选择客户", form: "表单错误" },
    "customerId",
  ),
  { customerId: undefined, form: "表单错误" },
);
assert.deepEqual(
  clearCustomerInventoryBatchFormErrorState({
    errors: { customerId: "请选择客户", form: "表单错误" },
    key: "customerId",
  }),
  {
    errors: { customerId: undefined, form: "表单错误" },
  },
);
assert.deepEqual(
  updateCustomerInventoryBatchFormFieldState({
    errors: { aluminumIngotPrice: "请填写铝锭价", form: "表单错误" },
    key: "aluminumIngotPrice",
    value: "21000",
    values: defaultCustomerInventoryBatchFormValues,
  }),
  {
    errors: { aluminumIngotPrice: undefined, form: "表单错误" },
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      aluminumIngotPrice: "21000",
    },
  },
);
assert.deepEqual(
  updateCustomerInventoryBatchCustomerWithFees({
    customerId: "c2",
    fees: customerInventoryFeeValues,
    pricingTaxIncluded: false,
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      customerId: "c1",
      note: "原备注",
      pricingTaxIncluded: true,
    },
  }),
  {
    ...defaultCustomerInventoryBatchFormValues,
    billetProcessingFee: "80.00",
    bridgeProcessingFee: "120.00",
    customerId: "c2",
    electrophoresisProcessingFee: "160.00",
    note: "原备注",
    oxidationProcessingFee: "150.00",
    powderProcessingFee: "110.00",
    pricingTaxIncluded: false,
  },
);
assert.deepEqual(
  updateCustomerInventoryBatchCustomerState({
    customerId: "c2",
    errors: { customerId: "请选择客户", form: "表单错误" },
    fees: customerInventoryFeeValues,
    pricingTaxIncluded: false,
    rows: [
      {
        color: "灰色",
        lengthMm: "6000",
        moldCode: "G5501",
        note: "备注",
        productId: "p1",
        productName: "灰色边框",
        quantity: "5",
        thicknessMmX100: 120,
        weightPerMeterKgX1000: 1200,
      },
    ],
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      customerId: "c1",
      note: "原备注",
      pricingTaxIncluded: true,
    },
  }),
  {
    errors: { customerId: undefined, form: "表单错误" },
    rows: [
      {
        color: "灰色",
        lengthMm: "6000",
        moldCode: "",
        note: "备注",
        productId: "",
        productName: "",
        quantity: "5",
        thicknessMmX100: 0,
        weightPerMeterKgX1000: 0,
      },
    ],
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      billetProcessingFee: "80.00",
      bridgeProcessingFee: "120.00",
      customerId: "c2",
      electrophoresisProcessingFee: "160.00",
      note: "原备注",
      oxidationProcessingFee: "150.00",
      powderProcessingFee: "110.00",
      pricingTaxIncluded: false,
    },
  },
);
assert.deepEqual(
  updateCustomerInventoryBatchPricingWithFees({
    fees: customerInventoryFeeValues,
    pricingTaxIncluded: false,
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      customerId: "c1",
      pricingTaxIncluded: true,
    },
  }),
  {
    ...defaultCustomerInventoryBatchFormValues,
    billetProcessingFee: "80.00",
    bridgeProcessingFee: "120.00",
    customerId: "c1",
    electrophoresisProcessingFee: "160.00",
    oxidationProcessingFee: "150.00",
    powderProcessingFee: "110.00",
    pricingTaxIncluded: false,
  },
);
assert.deepEqual(
  createCustomerInventoryBatchPricingFeesState({
    fees: customerInventoryFeeValues,
    pricingTaxIncluded: false,
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      customerId: "c1",
      pricingTaxIncluded: true,
    },
  }),
  {
    values: {
      ...defaultCustomerInventoryBatchFormValues,
      billetProcessingFee: "80.00",
      bridgeProcessingFee: "120.00",
      customerId: "c1",
      electrophoresisProcessingFee: "160.00",
      oxidationProcessingFee: "150.00",
      powderProcessingFee: "110.00",
      pricingTaxIncluded: false,
    },
  },
);
assert.deepEqual(defaultCustomerInventoryBatchRow, {
  color: "",
  lengthMm: "",
  moldCode: "",
  note: "",
  productId: "",
  productName: "",
  quantity: "",
  thicknessMmX100: 0,
  weightPerMeterKgX1000: 0,
});
const customerInventoryImportRow = {
  aluminumIngotPriceX100: 2000000,
  batchKey: "原批次-001",
  batchNote: "虎标膜,第一车",
  billetProcessingFeeX100: 0,
  bridgeProcessingFeeX100: 12000,
  color: "灰色",
  customerName: "测试客户",
  electrophoresisProcessingFeeX100: 0,
  historicalOrderDate: "2026-07-20",
  historicalOrderRef: "OLD-001",
  itemNote: "明细备注",
  lengthMm: 6000,
  moldCode: "G5501",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 11000,
  pricingTaxIncluded: true,
  productName: "测试商品",
  quantity: 5,
  rowNumber: 2,
};
assert.deepEqual(createEmptyCustomerInventoryImportPreviewState(), {
  errors: [],
  fileName: "",
  rows: [],
});
assert.equal(
  getCustomerInventoryImportFileName("/tmp/客户库存导入.csv"),
  "客户库存导入.csv",
);
assert.equal(
  getCustomerInventoryImportFileName("C:\\temp\\客户库存导入.xlsx"),
  "客户库存导入.xlsx",
);
assert.deepEqual(
  createCustomerInventoryImportFileSelectionState("/tmp/客户库存导入.csv"),
  {
    errors: [],
    fileName: "客户库存导入.csv",
    rows: [],
  },
);
assert.deepEqual(
  createCustomerInventoryImportParseSuccessState({
    fileName: "客户库存导入.csv",
    result: {
      errors: ["第 3 行：商品不存在"],
      rows: [customerInventoryImportRow],
    },
  }),
  {
    errors: ["第 3 行：商品不存在"],
    fileName: "客户库存导入.csv",
    rows: [customerInventoryImportRow],
  },
);
assert.deepEqual(
  createCustomerInventoryImportErrorState({
    fileName: "客户库存导入.csv",
    message: "客户库存批量导入失败",
    rows: [customerInventoryImportRow],
  }),
  {
    errors: ["客户库存批量导入失败"],
    fileName: "客户库存导入.csv",
    rows: [customerInventoryImportRow],
  },
);
const emptyCustomerInventoryBatchDialogValues =
  createEmptyCustomerInventoryBatchDialogValues();
assert.deepEqual(emptyCustomerInventoryBatchDialogValues, {
  formValues: defaultCustomerInventoryBatchFormValues,
  rows: [defaultCustomerInventoryBatchRow],
});
assert.deepEqual(createEmptyCustomerInventoryBatchDialogApplyState(), {
  errors: {},
  formValues: defaultCustomerInventoryBatchFormValues,
  rows: [defaultCustomerInventoryBatchRow],
});
assert.deepEqual(
  createCustomerInventoryBatchDialogOpenState({
    editingBatch: null,
    values: emptyCustomerInventoryBatchDialogValues,
  }),
  {
    dialogApplyState: createCustomerInventoryBatchDialogApplyState(
      emptyCustomerInventoryBatchDialogValues,
    ),
    editingBatch: null,
    open: true,
  },
);
assert.deepEqual(createCustomerInventoryBatchDialogCloseState(), {
  dialogApplyState: createEmptyCustomerInventoryBatchDialogApplyState(),
  editingBatch: null,
  open: false,
});
assert.notEqual(
  emptyCustomerInventoryBatchDialogValues.formValues,
  defaultCustomerInventoryBatchFormValues,
);
assert.notEqual(
  emptyCustomerInventoryBatchDialogValues.rows[0],
  defaultCustomerInventoryBatchRow,
);
assert.deepEqual(
  clearCustomerInventoryBatchRowProducts([
    {
      color: "灰色",
      lengthMm: "6000",
      moldCode: "G5501",
      note: "备注",
      productId: "p1",
      productName: "灰色边框",
      quantity: "5",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 1200,
    },
  ]),
  [
    {
      color: "灰色",
      lengthMm: "6000",
      moldCode: "",
      note: "备注",
      productId: "",
      productName: "",
      quantity: "5",
      thicknessMmX100: 0,
      weightPerMeterKgX1000: 0,
    },
  ],
);
const customerInventoryRowA = {
  color: "灰色",
  lengthMm: "6000",
  moldCode: "G5501",
  note: "第一行",
  productId: "p1",
  productName: "灰色边框",
  quantity: "5",
  thicknessMmX100: 120,
  weightPerMeterKgX1000: 1200,
};
const customerInventoryRowB = {
  color: "白色",
  lengthMm: "5000",
  moldCode: "G5502",
  note: "第二行",
  productId: "p2",
  productName: "白色边框",
  quantity: "3",
  thicknessMmX100: 130,
  weightPerMeterKgX1000: 1500,
};
assert.deepEqual(
  appendCustomerInventoryBatchRow([customerInventoryRowA]),
  [customerInventoryRowA, defaultCustomerInventoryBatchRow],
);
assert.deepEqual(
  appendCustomerInventoryBatchRowState([customerInventoryRowA]),
  {
    rows: [customerInventoryRowA, defaultCustomerInventoryBatchRow],
  },
);
assert.notEqual(
  appendCustomerInventoryBatchRow([customerInventoryRowA])[1],
  defaultCustomerInventoryBatchRow,
);
assert.deepEqual(
  removeCustomerInventoryBatchRow({
    rowIndex: 0,
    rows: [customerInventoryRowA, customerInventoryRowB],
  }),
  [customerInventoryRowB],
);
assert.deepEqual(
  removeCustomerInventoryBatchRowState({
    rowIndex: 0,
    rows: [customerInventoryRowA, customerInventoryRowB],
  }),
  {
    rows: [customerInventoryRowB],
  },
);
assert.deepEqual(
  updateCustomerInventoryBatchRowField({
    field: "quantity",
    rowIndex: 1,
    rows: [customerInventoryRowA, customerInventoryRowB],
    value: "8",
  }),
  [customerInventoryRowA, { ...customerInventoryRowB, quantity: "8" }],
);
assert.deepEqual(
  updateCustomerInventoryBatchRowFieldState({
    errors: {
      "row-1-quantity": "数量必须大于 0",
      "row-1-productId": "请选择商品",
      form: "表单错误",
    },
    field: "quantity",
    rowIndex: 1,
    rows: [customerInventoryRowA, customerInventoryRowB],
    value: "8",
  }),
  {
    errors: {
      "row-1-quantity": undefined,
      "row-1-productId": "请选择商品",
      form: "表单错误",
    },
    rows: [customerInventoryRowA, { ...customerInventoryRowB, quantity: "8" }],
  },
);
assert.deepEqual(
  applyCustomerInventoryBatchRowProduct({
    product: {
      id: "p2",
      moldCode: "G5502",
      productName: "白色边框",
      thicknessMmX100: 130,
      weightPerMeterKgX1000: 1500,
    },
    row: {
      color: "灰色",
      lengthMm: "6000",
      moldCode: "G5501",
      note: "备注",
      productId: "p1",
      productName: "灰色边框",
      quantity: "5",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 1200,
    },
  }),
  {
    color: "灰色",
    lengthMm: "6000",
    moldCode: "G5502",
    note: "备注",
    productId: "p2",
    productName: "白色边框",
    quantity: "5",
    thicknessMmX100: 130,
    weightPerMeterKgX1000: 1500,
  },
);
assert.deepEqual(
  applyCustomerInventoryBatchRowProduct({
    row: {
      color: "灰色",
      lengthMm: "6000",
      moldCode: "G5501",
      note: "备注",
      productId: "p1",
      productName: "灰色边框",
      quantity: "5",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 1200,
    },
  }),
  {
    color: "灰色",
    lengthMm: "6000",
    moldCode: "",
    note: "备注",
    productId: "",
    productName: "",
    quantity: "5",
    thicknessMmX100: 0,
    weightPerMeterKgX1000: 0,
  },
);
assert.deepEqual(
  applyCustomerInventoryBatchRowProductAtIndex({
    product: {
      id: "p3",
      moldCode: "G5503",
      productName: "绿色边框",
      thicknessMmX100: 140,
      weightPerMeterKgX1000: 1600,
    },
    rowIndex: 1,
    rows: [customerInventoryRowA, customerInventoryRowB],
  }),
  [
    customerInventoryRowA,
    {
      ...customerInventoryRowB,
      moldCode: "G5503",
      productId: "p3",
      productName: "绿色边框",
      thicknessMmX100: 140,
      weightPerMeterKgX1000: 1600,
    },
  ],
);
assert.deepEqual(
  applyCustomerInventoryBatchRowProductState({
    errors: {
      "row-1-lengthMm": "长度必须大于 0",
      "row-1-productId": "请选择商品",
      form: "表单错误",
    },
    product: {
      id: "p3",
      moldCode: "G5503",
      productName: "绿色边框",
      thicknessMmX100: 140,
      weightPerMeterKgX1000: 1600,
    },
    rowIndex: 1,
    rows: [customerInventoryRowA, customerInventoryRowB],
  }),
  {
    errors: {
      "row-1-lengthMm": "长度必须大于 0",
      "row-1-productId": undefined,
      form: "表单错误",
    },
    rows: [
      customerInventoryRowA,
      {
        ...customerInventoryRowB,
        moldCode: "G5503",
        productId: "p3",
        productName: "绿色边框",
        thicknessMmX100: 140,
        weightPerMeterKgX1000: 1600,
      },
    ],
  },
);
assert.deepEqual(
  getNextCustomerInventoryDetailFocusTarget({
    field: "lengthMm",
    rowCount: 2,
    rowIndex: 0,
  }),
  { field: "color", rowIndex: 0, shouldAppendRow: false },
);
assert.deepEqual(
  getNextCustomerInventoryDetailFocusTarget({
    field: "color",
    rowCount: 2,
    rowIndex: 0,
  }),
  { field: "quantity", rowIndex: 0, shouldAppendRow: false },
);
assert.deepEqual(
  getNextCustomerInventoryDetailFocusTarget({
    field: "quantity",
    rowCount: 2,
    rowIndex: 0,
  }),
  { field: "note", rowIndex: 0, shouldAppendRow: false },
);
assert.deepEqual(
  getNextCustomerInventoryDetailFocusTarget({
    field: "note",
    rowCount: 2,
    rowIndex: 0,
  }),
  { field: "product", rowIndex: 1, shouldAppendRow: false },
);
assert.deepEqual(
  getNextCustomerInventoryDetailFocusTarget({
    field: "note",
    rowCount: 2,
    rowIndex: 1,
  }),
  { field: "product", rowIndex: 2, shouldAppendRow: true },
);
assert.deepEqual(
  createCustomerInventoryBatchFormValuesFromBatch({
    aluminumIngotPriceX100: 2_000_000,
    batchId: "ignored",
    billetProcessingFeeX100: 8000,
    bridgeProcessingFeeX100: 12000,
    customerId: "customer-1",
    electrophoresisProcessingFeeX100: 0,
    historicalOrderDate: null,
    historicalOrderRef: "历史单号",
    id: "KH-20260623001",
    note: "批次备注",
    oxidationProcessingFeeX100: 9000,
    powderProcessingFeeX100: 10000,
    pricingTaxIncluded: true,
  }),
  {
    aluminumIngotPrice: "20000.00",
    batchId: "KH-20260623001",
    billetProcessingFee: "80.00",
    bridgeProcessingFee: "120.00",
    customerId: "customer-1",
    electrophoresisProcessingFee: "",
    historicalOrderDate: "",
    historicalOrderRef: "历史单号",
    note: "批次备注",
    oxidationProcessingFee: "90.00",
    powderProcessingFee: "100.00",
    pricingTaxIncluded: true,
  },
);
assert.deepEqual(
  createCustomerInventoryBatchRowFromStockItem({
    item: {
      color: "灰色",
      id: "stock-1",
      lengthMm: 6000,
      moldCode: "旧模具",
      note: "库存备注",
      productId: "p1",
      productName: "旧商品名",
      quantity: 5,
    },
    product: {
      moldCode: "G5501",
      productName: "灰色边框",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 1200,
    },
  }),
  {
    color: "灰色",
    lengthMm: "6000",
    moldCode: "G5501",
    note: "库存备注",
    productId: "p1",
    productName: "灰色边框",
    quantity: "5",
    thicknessMmX100: 120,
    weightPerMeterKgX1000: 1200,
  },
);
assert.deepEqual(
  createCustomerInventoryBatchRowsFromBatch({
    batch: {
      id: "KH-20260623001",
      items: [
        {
          color: "灰色",
          id: "stock-1",
          lengthMm: 6000,
          moldCode: "旧模具",
          note: "库存备注",
          productId: "p1",
          productName: "旧商品名",
          quantity: 5,
        },
        {
          color: "白色",
          id: "stock-2",
          lengthMm: 5000,
          moldCode: "G5502",
          note: "",
          productId: "p-missing",
          productName: "保留商品名",
          quantity: 3,
        },
      ],
    },
    products: [
      {
        id: "p1",
        moldCode: "G5501",
        productName: "灰色边框",
        thicknessMmX100: 120,
        weightPerMeterKgX1000: 1200,
      },
    ],
  }),
  [
    {
      color: "灰色",
      lengthMm: "6000",
      moldCode: "G5501",
      note: "库存备注",
      productId: "p1",
      productName: "灰色边框",
      quantity: "5",
      thicknessMmX100: 120,
      weightPerMeterKgX1000: 1200,
    },
    {
      color: "白色",
      lengthMm: "5000",
      moldCode: "G5502",
      note: "",
      productId: "p-missing",
      productName: "保留商品名",
      quantity: "3",
      thicknessMmX100: 0,
      weightPerMeterKgX1000: 0,
    },
  ],
);
const customerInventoryBatchDialogBatch = {
  aluminumIngotPriceX100: 2_000_000,
  billetProcessingFeeX100: 8000,
  bridgeProcessingFeeX100: 12000,
  customerId: "c1",
  electrophoresisProcessingFeeX100: 16000,
  historicalOrderDate: "2026-06-23",
  historicalOrderRef: "外部单号",
  id: "KH-20260623001",
  items: [
    {
      color: "灰色",
      id: "stock-1",
      lengthMm: 6000,
      moldCode: "旧模具",
      note: "库存备注",
      productId: "p1",
      productName: "旧商品名",
      quantity: 5,
    },
  ],
  note: "批次备注",
  oxidationProcessingFeeX100: 15000,
  powderProcessingFeeX100: 11000,
  pricingTaxIncluded: true,
};
const customerInventoryBatchDialogValuesFromBatch =
  createCustomerInventoryBatchDialogValuesFromBatch({
    batch: customerInventoryBatchDialogBatch,
    products: [
      {
        id: "p1",
        moldCode: "G5501",
        productName: "灰色边框",
        thicknessMmX100: 120,
        weightPerMeterKgX1000: 1200,
      },
    ],
  });
assert.deepEqual(customerInventoryBatchDialogValuesFromBatch.formValues, {
  aluminumIngotPrice: "20000.00",
  batchId: "KH-20260623001",
  billetProcessingFee: "80.00",
  bridgeProcessingFee: "120.00",
  customerId: "c1",
  electrophoresisProcessingFee: "160.00",
  historicalOrderDate: "2026-06-23",
  historicalOrderRef: "外部单号",
  note: "批次备注",
  oxidationProcessingFee: "150.00",
  powderProcessingFee: "110.00",
  pricingTaxIncluded: true,
});
assert.deepEqual(customerInventoryBatchDialogValuesFromBatch.rows, [
  {
    color: "灰色",
    lengthMm: "6000",
    moldCode: "G5501",
    note: "库存备注",
    productId: "p1",
    productName: "灰色边框",
    quantity: "5",
    thicknessMmX100: 120,
    weightPerMeterKgX1000: 1200,
  },
]);
assert.deepEqual(
  createCustomerInventoryBatchDialogApplyState(
    customerInventoryBatchDialogValuesFromBatch,
  ),
  {
    ...customerInventoryBatchDialogValuesFromBatch,
    errors: {},
  },
);
assert.deepEqual(
  createCustomerInventoryBatchDialogOpenState({
    editingBatch: customerInventoryBatchDialogBatch,
    values: customerInventoryBatchDialogValuesFromBatch,
  }),
  {
    dialogApplyState: createCustomerInventoryBatchDialogApplyState(
      customerInventoryBatchDialogValuesFromBatch,
    ),
    editingBatch: customerInventoryBatchDialogBatch,
    open: true,
  },
);
assert.deepEqual(
  getCustomerInventoryBatchRequiredCategories(customerInventoryBatchRows),
  ["powder", "billet", "oxidation"],
);
assert.equal(
  getCustomerInventoryBatchTotalQuantity(customerInventoryBatchRows),
  10,
);
assert.deepEqual(
  getCustomerInventoryBatchCategoryQuantityItems(customerInventoryBatchRows),
  [
    { label: "喷涂", value: 5 },
    { label: "坯料", value: 3 },
  ],
);
assert.equal(
  getCustomerInventoryBatchRowWeightX100(customerInventoryBatchRows[0]),
  3600,
);
assert.equal(
  getCustomerInventoryBatchRowWeightX100(customerInventoryBatchRows[3]),
  0,
);
assert.equal(
  getCustomerInventoryBatchTotalTheoreticalWeightX100(
    customerInventoryBatchRows,
  ),
  4365,
);
const validCustomerInventoryBatchValues = {
  aluminumIngotPrice: "20000",
  batchId: "",
  billetProcessingFee: "80",
  bridgeProcessingFee: "120",
  customerId: "customer-1",
  electrophoresisProcessingFee: "",
  historicalOrderDate: " 2026-06-23 ",
  historicalOrderRef: " 历史单号 ",
  note: " 批次备注 ",
  oxidationProcessingFee: "",
  powderProcessingFee: "100",
  pricingTaxIncluded: true,
};
assert.deepEqual(
  collectCustomerInventoryBatchSubmitState({
    requiredCategories: ["powder", "billet"],
    rows: customerInventoryBatchRows.slice(0, 2),
    values: validCustomerInventoryBatchValues,
  }),
  {
    errors: {},
    payload: {
      aluminumIngotPriceX100: 2_000_000,
      billetProcessingFeeX100: 8000,
      bridgeProcessingFeeX100: 12000,
      customerId: "customer-1",
      electrophoresisProcessingFeeX100: 0,
      historicalOrderDate: "2026-06-23",
      historicalOrderRef: "历史单号",
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "",
          productId: "p1",
          quantity: 5,
        },
        {
          color: "坯料",
          lengthMm: 3000,
          note: "",
          productId: "p2",
          quantity: 3,
        },
      ],
      note: "批次备注",
      oxidationProcessingFeeX100: 0,
      powderProcessingFeeX100: 10000,
      pricingTaxIncluded: true,
    },
  },
);
assert.deepEqual(normalizeCustomerInventoryHistoricalOrderDate(""), {
  value: null,
});
assert.deepEqual(normalizeCustomerInventoryHistoricalOrderDate(" 2026-06-23 "), {
  value: "2026-06-23",
});
assert.deepEqual(normalizeCustomerInventoryHistoricalOrderDate("2026/06/23"), {
  error: "日期格式为 YYYY-MM-DD",
  value: null,
});
assert.deepEqual(normalizeCustomerInventoryHistoricalOrderDate("2026-02-30"), {
  error: "请输入有效日期",
  value: null,
});
assert.deepEqual(
  collectCustomerInventoryBatchSubmitState({
    requiredCategories: ["powder"],
    rows: customerInventoryBatchRows.slice(0, 1),
    values: { ...validCustomerInventoryBatchValues, aluminumIngotPrice: "abc" },
  }),
  {
    errors: {
      aluminumIngotPrice: "铝锭价只能输入数字",
    },
    payload: null,
  },
);
assert.deepEqual(
  collectCustomerInventoryBatchSubmitState({
    requiredCategories: ["powder"],
    rows: customerInventoryBatchRows.slice(0, 1),
    values: {
      ...validCustomerInventoryBatchValues,
      historicalOrderDate: "2026/06/23",
    },
  }),
  {
    errors: {
      historicalOrderDate: "日期格式为 YYYY-MM-DD",
    },
    payload: null,
  },
);
assert.deepEqual(
  collectCustomerInventoryBatchSubmitState({
    requiredCategories: ["powder"],
    rows: customerInventoryBatchRows.slice(0, 1),
    values: { ...validCustomerInventoryBatchValues, powderProcessingFee: "" },
  }),
  {
    errors: {
      powderProcessingFee: "请填写喷涂加工费",
    },
    payload: null,
  },
);
assert.deepEqual(
  collectCustomerInventoryBatchSubmitState({
    requiredCategories: [],
    rows: [
      {
        color: "",
        lengthMm: "0",
        moldCode: "",
        note: "",
        productId: "",
        productName: "",
        quantity: "0",
        thicknessMmX100: 0,
        weightPerMeterKgX1000: 0,
      },
    ],
    values: { ...validCustomerInventoryBatchValues, customerId: "" },
  }),
  {
    errors: {
      customerId: "请选择客户",
      form: "请至少添加一项客户库存",
      "row-0-color": "请输入颜色",
      "row-0-lengthMm": "长度必须大于 0",
      "row-0-productId": "请选择商品",
      "row-0-quantity": "数量必须大于 0",
    },
    payload: null,
  },
);

assert.equal(parseWeightKgToX100(""), 0);
assert.equal(parseWeightKgToX100(" 10.235 "), 1024);
assert.equal(parseWeightKgToX100("-1"), null);
assert.equal(parseWeightKgToX100("abc"), null);

assert.deepEqual(
  getRequiredDeliveryWeights([
    { color: "坯料", quantity: "2" },
    { color: "外咖啡 内白", quantity: "3" },
    { color: "灰色", quantity: "4" },
    { color: "氧化", quantity: "5" },
    { color: "1#色", quantity: "6" },
    { color: "灰色", quantity: "0" },
    { color: "双面灰", quantity: "abc" },
  ]),
  {
    billet: true,
    bridge: true,
    electrophoresis: true,
    oxidation: true,
    powder: true,
  },
);

const pendingGroup = {
  deliveryNoteId: null,
  deliveryNoteIds: [],
  inventoryCloseDestination: null,
  inventoryClosedAt: null,
  inventoryLockedAt: null,
  items: [
    { currentQuantity: 0, orderQuantity: 2, requiredQuantity: 5 },
    { currentQuantity: 0, orderQuantity: 0, requiredQuantity: 3 },
  ],
};
const deliveredGroup = {
  deliveryNoteId: "ALU20260621001",
  deliveryNoteIds: ["ALU20260621001-01"],
  inventoryCloseDestination: "shipped",
  inventoryClosedAt: "2026-06-21T10:00:00.000Z",
  inventoryLockedAt: "2026-06-21T09:00:00.000Z",
  items: [{ currentQuantity: 0, orderQuantity: 0, requiredQuantity: 5 }],
};
const overstockGroup = {
  deliveryNoteId: null,
  deliveryNoteIds: [],
  inventoryCloseDestination: null,
  inventoryClosedAt: null,
  inventoryLockedAt: null,
  items: [{ currentQuantity: 0, orderQuantity: 7, requiredQuantity: 5 }],
};

assert.deepEqual(getOrderGroupStats(pendingGroup), {
  hasOverStock: false,
  isDelivered: false,
  orderQuantity: 2,
  pendingQuantity: 6,
  publicQuantity: 0,
  requiredQuantity: 8,
});
assert.equal(matchesOrderInventoryFilter(pendingGroup, "pending"), true);
assert.equal(matchesOrderInventoryFilter(pendingGroup, "stocked"), true);
assert.equal(matchesOrderInventoryFilter(deliveredGroup, "pending"), false);
assert.equal(matchesOrderInventoryFilter(deliveredGroup, "delivered"), true);
assert.equal(matchesOrderInventoryFilter(overstockGroup, "overstock"), true);
assert.equal(getOrderInventoryStatus(5, 3).label, "建议入库 2 支");
assert.equal(getOrderInventoryStatus(5, 5).label, "已入齐");
assert.equal(getOrderInventoryStatus(5, 7).label, "超入库 2 支");

const groupedOrderItems = [
  {
    color: "灰色",
    customerAddress: "地址 A",
    customerName: "客户 A",
    deliveryNoteId: null,
    deliveryNoteIds: [],
    handlerName: "经手人 A",
    inventoryCloseDestination: null,
    inventoryClosedAt: null,
    inventoryLockedAt: null,
    lengthMm: 6000,
    moldCode: "G5501",
    note: "",
    orderedDate: "2026-06-21",
    orderId: "ALU20260621001",
    orderNote: "订单 A 备注",
    orderQuantity: 2,
    pricingTaxIncluded: true,
    productId: "p1",
    productName: "灰色边框",
    publicQuantity: 1,
    requiredQuantity: 5,
  },
  {
    color: "白色",
    customerAddress: "地址 A",
    customerName: "客户 A",
    deliveryNoteId: null,
    deliveryNoteIds: [],
    handlerName: "经手人 A",
    inventoryCloseDestination: null,
    inventoryClosedAt: null,
    inventoryLockedAt: null,
    lengthMm: 3000,
    moldCode: "G5502",
    note: "",
    orderedDate: "2026-06-21",
    orderId: "ALU20260621001",
    orderNote: "订单 A 备注",
    orderQuantity: 0,
    pricingTaxIncluded: true,
    productId: "p2",
    productName: "白色边框",
    publicQuantity: 0,
    requiredQuantity: 3,
  },
  {
    color: "坯料",
    customerAddress: "地址 B",
    customerName: "客户 B",
    deliveryNoteId: "ALU20260622001",
    deliveryNoteIds: ["ALU20260622001-01"],
    handlerName: "经手人 B",
    inventoryCloseDestination: "shipped",
    inventoryClosedAt: "2026-06-22T10:00:00.000Z",
    inventoryLockedAt: "2026-06-22T09:00:00.000Z",
    lengthMm: 1000,
    moldCode: "G5503",
    note: "",
    orderedDate: "2026-06-22",
    orderId: "ALU20260622001",
    orderNote: "",
    orderQuantity: 0,
    pricingTaxIncluded: false,
    productId: "p3",
    productName: "坯料边框",
    publicQuantity: 0,
    requiredQuantity: 1,
  },
  {
    color: "黑色",
    customerAddress: "地址 C",
    customerName: "客户 C",
    deliveryNoteId: null,
    deliveryNoteIds: [],
    handlerName: "经手人 C",
    inventoryCloseDestination: null,
    inventoryClosedAt: null,
    inventoryLockedAt: null,
    lengthMm: 5000,
    moldCode: "G5504",
    note: "",
    orderedDate: "2026-06-23",
    orderId: "ALU20260623001",
    orderNote: "订单 C 备注",
    orderQuantity: 7,
    pricingTaxIncluded: true,
    productId: "p4",
    productName: "黑色边框",
    publicQuantity: 0,
    requiredQuantity: 5,
  },
];
const orderGroups = buildOrderInventoryGroups(groupedOrderItems);
assert.deepEqual(
  orderGroups.map((group) => ({
    deliveryNoteId: group.deliveryNoteId,
    itemCount: group.items.length,
    orderId: group.orderId,
    orderNote: group.orderNote,
  })),
  [
    {
      deliveryNoteId: null,
      itemCount: 2,
      orderId: "ALU20260621001",
      orderNote: "订单 A 备注",
    },
    {
      deliveryNoteId: "ALU20260622001",
      itemCount: 1,
      orderId: "ALU20260622001",
      orderNote: "",
    },
    {
      deliveryNoteId: null,
      itemCount: 1,
      orderId: "ALU20260623001",
      orderNote: "订单 C 备注",
    },
  ],
);
assert.deepEqual(
  filterOrderInventoryGroups(orderGroups, "pending").map((group) => group.orderId),
  ["ALU20260621001"],
);
assert.deepEqual(getOrderInventoryFilterCounts(orderGroups), {
  all: 3,
  delivered: 1,
  overstock: 1,
  pending: 1,
  stocked: 2,
});
assert.deepEqual(
  getInventoryOverviewStats({
    customerInventoryBatches: [{ id: "KH-20260621001" }, { id: "KH-20260621002" }],
    customerInventoryTotalQuantity: 4,
    orderGroups,
    publicInventoryItems: [{ productId: "p1" }, { productId: "p2" }],
    publicInventoryTotalQuantity: 6,
  }),
  {
    customerInventoryBatchCount: 2,
    customerInventoryTotalStockQuantity: 4,
    inventoryOverviewTotalQuantity: 19,
    orderInventoryOrderCount: 3,
    orderInventoryTotalQuantity: 9,
    publicInventoryItemCount: 2,
    publicInventoryTotalQuantity: 6,
  },
);
assert.deepEqual(
  getDeliveredOrderGroups(orderGroups).map((group) => group.orderId),
  ["ALU20260622001"],
);
assert.equal(
  getDeliveredOrderGroupsByDeliveryNoteId(orderGroups).get("ALU20260622001-01")
    ?.customerName,
  "客户 B",
);
assert.deepEqual(
  selectDeliveredOrderGroupsByDeliveryNoteIds(
    getDeliveredOrderGroupsByDeliveryNoteId(orderGroups),
    ["missing", "ALU20260622001-01"],
  ).map((group) => group.orderId),
  ["ALU20260622001"],
);
const mergeDeliveryGroupsById = new Map([
  [
    "DN-A",
    {
      customerAddress: "地址 A",
      customerName: "客户 A",
      deliveryNoteId: "DN-A",
      handlerName: "经手人",
      items: [],
      orderedDate: "2026-06-22",
      orderId: "ALU20260622001",
      pricingTaxIncluded: true,
    },
  ],
  [
    "DN-B",
    {
      customerAddress: "地址 A",
      customerName: "客户 A",
      deliveryNoteId: "DN-B",
      handlerName: "经手人",
      items: [],
      orderedDate: "2026-06-23",
      orderId: "ALU20260623001",
      pricingTaxIncluded: true,
    },
  ],
  [
    "DN-C",
    {
      customerAddress: "地址 C",
      customerName: "客户 C",
      deliveryNoteId: "DN-C",
      handlerName: "经手人",
      items: [],
      orderedDate: "2026-06-24",
      orderId: "ALU20260624001",
      pricingTaxIncluded: true,
    },
  ],
]);
assert.deepEqual(createMergeDeliveryNoteIds(mergeDeliveryGroupsById.get("DN-A")), [
  "DN-A",
]);
assert.deepEqual(createMergeDeliveryNoteIds(null), []);
assert.deepEqual(defaultMergeDeliveryNoteDialogValues, {
  customGroupsByDeliveryNoteId: {},
  deliveryNoteIds: [],
  specialNote: "",
});
assert.deepEqual(
  createMergeDeliveryNoteDialogValues(mergeDeliveryGroupsById.get("DN-A")),
  {
    customGroupsByDeliveryNoteId: {},
    deliveryNoteIds: ["DN-A"],
    specialNote: "",
  },
);
assert.deepEqual(createMergeDeliveryNoteDialogValues(null), {
  customGroupsByDeliveryNoteId: {},
  deliveryNoteIds: [],
  specialNote: "",
});
assert.deepEqual(
  mergeDeliveryNoteGroupsWithNoteDefaults({
    groups: { "DN-A": "人工分组", "DN-B": "" },
    notes: [
      { id: "DN-A", note: "出库备注 A" },
      { id: "DN-B", note: "出库备注 B" },
      { id: "DN-C", note: " 出库备注 C " },
    ],
  }),
  {
    "DN-A": "人工分组",
    "DN-B": "",
    "DN-C": "出库备注 C",
  },
);
assert.deepEqual(
  createMergeDeliveryNoteDialogApplyState(
    createMergeDeliveryNoteDialogValues(mergeDeliveryGroupsById.get("DN-A")),
  ),
  {
    customGroupsByDeliveryNoteId: {},
    deliveryNoteIds: ["DN-A"],
    errors: {},
    specialNote: "",
  },
);
assert.deepEqual(
  createMergeDeliveryNoteDialogOpenState(
    createMergeDeliveryNoteDialogValues(mergeDeliveryGroupsById.get("DN-A")),
  ),
  {
    currentDeliveryNote: null,
    currentMergedDeliveryNote: null,
    dialogApplyState: {
      customGroupsByDeliveryNoteId: {},
      deliveryNoteIds: ["DN-A"],
      errors: {},
      specialNote: "",
    },
    mergeOpen: true,
  },
);
assert.deepEqual(createMergeDeliveryNoteDialogCloseState(), {
  dialogApplyState: createEmptyMergeDeliveryNoteDialogApplyState(),
  mergeOpen: false,
});
assert.deepEqual(createEmptyMergeDeliveryNoteDialogApplyState(), {
  customGroupsByDeliveryNoteId: {},
  deliveryNoteIds: [],
  errors: {},
  specialNote: "",
});
const mergeDeliveryNoteGroupLabels = { "DN-A": "第一车" };
assert.deepEqual(
  updateMergeDeliveryNoteGroupLabel({
    deliveryNoteId: "DN-B",
    groups: mergeDeliveryNoteGroupLabels,
    value: "第二车",
  }),
  { "DN-A": "第一车", "DN-B": "第二车" },
);
assert.deepEqual(
  updateMergeDeliveryNoteGroupLabelState({
    deliveryNoteId: "DN-B",
    groups: mergeDeliveryNoteGroupLabels,
    value: "第二车",
  }),
  {
    customGroupsByDeliveryNoteId: {
      "DN-A": "第一车",
      "DN-B": "第二车",
    },
  },
);
assert.deepEqual(mergeDeliveryNoteGroupLabels, { "DN-A": "第一车" });
assert.deepEqual(updateMergeDeliveryNoteSpecialNoteState("醒目提示"), {
  specialNote: "醒目提示",
});
assert.deepEqual(
  toggleMergeDeliveryNoteSelection({
    checked: true,
    currentIds: ["DN-A"],
    deliveryNoteId: "DN-B",
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }),
  {
    deliveryNoteIds: ["DN-A", "DN-B"],
    error: null,
  },
);
assert.deepEqual(
  createMergeDeliveryNoteSelectionApplyState({
    checked: true,
    currentIds: ["DN-A"],
    deliveryNoteId: "DN-B",
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }),
  {
    deliveryNoteIds: ["DN-A", "DN-B"],
    errors: {},
  },
);
assert.deepEqual(
  toggleMergeDeliveryNoteSelection({
    checked: true,
    currentIds: ["DN-A"],
    deliveryNoteId: "DN-C",
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }),
  {
    deliveryNoteIds: ["DN-A"],
    error: "只能选择同一客户的出库单",
  },
);
assert.deepEqual(
  createMergeDeliveryNoteSelectionApplyState({
    checked: true,
    currentIds: ["DN-A"],
    deliveryNoteId: "DN-C",
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }),
  {
    deliveryNoteIds: ["DN-A"],
    errors: { form: "只能选择同一客户的出库单" },
  },
);
assert.deepEqual(
  toggleMergeDeliveryNoteSelection({
    checked: false,
    currentIds: ["DN-A", "DN-B"],
    deliveryNoteId: "DN-A",
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }),
  {
    deliveryNoteIds: ["DN-B"],
    error: null,
  },
);
assert.deepEqual(createMergeDeliveryNoteSubmitRequestState(), {
  errors: {},
});
assert.deepEqual(
  collectMergeDeliveryNoteSubmitState({
    deliveryNoteIds: ["DN-A"],
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }).errors,
  { form: "请选择至少 2 张出库单" },
);
assert.deepEqual(
  collectMergeDeliveryNoteSubmitState({
    deliveryNoteIds: ["missing", "DN-A"],
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }),
  {
    errors: { form: "请选择至少 2 张出库单" },
    selectedGroups: [mergeDeliveryGroupsById.get("DN-A")],
  },
);
assert.deepEqual(
  collectMergeDeliveryNoteSubmitState({
    deliveryNoteIds: ["DN-A", "DN-B"],
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }).selectedGroups.map((group) => group.deliveryNoteId),
  ["DN-A", "DN-B"],
);
assert.deepEqual(
  collectMergeDeliveryNoteSubmitState({
    deliveryNoteIds: ["DN-A", "DN-C"],
    groupsByDeliveryNoteId: mergeDeliveryGroupsById,
  }).errors,
  { form: "只能选择同一客户的出库单" },
);

const dialogGroup = {
  customerAddress: "验收地址",
  customerName: "验收客户",
  deliveryNoteId: null,
  handlerName: "经手人",
  orderNote: "完整订单备注",
  items: [
    {
      color: "灰色",
      customerAddress: "验收地址",
      customerName: "验收客户",
      deliveryNoteId: null,
      handlerName: "经手人",
      lengthMm: 6000,
      moldCode: "G5501",
      note: "订单明细备注",
      orderId: "ALU20260623001",
      orderQuantity: 3,
      orderedDate: "2026-06-23",
      pricingTaxIncluded: true,
      productId: "p1",
      productName: "商品 1",
      publicQuantity: 0,
      requiredQuantity: 5,
    },
    {
      color: "坯料",
      customerAddress: "验收地址",
      customerName: "验收客户",
      deliveryNoteId: null,
      handlerName: "经手人",
      lengthMm: 5000,
      moldCode: "G5502",
      note: "",
      orderId: "ALU20260623001",
      orderQuantity: 0,
      orderedDate: "2026-06-23",
      pricingTaxIncluded: true,
      productId: "p2",
      productName: "商品 2",
      publicQuantity: 0,
      requiredQuantity: 2,
    },
    {
      color: "白色",
      customerAddress: "验收地址",
      customerName: "验收客户",
      deliveryNoteId: null,
      handlerName: "经手人",
      lengthMm: 4000,
      moldCode: "G5503",
      note: "",
      orderId: "ALU20260623001",
      orderQuantity: 4,
      orderedDate: "2026-06-23",
      pricingTaxIncluded: true,
      productId: "p3",
      productName: "商品 3",
      publicQuantity: 0,
      requiredQuantity: 4,
    },
  ],
  orderId: "ALU20260623001",
  orderedDate: "2026-06-23",
  pricingTaxIncluded: false,
};
const batchRows = createBatchOrderRows(dialogGroup);
assert.deepEqual(batchRows.map((row) => row.quantity), ["", "", ""]);
assert.deepEqual(createBatchOrderDialogApplyState({ rows: batchRows }), {
  ...defaultBatchOrderImageRecognitionUiState,
  errors: {},
  note: "",
  rows: batchRows,
});
assert.deepEqual(createEmptyBatchOrderDialogApplyState(), {
  ...defaultBatchOrderImageRecognitionUiState,
  errors: {},
  note: "",
  rows: [],
});
assert.deepEqual(createBatchOrderDialogOpenState(dialogGroup), {
  dialogApplyState: createBatchOrderDialogApplyState({ rows: batchRows }),
  open: true,
});
assert.deepEqual(createBatchOrderDialogCloseState(), {
  dialogApplyState: createEmptyBatchOrderDialogApplyState(),
  open: false,
});
assert.deepEqual(createBatchOrderSuccessDialogState(), {
  dialogApplyState: createEmptyBatchOrderDialogApplyState(),
  open: false,
});
assert.equal(
  getOrderInventoryQuantitySuggestion({
    currentQuantity: 3,
    movementType: "produce",
    requiredQuantity: 5,
  }),
  "2",
);
assert.equal(
  getOrderInventoryQuantitySuggestion({
    currentQuantity: 5,
    movementType: "produce",
    requiredQuantity: 5,
  }),
  "",
);
assert.equal(
  getOrderInventoryQuantitySuggestion({
    currentQuantity: 3,
    movementType: "ship",
    requiredQuantity: 5,
  }),
  "3",
);
assert.equal(
  getOrderInventoryQuantitySuggestion({
    currentQuantity: 3,
    movementType: "adjust",
    requiredQuantity: 5,
  }),
  "",
);
assert.equal(defaultOrderInventoryFormValues.quantity, "");
const orderInventoryFormWithNote = updateOrderInventoryFormField({
  key: "note",
  value: "订单入库备注",
  values: defaultOrderInventoryFormValues,
});
assert.equal(orderInventoryFormWithNote.note, "订单入库备注");
assert.equal(defaultOrderInventoryFormValues.note, "");
assert.deepEqual(
  clearOrderInventoryFormError(
    { productId: "请选择商品", quantity: "数量必须大于 0" },
    "quantity",
  ),
  { productId: "请选择商品", quantity: undefined },
);
assert.deepEqual(
  updateOrderInventoryFormFieldState({
    errors: { productId: "请选择商品", quantity: "数量必须大于 0" },
    key: "quantity",
    value: "2",
    values: defaultOrderInventoryFormValues,
  }),
  {
    errors: { productId: "请选择商品", quantity: undefined },
    values: {
      ...defaultOrderInventoryFormValues,
      quantity: "2",
    },
  },
);
assert.deepEqual(
  createOrderInventoryFormValues({
    item: dialogGroup.items[0],
    movementType: "produce",
  }),
  {
    color: "灰色",
    currentQuantity: 3,
    lengthMm: 6000,
    moldCode: "G5501",
    movementType: "produce",
    note: "",
    orderId: "ALU20260623001",
    productId: "p1",
    productName: "商品 1",
    quantity: "2",
    requiredQuantity: 5,
  },
);
const orderInventoryDialogValues = createOrderInventoryFormValues({
  item: dialogGroup.items[0],
  movementType: "produce",
});
assert.deepEqual(
  createOrderInventoryDialogApplyState(orderInventoryDialogValues),
  {
    errors: {},
    values: {
      color: "灰色",
      currentQuantity: 3,
      lengthMm: 6000,
      moldCode: "G5501",
      movementType: "produce",
      note: "",
      orderId: "ALU20260623001",
      productId: "p1",
      productName: "商品 1",
      quantity: "2",
      requiredQuantity: 5,
    },
  },
);
assert.deepEqual(createOrderInventoryDialogOpenState(orderInventoryDialogValues), {
  dialogApplyState: createOrderInventoryDialogApplyState(
    orderInventoryDialogValues,
  ),
  open: true,
});
assert.deepEqual(createOrderInventoryDialogCloseState(), {
  dialogApplyState: createEmptyOrderInventoryDialogApplyState(),
  open: false,
});
assert.deepEqual(createEmptyOrderInventoryDialogApplyState(), {
  errors: {},
  values: defaultOrderInventoryFormValues,
});
assert.deepEqual(
  createOrderInventoryFormValues({
    item: dialogGroup.items[0],
    movementType: "ship",
  }).quantity,
  "3",
);
assert.deepEqual(
  collectOrderInventoryAdjustmentSubmitState({
    ...createOrderInventoryFormValues({
      item: dialogGroup.items[0],
      movementType: "ship",
    }),
    note: " 出库备注 ",
    quantity: "2",
  }),
  {
    errors: {},
    payload: {
      color: "灰色",
      lengthMm: 6000,
      movementType: "ship",
      note: "出库备注",
      orderId: "ALU20260623001",
      productId: "p1",
      quantity: 2,
    },
  },
);
assert.deepEqual(
  collectOrderInventoryAdjustmentSubmitState({
    ...createOrderInventoryFormValues({
      item: dialogGroup.items[0],
      movementType: "ship",
    }),
    quantity: "4",
  }),
  {
    errors: { quantity: "出库数量不能大于当前库存" },
    payload: null,
  },
);
assert.deepEqual(
  fillBatchOrderRequiredQuantities(batchRows).map((row) => row.quantity),
  ["2", "2", ""],
);
assert.deepEqual(
  fillBatchOrderRequiredQuantityState(batchRows),
  {
    errors: {},
    rows: [
      { ...batchRows[0], quantity: "2" },
      { ...batchRows[1], quantity: "2" },
      { ...batchRows[2], quantity: "" },
    ],
  },
);
assert.deepEqual(
  clearBatchOrderQuantities([
    { ...batchRows[0], quantity: "2" },
    { ...batchRows[1], quantity: "2" },
    { ...batchRows[2], quantity: "1" },
  ]).map((row) => row.quantity),
  ["", "", ""],
);
assert.deepEqual(
  clearBatchOrderQuantityState([
    { ...batchRows[0], quantity: "2" },
    { ...batchRows[1], quantity: "2" },
  ]),
  {
    errors: {},
    rows: [
      { ...batchRows[0], quantity: "" },
      { ...batchRows[1], quantity: "" },
    ],
  },
);
assert.deepEqual(
  updateBatchOrderRowQuantity(
    batchRows,
    getInventoryDetailKey(batchRows[1]),
    "7",
  ),
  [batchRows[0], { ...batchRows[1], quantity: "7" }, batchRows[2]],
);
assert.deepEqual(
  updateBatchOrderQuantityState({
    detailKey: getInventoryDetailKey(batchRows[1]),
    errors: {
      [getInventoryDetailKey(batchRows[1])]: "数量必须大于 0",
      form: "请至少录入一项入库数量",
    },
    quantity: "7",
    rows: batchRows,
  }),
  {
    errors: {
      [getInventoryDetailKey(batchRows[1])]: undefined,
      form: "请至少录入一项入库数量",
    },
    rows: [batchRows[0], { ...batchRows[1], quantity: "7" }, batchRows[2]],
  },
);
assert.deepEqual(
  updateBatchOrderNoteState({
    errors: { form: "请选择订单", [getInventoryDetailKey(batchRows[0])]: "错误" },
    note: "本次入库备注",
  }),
  {
    errors: {
      form: undefined,
      [getInventoryDetailKey(batchRows[0])]: "错误",
    },
    note: "本次入库备注",
  },
);
assert.deepEqual(
  prepareBatchOrderImageRecognitionPaths(" /tmp/a.png ", []),
  {
    nextPaths: ["/tmp/a.png"],
    normalizedPaths: ["/tmp/a.png"],
    skippedPaths: [],
  },
);
assert.deepEqual(
  prepareBatchOrderImageRecognitionPaths(
    [" /tmp/a.png ", "/tmp/a.png", "", " /tmp/b.png "],
    ["/tmp/a.png"],
  ),
  {
    nextPaths: ["/tmp/b.png"],
    normalizedPaths: ["/tmp/a.png", "/tmp/b.png"],
    skippedPaths: ["/tmp/a.png"],
  },
);
assert.deepEqual(
  prepareBatchOrderImageRecognitionPaths(null, ["/tmp/a.png"]),
  {
    nextPaths: [],
    normalizedPaths: [],
    skippedPaths: [],
  },
);
assert.deepEqual(
  prepareBatchOrderImageRecognitionPaths(["/tmp/a.png"], ["/tmp/a.png"]),
  {
    nextPaths: [],
    normalizedPaths: ["/tmp/a.png"],
    skippedPaths: ["/tmp/a.png"],
  },
);
assert.deepEqual(
  createBatchOrderImageRecognitionDuplicateSelectionState(["/tmp/a.png"]),
  {
    errors: {
      form: "本次选择的图片都已经识别过了",
    },
    skippedImagePaths: ["/tmp/a.png"],
  },
);
assert.deepEqual(createBatchOrderImagePreviewFailureState("图片预览失败"), {
  errors: {
    form: "图片预览失败",
  },
});
assert.deepEqual(createBatchOrderImagePreviewFailureState(undefined), {
  errors: {
    form: "图片预览失败",
  },
});
assert.deepEqual(createBatchOrderImagePreview("/tmp/a.png", "data:image/a"), {
  path: "/tmp/a.png",
  previewUrl: "data:image/a",
  rotationDegrees: 0,
});
assert.deepEqual(defaultBatchOrderImageRecognitionUiState, {
  imageMatches: [],
  imagePreviewIndex: 0,
  imagePreviewOpen: false,
  imagePreviews: [],
  imageRawTextOpen: false,
  imageRawTexts: [],
  recognizedImagePaths: [],
  skippedImagePaths: [],
});
const batchOrderImagePreviews = [
  createBatchOrderImagePreview("/tmp/a.png", "data:image/a"),
  {
    ...createBatchOrderImagePreview("/tmp/b.png", "data:image/b"),
    rotationDegrees: 270,
  },
];
assert.deepEqual(
  createBatchOrderImagePreviewDialogState(batchOrderImagePreviews),
  {
    imagePreviewIndex: 0,
    imagePreviewOpen: true,
    imagePreviews: batchOrderImagePreviews,
  },
);
assert.deepEqual(createBatchOrderImagePreviewDialogState([]), {
  imagePreviewIndex: 0,
  imagePreviewOpen: false,
  imagePreviews: [],
});
assert.deepEqual(
  createBatchOrderImageRecognitionConfirmState({
    imagePreviews: batchOrderImagePreviews,
    skippedPaths: ["/tmp/skipped.png"],
  }),
  {
    imagePreviewOpen: false,
    request: {
      images: batchOrderImagePreviews,
      skippedPaths: ["/tmp/skipped.png"],
    },
  },
);
assert.deepEqual(
  createBatchOrderImageRecognitionConfirmState({
    imagePreviews: [],
    skippedPaths: ["/tmp/skipped.png"],
  }),
  {
    imagePreviewOpen: false,
    request: null,
  },
);
assert.deepEqual(
  rotateBatchOrderImagePreviews(batchOrderImagePreviews, 0, 90).map(
    (image) => image.rotationDegrees,
  ),
  [90, 270],
);
assert.deepEqual(
  rotateBatchOrderImagePreviews(batchOrderImagePreviews, 0, -90).map(
    (image) => image.rotationDegrees,
  ),
  [270, 270],
);
assert.deepEqual(
  rotateBatchOrderImagePreviews(batchOrderImagePreviews, 1, 180).map(
    (image) => image.rotationDegrees,
  ),
  [0, 90],
);
assert.deepEqual(
  createBatchOrderImagePreviewRotationState({
    delta: 180,
    imagePreviewIndex: 1,
    imagePreviews: batchOrderImagePreviews,
  }).imagePreviews.map((image) => image.rotationDegrees),
  [0, 90],
);
assert.deepEqual(createBatchOrderImageRawTextToggleState(false), {
  imageRawTextOpen: true,
});
assert.deepEqual(createBatchOrderImageRawTextToggleState(true), {
  imageRawTextOpen: false,
});
assert.deepEqual(
  rotateBatchOrderImagePreviews(batchOrderImagePreviews, 1, 450).map(
    (image) => image.rotationDegrees,
  ),
  [0, 0],
);
assert.deepEqual(
  rotateBatchOrderImagePreviews(batchOrderImagePreviews, 9, 90),
  batchOrderImagePreviews,
);
assert.deepEqual(
  mergeBatchOrderRecognizedImagePaths(["/tmp/a.png"], [
    "/tmp/a.png",
    "/tmp/b.png",
  ]),
  ["/tmp/a.png", "/tmp/b.png"],
);
assert.deepEqual(
  appendBatchOrderImageRecognitionRawTexts(["原文 A"], ["原文 B", "原文 C"]),
  ["原文 A", "原文 B", "原文 C"],
);
assert.equal(
  getBatchOrderImageRecognitionFailureMessage(["a.png：失败", "b.png：失败"]),
  "部分图片识别失败：\na.png：失败\nb.png：失败",
);
assert.equal(getBatchOrderImageRecognitionFailureMessage([]), null);
assert.deepEqual(
  applyBatchOrderImageRecognitionMatches(batchRows, [
    {
      detailKey: getInventoryDetailKey(batchRows[0]),
      item: { color: "灰色", lengthMm: 6000, moldCode: "G5501", quantity: 2 },
      message: "已匹配",
      status: "matched",
    },
    {
      detailKey: getInventoryDetailKey(batchRows[0]),
      item: { color: "灰色", lengthMm: 6000, moldCode: "G5501", quantity: 3 },
      message: "已匹配",
      status: "matched",
    },
    {
      detailKey: getInventoryDetailKey(batchRows[1]),
      item: { color: "白色", lengthMm: 3000, moldCode: "G5502", quantity: null },
      message: "已匹配，待识别支数",
      status: "matched",
    },
    {
      item: { color: "香槟", lengthMm: 6000, moldCode: "G5501", quantity: 4 },
      message: "未匹配到当前订单明细",
      status: "unmatched",
    },
  ]),
  {
    hasApplicableMatches: true,
    rows: [
      { ...batchRows[0], quantity: "5" },
      batchRows[1],
      batchRows[2],
    ],
  },
);
assert.deepEqual(
  createBatchOrderImageRecognitionApplyState({
    rows: batchRows,
    matches: [
      {
        detailKey: getInventoryDetailKey(batchRows[0]),
        item: { color: "灰色", lengthMm: 6000, moldCode: "G5501", quantity: 2 },
        message: "已匹配",
        status: "matched",
      },
    ],
  }),
  {
    errors: {},
    hasApplicableMatches: true,
    rows: [
      { ...batchRows[0], quantity: "2" },
      batchRows[1],
      batchRows[2],
    ],
  },
);
assert.deepEqual(
  applyBatchOrderImageRecognitionMatches(batchRows, [
    {
      detailKey: getInventoryDetailKey(batchRows[0]),
      item: { color: "灰色", lengthMm: 6000, moldCode: "G5501", quantity: null },
      message: "已匹配，待识别支数",
      status: "matched",
    },
  ]),
  {
    hasApplicableMatches: false,
    rows: batchRows,
  },
);
assert.deepEqual(
  createBatchOrderImageRecognitionApplyState({
    rows: batchRows,
    matches: [
      {
        item: { color: "香槟", lengthMm: 6000, moldCode: "G5501", quantity: 4 },
        message: "未匹配到当前订单明细",
        status: "unmatched",
      },
    ],
  }),
  {
    errors: { form: "没有可应用的识别结果" },
    hasApplicableMatches: false,
    rows: batchRows,
  },
);
const batchOrderRecognitionMatches = [
  {
    detailKey: getInventoryDetailKey(batchRows[0]),
    item: { color: "灰色", lengthMm: 6000, moldCode: "G5501", quantity: 2 },
    message: "已匹配",
    status: "matched",
  },
];
assert.deepEqual(
  appendBatchOrderImageRecognitionMatches(
    [
      {
        item: { color: "白色", lengthMm: 3000, moldCode: "G5502", quantity: 1 },
        message: "未匹配",
        status: "unmatched",
      },
    ],
    batchOrderRecognitionMatches,
  ).map((match) => match.message),
  ["未匹配", "已匹配"],
);
assert.deepEqual(
  mergeBatchOrderImageRecognitionSuccessState({
    currentImageMatches: [],
    currentImageRawTexts: ["旧原文"],
    currentRecognizedImagePaths: ["/tmp/a.png"],
    result: {
      failedImages: ["c.png：失败"],
      matches: batchOrderRecognitionMatches,
      paths: ["/tmp/a.png", "/tmp/b.png"],
      rawTexts: ["新原文"],
      skippedPaths: ["/tmp/skip.png"],
    },
  }),
  {
    errors: { form: "部分图片识别失败：\nc.png：失败" },
    imageMatches: batchOrderRecognitionMatches,
    imageRawTexts: ["旧原文", "新原文"],
    recognizedImagePaths: ["/tmp/a.png", "/tmp/b.png"],
    skippedImagePaths: ["/tmp/skip.png"],
  },
);
assert.deepEqual(
  mergeBatchOrderImageRecognitionSuccessState({
    currentImageMatches: [],
    currentImageRawTexts: [],
    currentRecognizedImagePaths: [],
    result: {
      failedImages: [],
      matches: batchOrderRecognitionMatches,
      paths: ["/tmp/a.png"],
      rawTexts: ["原文 A"],
      skippedPaths: [],
    },
  }),
  {
    errors: {},
    imageMatches: batchOrderRecognitionMatches,
    imageRawTexts: ["原文 A"],
    recognizedImagePaths: ["/tmp/a.png"],
    skippedImagePaths: [],
  },
);
assert.equal(
  getBatchOrderEnteredQuantity([
    { ...batchRows[0], quantity: "2" },
    { ...batchRows[1], quantity: "bad" },
  ]),
  2,
);
assert.deepEqual(
  collectBatchOrderAdjustmentItems([
    { ...batchRows[0], quantity: "2" },
    { ...batchRows[1], quantity: "" },
  ]),
  {
    errors: {},
    items: [{ color: "灰色", lengthMm: 6000, productId: "p1", quantity: 2 }],
  },
);
assert.equal(
  collectBatchOrderAdjustmentItems([{ ...batchRows[0], quantity: "0" }]).errors[
    "p1:6000:灰色"
  ],
  "数量必须大于 0",
);
assert.equal(
  collectBatchOrderAdjustmentItems(clearBatchOrderQuantities(batchRows)).errors.form,
  "请至少录入一项入库数量",
);
assert.deepEqual(
  collectBatchOrderAdjustmentSubmitState({
    note: " 入库备注 ",
    orderId: "ALU20260623001",
    rows: [{ ...batchRows[0], quantity: "2" }],
  }),
  {
    errors: {},
    payload: {
      items: [
        { color: "灰色", lengthMm: 6000, productId: "p1", quantity: 2 },
      ],
      note: "入库备注",
      orderId: "ALU20260623001",
    },
  },
);
assert.deepEqual(
  collectBatchOrderAdjustmentSubmitState({
    note: "",
    orderId: null,
    rows: [{ ...batchRows[0], quantity: "2" }],
  }),
  {
    errors: { form: "请选择订单" },
    payload: null,
  },
);
assert.deepEqual(
  collectBatchOrderAdjustmentSubmitState({
    note: "",
    orderId: "ALU20260623001",
    rows: clearBatchOrderQuantities(batchRows),
  }),
  {
    errors: { form: "请至少录入一项入库数量" },
    payload: null,
  },
);

const deliveryRows = createDeliveryNoteRows(dialogGroup);
assert.equal(createDeliveryNoteFormValues(dialogGroup).pricingTaxIncluded, false);
assert.equal(
  createDeliveryNoteFormValues({
    ...dialogGroup,
    orderNote: "虎标膜， 第一车，送仓库 ",
  }).note,
  "第一车，送仓库",
);
assert.equal(
  deriveDeliveryNoteDefaultNote("前缀, 英文逗号后,保留后续"),
  "英文逗号后,保留后续",
);
assert.equal(deriveDeliveryNoteDefaultNote("无逗号订单备注"), "");
assert.equal(deriveDeliveryNoteDefaultNote("前缀，   "), "");
assert.equal(
  createDeliveryNoteFormValues({ ...dialogGroup, orderNote: "" }).note,
  "",
);
assert.deepEqual(createEmptyDeliveryNoteDialogValues(), {
  formValues: defaultDeliveryNoteFormValues,
  rows: [],
});
assert.notEqual(
  createEmptyDeliveryNoteDialogValues().formValues,
  defaultDeliveryNoteFormValues,
);
assert.deepEqual(createEmptyDeliveryNoteDialogApplyState(), {
  errors: {},
  formValues: defaultDeliveryNoteFormValues,
  rows: [],
});
assert.deepEqual(createDeliveryNoteFormErrorState("请选择订单"), {
  errors: {
    form: "请选择订单",
  },
});
assert.deepEqual(createDeliveryNoteFormErrorState(undefined), {
  errors: {
    form: undefined,
  },
});
assert.deepEqual(createEmptyDeliveryNoteFormErrorState(), {
  errors: {},
});
const deliveryNoteDialogValues = createDeliveryNoteDialogValues(dialogGroup);
assert.equal(deliveryNoteDialogValues.formValues.pricingTaxIncluded, false);
assert.deepEqual(
  deliveryNoteDialogValues.rows.map((row) => row.productId),
  ["p1", "p3"],
);
assert.deepEqual(createDeliveryNoteDialogApplyState(deliveryNoteDialogValues), {
  errors: {},
  formValues: deliveryNoteDialogValues.formValues,
  rows: deliveryNoteDialogValues.rows,
});
assert.deepEqual(createDeliveryNoteDialogOpenState(deliveryNoteDialogValues), {
  dialogApplyState: createDeliveryNoteDialogApplyState(deliveryNoteDialogValues),
  open: true,
});
assert.deepEqual(createDeliveryNoteDialogCloseState(), {
  dialogApplyState: createEmptyDeliveryNoteDialogApplyState(),
  open: false,
});
assert.deepEqual(createDeliveryNoteSuccessDialogState(), {
  dialogApplyState: createEmptyDeliveryNoteDialogApplyState(),
  open: false,
  printOpen: true,
});
const createdDeliveryNote = createDeliveryNoteFixture();
assert.deepEqual(createDeliveryNoteCreateSuccessState(createdDeliveryNote), {
  ...createDeliveryNoteSuccessDialogState(),
  currentDeliveryNote: createdDeliveryNote,
});
assert.deepEqual(createMergeDeliveryNotePreviewSuccessState(mergedDeliveryNote), {
  currentDeliveryNote: null,
  currentMergedDeliveryNote: mergedDeliveryNote,
  mergeOpen: false,
  printOpen: true,
});
assert.deepEqual(
  parseDeliveryExtraCharge({
    ...createDeliveryNoteFormValues(dialogGroup),
    extraChargeAmount: "200",
    extraChargeName: "运费",
  }),
  { amountX100: 20000, errors: {}, name: "运费" },
);
assert.deepEqual(
  parseDeliveryExtraCharge({
    ...createDeliveryNoteFormValues(dialogGroup),
    extraChargeAmount: "200",
    extraChargeName: "",
  }),
  {
    amountX100: 0,
    errors: { extraChargeName: "请填写收费名称" },
    name: "",
  },
);
const multiChargeValues = {
  ...createDeliveryNoteFormValues(dialogGroup),
  extraCharges: [
    { name: " 运费 ", amount: "200.10" },
    { name: "装车费", amount: "50.20" },
    { name: "", amount: "" },
  ],
};
assert.deepEqual(parseDeliveryExtraCharges(multiChargeValues), {
  amountX100: 25030,
  errors: {},
  name: "运费、装车费",
  charges: [
    { name: "运费", amountX100: 20010 },
    { name: "装车费", amountX100: 5020 },
  ],
});
assert.deepEqual(parseDeliveryExtraCharges({ ...multiChargeValues, extraCharges: [] }), {
  amountX100: 0, errors: {}, name: "", charges: [],
});
assert.deepEqual(parseDeliveryExtraCharges({
  ...multiChargeValues,
  extraCharges: [{ name: "", amount: "20" }, { name: "装车费", amount: "0" }],
}).errors, {
  "extraChargeName-0": "请填写收费名称",
  "extraChargeAmount-1": "收费金额必须大于 0",
});
assert.ok(parseDeliveryExtraCharges({
  ...multiChargeValues,
  extraCharges: [{ name: "运费", amount: "90071992547410" }],
}).errors.form);
assert.deepEqual(mergedDeliveryNoteWithMixedExtraCharges.priceGroups[0].extraCharges, [
  { name: "运费", amountX100: 10000 },
  { name: "装车费", amountX100: 20000 },
]);
assert.deepEqual(deliveryRows.map((row) => row.productId), ["p1", "p3"]);
assert.deepEqual(deliveryRows.map((row) => row.note), ["订单明细备注", ""]);
assert.deepEqual(deliveryRows.map((row) => row.quantity), ["", ""]);
assert.equal(getDeliveryNoteTotalQuantity(deliveryRows), 0);
assert.equal(getDeliveryNoteTransferQuantity(deliveryRows), 7);
const filledDeliveryRows = fillDeliveryNoteCurrentQuantities(deliveryRows);
assert.deepEqual(filledDeliveryRows.map((row) => row.quantity), ["3", "4"]);
assert.equal(getDeliveryNoteTotalQuantity(filledDeliveryRows), 7);
assert.deepEqual(
  clearDeliveryNoteQuantities(filledDeliveryRows).map((row) => row.quantity),
  ["", ""],
);
assert.deepEqual(
  updateDeliveryNoteRow(deliveryRows, getInventoryDetailKey(deliveryRows[0]), {
    quantity: "2",
  }).map((row) => row.quantity),
  ["2", ""],
);
assert.deepEqual(
  updateDeliveryNoteRowState({
    detailKey: getInventoryDetailKey(deliveryRows[0]),
    errors: {
      [getInventoryDetailKey(deliveryRows[0])]: "数量错误",
      form: "请至少录入一项出库数量",
    },
    rows: deliveryRows,
    updates: { quantity: "2" },
  }),
  {
    errors: {
      [getInventoryDetailKey(deliveryRows[0])]: undefined,
      form: "请至少录入一项出库数量",
    },
    rows: [{ ...deliveryRows[0], quantity: "2" }, deliveryRows[1]],
  },
);
assert.deepEqual(
  clearDeliveryNoteRowErrors(
    {
      [getInventoryDetailKey(deliveryRows[0])]: "数量错误",
      [getInventoryDetailKey(deliveryRows[1])]: "数量错误",
      form: "请至少录入一项出库数量",
      handlerName: "保留其他错误",
    },
    deliveryRows,
  ),
  {
    [getInventoryDetailKey(deliveryRows[0])]: undefined,
    [getInventoryDetailKey(deliveryRows[1])]: undefined,
    form: undefined,
    handlerName: "保留其他错误",
  },
);
assert.deepEqual(
  fillDeliveryNoteQuantityState({
    errors: {
      [getInventoryDetailKey(deliveryRows[0])]: "数量错误",
      [getInventoryDetailKey(deliveryRows[1])]: "数量错误",
      form: "请至少录入一项出库数量",
      handlerName: "保留其他错误",
    },
    rows: deliveryRows,
  }),
  {
    errors: {
      [getInventoryDetailKey(deliveryRows[0])]: undefined,
      [getInventoryDetailKey(deliveryRows[1])]: undefined,
      form: undefined,
      handlerName: "保留其他错误",
    },
    rows: filledDeliveryRows,
  },
);
assert.deepEqual(
  clearDeliveryNoteQuantityState({
    errors: {
      [getInventoryDetailKey(deliveryRows[0])]: "数量错误",
      [getInventoryDetailKey(deliveryRows[1])]: "数量错误",
      form: "请至少录入一项出库数量",
      handlerName: "保留其他错误",
    },
    rows: filledDeliveryRows,
  }),
  {
    errors: {
      [getInventoryDetailKey(deliveryRows[0])]: undefined,
      [getInventoryDetailKey(deliveryRows[1])]: undefined,
      form: undefined,
      handlerName: "保留其他错误",
    },
    rows: deliveryRows,
  },
);
assert.equal(
  getDeliveryNoteTransferQuantity([{ ...deliveryRows[0], quantity: "1" }]),
  2,
);
assert.deepEqual(getDeliveryWeightState(deliveryRows).requiredWeights, {
  billet: false,
  bridge: false,
  electrophoresis: false,
  oxidation: false,
  powder: false,
});
assert.deepEqual(getDeliveryWeightState(filledDeliveryRows).requiredWeights, {
  billet: false,
  bridge: false,
  electrophoresis: false,
  oxidation: false,
  powder: true,
});
assert.deepEqual(
  collectDeliveryNoteSubmitState({
    orderId: dialogGroup.orderId,
    requiredWeights: getDeliveryWeightState(deliveryRows).requiredWeights,
    rows: deliveryRows,
    values: createDeliveryNoteFormValues(dialogGroup),
  }),
  {
    errors: { form: "请至少录入一项出库数量" },
    payload: null,
  },
);
assert.deepEqual(
  collectDeliveryNoteSubmitState({
    orderId: dialogGroup.orderId,
    requiredWeights: getDeliveryWeightState([
      { ...deliveryRows[0], quantity: "2" },
      { ...deliveryRows[1], quantity: "4", note: "出库备注" },
    ]).requiredWeights,
    rows: [
      { ...deliveryRows[0], quantity: "2" },
      { ...deliveryRows[1], quantity: "4", note: "出库备注" },
    ],
    values: {
      ...createDeliveryNoteFormValues(dialogGroup),
      extraCharges: [{ name: "运费", amount: "20" }],
      note: " 出库单备注 ",
      powderWeightKg: "12.50",
      specialNote: "  特殊提示内容  ",
    },
  }),
  {
    errors: {},
    payload: {
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [{ name: "运费", amountX100: 2000 }],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "订单明细备注",
          productId: "p1",
          quantity: 2,
        },
        {
          color: "白色",
          lengthMm: 4000,
          note: "出库备注",
          productId: "p3",
          quantity: 4,
        },
      ],
      note: "出库单备注",
      orderId: "ALU20260623001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1250,
      pricingTaxIncluded: false,
      specialNote: "特殊提示内容",
    },
  },
);
assert.deepEqual(
  collectDeliveryNoteSubmitState({
    orderId: dialogGroup.orderId,
    requiredWeights: getDeliveryWeightState([
      { ...deliveryRows[0], quantity: "1" },
      deliveryRows[1],
    ]).requiredWeights,
    rows: [{ ...deliveryRows[0], quantity: "1" }, deliveryRows[1]],
    values: {
      ...createDeliveryNoteFormValues(dialogGroup),
      powderWeightKg: "12",
    },
  }),
  {
    errors: {},
    payload: {
      billetWeightKgX100: 0,
      bridgeWeightKgX100: 0,
      electrophoresisWeightKgX100: 0,
      extraCharges: [],
      items: [
        {
          color: "灰色",
          lengthMm: 6000,
          note: "订单明细备注",
          productId: "p1",
          quantity: 1,
        },
        {
          color: "白色",
          lengthMm: 4000,
          note: "",
          productId: "p3",
          quantity: 0,
        },
      ],
      note: "",
      orderId: "ALU20260623001",
      oxidationWeightKgX100: 0,
      powderWeightKgX100: 1200,
      pricingTaxIncluded: false,
      specialNote: "",
    },
  },
);
assert.deepEqual(
  collectDeliveryNoteSubmitState({
    orderId: dialogGroup.orderId,
    requiredWeights: getDeliveryWeightState([
      { ...deliveryRows[0], quantity: "1" },
    ]).requiredWeights,
    rows: [{ ...deliveryRows[0], quantity: "1" }],
    values: createDeliveryNoteFormValues(dialogGroup),
  }),
  {
    errors: { powderWeightKg: "请填写喷涂重量" },
    payload: null,
  },
);
assert.deepEqual(
  collectDeliveryNoteSubmitState({
    orderId: dialogGroup.orderId,
    requiredWeights: {
      billet: false,
      bridge: false,
      electrophoresis: false,
      oxidation: false,
      powder: false,
    },
    rows: [{ ...deliveryRows[0], quantity: "4" }],
    values: createDeliveryNoteFormValues(dialogGroup),
  }),
  {
    errors: { "p1:6000:灰色": "出库数量不能大于当前库存" },
    payload: null,
  },
);
assert.deepEqual(
  collectDeliveryNoteSubmitState({
    orderId: dialogGroup.orderId,
    requiredWeights: {
      billet: false,
      bridge: false,
      electrophoresis: false,
      oxidation: false,
      powder: false,
    },
    rows: [{ ...deliveryRows[0], color: "坯料氧化", quantity: "1" }],
    values: {
      ...createDeliveryNoteFormValues(dialogGroup),
      extraCharges: [{ name: "", amount: "20" }],
    },
  }),
  {
    errors: {
      "extraChargeName-0": "请填写收费名称",
      "p1:6000:坯料氧化": "颜色“坯料氧化”同时命中坯料、氧化，请检查颜色录入",
    },
    payload: null,
  },
);
assert.deepEqual(
  getFirstInvalidDeliveryNoteFocusTarget({
    errors: { powderWeightKg: "请填写喷涂重量" },
    requiredWeights: getDeliveryWeightState(filledDeliveryRows).requiredWeights,
    rows: deliveryRows,
    values: createDeliveryNoteFormValues(dialogGroup),
  }),
  { kind: "field", field: "powderWeightKg" },
);
assert.deepEqual(
  getFirstInvalidDeliveryNoteFocusTarget({
    errors: { "p1:6000:灰色": "出库数量不能大于当前库存" },
    requiredWeights: getDeliveryWeightState(deliveryRows).requiredWeights,
    rows: deliveryRows,
    values: {
      ...createDeliveryNoteFormValues(dialogGroup),
      powderWeightKg: "12",
    },
  }),
  { kind: "row", detailKey: "p1:6000:灰色", field: "quantity" },
);
assert.deepEqual(
  getFirstInvalidDeliveryNoteFocusTarget({
    errors: { form: "请至少录入一项出库数量" },
    requiredWeights: getDeliveryWeightState(deliveryRows).requiredWeights,
    rows: deliveryRows,
    values: {
      ...createDeliveryNoteFormValues(dialogGroup),
      powderWeightKg: "12",
    },
  }),
  { kind: "row", detailKey: "p1:6000:灰色", field: "quantity" },
);
assert.deepEqual(
  getFirstInvalidDeliveryNoteFocusTarget({
    errors: {},
    requiredWeights: getDeliveryWeightState(filledDeliveryRows).requiredWeights,
    rows: deliveryRows,
    values: createDeliveryNoteFormValues(dialogGroup),
  }),
  { kind: "field", field: "powderWeightKg" },
);
assert.equal(
  getFirstInvalidDeliveryNoteFocusTarget({
    errors: {},
    requiredWeights: getDeliveryWeightState(filledDeliveryRows).requiredWeights,
    rows: deliveryRows,
    values: {
      ...createDeliveryNoteFormValues(dialogGroup),
      powderWeightKg: "12",
    },
  }),
  null,
);

const customerInventoryDeliveryInitRows =
  createCustomerInventoryDeliveryRows([
    {
      id: "KH-20260623001",
      items: [
        {
          color: "灰色",
          id: "stock-1",
          lengthMm: 6000,
          moldCode: "G5501",
          note: "库存备注",
          productName: "灰色边框",
          quantity: 5,
        },
        {
          color: "白色",
          id: "stock-2",
          lengthMm: 3000,
          moldCode: "G5502",
          note: "零库存不出现在出库弹窗",
          productName: "白色边框",
          quantity: 0,
        },
      ],
      note: "批次备注",
  },
]);
const createCustomerInventoryDeliveryDialogBatch = (overrides = {}) => ({
  aluminumIngotPriceX100: 2_000_000,
  billetProcessingFeeX100: 8000,
  bridgeProcessingFeeX100: 12000,
  customerId: "customer-a",
  customerName: "客户 A",
  electrophoresisProcessingFeeX100: 0,
  hasDeliveryNote: false,
  historicalOrderDate: "2026-06-23",
  historicalOrderRef: "",
  id: "KH-20260623001",
  items: [
    {
      color: "灰色",
      id: "stock-1",
      lengthMm: 6000,
      moldCode: "G5501",
      note: "库存备注",
      productId: "p1",
      productName: "灰色边框",
      quantity: 5,
    },
  ],
  note: "批次备注",
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 10000,
  pricingTaxIncluded: true,
  totalQuantity: 5,
  ...overrides,
});
const customerInventoryDeliveryDialogBatchA =
  createCustomerInventoryDeliveryDialogBatch();
const customerInventoryDeliveryDialogBatchB =
  createCustomerInventoryDeliveryDialogBatch({
    id: "KH-20260624001",
    items: [
      {
        color: "氧化",
        id: "stock-2",
        lengthMm: 5000,
        moldCode: "G5502",
        note: "",
        productId: "p2",
        productName: "氧化边框",
        quantity: 3,
      },
    ],
    oxidationProcessingFeeX100: 9000,
    powderProcessingFeeX100: 0,
    totalQuantity: 3,
  });
assert.equal(
  getCustomerInventoryBatchPriceGroupKey(
    customerInventoryDeliveryDialogBatchA,
  ),
  "2000000:1:12000:10000:8000:0:0",
);
assert.deepEqual(
  groupCustomerInventoryBatchesByPrice([
    customerInventoryDeliveryDialogBatchA,
    { ...customerInventoryDeliveryDialogBatchA, id: "KH-20260625001" },
    customerInventoryDeliveryDialogBatchB,
  ]).map((group) => group.batchIds),
  [
    ["KH-20260623001", "KH-20260625001"],
    ["KH-20260624001"],
  ],
);
assert.deepEqual(
  createEmptyCustomerInventoryDeliveryDialogValues(),
  {
    errorMessage: null,
    formValues: customerInventoryDeliveryFormBase,
    priceGroupFormValues: {},
    priceGroups: [],
    rows: [],
    selectedBatch: null,
    selectedBatches: [],
  },
);
assert.deepEqual(createEmptyCustomerInventoryDeliveryDialogApplyState(), {
  errors: {},
  formValues: customerInventoryDeliveryFormBase,
  priceGroupFormValues: {},
  rows: [],
  selectedBatch: null,
  selectedBatches: [],
});
assert.deepEqual(createCustomerInventoryDeliverySuccessDialogState(), {
  deliveryOpen: false,
  dialogApplyState: createEmptyCustomerInventoryDeliveryDialogApplyState(),
  printOpen: true,
  selectedBatchIds: [],
});
const customerInventoryDeliveryDialogValues =
  createCustomerInventoryDeliveryDialogValues([
    customerInventoryDeliveryDialogBatchA,
    customerInventoryDeliveryDialogBatchB,
  ]);
assert.equal(
  customerInventoryDeliveryDialogValues.selectedBatch.id,
  "KH-20260623001",
);
assert.deepEqual(
  customerInventoryDeliveryDialogValues.selectedBatches.map((batch) => batch.id),
  ["KH-20260623001", "KH-20260624001"],
);
assert.deepEqual(
  customerInventoryDeliveryDialogValues.rows.map((row) => row.stockId),
  ["stock-1", "stock-2"],
);
assert.deepEqual(
  customerInventoryDeliveryDialogValues.priceGroups.map((group) => ({
    batchIds: group.batchIds,
    title: group.title,
  })),
  [
    { batchIds: ["KH-20260623001"], title: "计价方案1" },
    { batchIds: ["KH-20260624001"], title: "计价方案2" },
  ],
);
assert.deepEqual(
  Object.keys(customerInventoryDeliveryDialogValues.priceGroupFormValues),
  [
    "2000000:1:12000:10000:8000:0:0",
    "2000000:1:12000:0:8000:9000:0",
  ],
);
assert.deepEqual(
  createCustomerInventoryDeliveryDialogApplyState(
    customerInventoryDeliveryDialogValues,
  ),
  {
    errors: {},
    formValues: customerInventoryDeliveryDialogValues.formValues,
    priceGroupFormValues:
      customerInventoryDeliveryDialogValues.priceGroupFormValues,
    rows: customerInventoryDeliveryDialogValues.rows,
    selectedBatch: customerInventoryDeliveryDialogValues.selectedBatch,
    selectedBatches: customerInventoryDeliveryDialogValues.selectedBatches,
  },
);
assert.deepEqual(
  createCustomerInventoryDeliveryDialogOpenState(
    customerInventoryDeliveryDialogValues,
  ),
  {
    dialogApplyState: createCustomerInventoryDeliveryDialogApplyState(
      customerInventoryDeliveryDialogValues,
    ),
    open: true,
  },
);
assert.deepEqual(createCustomerInventoryDeliveryDialogCloseState(), {
  dialogApplyState: createEmptyCustomerInventoryDeliveryDialogApplyState(),
  open: false,
});
assert.deepEqual(customerInventoryDeliveryInitRows, [
  {
    batchId: "KH-20260623001",
    batchNote: "批次备注",
    color: "灰色",
    currentQuantity: 5,
    groupLabel: "",
    lengthMm: 6000,
    moldCode: "G5501",
    note: "库存备注",
    productName: "灰色边框",
    quantity: "",
    stockId: "stock-1",
  },
]);
assert.deepEqual(
  fillCustomerInventoryDeliveryCurrentQuantities(
    customerInventoryDeliveryInitRows,
  ).map((row) => row.quantity),
  ["5"],
);
assert.deepEqual(
  clearCustomerInventoryDeliveryQuantities([
    { ...customerInventoryDeliveryInitRows[0], quantity: "5" },
  ]).map((row) => row.quantity),
  [""],
);
assert.deepEqual(
  getCustomerInventoryDeliveryDialogState([
    {
      customerId: "customer-a",
      id: "KH-20260623001",
      totalQuantity: 0,
    },
  ]),
  {
    batches: [],
    errorMessage: "请选择有剩余库存的客户库存批次",
    firstBatch: null,
  },
);
assert.deepEqual(
  getCustomerInventoryDeliveryDialogState([
    {
      customerId: "customer-a",
      id: "KH-20260623001",
      totalQuantity: 5,
    },
    {
      customerId: "customer-b",
      id: "KH-20260624001",
      totalQuantity: 3,
    },
  ]),
  {
    batches: [],
    errorMessage: "只能合并同一客户的库存批次",
    firstBatch: null,
  },
);
const sameCustomerDeliveryDialogBatches = [
  {
    customerId: "customer-a",
    id: "KH-20260623001",
    totalQuantity: 5,
  },
  {
    customerId: "customer-a",
    id: "KH-20260624001",
    totalQuantity: 0,
  },
  {
    customerId: "customer-a",
    id: "KH-20260625001",
    totalQuantity: 2,
  },
];
assert.deepEqual(
  getCustomerInventoryDeliveryDialogState(sameCustomerDeliveryDialogBatches),
  {
    batches: [
      sameCustomerDeliveryDialogBatches[0],
      sameCustomerDeliveryDialogBatches[2],
    ],
    errorMessage: null,
    firstBatch: sameCustomerDeliveryDialogBatches[0],
  },
);
assert.deepEqual(
  createCustomerInventoryDeliveryPriceGroupFormValues([
    { batchIds: ["KH-20260623001"], key: "price-a" },
    { batchIds: ["KH-20260624001"], key: "price-b" },
  ]),
  {
    "price-a": {
      billetWeightKg: "",
      bridgeWeightKg: "",
      electrophoresisWeightKg: "",
      extraCharges: [{ name: "", amount: "" }],
      extraChargeAmount: "",
      extraChargeName: "",
      handlerName: "",
      note: "",
      oxidationWeightKg: "",
      powderWeightKg: "",
      pricingTaxIncluded: true,
      specialNote: "",
    },
    "price-b": {
      billetWeightKg: "",
      bridgeWeightKg: "",
      electrophoresisWeightKg: "",
      extraCharges: [{ name: "", amount: "" }],
      extraChargeAmount: "",
      extraChargeName: "",
      handlerName: "",
      note: "",
      oxidationWeightKg: "",
      powderWeightKg: "",
      pricingTaxIncluded: true,
      specialNote: "",
    },
  },
);
const deliveryNoteFormWithHandler = updateDeliveryNoteFormField({
  key: "handlerName",
  value: "张三",
  values: defaultDeliveryNoteFormValues,
});
assert.equal(deliveryNoteFormWithHandler.handlerName, "张三");
assert.equal(defaultDeliveryNoteFormValues.handlerName, "");
assert.deepEqual(
  clearDeliveryNoteFormError(
    { form: "表单错误", handlerName: "请输入经手人" },
    "handlerName",
  ),
  { form: "表单错误", handlerName: undefined },
);
assert.deepEqual(
  clearDeliveryNoteFormFieldErrorState({
    errors: { form: "表单错误", powderWeightKg: "请填写喷涂重量" },
    key: "powderWeightKg",
  }),
  {
    errors: { form: "表单错误", powderWeightKg: undefined },
  },
);
assert.deepEqual(
  updateDeliveryNoteFormFieldState({
    errors: { form: "表单错误", handlerName: "请输入经手人" },
    key: "handlerName",
    value: "张三",
    values: defaultDeliveryNoteFormValues,
  }),
  {
    errors: { form: "表单错误", handlerName: undefined },
    values: {
      ...defaultDeliveryNoteFormValues,
      handlerName: "张三",
    },
  },
);
assert.deepEqual(
  updateDeliveryNotePriceGroupFormField({
    key: "powderWeightKg",
    priceGroupFormValues: {
      "price-a": {
        ...defaultDeliveryNoteFormValues,
        handlerName: "张三",
      },
    },
    priceGroupKey: "price-a",
    value: "12.5",
  })["price-a"],
  {
    ...defaultDeliveryNoteFormValues,
    handlerName: "张三",
    powderWeightKg: "12.5",
  },
);
assert.deepEqual(
  updateDeliveryNotePriceGroupFormField({
    key: "extraChargeName",
    priceGroupFormValues: {},
    priceGroupKey: "price-b",
    value: "运费",
  })["price-b"],
  {
    ...defaultDeliveryNoteFormValues,
    extraChargeName: "运费",
  },
);
assert.deepEqual(
  updateCustomerInventoryDeliveryFormFieldState({
    errors: { form: "表单错误", handlerName: "请输入经手人" },
    key: "handlerName",
    value: "李四",
    values: defaultDeliveryNoteFormValues,
  }),
  {
    errors: { form: "表单错误", handlerName: undefined },
    values: {
      ...defaultDeliveryNoteFormValues,
      handlerName: "李四",
    },
  },
);
assert.deepEqual(
  updateCustomerInventoryDeliveryPriceGroupFormFieldState({
    errors: {
      form: "表单错误",
      "price-a-extraChargeName": "请填写收费名称",
    },
    key: "extraChargeName",
    priceGroupFormValues: {
      "price-a": {
        ...defaultDeliveryNoteFormValues,
        powderWeightKg: "18",
      },
    },
    priceGroupKey: "price-a",
    value: "运费",
  }),
  {
    errors: {
      form: "表单错误",
      "price-a-extraChargeName": undefined,
    },
    priceGroupFormValues: {
      "price-a": {
        ...defaultDeliveryNoteFormValues,
        extraChargeName: "运费",
        powderWeightKg: "18",
      },
    },
  },
);

assert.equal(getInventoryDetailKey({ color: "灰色", lengthMm: 6000, productId: "p1" }), "p1:6000:灰色");
assert.equal(normalizeMoldCode(" g 55 o1 "), "G55O1");
assert.equal(normalizeOcrMoldCodeForLookup("G55O1"), "G5501");
assert.equal(normalizeOcrMoldCodeForLookup("GOA"), "GOA");
assert.equal(normalizeInventoryLengthMm(6.01), 6010);
assert.equal(normalizeInventoryLengthMm(6000), 6000);
assert.equal(normalizeInventoryColorGroup("深灰色"), "灰");
assert.equal(normalizeInventoryColorGroup("坯料"), "坯料");
assert.equal(normalizeInventoryColorGroup("香槟"), "香槟");
assert.deepEqual(
  withRecognizedOrderMoldCode(
    { color: "灰", lengthMm: 6000, moldCode: "G55O1", quantity: 4 },
    "G5501",
  ),
  { color: "灰", lengthMm: 6000, moldCode: "G5501", quantity: 4 },
);

const rows = [
  {
    color: "深灰色",
    currentQuantity: 0,
    lengthMm: 6000,
    moldCode: "G5501",
    productId: "p1",
    productName: "测试商品",
    quantity: "",
    requiredQuantity: 10,
  },
  {
    color: "白色",
    currentQuantity: 0,
    lengthMm: 6000,
    moldCode: "G5502",
    productId: "p2",
    productName: "测试商品 2",
    quantity: "",
    requiredQuantity: 10,
  },
];

const ambiguousRows = [
  ...rows,
  {
    color: "浅灰色",
    currentQuantity: 0,
    lengthMm: 6000,
    moldCode: "G5501",
    productId: "p3",
    productName: "测试商品 3",
    quantity: "",
    requiredQuantity: 10,
  },
];

assert.equal(
  getRecognizedOrderMoldCode(
    { color: "灰", lengthMm: 6010, moldCode: "G55O1", quantity: 4 },
    rows,
  ),
  "G5501",
);

assert.deepEqual(
  buildBatchOrderImageRecognitionMatches(
    [{ color: "灰", lengthMm: 6010, moldCode: "G55O1", quantity: 4 }],
    rows,
  ),
  [
    {
      detailKey: "p1:6000:深灰色",
      item: { color: "灰", lengthMm: 6000, moldCode: "G5501", quantity: 4 },
      message: "已匹配",
      status: "matched",
    },
  ],
);

assert.equal(
  buildBatchOrderImageRecognitionMatches(
    [{ color: "灰", lengthMm: 6000, moldCode: "G5501", quantity: null }],
    ambiguousRows,
  )[0].message,
  "匹配到 2 条订单颜色，请手动确认",
);
assert.equal(
  buildBatchOrderImageRecognitionMatches(
    [{ color: "香槟", lengthMm: 6000, moldCode: "G5501", quantity: 4 }],
    rows,
  )[0].status,
  "unmatched",
);
assert.equal(
  buildBatchOrderImageRecognitionMatches(
    [{ color: "灰", lengthMm: 6050, moldCode: "G5501", quantity: 4 }],
    rows,
  )[0].status,
  "unmatched",
);
assert.deepEqual(
  dedupeBatchOrderImageRecognitionMatches([
    {
      item: { color: "灰", lengthMm: 6000, moldCode: "G5501", quantity: null },
      message: "未匹配到当前订单明细",
      status: "unmatched",
    },
    {
      detailKey: "p1:6000:深灰色",
      item: { color: "深灰色", lengthMm: 6000, moldCode: "G5501", quantity: 4 },
      message: "已匹配",
      status: "matched",
    },
  ]),
  [
    {
      detailKey: "p1:6000:深灰色",
      item: { color: "深灰色", lengthMm: 6000, moldCode: "G5501", quantity: 4 },
      message: "已匹配",
      status: "matched",
    },
  ],
);

const printStockItem = (id, batchId, quantity = 1) => ({
  batchId,
  color: id.includes("billet") ? "坯料" : "灰色",
  id,
  lengthMm: 6000,
  moldCode: `M-${id}`,
  note: "打印明细",
  productId: id,
  productName: `打印商品 ${id}`,
  quantity,
  updatedAt: "2026-07-15T08:00:00.000Z",
});
const printPricingSnapshot = {
  aluminumIngotPriceX100: 2_000_000,
  billetProcessingFeeX100: 300_000,
  bridgeProcessingFeeX100: 320_000,
  electrophoresisProcessingFeeX100: 0,
  oxidationProcessingFeeX100: 0,
  powderProcessingFeeX100: 310_000,
  pricingTaxIncluded: true,
};
const printBatches = [
  {
    ...printPricingSnapshot,
    historicalOrderDate: "2026-07-02",
    historicalOrderRef: "OLD-002",
    id: "BATCH-002",
    itemCount: 6,
    items: Array.from({ length: 6 }, (_, index) =>
      printStockItem(`b-${index + 1}`, "BATCH-002"),
    ),
    note: "第二批",
    totalQuantity: 6,
  },
  {
    ...printPricingSnapshot,
    historicalOrderDate: "2026-07-02",
    historicalOrderRef: "OLD-001",
    id: "BATCH-001",
    itemCount: 2,
    items: [
      printStockItem("a-1", "BATCH-001", 2),
      printStockItem("a-billet", "BATCH-001", 3),
    ],
    note: "第一批",
    totalQuantity: 5,
  },
  {
    ...printPricingSnapshot,
    historicalOrderDate: null,
    historicalOrderRef: "",
    id: "BATCH-NO-DATE",
    itemCount: 1,
    items: [printStockItem("no-date", "BATCH-NO-DATE", 4)],
    note: "沃德虎标膜，九州印象 9# 楼剩余料以及地下车库连接区域，其余料已发货",
    totalQuantity: 4,
  },
  {
    ...printPricingSnapshot,
    historicalOrderDate: null,
    historicalOrderRef: "",
    id: "BATCH-NO-DATE-2",
    itemCount: 1,
    items: [printStockItem("no-date-2", "BATCH-NO-DATE-2")],
    note: "",
    totalQuantity: 1,
  },
];
const printSnapshot = {
  batches: printBatches,
  customerAddress: "打印地址",
  customerId: "customer-print",
  customerName: "打印客户",
  generatedAt: "2026-07-15T08:00:00.000Z",
  itemCount: 10,
  totalQuantity: 16,
};
const printTableGroups = buildCustomerInventoryPrintTableGroups(printSnapshot);

assert.equal(printTableGroups.length, 3);
assert.deepEqual(
  printTableGroups.map((group) => group.batches.map((batch) => batch.id)),
  [
    ["BATCH-002", "BATCH-001"],
    ["BATCH-NO-DATE"],
    ["BATCH-NO-DATE-2"],
  ],
);
assert.equal(printTableGroups[0].totalQuantity, 11);
const differentPriceTableGroups = buildCustomerInventoryPrintTableGroups({
  ...printSnapshot,
  batches: [
    printBatches[0],
    {
      ...printBatches[1],
      aluminumIngotPriceX100:
        printBatches[1].aluminumIngotPriceX100 + 100,
    },
  ],
});

assert.equal(differentPriceTableGroups.length, 2);
assert.equal(printTableGroups[1].id, "batch:BATCH-NO-DATE");
assert.equal(printTableGroups[2].id, "batch:BATCH-NO-DATE-2");
assert.equal(
  getDefaultCustomerInventoryPrintGroupLabel(printBatches[2]),
  "九州印象 9# 楼剩余料以及地下车库连接区域，其余料已发货",
);
assert.deepEqual(createCustomerInventoryPrintGroupLabels(printSnapshot), {
  "BATCH-001": "第一批",
  "BATCH-002": "第二批",
  "BATCH-NO-DATE":
    "九州印象 9# 楼剩余料以及地下车库连接区域，其余料已发货",
  "BATCH-NO-DATE-2": "BATCH-NO-DATE-2",
});
assert.deepEqual(
  normalizeCustomerInventoryPrintGroupLabels(printSnapshot, {
    "BATCH-001": " 手工一组 ",
    "BATCH-002": "",
  }),
  {
    "BATCH-001": "手工一组",
    "BATCH-002": "第二批",
    "BATCH-NO-DATE":
      "九州印象 9# 楼剩余料以及地下车库连接区域，其余料已发货",
    "BATCH-NO-DATE-2": "BATCH-NO-DATE-2",
  },
);
const printPages = paginateCustomerInventoryPrintSnapshot(
  printSnapshot,
  10,
);
const printedItemIds = printPages.flatMap((page) =>
  page.tables.flatMap((table) =>
    table.rowGroups.flatMap((rowGroup) =>
      rowGroup.items.map((item) => item.id),
    ),
  ),
);

assert.ok(printPages.length > 1);
assert.deepEqual(printedItemIds, printBatches.flatMap((batch) => batch.items.map((item) => item.id)));
assert.equal(new Set(printedItemIds).size, printedItemIds.length);
assert.equal(
  printPages
    .flatMap((page) => page.tables)
    .filter(
      (table) => table.group.id === printTableGroups[0].id && table.isLastPart,
    )
    .length,
  1,
);
const densePrintItems = Array.from({ length: 48 }, (_, index) =>
  printStockItem(`dense-${index + 1}`, "BATCH-DENSE"),
);
const densePrintBatch = {
  ...printPricingSnapshot,
  historicalOrderDate: "2026-07-03",
  historicalOrderRef: "DENSE-001",
  id: "BATCH-DENSE",
  itemCount: densePrintItems.length,
  items: densePrintItems,
  note: "密集分页",
  totalQuantity: densePrintItems.length,
};
const createDensePrintSnapshot = (itemCount) => ({
  batches: [
    {
      ...densePrintBatch,
      itemCount,
      items: densePrintItems.slice(0, itemCount),
      totalQuantity: itemCount,
    },
  ],
  customerAddress: "打印地址",
  customerId: "customer-print",
  customerName: "打印客户",
  generatedAt: "2026-07-15T08:00:00.000Z",
  itemCount,
  totalQuantity: itemCount,
});
const compactPrintPages = paginateCustomerInventoryPrintSnapshot(
  createDensePrintSnapshot(38),
);
const balancedPrintPages = paginateCustomerInventoryPrintSnapshot(
  createDensePrintSnapshot(48),
);
const balancedLastPageRowCount = balancedPrintPages.at(-1).tables.reduce(
  (total, table) =>
    total +
    table.rowGroups.reduce(
      (rowTotal, rowGroup) => rowTotal + rowGroup.items.length,
      0,
    ),
  0,
);

assert.equal(compactPrintPages.length, 1);
assert.equal(balancedPrintPages.length, 2);
assert.ok(balancedLastPageRowCount >= 6);
const actualInventoryPrintGroupSizes = [4, 28, 16, 19, 12];
let actualInventoryPrintItemOffset = 0;
const actualInventoryPrintBatches = actualInventoryPrintGroupSizes.map(
  (itemCount, groupIndex) => {
    const batchId = `ACTUAL-BATCH-${groupIndex + 1}`;
    const items = Array.from({ length: itemCount }, (_, itemIndex) =>
      printStockItem(
        `actual-${actualInventoryPrintItemOffset + itemIndex + 1}`,
        batchId,
      ),
    );

    actualInventoryPrintItemOffset += itemCount;

    return {
      ...printPricingSnapshot,
      historicalOrderDate: [
        "2026-05-01",
        "2025-11-05",
        "2025-04-07",
        "2025-03-24",
        "2025-03-18",
      ][groupIndex],
      historicalOrderRef: `ACTUAL-${groupIndex + 1}`,
      id: batchId,
      itemCount,
      items,
      note: "真实分页分布",
      totalQuantity: itemCount,
    };
  },
);
const actualInventoryPrintPages = paginateCustomerInventoryPrintSnapshot({
  batches: actualInventoryPrintBatches,
  customerAddress: "打印地址",
  customerId: "customer-actual-print",
  customerName: "真实分页客户",
  generatedAt: "2026-07-16T08:00:00.000Z",
  itemCount: actualInventoryPrintItemOffset,
  totalQuantity: actualInventoryPrintItemOffset,
});
const actualInventoryPrintPageRowCounts = actualInventoryPrintPages.map(
  (page) =>
    page.tables.reduce(
      (pageTotal, table) =>
        pageTotal +
        table.rowGroups.reduce(
          (tableTotal, rowGroup) => tableTotal + rowGroup.items.length,
          0,
        ),
      0,
    ),
);

assert.deepEqual(actualInventoryPrintPageRowCounts, [32, 35, 12]);
const measuredInventoryPrintMetrics = {
  batchHeights: Object.fromEntries(
    actualInventoryPrintBatches.map((batch) => [batch.id, batch.itemCount]),
  ),
  continuedHeight: 5,
  grandTotalHeight: 10,
  pageContentHeight: 100,
  pageFixedHeight: 10,
  tableHeaderHeights: Object.fromEntries(
    actualInventoryPrintBatches.map((batch) => [
      buildCustomerInventoryPrintTableGroups({ batches: [batch] })[0].id,
      10,
    ]),
  ),
  tableSummaryHeights: Object.fromEntries(
    actualInventoryPrintBatches.map((batch) => [
      buildCustomerInventoryPrintTableGroups({ batches: [batch] })[0].id,
      5,
    ]),
  ),
};
const measuredInventoryPrintResult =
  paginateMeasuredCustomerInventoryPrintSnapshot(
    {
      batches: actualInventoryPrintBatches,
      customerAddress: "打印地址",
      customerId: "customer-actual-print",
      customerName: "真实分页客户",
      generatedAt: "2026-07-16T08:00:00.000Z",
      itemCount: actualInventoryPrintItemOffset,
      totalQuantity: actualInventoryPrintItemOffset,
    },
    createCustomerInventoryPrintGroupLabels({
      batches: actualInventoryPrintBatches,
    }),
    measuredInventoryPrintMetrics,
  );

assert.equal(measuredInventoryPrintResult.errorMessage, null);
assert.deepEqual(
  measuredInventoryPrintResult.pages.map((page) =>
    page.tables.reduce(
      (pageTotal, table) =>
        pageTotal +
        table.rowGroups.reduce(
          (tableTotal, rowGroup) => tableTotal + rowGroup.items.length,
          0,
        ),
      0,
    ),
  ),
  [32, 35, 12],
);
const oversizedInventoryPrintResult =
  paginateMeasuredCustomerInventoryPrintSnapshot(
    {
      batches: actualInventoryPrintBatches,
      customerAddress: "打印地址",
      customerId: "customer-actual-print",
      customerName: "真实分页客户",
      generatedAt: "2026-07-16T08:00:00.000Z",
      itemCount: actualInventoryPrintItemOffset,
      totalQuantity: actualInventoryPrintItemOffset,
    },
    createCustomerInventoryPrintGroupLabels({
      batches: actualInventoryPrintBatches,
    }),
    {
      ...measuredInventoryPrintMetrics,
      batchHeights: {
        ...measuredInventoryPrintMetrics.batchHeights,
        "ACTUAL-BATCH-1": 100,
      },
    },
  );

assert.match(oversizedInventoryPrintResult.errorMessage, /ACTUAL-BATCH-1/);
const totalsOnlyPrintBatch = actualInventoryPrintBatches[0];
const totalsOnlyPrintSnapshot = {
  batches: [totalsOnlyPrintBatch],
  customerAddress: "打印地址",
  customerId: "customer-totals-print",
  customerName: "总计换页客户",
  generatedAt: "2026-07-16T08:00:00.000Z",
  itemCount: totalsOnlyPrintBatch.itemCount,
  totalQuantity: totalsOnlyPrintBatch.totalQuantity,
};
const totalsOnlyPrintResult = paginateMeasuredCustomerInventoryPrintSnapshot(
  totalsOnlyPrintSnapshot,
  createCustomerInventoryPrintGroupLabels(totalsOnlyPrintSnapshot),
  {
    batchHeights: { [totalsOnlyPrintBatch.id]: 60 },
    continuedHeight: 5,
    grandTotalHeight: 20,
    pageContentHeight: 100,
    pageFixedHeight: 10,
    tableHeaderHeights: {
      [buildCustomerInventoryPrintTableGroups({
        batches: [totalsOnlyPrintBatch],
      })[0].id]: 10,
    },
    tableSummaryHeights: {
      [buildCustomerInventoryPrintTableGroups({
        batches: [totalsOnlyPrintBatch],
      })[0].id]: 5,
    },
  },
);

assert.equal(totalsOnlyPrintResult.errorMessage, null);
assert.equal(totalsOnlyPrintResult.pages.length, 2);
assert.equal(totalsOnlyPrintResult.pages[0].tables.length, 1);
assert.equal(totalsOnlyPrintResult.pages[1].tables.length, 0);
const totalsOnlyWithPriorContentBatches = actualInventoryPrintBatches.slice(0, 2);
const totalsOnlyWithPriorContentSnapshot = {
  batches: totalsOnlyWithPriorContentBatches,
  customerAddress: "打印地址",
  customerId: "customer-totals-prior-content-print",
  customerName: "已有内容总计换页客户",
  generatedAt: "2026-07-16T08:00:00.000Z",
  itemCount: totalsOnlyWithPriorContentBatches.reduce(
    (total, batch) => total + batch.itemCount,
    0,
  ),
  totalQuantity: totalsOnlyWithPriorContentBatches.reduce(
    (total, batch) => total + batch.totalQuantity,
    0,
  ),
};
const totalsOnlyWithPriorContentResult =
  paginateMeasuredCustomerInventoryPrintSnapshot(
    totalsOnlyWithPriorContentSnapshot,
    createCustomerInventoryPrintGroupLabels(
      totalsOnlyWithPriorContentSnapshot,
    ),
    {
      batchHeights: Object.fromEntries(
        totalsOnlyWithPriorContentBatches.map((batch) => [batch.id, 25]),
      ),
      continuedHeight: 5,
      grandTotalHeight: 20,
      pageContentHeight: 100,
      pageFixedHeight: 10,
      tableHeaderHeights: Object.fromEntries(
        totalsOnlyWithPriorContentBatches.map((batch) => [
          buildCustomerInventoryPrintTableGroups({ batches: [batch] })[0].id,
          10,
        ]),
      ),
      tableSummaryHeights: Object.fromEntries(
        totalsOnlyWithPriorContentBatches.map((batch) => [
          buildCustomerInventoryPrintTableGroups({ batches: [batch] })[0].id,
          5,
        ]),
      ),
    },
  );

assert.equal(totalsOnlyWithPriorContentResult.errorMessage, null);
assert.equal(totalsOnlyWithPriorContentResult.pages.length, 2);
assert.equal(totalsOnlyWithPriorContentResult.pages[0].tables.length, 2);
assert.equal(totalsOnlyWithPriorContentResult.pages[1].tables.length, 0);
assert.throws(
  () =>
    paginateCustomerInventoryPrintSnapshot(
      {
        batches: [],
        customerAddress: "",
        customerId: "customer-print",
        customerName: "打印客户",
        generatedAt: "2026-07-15T08:00:00.000Z",
        itemCount: 0,
        totalQuantity: 0,
      },
      4,
    ),
  /分页容量过小/,
);

assert.equal(customerInventoryImportHeaders.length, 18);
assert.deepEqual(createCustomerInventoryImportTemplateCsvRows(), [
  customerInventoryImportHeaders,
]);
const exportRows = createCustomerInventoryExportCsvRows([
  {
    aluminumIngotPriceX100: 2050050,
    billetProcessingFeeX100: 0,
    bridgeProcessingFeeX100: 0,
    customerName: "导出客户",
    electrophoresisProcessingFeeX100: 0,
    historicalOrderDate: "2026-07-01",
    historicalOrderRef: "OLD-001",
    id: "DC-20260701001",
    items: [
      {
        color: "喷涂灰",
        lengthMm: 6000,
        moldCode: "EXP-001",
        note: "正库存",
        productName: "导出商品",
        quantity: 5,
      },
      {
        color: "喷涂白",
        lengthMm: 3000,
        moldCode: "EXP-001",
        note: "零库存不导出",
        productName: "导出商品",
        quantity: 0,
      },
    ],
    note: "导出批次备注",
    oxidationProcessingFeeX100: 0,
    powderProcessingFeeX100: 125,
    pricingTaxIncluded: true,
  },
]);
assert.equal(getCustomerInventoryExportItemCount([{ items: [{ quantity: 5 }, { quantity: 0 }] }]), 1);
assert.equal(exportRows.length, 2);
assert.deepEqual(exportRows[0], customerInventoryImportHeaders);
assert.deepEqual(exportRows[1], [
  "DC-20260701001",
  "导出客户",
  "2026-07-01",
  "OLD-001",
  "20500.50",
  "含税",
  "0.00",
  "1.25",
  "0.00",
  "0.00",
  "0.00",
  "导出批次备注",
  "导出商品",
  "EXP-001",
  6000,
  "喷涂灰",
  5,
  "正库存",
]);

console.log("inventory utility rules ok");
