import {
  deliveryWeightFields,
  getDeliveryNotePrintPreviewState,
  getInventoryDetailKey,
  getRequiredDeliveryWeights,
  type DeliveryNoteFormRow,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils"
import type { DeliveryNote } from "@/features/inventory/types"
import { parseIntegerInput } from "@/lib/number-input"
import { defaultDeliveryNoteFormValues } from "./inventory-dialog-state-forms"
import type {
  CustomerInventoryDeliveryFormFieldUpdateState,
  CustomerInventoryDeliveryPriceGroupFormFieldUpdateState,
  DeliveryNoteCreateSuccessState,
  DeliveryNoteDialogApplyState,
  DeliveryNoteDialogCloseState,
  DeliveryNoteDialogOpenState,
  DeliveryNoteDialogValues,
  DeliveryNoteFormErrorClearState,
  DeliveryNoteFormErrorState,
  DeliveryNoteFormErrors,
  DeliveryNoteFormFieldUpdateState,
  DeliveryNoteFormValues,
  DeliveryNotePrintPreviewRequestState,
  DeliveryNotePrintPreviewSuccessState,
  DeliveryNoteRowsUpdateState,
  DeliveryNoteSuccessDialogState,
  OrderInventoryQuantitySuggestionInput,
} from "./inventory-dialog-state-types"

export function createDeliveryNoteFormValues(
  group: OrderInventoryGroup,
): DeliveryNoteFormValues {
  return {
    ...defaultDeliveryNoteFormValues,
    note: deriveDeliveryNoteDefaultNote(group.orderNote),
    pricingTaxIncluded: group.pricingTaxIncluded,
  }
}

export function deriveDeliveryNoteDefaultNote(orderNote: string | null | undefined) {
  const normalizedOrderNote = orderNote ?? ""
  const delimiterIndex = normalizedOrderNote.search(/[，,]/)

  return delimiterIndex < 0
    ? ""
    : normalizedOrderNote.slice(delimiterIndex + 1).trim()
}

export function createEmptyDeliveryNoteDialogValues(): DeliveryNoteDialogValues {
  return {
    formValues: { ...defaultDeliveryNoteFormValues },
    rows: [],
  }
}

export function createDeliveryNoteDialogValues(
  group: OrderInventoryGroup,
): DeliveryNoteDialogValues {
  return {
    formValues: createDeliveryNoteFormValues(group),
    rows: createDeliveryNoteRows(group),
  }
}

export function createDeliveryNoteDialogApplyState(
  values: DeliveryNoteDialogValues,
): DeliveryNoteDialogApplyState {
  return {
    errors: {},
    formValues: values.formValues,
    rows: values.rows,
  }
}

export function createEmptyDeliveryNoteDialogApplyState(): DeliveryNoteDialogApplyState {
  return createDeliveryNoteDialogApplyState(createEmptyDeliveryNoteDialogValues())
}

export function createDeliveryNoteDialogOpenState(
  values: DeliveryNoteDialogValues,
): DeliveryNoteDialogOpenState {
  return {
    dialogApplyState: createDeliveryNoteDialogApplyState(values),
    open: true,
  }
}

export function createDeliveryNoteDialogCloseState(): DeliveryNoteDialogCloseState {
  return {
    dialogApplyState: createEmptyDeliveryNoteDialogApplyState(),
    open: false,
  }
}

export function createDeliveryNoteSuccessDialogState(): DeliveryNoteSuccessDialogState {
  const closeState = createDeliveryNoteDialogCloseState()

  return {
    dialogApplyState: closeState.dialogApplyState,
    open: closeState.open,
    printOpen: true,
  }
}

export function createDeliveryNoteCreateSuccessState(
  deliveryNote: DeliveryNote,
): DeliveryNoteCreateSuccessState {
  return {
    ...createDeliveryNoteSuccessDialogState(),
    currentDeliveryNote: deliveryNote,
  }
}

export function createDeliveryNotePrintPreviewSuccessState(
  deliveryNote: DeliveryNote,
): DeliveryNotePrintPreviewSuccessState {
  return {
    ...getDeliveryNotePrintPreviewState(deliveryNote),
    printOpen: true,
  }
}

export function createDeliveryNotePrintPreviewRequestState(): DeliveryNotePrintPreviewRequestState {
  return {
    currentMergedDeliveryNote: null,
    errors: {},
  }
}

export function updateDeliveryNoteFormField<
  Key extends keyof DeliveryNoteFormValues,
>({
  key,
  value,
  values,
}: {
  key: Key
  value: DeliveryNoteFormValues[Key]
  values: DeliveryNoteFormValues
}): DeliveryNoteFormValues {
  return {
    ...values,
    [key]: value,
  }
}

export function updateDeliveryNotePriceGroupFormField<
  Key extends keyof DeliveryNoteFormValues,
>({
  defaultValues = defaultDeliveryNoteFormValues,
  key,
  priceGroupFormValues,
  priceGroupKey,
  value,
}: {
  defaultValues?: DeliveryNoteFormValues
  key: Key
  priceGroupFormValues: Record<string, DeliveryNoteFormValues>
  priceGroupKey: string
  value: DeliveryNoteFormValues[Key]
}): Record<string, DeliveryNoteFormValues> {
  return {
    ...priceGroupFormValues,
    [priceGroupKey]: {
      ...defaultValues,
      ...(priceGroupFormValues[priceGroupKey] ?? {}),
      [key]: value,
    },
  }
}

export function clearDeliveryNoteFormError(
  errors: DeliveryNoteFormErrors,
  key: string,
): DeliveryNoteFormErrors {
  return {
    ...errors,
    [key]: undefined,
  }
}

export function createDeliveryNoteFormErrorState(
  message: string | null | undefined,
): DeliveryNoteFormErrorState {
  return {
    errors: {
      form: message ?? undefined,
    },
  }
}

export function createEmptyDeliveryNoteFormErrorState(): DeliveryNoteFormErrorClearState {
  return {
    errors: {},
  }
}

export function clearDeliveryNoteFormFieldErrorState({
  errors,
  key,
}: {
  errors: DeliveryNoteFormErrors
  key: string
}): DeliveryNoteFormErrorClearState {
  return {
    errors: clearDeliveryNoteFormError(errors, key),
  }
}

export function updateDeliveryNoteFormFieldState<
  Key extends keyof DeliveryNoteFormValues,
>({
  errors,
  key,
  value,
  values,
}: {
  errors: DeliveryNoteFormErrors
  key: Key
  value: DeliveryNoteFormValues[Key]
  values: DeliveryNoteFormValues
}): DeliveryNoteFormFieldUpdateState {
  return {
    errors: key === "extraCharges"
      ? Object.fromEntries(
          Object.entries(errors).filter(
            ([errorKey]) => !errorKey.startsWith("extraCharge") && errorKey !== "form",
          ),
        )
      : clearDeliveryNoteFormError(errors, key),
    values: updateDeliveryNoteFormField({ key, value, values }),
  }
}

export function updateCustomerInventoryDeliveryFormFieldState<
  Key extends keyof DeliveryNoteFormValues,
>({
  errors,
  key,
  value,
  values,
}: {
  errors: DeliveryNoteFormErrors
  key: Key
  value: DeliveryNoteFormValues[Key]
  values: DeliveryNoteFormValues
}): CustomerInventoryDeliveryFormFieldUpdateState {
  return updateDeliveryNoteFormFieldState({ errors, key, value, values })
}

export function updateCustomerInventoryDeliveryPriceGroupFormFieldState<
  Key extends keyof DeliveryNoteFormValues,
>({
  errors,
  key,
  priceGroupFormValues,
  priceGroupKey,
  value,
}: {
  errors: DeliveryNoteFormErrors
  key: Key
  priceGroupFormValues: Record<string, DeliveryNoteFormValues>
  priceGroupKey: string
  value: DeliveryNoteFormValues[Key]
}): CustomerInventoryDeliveryPriceGroupFormFieldUpdateState {
  const errorKey = `${priceGroupKey}-${String(key)}`

  return {
    errors: clearDeliveryNoteFormError(errors, errorKey),
    priceGroupFormValues: updateDeliveryNotePriceGroupFormField({
      key,
      priceGroupFormValues,
      priceGroupKey,
      value,
    }),
  }
}

export function getOrderInventoryQuantitySuggestion({
  currentQuantity,
  movementType,
  requiredQuantity,
}: OrderInventoryQuantitySuggestionInput) {
  if (movementType === "produce") {
    const remainingQuantity = Math.max(requiredQuantity - currentQuantity, 0)

    return remainingQuantity > 0 ? String(remainingQuantity) : ""
  }

  if (movementType === "ship") {
    return currentQuantity > 0 ? String(currentQuantity) : ""
  }

  return ""
}

export function createDeliveryNoteRows(
  group: OrderInventoryGroup,
): DeliveryNoteFormRow[] {
  return group.items
    .filter((item) => item.orderQuantity > 0)
    .map((item) => ({
      color: item.color,
      currentQuantity: item.orderQuantity,
      lengthMm: item.lengthMm,
      moldCode: item.moldCode,
      note: item.note,
      productId: item.productId,
      productName: item.productName,
      quantity: "",
      requiredQuantity: item.requiredQuantity,
    }))
}

export function fillDeliveryNoteCurrentQuantities(
  rows: DeliveryNoteFormRow[],
): DeliveryNoteFormRow[] {
  return rows.map((row) => ({
    ...row,
    quantity: String(row.currentQuantity),
  }))
}

export function clearDeliveryNoteQuantities(
  rows: DeliveryNoteFormRow[],
): DeliveryNoteFormRow[] {
  return rows.map((row) => ({
    ...row,
    quantity: "",
  }))
}

export function updateDeliveryNoteRow(
  rows: DeliveryNoteFormRow[],
  detailKey: string,
  updates: Partial<Pick<DeliveryNoteFormRow, "quantity" | "note">>,
): DeliveryNoteFormRow[] {
  return rows.map((row) =>
    getInventoryDetailKey(row) === detailKey ? { ...row, ...updates } : row,
  )
}

export function clearDeliveryNoteRowErrors(
  errors: DeliveryNoteFormErrors,
  rows: DeliveryNoteFormRow[],
): DeliveryNoteFormErrors {
  const next = { ...errors }

  for (const row of rows) {
    next[getInventoryDetailKey(row)] = undefined
  }

  next.form = undefined
  return next
}

export function updateDeliveryNoteRowState({
  detailKey,
  errors,
  rows,
  updates,
}: {
  detailKey: string
  errors: DeliveryNoteFormErrors
  rows: DeliveryNoteFormRow[]
  updates: Partial<Pick<DeliveryNoteFormRow, "quantity" | "note">>
}): DeliveryNoteRowsUpdateState {
  return {
    errors: clearDeliveryNoteFormError(errors, detailKey),
    rows: updateDeliveryNoteRow(rows, detailKey, updates),
  }
}

export function fillDeliveryNoteQuantityState({
  errors,
  rows,
}: {
  errors: DeliveryNoteFormErrors
  rows: DeliveryNoteFormRow[]
}): DeliveryNoteRowsUpdateState {
  return {
    errors: clearDeliveryNoteRowErrors(errors, rows),
    rows: fillDeliveryNoteCurrentQuantities(rows),
  }
}

export function clearDeliveryNoteQuantityState({
  errors,
  rows,
}: {
  errors: DeliveryNoteFormErrors
  rows: DeliveryNoteFormRow[]
}): DeliveryNoteRowsUpdateState {
  return {
    errors: clearDeliveryNoteRowErrors(errors, rows),
    rows: clearDeliveryNoteQuantities(rows),
  }
}

export function getDeliveryNoteTotalQuantity(rows: DeliveryNoteFormRow[]) {
  return rows.reduce((total, row) => {
    const quantity = parseIntegerInput(row.quantity)
    return quantity !== null && quantity > 0 ? total + quantity : total
  }, 0)
}

export function getDeliveryNoteTransferQuantity(rows: DeliveryNoteFormRow[]) {
  return rows.reduce((total, row) => {
    const quantity = parseIntegerInput(row.quantity)
    const outboundQuantity = quantity !== null && quantity > 0 ? quantity : 0
    return total + Math.max(row.currentQuantity - outboundQuantity, 0)
  }, 0)
}

export function getDeliveryWeightState(rows: DeliveryNoteFormRow[]) {
  const requiredWeights = getRequiredDeliveryWeights(rows)

  return {
    requiredWeights,
    visibleFields: deliveryWeightFields.filter(
      (field) => requiredWeights[field.category],
    ),
  }
}
