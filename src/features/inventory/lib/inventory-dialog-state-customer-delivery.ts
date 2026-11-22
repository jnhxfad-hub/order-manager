import {
  deliveryWeightFields,
  buildCustomerInventoryDeliveryPriceGroups,
  getCustomerInventoryDeliveryCreateResult,
  getRequiredCustomerInventoryDeliveryPriceGroupWeightFields,
  groupCustomerInventoryBatchesByPrice,
  type CustomerInventoryDeliveryPriceGroupSource,
  type CustomerInventoryDeliveryPriceGroupView,
  type CustomerInventoryDeliveryRow,
} from "@/features/inventory/lib/inventory-utils"
import type {
  CustomerInventoryBatch,
  DeliveryNote,
} from "@/features/inventory/types"
import type { ProcessingCategory } from "@/lib/processing-fees"
import { clearDeliveryNoteFormError } from "./inventory-dialog-state-delivery-note"
import { defaultDeliveryNoteFormValues } from "./inventory-dialog-state-forms"
import type {
  CustomerInventoryDeliveryBatchSelectionInput,
  CustomerInventoryDeliveryBatchSelectionState,
  CustomerInventoryDeliveryCreateSuccessState,
  CustomerInventoryDeliveryDialogApplyState,
  CustomerInventoryDeliveryDialogCloseState,
  CustomerInventoryDeliveryDialogOpenState,
  CustomerInventoryDeliveryDialogState,
  CustomerInventoryDeliveryDialogValues,
  CustomerInventoryDeliveryFocusRequest,
  CustomerInventoryDeliveryFocusTarget,
  CustomerInventoryDeliveryRowsOnlyUpdateState,
  CustomerInventoryDeliveryRowsUpdateState,
  CustomerInventoryDeliverySuccessDialogState,
  DeliveryNoteFormErrors,
  DeliveryNoteFormValues,
} from "./inventory-dialog-state-types"

export function createCustomerInventoryDeliveryRows(
  batches: CustomerInventoryBatch[],
): CustomerInventoryDeliveryRow[] {
  return batches.flatMap((batch) =>
    batch.items
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        batchId: batch.id,
        batchNote: batch.note,
        color: item.color,
        currentQuantity: item.quantity,
        groupLabel: "",
        lengthMm: item.lengthMm,
        moldCode: item.moldCode,
        note: item.note,
        productName: item.productName,
        quantity: "",
        stockId: item.id,
      })),
  )
}

export function selectCustomerInventoryBatchesByIds(
  batches: CustomerInventoryBatch[],
  batchIds: string[],
): CustomerInventoryBatch[] {
  return batchIds
    .map((batchId) => batches.find((batch) => batch.id === batchId))
    .filter((batch): batch is CustomerInventoryBatch => Boolean(batch))
}

export function toggleCustomerInventoryDeliveryBatchId({
  batchId,
  checked,
  selectedBatchIds,
}: CustomerInventoryDeliveryBatchSelectionInput): string[] {
  if (!checked) {
    return selectedBatchIds.filter((selectedBatchId) => selectedBatchId !== batchId)
  }

  return selectedBatchIds.includes(batchId)
    ? selectedBatchIds
    : [...selectedBatchIds, batchId]
}

export function toggleCustomerInventoryDeliveryBatchSelectionState(
  input: CustomerInventoryDeliveryBatchSelectionInput,
): CustomerInventoryDeliveryBatchSelectionState {
  return {
    selectedBatchIds: toggleCustomerInventoryDeliveryBatchId(input),
  }
}

export function fillCustomerInventoryDeliveryCurrentQuantities(
  rows: CustomerInventoryDeliveryRow[],
): CustomerInventoryDeliveryRow[] {
  return rows.map((row) => ({
    ...row,
    quantity: String(row.currentQuantity),
  }))
}

export function clearCustomerInventoryDeliveryQuantities(
  rows: CustomerInventoryDeliveryRow[],
): CustomerInventoryDeliveryRow[] {
  return rows.map((row) => ({
    ...row,
    quantity: "",
  }))
}

export function clearCustomerInventoryDeliveryRowErrors(
  errors: DeliveryNoteFormErrors,
  rows: CustomerInventoryDeliveryRow[],
): DeliveryNoteFormErrors {
  const next = { ...errors }

  for (const row of rows) {
    next[row.stockId] = undefined
  }

  next.form = undefined
  return next
}

