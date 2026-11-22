import type { CustomerInventoryBatchRow } from "@/features/inventory/lib/inventory-utils"
import type {
  CustomerInventoryBatch,
  CustomerInventoryStockItem,
} from "@/features/inventory/types"
import { formatMoneyInput } from "@/lib/money"
import {
  defaultCustomerInventoryBatchFormValues,
  defaultCustomerInventoryBatchRow,
} from "./inventory-dialog-state-forms"
import type {
  CustomerInventoryBatchCustomerUpdateState,
  CustomerInventoryBatchDialogApplyState,
  CustomerInventoryBatchDialogCloseState,
  CustomerInventoryBatchDialogOpenState,
  CustomerInventoryBatchDialogValues,
  CustomerInventoryBatchErrors,
  CustomerInventoryBatchFormCustomerStateInput,
  CustomerInventoryBatchFormErrorClearState,
  CustomerInventoryBatchFormFieldUpdateState,
  CustomerInventoryBatchFormPricingStateInput,
  CustomerInventoryBatchFormValues,
  CustomerInventoryBatchFormValuesUpdateState,
  CustomerInventoryBatchRowProductSelection,
  CustomerInventoryBatchRowProductSnapshot,
  CustomerInventoryBatchRowsOnlyUpdateState,
  CustomerInventoryBatchRowsUpdateState,
  CustomerInventoryDetailFocusTarget,
  CustomerInventoryDetailInputField,
  CustomerInventoryProcessingFeeField,
  CustomerInventoryProcessingFeeSnapshotX100,
} from "./inventory-dialog-state-types"

export function createCustomerInventoryBatchFormValuesFromBatch(
  batch: CustomerInventoryBatch,
): CustomerInventoryBatchFormValues {
  return {
    aluminumIngotPrice: formatMoneyInput(batch.aluminumIngotPriceX100),
    batchId: batch.id,
    billetProcessingFee: formatMoneyInput(batch.billetProcessingFeeX100),
    bridgeProcessingFee: formatMoneyInput(batch.bridgeProcessingFeeX100),
    customerId: batch.customerId,
    electrophoresisProcessingFee: formatMoneyInput(
      batch.electrophoresisProcessingFeeX100,
    ),
    historicalOrderDate: batch.historicalOrderDate ?? "",
    historicalOrderRef: batch.historicalOrderRef,
    note: batch.note,
    oxidationProcessingFee: formatMoneyInput(batch.oxidationProcessingFeeX100),
    powderProcessingFee: formatMoneyInput(batch.powderProcessingFeeX100),
    pricingTaxIncluded: batch.pricingTaxIncluded,
  }
}

export function createEmptyCustomerInventoryBatchDialogValues(): CustomerInventoryBatchDialogValues {
  return {
    formValues: { ...defaultCustomerInventoryBatchFormValues },
    rows: [{ ...defaultCustomerInventoryBatchRow }],
  }
}

export function createCustomerInventoryBatchDialogValuesFromBatch({
  batch,
  products,
}: {
  batch: CustomerInventoryBatch
  products: readonly CustomerInventoryBatchRowProductSelection[]
}): CustomerInventoryBatchDialogValues {
  return {
    formValues: createCustomerInventoryBatchFormValuesFromBatch(batch),
    rows: createCustomerInventoryBatchRowsFromBatch({ batch, products }),
  }
}

export function createCustomerInventoryBatchDialogApplyState(
  values: CustomerInventoryBatchDialogValues,
): CustomerInventoryBatchDialogApplyState {
  return {
    ...values,
    errors: {},
  }
}

export function createEmptyCustomerInventoryBatchDialogApplyState(): CustomerInventoryBatchDialogApplyState {
  return createCustomerInventoryBatchDialogApplyState(
    createEmptyCustomerInventoryBatchDialogValues(),
  )
}

export function createCustomerInventoryBatchDialogOpenState({
  editingBatch,
  values,
}: {
  editingBatch: CustomerInventoryBatch | null
  values: CustomerInventoryBatchDialogValues
}): CustomerInventoryBatchDialogOpenState {
  return {
    dialogApplyState: createCustomerInventoryBatchDialogApplyState(values),
    editingBatch,
    open: true,
  }
}

