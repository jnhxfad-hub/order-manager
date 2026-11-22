import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

import {
  createDeliveryNote,
  getCustomerInventoryDeliveryNote,
  getDeliveryNote,
  updateCustomerInventoryDeliveryNoteSpecialNote,
  updateDeliveryNoteSpecialNote,
  type CreateDeliveryNotePayload,
} from "@/features/inventory/api/inventory-api";
import {
  clearDeliveryNoteFormFieldErrorState,
  clearDeliveryNoteQuantityState,
  collectDeliveryNoteSubmitState,
  createDeliveryNoteCreateSuccessState,
  createDeliveryNoteDialogCloseState,
  createDeliveryNoteDialogOpenState,
  createDeliveryNoteDialogValues,
  createDeliveryNoteFormErrorState,
  createDeliveryNotePrintPreviewRequestState,
  createDeliveryNotePrintPreviewSuccessState,
  defaultDeliveryNoteFormValues,
  fillDeliveryNoteQuantityState,
  getDeliveryNoteTotalQuantity,
  getDeliveryNoteTransferQuantity,
  getDeliveryWeightState,
  getFirstInvalidDeliveryNoteFocusTarget,
  updateDeliveryNoteFormFieldState,
  updateDeliveryNoteRowState,
  type DeliveryNoteCreateSuccessState,
  type DeliveryNoteDialogApplyState,
  type DeliveryNoteFormErrorClearState,
  type DeliveryNoteFormErrors,
  type DeliveryNoteFormFieldUpdateState,
  type DeliveryNoteFormValues,
  type DeliveryNotePrintPreviewRequestState,
  type DeliveryNotePrintPreviewSuccessState,
  type DeliveryNoteRowsUpdateState,
  type MergeDeliveryNotePreviewSuccessState,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  getDeliveryNoteNotice,
  type DeliveryNoteFocusTarget,
  type DeliveryNoteFormRow,
  type DeliveryNoteWeightKey,
  type InventoryNotice,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils";
import type {
  DeliveryNote,
  MergedDeliveryNote,
} from "@/features/inventory/types";
import { isTauriRuntime } from "@/lib/browser-runtime";
import { getErrorMessage } from "@/lib/errors";

export type DeliveryNotePreviewSource =
  | "order"
  | "customer"
  | "temporary-merge";

export interface UseDeliveryNoteOptions {
  onNotice: (notice: InventoryNotice) => void;
  selectedOrderGroup: OrderInventoryGroup | undefined;
  setMergeDeliveryNoteOpen: (open: boolean) => void;
}

export function useDeliveryNote({
  onNotice,
  selectedOrderGroup,
  setMergeDeliveryNoteOpen,
}: UseDeliveryNoteOptions) {
  const queryClient = useQueryClient();
  const [deliveryNoteOpen, setDeliveryNoteOpen] = useState(false);
  const [deliveryNotePrintOpen, setDeliveryNotePrintOpen] = useState(false);
  const [deliveryNoteFormValues, setDeliveryNoteFormValues] =
    useState<DeliveryNoteFormValues>(defaultDeliveryNoteFormValues);
  const [deliveryNoteRows, setDeliveryNoteRows] = useState<
    DeliveryNoteFormRow[]
  >([]);
  const [deliveryNoteErrors, setDeliveryNoteErrors] =
    useState<DeliveryNoteFormErrors>({});
  const [currentDeliveryNote, setCurrentDeliveryNote] =
    useState<DeliveryNote | null>(null);
  const [currentMergedDeliveryNote, setCurrentMergedDeliveryNote] =
    useState<MergedDeliveryNote | null>(null);
  const [deliveryNotePreviewSource, setDeliveryNotePreviewSource] =
    useState<DeliveryNotePreviewSource | null>(null);
  const [deliveryNotePreviewSpecialNote, setDeliveryNotePreviewSpecialNote] =
    useState("");
  const [
    savedDeliveryNotePreviewSpecialNote,
    setSavedDeliveryNotePreviewSpecialNote,
  ] = useState("");
  const [
    deliveryNotePreviewSpecialNoteEditorOpen,
    setDeliveryNotePreviewSpecialNoteEditorOpen,
  ] = useState(false);
  const keepDeliveryNoteErrorOnFocusRef = useRef(false);

  const createDeliveryNoteMutation = useMutation({
    mutationFn: (payload: CreateDeliveryNotePayload) =>
      createDeliveryNote(payload),
    onError: () => {
      focusDeliveryNoteTarget(findFirstInvalidDeliveryNoteField());
    },
    onSuccess: (deliveryNote) => {
      const successState = createDeliveryNoteCreateSuccessState(deliveryNote);

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onNotice({
        message: getDeliveryNoteNotice(deliveryNote),
        tone: "success",
      });
      applyDeliveryNoteCreateSuccessState(successState);
    },
  });

  const getDeliveryNoteMutation = useMutation({
    mutationFn: (id: string) => getDeliveryNote(id),
    onError: (error) => {
      applyDeliveryNoteFormError(error);
    },
    onSuccess: (deliveryNote) => {
      const successState =
        createDeliveryNotePrintPreviewSuccessState(deliveryNote);

      applyDeliveryNotePrintPreviewState(successState, "order");
    },
  });
  const getCustomerInventoryDeliveryNoteMutation = useMutation({
    mutationFn: (id: string) => getCustomerInventoryDeliveryNote(id),
    onError: (error) => {
      applyDeliveryNoteFormError(error);
    },
    onSuccess: (deliveryNote) => {
      const successState =
        createDeliveryNotePrintPreviewSuccessState(deliveryNote);

      applyDeliveryNotePrintPreviewState(successState, "customer");
    },
  });
  const updateDeliveryNoteSpecialNoteMutation = useMutation({
    mutationFn: updateDeliveryNoteSpecialNote,
    onSuccess: (deliveryNote) => {
      const successState =
        createDeliveryNotePrintPreviewSuccessState(deliveryNote);

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onNotice({
        message: "出库单提示已保存",
        tone: "success",
      });
      applyDeliveryNotePrintPreviewState(successState, "order");
    },
  });
  const updateCustomerInventoryDeliveryNoteSpecialNoteMutation = useMutation({
    mutationFn: updateCustomerInventoryDeliveryNoteSpecialNote,
    onSuccess: (deliveryNote) => {
      const successState =
        createDeliveryNotePrintPreviewSuccessState(deliveryNote);

      queryClient.invalidateQueries({ queryKey: ["customer-inventory"] });
      onNotice({
        message: "客户库存出库单提示已保存",
        tone: "success",
      });
      applyDeliveryNotePrintPreviewState(successState, "customer");
    },
  });

  const deliveryNoteTotalQuantity =
    getDeliveryNoteTotalQuantity(deliveryNoteRows);
  const deliveryNoteTransferQuantity =
    getDeliveryNoteTransferQuantity(deliveryNoteRows);
  const {
    requiredWeights: requiredDeliveryWeights,
    visibleFields: visibleDeliveryWeightFields,
  } = getDeliveryWeightState(deliveryNoteRows);
  const currentDeliveryNoteTotalQuantity =
    currentDeliveryNote?.items.reduce(
      (total, item) => total + item.quantity,
      0,
    ) ?? 0;
  const currentDeliveryNotePreviewId =
    currentDeliveryNote?.id ?? currentMergedDeliveryNote?.id ?? "";
  const canSaveDeliveryNotePreviewSpecialNote = Boolean(
    currentDeliveryNotePreviewId &&
      (deliveryNotePreviewSource === "order" ||
        deliveryNotePreviewSource === "customer"),
  );
  const isSavingDeliveryNotePreviewSpecialNote =
    updateDeliveryNoteSpecialNoteMutation.isPending ||
    updateCustomerInventoryDeliveryNoteSpecialNoteMutation.isPending;
  const deliveryNotePreviewSpecialNoteErrorMessage =
    getErrorMessage(updateDeliveryNoteSpecialNoteMutation.error) ??
    getErrorMessage(
      updateCustomerInventoryDeliveryNoteSpecialNoteMutation.error,
    );
  const isDeliveryPrintReady = Boolean(
    (currentDeliveryNote || currentMergedDeliveryNote) && deliveryNotePrintOpen,
  );

  function getDeliveryNotePreviewSpecialNote(
    deliveryNote: DeliveryNote | null,
    mergedDeliveryNote: MergedDeliveryNote | null,
  ) {
    return deliveryNote?.specialNote ?? mergedDeliveryNote?.specialNote ?? "";
  }

  function applyDeliveryNotePreviewSpecialNoteState(
    source: DeliveryNotePreviewSource | null,
    specialNote: string,
  ) {
    updateDeliveryNoteSpecialNoteMutation.reset();
    updateCustomerInventoryDeliveryNoteSpecialNoteMutation.reset();
    setDeliveryNotePreviewSource(source);
    setDeliveryNotePreviewSpecialNote(specialNote);
    setSavedDeliveryNotePreviewSpecialNote(specialNote);
    setDeliveryNotePreviewSpecialNoteEditorOpen(false);
  }

  function applyDeliveryNoteDialogState(state: DeliveryNoteDialogApplyState) {
    setDeliveryNoteErrors(state.errors);
    setDeliveryNoteFormValues(state.formValues);
    setDeliveryNoteRows(state.rows);
  }

  function applyDeliveryNoteRowsUpdateState(
    state: DeliveryNoteRowsUpdateState,
  ) {
    setDeliveryNoteRows(state.rows);
    setDeliveryNoteErrors(state.errors);
  }

  function applyDeliveryNoteFormFieldUpdateState(
    state: DeliveryNoteFormFieldUpdateState,
  ) {
    setDeliveryNoteFormValues(state.values);
    setDeliveryNoteErrors(state.errors);
  }

  function applyDeliveryNoteFormErrorClearState(
    state: DeliveryNoteFormErrorClearState,
  ) {
    setDeliveryNoteErrors(state.errors);
  }

  function applyDeliveryNoteCreateSuccessState(
    state: DeliveryNoteCreateSuccessState,
  ) {
    setCurrentDeliveryNote(state.currentDeliveryNote);
    setCurrentMergedDeliveryNote(null);
    applyDeliveryNotePreviewSpecialNoteState(
      "order",
      state.currentDeliveryNote.specialNote,
    );
    setDeliveryNoteOpen(state.open);
    applyDeliveryNoteDialogState(state.dialogApplyState);
    setDeliveryNotePrintOpen(state.printOpen);
  }

  function applyDeliveryNoteFormError(error: unknown) {
    applyDeliveryNoteFormErrorMessage(getErrorMessage(error));
  }

  function applyDeliveryNoteFormErrorMessage(message: string | undefined) {
    setDeliveryNoteErrors(
      createDeliveryNoteFormErrorState(message).errors,
    );
  }

  function applyDeliveryNotePrintPreviewState(
    state: DeliveryNotePrintPreviewSuccessState,
    source: DeliveryNotePreviewSource,
  ) {
    setCurrentDeliveryNote(state.currentDeliveryNote);
    setCurrentMergedDeliveryNote(state.currentMergedDeliveryNote);
    applyDeliveryNotePreviewSpecialNoteState(
      source,
      getDeliveryNotePreviewSpecialNote(
        state.currentDeliveryNote,
        state.currentMergedDeliveryNote,
      ),
    );
    setDeliveryNotePrintOpen(state.printOpen);
  }

  function applyDeliveryNotePrintPreviewRequestState(
    state: DeliveryNotePrintPreviewRequestState,
  ) {
    setDeliveryNoteErrors(state.errors);
    setCurrentMergedDeliveryNote(state.currentMergedDeliveryNote);
    applyDeliveryNotePreviewSpecialNoteState(null, "");
  }

  function openDeliveryNoteDialog(group: OrderInventoryGroup) {
    if (group.inventoryClosedAt) {
      if (group.deliveryNoteId) {
        openDeliveryNotePrintPreview(group.deliveryNoteId);
      }
      return;
    }

    createDeliveryNoteMutation.reset();
    const state = createDeliveryNoteDialogOpenState(
      createDeliveryNoteDialogValues(group),
    );

    applyDeliveryNoteDialogState(state.dialogApplyState);
    setDeliveryNoteOpen(state.open);
  }

  function openDeliveryNotePrintPreview(id: string) {
    const state = createDeliveryNotePrintPreviewRequestState();

    getDeliveryNoteMutation.reset();
    applyDeliveryNotePrintPreviewRequestState(state);
    getDeliveryNoteMutation.mutate(id);
  }

  function applyMergeDeliveryNotePreviewSuccessState(
    state: MergeDeliveryNotePreviewSuccessState,
  ) {
    setCurrentDeliveryNote(state.currentDeliveryNote);
    setCurrentMergedDeliveryNote(state.currentMergedDeliveryNote);
    applyDeliveryNotePreviewSpecialNoteState(
      "temporary-merge",
      getDeliveryNotePreviewSpecialNote(
        state.currentDeliveryNote,
        state.currentMergedDeliveryNote,
      ),
    );
    setMergeDeliveryNoteOpen(state.mergeOpen);
    setDeliveryNotePrintOpen(state.printOpen);
  }

  function openCustomerInventoryDeliveryNotePrintPreview(id: string) {
    const state = createDeliveryNotePrintPreviewRequestState();

    getCustomerInventoryDeliveryNoteMutation.reset();
    applyDeliveryNotePrintPreviewRequestState(state);
    getCustomerInventoryDeliveryNoteMutation.mutate(id);
  }

  function handleDeliveryNoteOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDeliveryNoteOpen(nextOpen);
      return;
    }

    const state = createDeliveryNoteDialogCloseState();

    setDeliveryNoteOpen(state.open);
    createDeliveryNoteMutation.reset();
    applyDeliveryNoteDialogState(state.dialogApplyState);
  }

  function updateDeliveryNoteFormValue<
    Key extends keyof DeliveryNoteFormValues,
  >(key: Key, value: DeliveryNoteFormValues[Key]) {
    const nextState = updateDeliveryNoteFormFieldState({
      errors: deliveryNoteErrors,
      key,
      value,
      values: deliveryNoteFormValues,
    });

    applyDeliveryNoteFormFieldUpdateState(nextState);
    createDeliveryNoteMutation.reset();
  }

  function clearDeliveryNoteError(key: DeliveryNoteWeightKey) {
    const nextState = clearDeliveryNoteFormFieldErrorState({
      errors: deliveryNoteErrors,
      key,
    });

    applyDeliveryNoteFormErrorClearState(nextState);
    createDeliveryNoteMutation.reset();
  }

  function handleDeliveryNoteWeightFocus(key: DeliveryNoteWeightKey) {
    if (keepDeliveryNoteErrorOnFocusRef.current) {
      return;
    }

    clearDeliveryNoteError(key);
  }

  function focusDeliveryNoteTarget(target: DeliveryNoteFocusTarget | null) {
    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      const element =
        target.kind === "field"
          ? document.querySelector<HTMLElement>(
              `[data-delivery-note-field="${target.field}"]`,
            )
          : Array.from(
              document.querySelectorAll<HTMLElement>(
                "[data-delivery-note-detail][data-delivery-note-field]",
              ),
            ).find(
              (item) =>
                item.dataset.deliveryNoteDetail === target.detailKey &&
                item.dataset.deliveryNoteField === target.field,
            );

      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (element) {
        keepDeliveryNoteErrorOnFocusRef.current = true;
        element.focus();
        requestAnimationFrame(() => {
          keepDeliveryNoteErrorOnFocusRef.current = false;
        });
      }
    });
  }

  function focusNextDeliveryWeightField(
    event: KeyboardEvent<HTMLInputElement>,
    target: DeliveryNoteFocusTarget,
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    focusDeliveryNoteTarget(target);
  }

  function findFirstInvalidDeliveryNoteField(
    errors: DeliveryNoteFormErrors = deliveryNoteErrors,
  ): DeliveryNoteFocusTarget | null {
    return getFirstInvalidDeliveryNoteFocusTarget({
      errors,
      requiredWeights: requiredDeliveryWeights,
      rows: deliveryNoteRows,
      values: deliveryNoteFormValues,
    });
  }

  function updateDeliveryNoteRow(
    detailKey: string,
    updates: Partial<Pick<DeliveryNoteFormRow, "quantity" | "note">>,
  ) {
    const nextState = updateDeliveryNoteRowState({
      detailKey,
      errors: deliveryNoteErrors,
      rows: deliveryNoteRows,
      updates,
    });

    applyDeliveryNoteRowsUpdateState(nextState);
    createDeliveryNoteMutation.reset();
  }

  function fillAllDeliveryNoteQuantities() {
    const nextState = fillDeliveryNoteQuantityState({
      errors: deliveryNoteErrors,
      rows: deliveryNoteRows,
    });

    applyDeliveryNoteRowsUpdateState(nextState);
    createDeliveryNoteMutation.reset();
  }

  function clearAllDeliveryNoteQuantities() {
    const nextState = clearDeliveryNoteQuantityState({
      errors: deliveryNoteErrors,
      rows: deliveryNoteRows,
    });

    applyDeliveryNoteRowsUpdateState(nextState);
    createDeliveryNoteMutation.reset();
  }

  function submitDeliveryNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOrderGroup) {
      applyDeliveryNoteFormErrorMessage("请选择订单");
      return;
    }

    if (selectedOrderGroup.inventoryClosedAt) {
      applyDeliveryNoteFormErrorMessage("该订单库存已完结，不能继续出库");
      return;
    }

    const { errors, payload } = collectDeliveryNoteSubmitState({
      orderId: selectedOrderGroup.orderId,
      requiredWeights: requiredDeliveryWeights,
      rows: deliveryNoteRows,
      values: deliveryNoteFormValues,
    });

    if (!payload) {
      setDeliveryNoteErrors(errors);
      focusDeliveryNoteTarget(findFirstInvalidDeliveryNoteField(errors));
      return;
    }

    createDeliveryNoteMutation.mutate(payload);
  }

  function handleDeliveryNotePrintOpenChange(nextOpen: boolean) {
    setDeliveryNotePrintOpen(nextOpen);

    if (!nextOpen) {
      updateDeliveryNoteSpecialNoteMutation.reset();
      updateCustomerInventoryDeliveryNoteSpecialNoteMutation.reset();
      setDeliveryNotePreviewSpecialNoteEditorOpen(false);
    }
  }

  function handleDeliveryNoteSpecialNoteEditorOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      updateDeliveryNoteSpecialNoteMutation.reset();
      updateCustomerInventoryDeliveryNoteSpecialNoteMutation.reset();
    }

    setDeliveryNotePreviewSpecialNoteEditorOpen(nextOpen);
  }

  function updateDeliveryNotePreviewSpecialNote(value: string) {
    if (!isSavingDeliveryNotePreviewSpecialNote) {
      updateDeliveryNoteSpecialNoteMutation.reset();
      updateCustomerInventoryDeliveryNoteSpecialNoteMutation.reset();
    }

    setDeliveryNotePreviewSpecialNote(value);
    setCurrentDeliveryNote((deliveryNote) =>
      deliveryNote ? { ...deliveryNote, specialNote: value } : deliveryNote,
    );
    setCurrentMergedDeliveryNote((mergedDeliveryNote) =>
      mergedDeliveryNote
        ? { ...mergedDeliveryNote, specialNote: value }
        : mergedDeliveryNote,
    );
  }

  function saveDeliveryNotePreviewSpecialNote() {
    if (!canSaveDeliveryNotePreviewSpecialNote) {
      return;
    }

    const payload = {
      id: currentDeliveryNotePreviewId,
      specialNote: deliveryNotePreviewSpecialNote,
    };

    if (deliveryNotePreviewSource === "order") {
      updateDeliveryNoteSpecialNoteMutation.mutate(payload);
      return;
    }

    if (deliveryNotePreviewSource === "customer") {
      updateCustomerInventoryDeliveryNoteSpecialNoteMutation.mutate(payload);
    }
  }

  async function printDeliveryNote() {
    if (!currentDeliveryNote && !currentMergedDeliveryNote) {
      return;
    }

    try {
      if (isTauriRuntime()) {
        await invoke("print_current_window", { orientation: "portrait" });
        return;
      }

      window.print();
    } catch (error) {
      applyDeliveryNoteFormErrorMessage(
        getErrorMessage(error, "无法打开打印面板") ?? "无法打开打印面板",
      );
    }
  }
  return {
    applyDeliveryNoteFormError,
    applyDeliveryNotePreviewSpecialNoteState,
    applyMergeDeliveryNotePreviewSuccessState,
    canSaveDeliveryNotePreviewSpecialNote,
    clearAllDeliveryNoteQuantities,
    createDeliveryNoteMutation,
    currentDeliveryNote,
    currentDeliveryNoteTotalQuantity,
    currentMergedDeliveryNote,
    deliveryNoteErrors,
    deliveryNoteFormValues,
    deliveryNoteOpen,
    deliveryNotePreviewSpecialNote,
    deliveryNotePreviewSpecialNoteEditorOpen,
    deliveryNotePreviewSpecialNoteErrorMessage,
    deliveryNotePrintOpen,
    deliveryNoteRows,
    deliveryNoteTotalQuantity,
    deliveryNoteTransferQuantity,
    fillAllDeliveryNoteQuantities,
    focusNextDeliveryWeightField,
    getDeliveryNotePreviewSpecialNote,
    handleDeliveryNoteOpenChange,
    handleDeliveryNotePrintOpenChange,
    handleDeliveryNoteSpecialNoteEditorOpenChange,
    handleDeliveryNoteWeightFocus,
    isDeliveryPrintReady,
    isSavingDeliveryNotePreviewSpecialNote,
    openCustomerInventoryDeliveryNotePrintPreview,
    openDeliveryNoteDialog,
    openDeliveryNotePrintPreview,
    printDeliveryNote,
    requiredDeliveryWeights,
    saveDeliveryNotePreviewSpecialNote,
    savedDeliveryNotePreviewSpecialNote,
    setCurrentDeliveryNote,
    setCurrentMergedDeliveryNote,
    setDeliveryNoteErrors,
    setDeliveryNotePrintOpen,
    submitDeliveryNote,
    updateCustomerInventoryDeliveryNoteSpecialNoteMutation,
    updateDeliveryNoteFormValue,
    updateDeliveryNotePreviewSpecialNote,
    updateDeliveryNoteRow,
    updateDeliveryNoteSpecialNoteMutation,
    visibleDeliveryWeightFields,
  };
}
