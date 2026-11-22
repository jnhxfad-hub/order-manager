import {
  getMergedDeliveryNoteCustomerName,
  selectDeliveredOrderGroupsByDeliveryNoteIds,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils"
import type {
  DeliveryNote,
  MergedDeliveryNote,
} from "@/features/inventory/types"
import { createEmptyDeliveryNoteFormErrorState } from "./inventory-dialog-state-delivery-note"
import { defaultMergeDeliveryNoteDialogValues } from "./inventory-dialog-state-forms"
import type {
  MergeDeliveryNoteDialogApplyState,
  MergeDeliveryNoteDialogCloseState,
  MergeDeliveryNoteDialogOpenState,
  MergeDeliveryNoteDialogValues,
  MergeDeliveryNoteGroupUpdateState,
  MergeDeliveryNotePreviewSuccessState,
  MergeDeliveryNoteSelectionApplyState,
  MergeDeliveryNoteSelectionState,
  MergeDeliveryNoteSpecialNoteUpdateState,
  MergeDeliveryNoteSubmitRequestState,
  MergeDeliveryNoteSubmitState,
} from "./inventory-dialog-state-types"

export function createMergeDeliveryNoteIds(
  selectedGroup: OrderInventoryGroup | null | undefined,
) {
  return selectedGroup?.deliveryNoteId ? [selectedGroup.deliveryNoteId] : []
}

export function createMergeDeliveryNoteDialogValues(
  selectedGroup: OrderInventoryGroup | null | undefined,
): MergeDeliveryNoteDialogValues {
  return {
    customGroupsByDeliveryNoteId: {},
    deliveryNoteIds: createMergeDeliveryNoteIds(selectedGroup),
    specialNote: "",
  }
}

export function mergeDeliveryNoteGroupsWithNoteDefaults({
  groups,
  notes,
}: {
  groups: Record<string, string>
  notes: DeliveryNote[]
}) {
  const nextGroups = { ...groups }

  for (const deliveryNote of notes) {
    if (!Object.prototype.hasOwnProperty.call(nextGroups, deliveryNote.id)) {
      nextGroups[deliveryNote.id] = deliveryNote.note.trim()
    }
  }

  return nextGroups
}

export function createMergeDeliveryNoteDialogApplyState(
  values: MergeDeliveryNoteDialogValues,
): MergeDeliveryNoteDialogApplyState {
  return {
    ...values,
    errors: {},
  }
}

export function createEmptyMergeDeliveryNoteDialogApplyState(): MergeDeliveryNoteDialogApplyState {
  return createMergeDeliveryNoteDialogApplyState(
    defaultMergeDeliveryNoteDialogValues,
  )
}

export function createMergeDeliveryNoteDialogOpenState(
  values: MergeDeliveryNoteDialogValues,
): MergeDeliveryNoteDialogOpenState {
  return {
    currentDeliveryNote: null,
    currentMergedDeliveryNote: null,
    dialogApplyState: createMergeDeliveryNoteDialogApplyState(values),
    mergeOpen: true,
  }
}

export function createMergeDeliveryNoteDialogCloseState(): MergeDeliveryNoteDialogCloseState {
  return {
    dialogApplyState: createEmptyMergeDeliveryNoteDialogApplyState(),
    mergeOpen: false,
  }
}

export function updateMergeDeliveryNoteGroupLabel({
  deliveryNoteId,
  groups,
  value,
}: {
  deliveryNoteId: string
  groups: Record<string, string>
  value: string
}): Record<string, string> {
  return {
    ...groups,
    [deliveryNoteId]: value,
  }
}

export function updateMergeDeliveryNoteGroupLabelState({
  deliveryNoteId,
  groups,
  value,
}: {
  deliveryNoteId: string
  groups: Record<string, string>
  value: string
}): MergeDeliveryNoteGroupUpdateState {
  return {
    customGroupsByDeliveryNoteId: updateMergeDeliveryNoteGroupLabel({
      deliveryNoteId,
      groups,
      value,
    }),
  }
}

export function updateMergeDeliveryNoteSpecialNoteState(
  value: string,
): MergeDeliveryNoteSpecialNoteUpdateState {
  return {
    specialNote: value,
  }
}

export function toggleMergeDeliveryNoteSelection({
  checked,
  currentIds,
  deliveryNoteId,
  groupsByDeliveryNoteId,
}: {
  checked: boolean
  currentIds: string[]
  deliveryNoteId: string
  groupsByDeliveryNoteId: Map<string, OrderInventoryGroup>
}): MergeDeliveryNoteSelectionState {
  const group = groupsByDeliveryNoteId.get(deliveryNoteId)

  if (!group) {
    return {
      deliveryNoteIds: currentIds,
      error: null,
    }
  }

  if (!checked) {
    return {
      deliveryNoteIds: currentIds.filter((id) => id !== deliveryNoteId),
      error: null,
    }
  }

  const selectedGroups = selectDeliveredOrderGroupsByDeliveryNoteIds(
    groupsByDeliveryNoteId,
    currentIds,
  )

  if (!getMergedDeliveryNoteCustomerName([...selectedGroups, group])) {
    return {
      deliveryNoteIds: currentIds,
      error: "只能选择同一客户的出库单",
    }
  }

  return {
    deliveryNoteIds: currentIds.includes(deliveryNoteId)
      ? currentIds
      : [...currentIds, deliveryNoteId],
    error: null,
  }
}

export function createMergeDeliveryNoteSelectionApplyState({
  checked,
  currentIds,
  deliveryNoteId,
  groupsByDeliveryNoteId,
}: {
  checked: boolean
  currentIds: string[]
  deliveryNoteId: string
  groupsByDeliveryNoteId: Map<string, OrderInventoryGroup>
}): MergeDeliveryNoteSelectionApplyState {
  const nextState = toggleMergeDeliveryNoteSelection({
    checked,
    currentIds,
    deliveryNoteId,
    groupsByDeliveryNoteId,
  })

  return {
    deliveryNoteIds: nextState.deliveryNoteIds,
    errors: nextState.error ? { form: nextState.error } : {},
  }
}

export function createMergeDeliveryNotePreviewSuccessState(
  mergedDeliveryNote: MergedDeliveryNote,
): MergeDeliveryNotePreviewSuccessState {
  return {
    currentDeliveryNote: null,
    currentMergedDeliveryNote: mergedDeliveryNote,
    mergeOpen: false,
    printOpen: true,
  }
}

export function createMergeDeliveryNoteSubmitRequestState(): MergeDeliveryNoteSubmitRequestState {
  return createEmptyDeliveryNoteFormErrorState()
}

export function collectMergeDeliveryNoteSubmitState({
  deliveryNoteIds,
  groupsByDeliveryNoteId,
}: {
  deliveryNoteIds: string[]
  groupsByDeliveryNoteId: Map<string, OrderInventoryGroup>
}): MergeDeliveryNoteSubmitState {
  const selectedGroups = selectDeliveredOrderGroupsByDeliveryNoteIds(
    groupsByDeliveryNoteId,
    deliveryNoteIds,
  )

  if (selectedGroups.length < 2) {
    return {
      errors: { form: "请选择至少 2 张出库单" },
      selectedGroups,
    }
  }

  if (!getMergedDeliveryNoteCustomerName(selectedGroups)) {
    return {
      errors: { form: "只能选择同一客户的出库单" },
      selectedGroups,
    }
  }

  return {
    errors: {},
    selectedGroups,
  }
}