export function fillCustomerInventoryDeliveryQuantityState({
  errors,
  rows,
}: {
  errors: DeliveryNoteFormErrors
  rows: CustomerInventoryDeliveryRow[]
}): CustomerInventoryDeliveryRowsUpdateState {
  return {
    errors: clearCustomerInventoryDeliveryRowErrors(errors, rows),
    rows: fillCustomerInventoryDeliveryCurrentQuantities(rows),
  }
}

export function clearCustomerInventoryDeliveryQuantityState({
  errors,
  rows,
}: {
  errors: DeliveryNoteFormErrors
  rows: CustomerInventoryDeliveryRow[]
}): CustomerInventoryDeliveryRowsUpdateState {
  return {
    errors: clearCustomerInventoryDeliveryRowErrors(errors, rows),
    rows: clearCustomerInventoryDeliveryQuantities(rows),
  }
}

export function updateCustomerInventoryDeliveryGroupLabel(
  rows: CustomerInventoryDeliveryRow[],
  batchId: string,
  groupLabel: string,
): CustomerInventoryDeliveryRow[] {
  return rows.map((row) =>
    row.batchId === batchId ? { ...row, groupLabel } : row,
  )
}

export function updateCustomerInventoryDeliveryGroupLabelState({
  batchId,
  errors,
  groupLabel,
  rows,
}: {
  batchId: string
  errors: DeliveryNoteFormErrors
  groupLabel: string
  rows: CustomerInventoryDeliveryRow[]
}): CustomerInventoryDeliveryRowsUpdateState {
  return {
    errors: clearDeliveryNoteFormError(
      errors,
      `batch-${batchId}-groupLabel`,
    ),
    rows: updateCustomerInventoryDeliveryGroupLabel(rows, batchId, groupLabel),
  }
}

export function updateCustomerInventoryDeliveryRowQuantity(
  rows: CustomerInventoryDeliveryRow[],
  stockId: string,
  quantity: string,
): CustomerInventoryDeliveryRow[] {
  return rows.map((row) =>
    row.stockId === stockId ? { ...row, quantity } : row,
  )
}

export function updateCustomerInventoryDeliveryRowQuantityState({
  errors,
  quantity,
  rows,
  stockId,
}: {
  errors: DeliveryNoteFormErrors
  quantity: string
  rows: CustomerInventoryDeliveryRow[]
  stockId: string
}): CustomerInventoryDeliveryRowsUpdateState {
  return {
    errors: clearDeliveryNoteFormError(errors, stockId),
    rows: updateCustomerInventoryDeliveryRowQuantity(rows, stockId, quantity),
  }
}

export function updateCustomerInventoryDeliveryRowNote(
  rows: CustomerInventoryDeliveryRow[],
  stockId: string,
  note: string,
): CustomerInventoryDeliveryRow[] {
  return rows.map((row) => (row.stockId === stockId ? { ...row, note } : row))
}

export function updateCustomerInventoryDeliveryRowNoteState({
  note,
  rows,
  stockId,
}: {
  note: string
  rows: CustomerInventoryDeliveryRow[]
  stockId: string
}): CustomerInventoryDeliveryRowsOnlyUpdateState {
  return {
    rows: updateCustomerInventoryDeliveryRowNote(rows, stockId, note),
  }
}

type CustomerInventoryDeliveryWeightField =
  (typeof deliveryWeightFields)[number]

type CustomerInventoryDeliveryFocusContext = {
  priceGroups: CustomerInventoryDeliveryPriceGroupView[]
  requiredWeights: Record<ProcessingCategory, boolean>
  rows: CustomerInventoryDeliveryRow[]
  visibleWeightFields: readonly CustomerInventoryDeliveryWeightField[]
}

function getFirstCustomerInventoryDeliveryRowOrNoteTarget(
  rows: CustomerInventoryDeliveryRow[],
): CustomerInventoryDeliveryFocusTarget {
  if (rows[0]) {
    return {
      field: "quantity",
      kind: "row",
      rowIndex: 0,
    }
  }

  return {
    field: "delivery-note",
    kind: "field",
  }
}

