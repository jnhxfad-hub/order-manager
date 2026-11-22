import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createCustomerInventoryDeliveryNote,
  createCustomerInventoryDeliveryNotes,
  deriveCustomerInventoryDeliveryGroupLabel,
  type CreateCustomerInventoryDeliveryNotePayload,
} from "@/features/inventory/api/inventory-api";
import {
  clearCustomerInventoryDeliveryQuantityState,
  collectCustomerInventoryDeliverySubmitState,
  createCustomerInventoryDeliveryCreateSuccessState,
  createCustomerInventoryDeliveryDialogCloseState,
  createCustomerInventoryDeliveryDialogOpenState,
  createCustomerInventoryDeliveryDialogValues,
  defaultDeliveryNoteFormValues,
  fillCustomerInventoryDeliveryQuantityState,
  getFirstInvalidCustomerInventoryDeliveryFocusTarget,
  getNextCustomerInventoryDeliveryFocusTarget,
  selectCustomerInventoryBatchesByIds,
  toggleCustomerInventoryDeliveryBatchSelectionState,
  updateCustomerInventoryDeliveryFormFieldState,
  updateCustomerInventoryDeliveryGroupLabelState,
  updateCustomerInventoryDeliveryPriceGroupFormFieldState,
  updateCustomerInventoryDeliveryRowNoteState,
  updateCustomerInventoryDeliveryRowQuantityState,
  type CustomerInventoryDeliveryCreateSuccessState,
  type CustomerInventoryDeliveryDialogApplyState,
  type CustomerInventoryDeliveryFocusRequest,
  type CustomerInventoryDeliveryFocusTarget,
  type CustomerInventoryDeliveryFormFieldUpdateState,
  type CustomerInventoryDeliveryPriceGroupFormFieldUpdateState,
  type CustomerInventoryDeliveryRowsOnlyUpdateState,
  type CustomerInventoryDeliveryRowsUpdateState,
  type DeliveryNoteFormErrors,
  type DeliveryNoteFormValues,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  buildCustomerInventoryDeliveryGroups,
  buildCustomerInventoryDeliveryPriceGroups,
  createCustomerInventoryDeliveryWeightRows,
  deliveryWeightFields,
  getCustomerInventoryDeliveryTotalQuantity,
  getRequiredDeliveryWeights,
  groupCustomerInventoryBatchesByPrice,
  type CustomerInventoryDeliveryPriceGroupView,
  type CustomerInventoryDeliveryRow,
  type InventoryNotice,
} from "@/features/inventory/lib/inventory-utils";
import { getMatchedSpecialPricingKeyword } from "@/features/customers/lib/customer-pricing";
import type { Customer } from "@/features/customers/types";
import type {
  CustomerInventoryBatch,
  DeliveryNote,
  MergedDeliveryNote,
} from "@/features/inventory/types";

export interface UseCustomerInventoryDeliveryOptions {
  applyDeliveryNotePreviewSpecialNoteState: (
    source: "order" | "customer" | "temporary-merge" | null,
    specialNote: string,
  ) => void;
  customerInventoryBatches: CustomerInventoryBatch[];
  customers: Customer[];
  getDeliveryNotePreviewSpecialNote: (
    deliveryNote: DeliveryNote | null,
    mergedDeliveryNote: MergedDeliveryNote | null,
  ) => string;
  onNotice: (notice: InventoryNotice) => void;
  selectedCustomerInventoryBatch: CustomerInventoryBatch | null;
  setCurrentDeliveryNote: (note: DeliveryNote | null) => void;
  setCurrentMergedDeliveryNote: (note: MergedDeliveryNote | null) => void;
  setDeliveryNotePrintOpen: (open: boolean) => void;
  setSelectedCustomerInventoryBatch: (
    batch: CustomerInventoryBatch | null,
  ) => void;
}

