import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";

import { getDeliveryNote } from "@/features/inventory/api/inventory-api";
import {
  collectMergeDeliveryNoteSubmitState,
  createMergeDeliveryNoteDialogCloseState,
  createMergeDeliveryNoteDialogOpenState,
  createMergeDeliveryNoteDialogValues,
  createMergeDeliveryNotePreviewSuccessState,
  createMergeDeliveryNoteSelectionApplyState,
  createMergeDeliveryNoteSubmitRequestState,
  mergeDeliveryNoteGroupsWithNoteDefaults,
  updateMergeDeliveryNoteGroupLabelState,
  updateMergeDeliveryNoteSpecialNoteState,
  type DeliveryNoteFormErrors,
  type MergeDeliveryNoteDialogApplyState,
  type MergeDeliveryNoteGroupUpdateState,
  type MergeDeliveryNotePreviewSuccessState,
  type MergeDeliveryNoteSelectionApplyState,
  type MergeDeliveryNoteSpecialNoteUpdateState,
  type MergeDeliveryNoteSubmitRequestState,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  buildMergedDeliveryNotePreview,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils";
import type {
  DeliveryNote,
  MergedDeliveryNote,
} from "@/features/inventory/types";

export interface UseMergeDeliveryNoteOptions {
  deliveredOrderGroupsByDeliveryNoteId: Map<string, OrderInventoryGroup>;
  onDeliveryNoteError: (error: unknown) => void;
  onPreviewSuccess: (state: MergeDeliveryNotePreviewSuccessState) => void;
  selectedOrderGroup: OrderInventoryGroup | undefined;
  setCurrentDeliveryNote: (note: DeliveryNote | null) => void;
  setCurrentMergedDeliveryNote: (note: MergedDeliveryNote | null) => void;
  setDeliveryNoteErrors: (errors: DeliveryNoteFormErrors) => void;
  setMergeDeliveryNoteOpen: (open: boolean) => void;
}

export function useMergeDeliveryNote({
  deliveredOrderGroupsByDeliveryNoteId,
  onDeliveryNoteError,
  onPreviewSuccess,
  selectedOrderGroup,
  setCurrentDeliveryNote,
  setCurrentMergedDeliveryNote,
  setDeliveryNoteErrors,
  setMergeDeliveryNoteOpen,
}: UseMergeDeliveryNoteOptions) {
  const [mergeDeliveryNoteIds, setMergeDeliveryNoteIds] = useState<string[]>(
    [],
  );
  const [mergeDeliveryNoteGroups, setMergeDeliveryNoteGroups] = useState<
    Record<string, string>
  >({});
  const [mergeDeliveryNoteSpecialNote, setMergeDeliveryNoteSpecialNote] =
    useState("");

  const mergeDeliveryNoteMutation = useMutation({
    mutationFn: async ({
      customGroupsByDeliveryNoteId,
      deliveryNoteIds,
      specialNote,
    }: {
      customGroupsByDeliveryNoteId: Record<string, string>;
      deliveryNoteIds: string[];
      specialNote: string;
    }) => {
      const notes = await Promise.all(
        deliveryNoteIds.map((id) => getDeliveryNote(id)),
      );
      const resolvedCustomGroups = mergeDeliveryNoteGroupsWithNoteDefaults({
        groups: customGroupsByDeliveryNoteId,
        notes,
      });
      const { errorMessage, mergedDeliveryNote } = buildMergedDeliveryNotePreview({
        customGroupsByDeliveryNoteId: resolvedCustomGroups,
        notes,
        specialNote: specialNote.trim(),
      });

      if (!mergedDeliveryNote) {
        throw new Error(errorMessage ?? "无法生成合并出库单");
      }

      return mergedDeliveryNote;
    },
    onError: (error) => {
      onDeliveryNoteError(error);
    },
    onSuccess: (mergedDeliveryNote) => {
      const successState =
        createMergeDeliveryNotePreviewSuccessState(mergedDeliveryNote);

      onPreviewSuccess(successState);
    },
  });

  function applyMergeDeliveryNoteDialogState(
    state: MergeDeliveryNoteDialogApplyState,
  ) {
    setDeliveryNoteErrors(state.errors);
    setMergeDeliveryNoteGroups(state.customGroupsByDeliveryNoteId);
    setMergeDeliveryNoteIds(state.deliveryNoteIds);
    setMergeDeliveryNoteSpecialNote(state.specialNote);
  }

  function applyMergeDeliveryNoteSelectionState(
    state: MergeDeliveryNoteSelectionApplyState,
  ) {
    setDeliveryNoteErrors(state.errors);
    setMergeDeliveryNoteIds(state.deliveryNoteIds);
  }

  function applyMergeDeliveryNoteGroupUpdateState(
    state: MergeDeliveryNoteGroupUpdateState,
  ) {
    setMergeDeliveryNoteGroups(state.customGroupsByDeliveryNoteId);
  }

  function applyMergeDeliveryNoteSpecialNoteUpdateState(
    state: MergeDeliveryNoteSpecialNoteUpdateState,
  ) {
    setMergeDeliveryNoteSpecialNote(state.specialNote);
  }

  function applyMergeDeliveryNoteSubmitRequestState(
    state: MergeDeliveryNoteSubmitRequestState,
  ) {
    setDeliveryNoteErrors(state.errors);
  }

  function openMergeDeliveryNoteDialog() {
    const values = createMergeDeliveryNoteDialogValues(selectedOrderGroup);
    const state = createMergeDeliveryNoteDialogOpenState(values);

    mergeDeliveryNoteMutation.reset();
    setCurrentDeliveryNote(state.currentDeliveryNote);
    setCurrentMergedDeliveryNote(state.currentMergedDeliveryNote);
    applyMergeDeliveryNoteDialogState(state.dialogApplyState);
    setMergeDeliveryNoteOpen(state.mergeOpen);
    values.deliveryNoteIds.forEach((id) => {
      void syncMergeDeliveryNoteGroupFromNote(id);
    });
  }

  function handleMergeDeliveryNoteOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setMergeDeliveryNoteOpen(nextOpen);
      return;
    }

    const state = createMergeDeliveryNoteDialogCloseState();

    setMergeDeliveryNoteOpen(state.mergeOpen);
    mergeDeliveryNoteMutation.reset();
    applyMergeDeliveryNoteDialogState(state.dialogApplyState);
  }

  function toggleMergeDeliveryNote(id: string, checked: boolean) {
    mergeDeliveryNoteMutation.reset();
    const nextState = createMergeDeliveryNoteSelectionApplyState({
      checked,
      currentIds: mergeDeliveryNoteIds,
      deliveryNoteId: id,
      groupsByDeliveryNoteId: deliveredOrderGroupsByDeliveryNoteId,
    });

    applyMergeDeliveryNoteSelectionState(nextState);
    if (checked && nextState.deliveryNoteIds.includes(id)) {
      void syncMergeDeliveryNoteGroupFromNote(id);
    }
  }

  async function syncMergeDeliveryNoteGroupFromNote(id: string) {
    try {
      const deliveryNote = await getDeliveryNote(id);

      setMergeDeliveryNoteGroups((groups) =>
        mergeDeliveryNoteGroupsWithNoteDefaults({
          groups,
          notes: [deliveryNote],
        }),
      );
    } catch (error) {
      onDeliveryNoteError(error);
    }
  }

  function updateMergeDeliveryNoteGroup(id: string, value: string) {
    const nextState = updateMergeDeliveryNoteGroupLabelState({
      deliveryNoteId: id,
      groups: mergeDeliveryNoteGroups,
      value,
    });

    applyMergeDeliveryNoteGroupUpdateState(nextState);
  }

  function updateMergeDeliveryNoteSpecialNote(value: string) {
    applyMergeDeliveryNoteSpecialNoteUpdateState(
      updateMergeDeliveryNoteSpecialNoteState(value),
    );
  }

  function submitMergeDeliveryNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mergeDeliveryNoteMutation.reset();
    applyMergeDeliveryNoteSubmitRequestState(
      createMergeDeliveryNoteSubmitRequestState(),
    );

    const { errors } = collectMergeDeliveryNoteSubmitState({
      deliveryNoteIds: mergeDeliveryNoteIds,
      groupsByDeliveryNoteId: deliveredOrderGroupsByDeliveryNoteId,
    });

    if (errors.form) {
      setDeliveryNoteErrors(errors);
      return;
    }

    mergeDeliveryNoteMutation.mutate({
      customGroupsByDeliveryNoteId: mergeDeliveryNoteGroups,
      deliveryNoteIds: mergeDeliveryNoteIds,
      specialNote: mergeDeliveryNoteSpecialNote,
    });
  }

  return {
    handleMergeDeliveryNoteOpenChange,
    mergeDeliveryNoteGroups,
    mergeDeliveryNoteIds,
    mergeDeliveryNoteMutation,
    mergeDeliveryNoteSpecialNote,
    openMergeDeliveryNoteDialog,
    submitMergeDeliveryNote,
    toggleMergeDeliveryNote,
    updateMergeDeliveryNoteGroup,
    updateMergeDeliveryNoteSpecialNote,
  };
}