function getFirstCustomerInventoryDeliveryWeightOrRowTarget({
  requiredWeights,
  rows,
  visibleWeightFields,
}: CustomerInventoryDeliveryFocusContext): CustomerInventoryDeliveryFocusTarget {
  const firstWeightField = visibleWeightFields.find(
    (field) => requiredWeights[field.category],
  )

  if (firstWeightField) {
    return {
      field: firstWeightField.key,
      kind: "field",
    }
  }

  return getFirstCustomerInventoryDeliveryRowOrNoteTarget(rows)
}

function getCustomerInventoryDeliveryPriceGroupStartTarget({
  priceGroupIndex,
  priceGroups,
  rows,
}: Pick<CustomerInventoryDeliveryFocusContext, "priceGroups" | "rows"> & {
  priceGroupIndex: number
}): CustomerInventoryDeliveryFocusTarget {
  const priceGroup = priceGroups[priceGroupIndex]

  if (!priceGroup) {
    return getFirstCustomerInventoryDeliveryRowOrNoteTarget(rows)
  }

  const firstField =
    getRequiredCustomerInventoryDeliveryPriceGroupWeightFields(priceGroup)[0]

  if (firstField) {
    return {
      field: firstField.key,
      kind: "price-group-weight",
      priceGroupKey: priceGroup.key,
    }
  }

  return {
    field: "extraChargeName",
    kind: "price-group-field",
    priceGroupKey: priceGroup.key,
  }
}

function getCustomerInventoryDeliveryAfterPriceGroupTarget({
  priceGroupIndex,
  priceGroups,
  rows,
}: Pick<CustomerInventoryDeliveryFocusContext, "priceGroups" | "rows"> & {
  priceGroupIndex: number
}): CustomerInventoryDeliveryFocusTarget {
  if (priceGroupIndex + 1 < priceGroups.length) {
    return getCustomerInventoryDeliveryPriceGroupStartTarget({
      priceGroupIndex: priceGroupIndex + 1,
      priceGroups,
      rows,
    })
  }

  return getFirstCustomerInventoryDeliveryRowOrNoteTarget(rows)
}

export function getNextCustomerInventoryDeliveryFocusTarget(
  request: CustomerInventoryDeliveryFocusRequest,
  context: CustomerInventoryDeliveryFocusContext,
): CustomerInventoryDeliveryFocusTarget {
  if (request.kind === "handler") {
    if (context.priceGroups.length > 1) {
      return getCustomerInventoryDeliveryPriceGroupStartTarget({
        priceGroupIndex: 0,
        priceGroups: context.priceGroups,
        rows: context.rows,
      })
    }

    return {
      field: "extraChargeName",
      kind: "field",
    }
  }

  if (request.kind === "extra-charge") {
    if (request.field === "extraChargeName") {
      return {
        field: "extraChargeAmount",
        kind: "field",
      }
    }

    return getFirstCustomerInventoryDeliveryWeightOrRowTarget(context)
  }

  if (request.kind === "price-group-extra-charge") {
    const priceGroup = context.priceGroups[request.priceGroupIndex]

    if (!priceGroup) {
      return getFirstCustomerInventoryDeliveryRowOrNoteTarget(context.rows)
    }

    if (request.field === "extraChargeName") {
      return {
        field: "extraChargeAmount",
        kind: "price-group-field",
        priceGroupKey: priceGroup.key,
      }
    }

    return getCustomerInventoryDeliveryAfterPriceGroupTarget({
      priceGroupIndex: request.priceGroupIndex,
      priceGroups: context.priceGroups,
      rows: context.rows,
    })
  }

  if (request.kind === "row") {
    if (
      request.field === "quantity" &&
      request.rowIndex + 1 < context.rows.length
    ) {
      return {
        field: "quantity",
        kind: "row",
        rowIndex: request.rowIndex + 1,
      }
    }

    if (request.field === "quantity") {
      return {
        field: "note",
        kind: "row",
        rowIndex: 0,
      }
    }

    if (request.rowIndex + 1 < context.rows.length) {
      return {
        field: "note",
        kind: "row",
        rowIndex: request.rowIndex + 1,
      }
    }

    return {
      field: "delivery-note",
      kind: "field",
    }
  }

  if (request.kind === "weight") {
    const nextField = context.visibleWeightFields
      .slice(request.fieldIndex + 1)
      .find((field) => context.requiredWeights[field.category])

    if (nextField) {
      return {
        field: nextField.key,
        kind: "field",
      }
    }

    return getFirstCustomerInventoryDeliveryRowOrNoteTarget(context.rows)
  }

  const currentPriceGroup = context.priceGroups[request.priceGroupIndex]

  if (!currentPriceGroup) {
    return getCustomerInventoryDeliveryAfterPriceGroupTarget({
      priceGroupIndex: request.priceGroupIndex,
      priceGroups: context.priceGroups,
      rows: context.rows,
    })
  }

  const nextField =
    getRequiredCustomerInventoryDeliveryPriceGroupWeightFields(
      currentPriceGroup,
    )[request.fieldIndex + 1]

  if (nextField) {
    return {
      field: nextField.key,
      kind: "price-group-weight",
      priceGroupKey: currentPriceGroup.key,
    }
  }

  return {
    field: "extraChargeName",
    kind: "price-group-field",
    priceGroupKey: currentPriceGroup.key,
  }
}