export function useCustomerInventoryDelivery({
  applyDeliveryNotePreviewSpecialNoteState,
  customerInventoryBatches,
  customers,
  getDeliveryNotePreviewSpecialNote,
  onNotice,
  selectedCustomerInventoryBatch,
  setCurrentDeliveryNote,
  setCurrentMergedDeliveryNote,
  setDeliveryNotePrintOpen,
  setSelectedCustomerInventoryBatch,
}: UseCustomerInventoryDeliveryOptions) {
  const queryClient = useQueryClient();
  const [customerInventoryDeliveryOpen, setCustomerInventoryDeliveryOpen] =
    useState(false);
  const [
    selectedCustomerInventoryDeliveryBatches,
    setSelectedCustomerInventoryDeliveryBatches,
  ] = useState<CustomerInventoryBatch[]>([]);
  const [
    selectedCustomerInventoryDeliveryBatchIds,
    setSelectedCustomerInventoryDeliveryBatchIds,
  ] = useState<string[]>([]);
  const [customerInventoryDeliveryRows, setCustomerInventoryDeliveryRows] =
    useState<CustomerInventoryDeliveryRow[]>([]);
  const [
    customerInventoryDeliveryFormValues,
    setCustomerInventoryDeliveryFormValues,
  ] = useState<DeliveryNoteFormValues>(defaultDeliveryNoteFormValues);
  const [
    customerInventoryDeliveryPriceGroupFormValues,
    setCustomerInventoryDeliveryPriceGroupFormValues,
  ] = useState<Record<string, DeliveryNoteFormValues>>({});
  const [customerInventoryDeliveryErrors, setCustomerInventoryDeliveryErrors] =
    useState<DeliveryNoteFormErrors>({});

  const createCustomerInventoryDeliveryNoteMutation = useMutation({
    mutationFn: ({
      payloads,
    }: {
      payloads: CreateCustomerInventoryDeliveryNotePayload[];
    }) => {
      if (payloads.length <= 1) {
        const payload = payloads[0];

        if (!payload) {
          return Promise.resolve([]);
        }

        return createCustomerInventoryDeliveryNote(payload).then((deliveryNote) => [
          deliveryNote,
        ]);
      }

      return createCustomerInventoryDeliveryNotes(payloads);
    },
    onSuccess: (deliveryNotes) => {
      const successState =
        createCustomerInventoryDeliveryCreateSuccessState(deliveryNotes);

      queryClient.invalidateQueries({ queryKey: ["customer-inventory"] });
      onNotice({
        message: successState.message,
        tone: "success",
      });
      applyCustomerInventoryDeliveryCreateSuccessState(successState);
    },
  });

  const customerInventoryDeliveryTotalQuantity =
    getCustomerInventoryDeliveryTotalQuantity(customerInventoryDeliveryRows);
  const canClearCustomerInventoryDeliveryQuantities =
    customerInventoryDeliveryRows.some((row) => row.quantity.trim());
  const customerInventoryDeliveryPriceGroups: CustomerInventoryDeliveryPriceGroupView[] =
    buildCustomerInventoryDeliveryPriceGroups(
      selectedCustomerInventoryDeliveryBatches,
      customerInventoryDeliveryRows,
      groupCustomerInventoryBatchesByPrice(
        selectedCustomerInventoryDeliveryBatches,
      ),
    );
  const hasMultipleCustomerInventoryDeliveryPriceGroups =
    customerInventoryDeliveryPriceGroups.length > 1;
  const customerInventoryDeliveryGroups = buildCustomerInventoryDeliveryGroups(
    customerInventoryDeliveryRows,
    deriveCustomerInventoryDeliveryGroupLabel,
  );
  const requiredCustomerInventoryDeliveryWeights = getRequiredDeliveryWeights(
    createCustomerInventoryDeliveryWeightRows(
      customerInventoryDeliveryRows,
      "entered",
    ),
  );
  const availableCustomerInventoryDeliveryWeights = getRequiredDeliveryWeights(
    createCustomerInventoryDeliveryWeightRows(
      customerInventoryDeliveryRows,
      "current",
    ),
  );
  const visibleCustomerInventoryDeliveryWeightFields = deliveryWeightFields.filter(
    (field) => availableCustomerInventoryDeliveryWeights[field.category],
  );
  const selectedCustomerInventoryCustomer =
    selectedCustomerInventoryBatch
      ? (customers.find(
          (customer) =>
            customer.id === selectedCustomerInventoryBatch.customerId,
        ) ?? null)
      : null;
  const selectedCustomerInventoryPricingKeyword =
    getMatchedSpecialPricingKeyword(
      selectedCustomerInventoryCustomer,
      selectedCustomerInventoryBatch?.note ?? "",
    );
  const selectedCustomerInventoryPricingProfileName =
    selectedCustomerInventoryPricingKeyword
      ? `${selectedCustomerInventoryPricingKeyword}价`
      : "默认价";

  function applyCustomerInventoryDeliveryDialogValues(
    state: CustomerInventoryDeliveryDialogApplyState,
  ) {
    setSelectedCustomerInventoryBatch(state.selectedBatch);
    setSelectedCustomerInventoryDeliveryBatches(state.selectedBatches);
    setCustomerInventoryDeliveryFormValues(state.formValues);
    setCustomerInventoryDeliveryPriceGroupFormValues(
      state.priceGroupFormValues,
    );
    setCustomerInventoryDeliveryRows(state.rows);
    setCustomerInventoryDeliveryErrors(state.errors);
  }

  function applyCustomerInventoryDeliveryCreateSuccessState(
    state: CustomerInventoryDeliveryCreateSuccessState,
  ) {
    setCurrentDeliveryNote(state.currentDeliveryNote);
    setCurrentMergedDeliveryNote(state.currentMergedDeliveryNote);
    applyDeliveryNotePreviewSpecialNoteState(
      "customer",
      getDeliveryNotePreviewSpecialNote(
        state.currentDeliveryNote,
        state.currentMergedDeliveryNote,
      ),
    );
    setCustomerInventoryDeliveryOpen(state.deliveryOpen);
    setSelectedCustomerInventoryDeliveryBatchIds(state.selectedBatchIds);
    applyCustomerInventoryDeliveryDialogValues(state.dialogApplyState);
    setDeliveryNotePrintOpen(state.printOpen);
  }

  function applyCustomerInventoryDeliveryRowsUpdateState(
    state: CustomerInventoryDeliveryRowsUpdateState,
  ) {
    setCustomerInventoryDeliveryRows(state.rows);
    setCustomerInventoryDeliveryErrors(state.errors);
  }

  function applyCustomerInventoryDeliveryRowsOnlyUpdateState(
    state: CustomerInventoryDeliveryRowsOnlyUpdateState,
  ) {
    setCustomerInventoryDeliveryRows(state.rows);
  }

  function applyCustomerInventoryDeliveryFormFieldUpdateState(
    state: CustomerInventoryDeliveryFormFieldUpdateState,
  ) {
    setCustomerInventoryDeliveryFormValues(state.values);
    setCustomerInventoryDeliveryErrors(state.errors);
  }

  function applyCustomerInventoryDeliveryPriceGroupFormFieldUpdateState(
    state: CustomerInventoryDeliveryPriceGroupFormFieldUpdateState,
  ) {
    setCustomerInventoryDeliveryPriceGroupFormValues(
      state.priceGroupFormValues,
    );
    setCustomerInventoryDeliveryErrors(state.errors);
  }

  function openCustomerInventoryDeliveryDialog(batch: CustomerInventoryBatch) {
    openCustomerInventoryDeliveryDialogForBatches([batch]);
  }

  function openCustomerInventoryDeliveryDialogForBatches(
    batches: CustomerInventoryBatch[],
  ) {
    createCustomerInventoryDeliveryNoteMutation.reset();
    const dialogValues =
      createCustomerInventoryDeliveryDialogValues(batches);

    if (dialogValues.errorMessage) {
      onNotice({
        message: dialogValues.errorMessage,
        tone: "warning",
      });
      return;
    }

    if (!dialogValues.selectedBatch) {
      return;
    }

    const state =
      createCustomerInventoryDeliveryDialogOpenState(dialogValues);

    applyCustomerInventoryDeliveryDialogValues(state.dialogApplyState);
    setCustomerInventoryDeliveryOpen(state.open);
  }

  function openSelectedCustomerInventoryDeliveryDialog() {
    const selectedBatches = selectCustomerInventoryBatchesByIds(
      customerInventoryBatches,
      selectedCustomerInventoryDeliveryBatchIds,
    );

    openCustomerInventoryDeliveryDialogForBatches(selectedBatches);
  }

  function toggleCustomerInventoryDeliveryBatchSelection(
    batch: CustomerInventoryBatch,
    checked: boolean,
  ) {
    setSelectedCustomerInventoryDeliveryBatchIds(
      (current) =>
        toggleCustomerInventoryDeliveryBatchSelectionState({
          batchId: batch.id,
          checked,
          selectedBatchIds: current,
        }).selectedBatchIds,
    );
  }

  function handleCustomerInventoryDeliveryOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setCustomerInventoryDeliveryOpen(nextOpen);
      return;
    }

    const state = createCustomerInventoryDeliveryDialogCloseState();

    setCustomerInventoryDeliveryOpen(state.open);
    createCustomerInventoryDeliveryNoteMutation.reset();
    applyCustomerInventoryDeliveryDialogValues(state.dialogApplyState);
  }

  function fillAllCustomerInventoryDeliveryQuantities() {
    const nextState = fillCustomerInventoryDeliveryQuantityState({
      errors: customerInventoryDeliveryErrors,
      rows: customerInventoryDeliveryRows,
    });

    applyCustomerInventoryDeliveryRowsUpdateState(nextState);
    createCustomerInventoryDeliveryNoteMutation.reset();
  }

  function clearAllCustomerInventoryDeliveryQuantities() {
    const nextState = clearCustomerInventoryDeliveryQuantityState({
      errors: customerInventoryDeliveryErrors,
      rows: customerInventoryDeliveryRows,
    });

    applyCustomerInventoryDeliveryRowsUpdateState(nextState);
    createCustomerInventoryDeliveryNoteMutation.reset();
  }

  function handleCustomerInventoryDeliveryFormValueChange<
    Key extends keyof DeliveryNoteFormValues,
  >(key: Key, value: DeliveryNoteFormValues[Key]) {
    const nextState = updateCustomerInventoryDeliveryFormFieldState({
      errors: customerInventoryDeliveryErrors,
      key,
      value,
      values: customerInventoryDeliveryFormValues,
    });

    applyCustomerInventoryDeliveryFormFieldUpdateState(nextState);
  }

  function handleCustomerInventoryDeliveryPriceGroupFormValueChange<
    Key extends keyof DeliveryNoteFormValues,
  >(priceGroupKey: string, key: Key, value: DeliveryNoteFormValues[Key]) {
    const nextState =
      updateCustomerInventoryDeliveryPriceGroupFormFieldState({
        errors: customerInventoryDeliveryErrors,
        key,
        priceGroupFormValues: customerInventoryDeliveryPriceGroupFormValues,
        priceGroupKey,
        value,
      });

    applyCustomerInventoryDeliveryPriceGroupFormFieldUpdateState(nextState);
  }

  function handleCustomerInventoryDeliveryGroupLabelChange(
    batchId: string,
    value: string,
  ) {
    const nextState = updateCustomerInventoryDeliveryGroupLabelState({
      batchId,
      errors: customerInventoryDeliveryErrors,
      groupLabel: value,
      rows: customerInventoryDeliveryRows,
    });

    applyCustomerInventoryDeliveryRowsUpdateState(nextState);
  }

  function handleCustomerInventoryDeliveryRowQuantityChange(
    stockId: string,
    value: string,
  ) {
    const nextState = updateCustomerInventoryDeliveryRowQuantityState({
      errors: customerInventoryDeliveryErrors,
      quantity: value,
      rows: customerInventoryDeliveryRows,
      stockId,
    });

    applyCustomerInventoryDeliveryRowsUpdateState(nextState);
  }

  function handleCustomerInventoryDeliveryRowNoteChange(
    stockId: string,
    value: string,
  ) {
    const nextState = updateCustomerInventoryDeliveryRowNoteState({
      note: value,
      rows: customerInventoryDeliveryRows,
      stockId,
    });

    applyCustomerInventoryDeliveryRowsOnlyUpdateState(nextState);
  }

  function focusCustomerInventoryDeliveryTarget(
    target: CustomerInventoryDeliveryFocusTarget | null,
  ) {
    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const selector =
          target.kind === "row"
            ? `[data-customer-inventory-delivery-row="${target.rowIndex}"][data-customer-inventory-delivery-field="${target.field}"]`
            : target.kind === "field"
              ? `[data-customer-inventory-delivery-field="${target.field}"]`
              : target.kind === "group-label"
                ? `[data-customer-inventory-delivery-batch="${target.batchId}"][data-customer-inventory-delivery-field="groupLabel"]`
                : `[data-customer-inventory-delivery-price-group="${target.priceGroupKey}"][data-customer-inventory-delivery-field="${target.field}"]`;
        const element = document.querySelector<HTMLElement>(selector);

        element?.focus();
        element?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
  }

  function focusNextCustomerInventoryDeliveryTarget(
    event: KeyboardEvent<HTMLInputElement>,
    request: CustomerInventoryDeliveryFocusRequest,
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    focusCustomerInventoryDeliveryTarget(
      getNextCustomerInventoryDeliveryFocusTarget(request, {
        priceGroups: customerInventoryDeliveryPriceGroups,
        requiredWeights: requiredCustomerInventoryDeliveryWeights,
        rows: customerInventoryDeliveryRows,
        visibleWeightFields: visibleCustomerInventoryDeliveryWeightFields,
      }),
    );
  }

  function submitCustomerInventoryDelivery(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const { errors, payloads } = collectCustomerInventoryDeliverySubmitState({
      defaultGroupLabel: deriveCustomerInventoryDeliveryGroupLabel,
      formValues: customerInventoryDeliveryFormValues,
      hasMultiplePriceGroups: hasMultipleCustomerInventoryDeliveryPriceGroups,
      priceGroupFormValues: customerInventoryDeliveryPriceGroupFormValues,
      priceGroups: customerInventoryDeliveryPriceGroups,
      rows: customerInventoryDeliveryRows,
      selectedBatch: selectedCustomerInventoryBatch,
    });

    if (payloads.length === 0) {
      setCustomerInventoryDeliveryErrors(errors);
      focusCustomerInventoryDeliveryTarget(
        getFirstInvalidCustomerInventoryDeliveryFocusTarget({
          errors,
          hasMultiplePriceGroups:
            hasMultipleCustomerInventoryDeliveryPriceGroups,
          priceGroups: customerInventoryDeliveryPriceGroups,
          rows: customerInventoryDeliveryRows,
        }),
      );
      return;
    }

    createCustomerInventoryDeliveryNoteMutation.mutate({
      payloads,
    });
  }
  return {
    canClearCustomerInventoryDeliveryQuantities,
    clearAllCustomerInventoryDeliveryQuantities,
    createCustomerInventoryDeliveryNoteMutation,
    customerInventoryDeliveryErrors,
    customerInventoryDeliveryFormValues,
    customerInventoryDeliveryGroups,
    customerInventoryDeliveryOpen,
    customerInventoryDeliveryPriceGroupFormValues,
    customerInventoryDeliveryPriceGroups,
    customerInventoryDeliveryRows,
    customerInventoryDeliveryTotalQuantity,
    fillAllCustomerInventoryDeliveryQuantities,
    focusNextCustomerInventoryDeliveryTarget,
    handleCustomerInventoryDeliveryFormValueChange,
    handleCustomerInventoryDeliveryGroupLabelChange,
    handleCustomerInventoryDeliveryOpenChange,
    handleCustomerInventoryDeliveryPriceGroupFormValueChange,
    handleCustomerInventoryDeliveryRowNoteChange,
    handleCustomerInventoryDeliveryRowQuantityChange,
    hasMultipleCustomerInventoryDeliveryPriceGroups,
    openCustomerInventoryDeliveryDialog,
    openSelectedCustomerInventoryDeliveryDialog,
    requiredCustomerInventoryDeliveryWeights,
    selectedCustomerInventoryDeliveryBatchIds,
    selectedCustomerInventoryDeliveryBatches,
    selectedCustomerInventoryPricingProfileName,
    setSelectedCustomerInventoryDeliveryBatchIds,
    setSelectedCustomerInventoryDeliveryBatches,
    submitCustomerInventoryDelivery,
    toggleCustomerInventoryDeliveryBatchSelection,
    visibleCustomerInventoryDeliveryWeightFields,
  };
}