export function createCustomerInventoryBatchDialogCloseState(): CustomerInventoryBatchDialogCloseState {
  return {
    dialogApplyState: createEmptyCustomerInventoryBatchDialogApplyState(),
    editingBatch: null,
    open: false,
  }
}

export function applyCustomerInventoryProcessingFees({
  fees,
  values,
}: {
  fees: CustomerInventoryProcessingFeeSnapshotX100
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchFormValues {
  return {
    ...values,
    billetProcessingFee: formatMoneyInput(fees.billetProcessingFeeX100),
    bridgeProcessingFee: formatMoneyInput(fees.bridgeProcessingFeeX100),
    electrophoresisProcessingFee: formatMoneyInput(
      fees.electrophoresisProcessingFeeX100,
    ),
    oxidationProcessingFee: formatMoneyInput(fees.oxidationProcessingFeeX100),
    powderProcessingFee: formatMoneyInput(fees.powderProcessingFeeX100),
  }
}

export function fillMissingCustomerInventoryProcessingFees({
  fees,
  fields,
  values,
}: {
  fees: CustomerInventoryProcessingFeeSnapshotX100
  fields: readonly CustomerInventoryProcessingFeeField[]
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchFormValues {
  return fields.reduce<CustomerInventoryBatchFormValues>((next, field) => {
    if (String(next[field.formKey]).trim()) {
      return next
    }

    const feeValue = fees[field.snapshotKey]

    if (feeValue <= 0) {
      return next
    }

    return {
      ...next,
      [field.formKey]: formatMoneyInput(feeValue),
    }
  }, values)
}

export function createCustomerInventoryBatchMissingProcessingFeesState({
  fees,
  fields,
  values,
}: {
  fees: CustomerInventoryProcessingFeeSnapshotX100
  fields: readonly CustomerInventoryProcessingFeeField[]
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchFormValuesUpdateState {
  return {
    values: fillMissingCustomerInventoryProcessingFees({
      fees,
      fields,
      values,
    }),
  }
}

export function updateCustomerInventoryBatchNoteWithFees({
  fees,
  note,
  values,
}: {
  fees: CustomerInventoryProcessingFeeSnapshotX100
  note: string
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchFormValues {
  return {
    ...applyCustomerInventoryProcessingFees({ fees, values }),
    note,
  }
}

export function createCustomerInventoryBatchNoteFeesState({
  fees,
  note,
  values,
}: {
  fees: CustomerInventoryProcessingFeeSnapshotX100
  note: string
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchFormValuesUpdateState {
  return {
    values: updateCustomerInventoryBatchNoteWithFees({
      fees,
      note,
      values,
    }),
  }
}

export function updateCustomerInventoryBatchFormField<
  Key extends keyof CustomerInventoryBatchFormValues,
>({
  key,
  value,
  values,
}: {
  key: Key
  value: CustomerInventoryBatchFormValues[Key]
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchFormValues {
  return {
    ...values,
    [key]: value,
  }
}

export function clearCustomerInventoryBatchFormError(
  errors: CustomerInventoryBatchErrors,
  key: string,
): CustomerInventoryBatchErrors {
  return {
    ...errors,
    [key]: undefined,
  }
}

export function clearCustomerInventoryBatchFormErrorState({
  errors,
  key,
}: {
  errors: CustomerInventoryBatchErrors
  key: string
}): CustomerInventoryBatchFormErrorClearState {
  return {
    errors: clearCustomerInventoryBatchFormError(errors, key),
  }
}

export function updateCustomerInventoryBatchFormFieldState<
  Key extends keyof CustomerInventoryBatchFormValues,
>({
  errors,
  key,
  value,
  values,
}: {
  errors: CustomerInventoryBatchErrors
  key: Key
  value: CustomerInventoryBatchFormValues[Key]
  values: CustomerInventoryBatchFormValues
}): CustomerInventoryBatchFormFieldUpdateState {
  return {
    errors: clearCustomerInventoryBatchFormError(errors, key),
    values: updateCustomerInventoryBatchFormField({ key, value, values }),
  }
}

export function updateCustomerInventoryBatchCustomerWithFees({
  customerId,
  fees,
  pricingTaxIncluded,
  values,
}: CustomerInventoryBatchFormCustomerStateInput): CustomerInventoryBatchFormValues {
  return applyCustomerInventoryProcessingFees({
    fees,
    values: {
      ...values,
      customerId,
      pricingTaxIncluded,
    },
  })
}

export function updateCustomerInventoryBatchCustomerState({
  customerId,
  errors,
  fees,
  pricingTaxIncluded,
  rows,
  values,
}: CustomerInventoryBatchFormCustomerStateInput & {
  errors: CustomerInventoryBatchErrors
  rows: CustomerInventoryBatchRow[]
}): CustomerInventoryBatchCustomerUpdateState {
  return {
    errors: clearCustomerInventoryBatchFormError(errors, "customerId"),
    rows: clearCustomerInventoryBatchRowProducts(rows),
    values: updateCustomerInventoryBatchCustomerWithFees({
      customerId,
      fees,
      pricingTaxIncluded,
      values,
    }),
  }
}

export function updateCustomerInventoryBatchPricingWithFees({
  fees,
  pricingTaxIncluded,
  values,
}: CustomerInventoryBatchFormPricingStateInput): CustomerInventoryBatchFormValues {
  return applyCustomerInventoryProcessingFees({
    fees,
    values: {
      ...values,
      pricingTaxIncluded,
    },
  })
}

export function createCustomerInventoryBatchPricingFeesState(
  input: CustomerInventoryBatchFormPricingStateInput,
): CustomerInventoryBatchFormValuesUpdateState {
  return {
    values: updateCustomerInventoryBatchPricingWithFees(input),
  }
}

export function createCustomerInventoryBatchRowFromStockItem({
  item,
  product,
}: {
  item: CustomerInventoryStockItem
  product?: CustomerInventoryBatchRowProductSnapshot
}): CustomerInventoryBatchRow {
  return {
    color: item.color,
    lengthMm: String(item.lengthMm),
    moldCode: product?.moldCode ?? item.moldCode,
    note: item.note,
    productId: item.productId ?? "",
    productName: product?.productName ?? item.productName,
    quantity: String(item.quantity),
    thicknessMmX100: product?.thicknessMmX100 ?? 0,
    weightPerMeterKgX1000: product?.weightPerMeterKgX1000 ?? 0,
  }
}

export function createCustomerInventoryBatchRowsFromBatch({
  batch,
  products,
}: {
  batch: CustomerInventoryBatch
  products: readonly CustomerInventoryBatchRowProductSelection[]
}): CustomerInventoryBatchRow[] {
  return batch.items.map((item) =>
    createCustomerInventoryBatchRowFromStockItem({
      item,
      product:
        products.find((product) => product.id === item.productId) ??
        undefined,
    }),
  )
}

export function clearCustomerInventoryBatchRowProduct(
  row: CustomerInventoryBatchRow,
): CustomerInventoryBatchRow {
  return {
    ...row,
    moldCode: "",
    productId: "",
    productName: "",
    thicknessMmX100: 0,
    weightPerMeterKgX1000: 0,
  }
}

export function clearCustomerInventoryBatchRowProducts(
  rows: CustomerInventoryBatchRow[],
): CustomerInventoryBatchRow[] {
  return rows.map((row) => clearCustomerInventoryBatchRowProduct(row))
}

export function appendCustomerInventoryBatchRow(
  rows: CustomerInventoryBatchRow[],
): CustomerInventoryBatchRow[] {
  return [...rows, { ...defaultCustomerInventoryBatchRow }]
}

export function appendCustomerInventoryBatchRowState(
  rows: CustomerInventoryBatchRow[],
): CustomerInventoryBatchRowsOnlyUpdateState {
  return {
    rows: appendCustomerInventoryBatchRow(rows),
  }
}

export function removeCustomerInventoryBatchRow({
  rowIndex,
  rows,
}: {
  rowIndex: number
  rows: CustomerInventoryBatchRow[]
}): CustomerInventoryBatchRow[] {
  return rows.filter((_, index) => index !== rowIndex)
}

export function removeCustomerInventoryBatchRowState({
  rowIndex,
  rows,
}: {
  rowIndex: number
  rows: CustomerInventoryBatchRow[]
}): CustomerInventoryBatchRowsOnlyUpdateState {
  return {
    rows: removeCustomerInventoryBatchRow({ rowIndex, rows }),
  }
}

export function applyCustomerInventoryBatchRowProduct({
  product,
  row,
}: {
  product?: CustomerInventoryBatchRowProductSelection
  row: CustomerInventoryBatchRow
}): CustomerInventoryBatchRow {
  return {
    ...row,
    moldCode: product?.moldCode ?? "",
    productId: product?.id ?? "",
    productName: product?.productName ?? "",
    thicknessMmX100: product?.thicknessMmX100 ?? 0,
    weightPerMeterKgX1000: product?.weightPerMeterKgX1000 ?? 0,
  }
}

export function applyCustomerInventoryBatchRowProductAtIndex({
  product,
  rowIndex,
  rows,
}: {
  product?: CustomerInventoryBatchRowProductSelection
  rowIndex: number
  rows: CustomerInventoryBatchRow[]
}): CustomerInventoryBatchRow[] {
  return rows.map((row, index) =>
    index === rowIndex
      ? applyCustomerInventoryBatchRowProduct({ product, row })
      : row,
  )
}

export function updateCustomerInventoryBatchRowField({
  field,
  rowIndex,
  rows,
  value,
}: {
  field: CustomerInventoryDetailInputField
  rowIndex: number
  rows: CustomerInventoryBatchRow[]
  value: string
}): CustomerInventoryBatchRow[] {
  return rows.map((row, index) =>
    index === rowIndex ? { ...row, [field]: value } : row,
  )
}

function getCustomerInventoryBatchRowErrorKey(
  rowIndex: number,
  field: CustomerInventoryDetailInputField | "productId",
) {
  return `row-${rowIndex}-${field}`
}

export function updateCustomerInventoryBatchRowFieldState({
  errors,
  field,
  rowIndex,
  rows,
  value,
}: {
  errors: CustomerInventoryBatchErrors
  field: CustomerInventoryDetailInputField
  rowIndex: number
  rows: CustomerInventoryBatchRow[]
  value: string
}): CustomerInventoryBatchRowsUpdateState {
  return {
    errors: clearCustomerInventoryBatchFormError(
      errors,
      getCustomerInventoryBatchRowErrorKey(rowIndex, field),
    ),
    rows: updateCustomerInventoryBatchRowField({
      field,
      rowIndex,
      rows,
      value,
    }),
  }
}

export function applyCustomerInventoryBatchRowProductState({
  errors,
  product,
  rowIndex,
  rows,
}: {
  errors: CustomerInventoryBatchErrors
  product?: CustomerInventoryBatchRowProductSelection
  rowIndex: number
  rows: CustomerInventoryBatchRow[]
}): CustomerInventoryBatchRowsUpdateState {
  return {
    errors: clearCustomerInventoryBatchFormError(
      errors,
      getCustomerInventoryBatchRowErrorKey(rowIndex, "productId"),
    ),
    rows: applyCustomerInventoryBatchRowProductAtIndex({
      product,
      rowIndex,
      rows,
    }),
  }
}

export function getNextCustomerInventoryDetailFocusTarget({
  field,
  rowCount,
  rowIndex,
}: {
  field: CustomerInventoryDetailInputField
  rowCount: number
  rowIndex: number
}): CustomerInventoryDetailFocusTarget {
  if (field === "lengthMm") {
    return { field: "color", rowIndex, shouldAppendRow: false }
  }

  if (field === "color") {
    return { field: "quantity", rowIndex, shouldAppendRow: false }
  }

  if (field === "quantity") {
    return { field: "note", rowIndex, shouldAppendRow: false }
  }

  return {
    field: "product",
    rowIndex: rowIndex + 1,
    shouldAppendRow: rowIndex + 1 >= rowCount,
  }
}