export function getFirstInvalidCustomerInventoryDeliveryFocusTarget({
  errors,
  hasMultiplePriceGroups,
  priceGroups,
  rows,
}: {
  errors: DeliveryNoteFormErrors
  hasMultiplePriceGroups: boolean
  priceGroups: CustomerInventoryDeliveryPriceGroupView[]
  rows: CustomerInventoryDeliveryRow[]
}): CustomerInventoryDeliveryFocusTarget | null {
  if (errors.handlerName) {
    return { field: "handler", kind: "field" }
  }

  if (hasMultiplePriceGroups) {
    for (const priceGroup of priceGroups) {
      for (const field of getRequiredCustomerInventoryDeliveryPriceGroupWeightFields(
        priceGroup,
      )) {
        if (errors[`${priceGroup.key}-${field.key}`]) {
          return {
            field: field.key,
            kind: "price-group-weight",
            priceGroupKey: priceGroup.key,
          }
        }
      }

      if (errors[`${priceGroup.key}-extraChargeName`]) {
        return {
          field: "extraChargeName",
          kind: "price-group-field",
          priceGroupKey: priceGroup.key,
        }
      }

      if (errors[`${priceGroup.key}-extraChargeAmount`]) {
        return {
          field: "extraChargeAmount",
          kind: "price-group-field",
          priceGroupKey: priceGroup.key,
        }
      }
    }
  } else {
    for (const field of deliveryWeightFields) {
      if (errors[field.key]) {
        return { field: field.key, kind: "field" }
      }
    }

    if (errors.extraChargeName) {
      return { field: "extraChargeName", kind: "field" }
    }

    if (errors.extraChargeAmount) {
      return { field: "extraChargeAmount", kind: "field" }
    }
  }

  const checkedBatchIds = new Set<string>()

  for (const row of rows) {
    if (checkedBatchIds.has(row.batchId)) {
      continue
    }

    checkedBatchIds.add(row.batchId)

    if (errors[`batch-${row.batchId}-groupLabel`]) {
      return { batchId: row.batchId, kind: "group-label" }
    }
  }

  for (const [index, row] of rows.entries()) {
    if (errors[row.stockId]) {
      return {
        field: "quantity",
        kind: "row",
        rowIndex: index,
      }
    }
  }

  if (errors.form) {
    if (rows.length > 0) {
      return {
        field: "quantity",
        kind: "row",
        rowIndex: 0,
      }
    }

    return {
      field: "delivery-note",
      kind: "field",
    }
  }

  return null
}

export function getCustomerInventoryDeliveryDialogState(
  batches: CustomerInventoryBatch[],
): CustomerInventoryDeliveryDialogState {
  const deliverableBatches = batches.filter((batch) => batch.totalQuantity > 0)
  const firstBatch = deliverableBatches[0] ?? null

  if (!firstBatch) {
    return {
      batches: [],
      errorMessage: "请选择有剩余库存的客户库存批次",
      firstBatch: null,
    }
  }

  if (
    deliverableBatches.some(
      (batch) => batch.customerId !== firstBatch.customerId,
    )
  ) {
    return {
      batches: [],
      errorMessage: "只能合并同一客户的库存批次",
      firstBatch: null,
    }
  }

  return {
    batches: deliverableBatches,
    errorMessage: null,
    firstBatch,
  }
}

export function createEmptyCustomerInventoryDeliveryDialogValues(
  defaultValues: DeliveryNoteFormValues = defaultDeliveryNoteFormValues,
): CustomerInventoryDeliveryDialogValues {
  return {
    errorMessage: null,
    formValues: { ...defaultValues },
    priceGroupFormValues: {},
    priceGroups: [],
    rows: [],
    selectedBatch: null,
    selectedBatches: [],
  }
}

export function createCustomerInventoryDeliveryDialogApplyState(
  values: CustomerInventoryDeliveryDialogValues,
): CustomerInventoryDeliveryDialogApplyState {
  return {
    errors: {},
    formValues: values.formValues,
    priceGroupFormValues: values.priceGroupFormValues,
    rows: values.rows,
    selectedBatch: values.selectedBatch,
    selectedBatches: values.selectedBatches,
  }
}

export function createEmptyCustomerInventoryDeliveryDialogApplyState(): CustomerInventoryDeliveryDialogApplyState {
  return createCustomerInventoryDeliveryDialogApplyState(
    createEmptyCustomerInventoryDeliveryDialogValues(),
  )
}

export function createCustomerInventoryDeliveryDialogOpenState(
  values: CustomerInventoryDeliveryDialogValues,
): CustomerInventoryDeliveryDialogOpenState {
  return {
    dialogApplyState: createCustomerInventoryDeliveryDialogApplyState(values),
    open: true,
  }
}

export function createCustomerInventoryDeliveryDialogCloseState(): CustomerInventoryDeliveryDialogCloseState {
  return {
    dialogApplyState: createEmptyCustomerInventoryDeliveryDialogApplyState(),
    open: false,
  }
}

export function createCustomerInventoryDeliverySuccessDialogState(): CustomerInventoryDeliverySuccessDialogState {
  return {
    deliveryOpen: false,
    dialogApplyState: createEmptyCustomerInventoryDeliveryDialogApplyState(),
    printOpen: true,
    selectedBatchIds: [],
  }
}

export function createCustomerInventoryDeliveryCreateSuccessState(
  deliveryNotes: DeliveryNote[],
): CustomerInventoryDeliveryCreateSuccessState {
  return {
    ...getCustomerInventoryDeliveryCreateResult(deliveryNotes),
    ...createCustomerInventoryDeliverySuccessDialogState(),
  }
}

export function createCustomerInventoryDeliveryDialogValues(
  batches: CustomerInventoryBatch[],
  defaultValues: DeliveryNoteFormValues = defaultDeliveryNoteFormValues,
): CustomerInventoryDeliveryDialogValues {
  const dialogState = getCustomerInventoryDeliveryDialogState(batches)

  if (dialogState.errorMessage || !dialogState.firstBatch) {
    return {
      ...createEmptyCustomerInventoryDeliveryDialogValues(defaultValues),
      errorMessage: dialogState.errorMessage,
    }
  }

  const rows = createCustomerInventoryDeliveryRows(dialogState.batches)
  const priceGroupSources = groupCustomerInventoryBatchesByPrice(
    dialogState.batches,
  )

  return {
    errorMessage: null,
    formValues: { ...defaultValues },
    priceGroupFormValues:
      createCustomerInventoryDeliveryPriceGroupFormValues(
        priceGroupSources,
        defaultValues,
      ),
    priceGroups: buildCustomerInventoryDeliveryPriceGroups(
      dialogState.batches,
      rows,
      priceGroupSources,
    ),
    rows,
    selectedBatch: dialogState.firstBatch,
    selectedBatches: dialogState.batches,
  }
}

export function createCustomerInventoryDeliveryPriceGroupFormValues(
  priceGroups: CustomerInventoryDeliveryPriceGroupSource[],
  defaultValues: DeliveryNoteFormValues = defaultDeliveryNoteFormValues,
) {
  return Object.fromEntries(
    priceGroups.map((group) => [group.key, { ...defaultValues }]),
  )
}
