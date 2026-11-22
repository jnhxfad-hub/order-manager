import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  adjustInventory,
  type AdjustInventoryPayload,
} from "@/features/inventory/api/inventory-api";
import {
  collectInventoryAdjustmentSubmitState,
  createInventoryDialogCloseState,
  createInventoryDialogOpenState,
  createInventoryFormValues,
  defaultInventoryFormValues,
  updateInventoryFormFieldState,
  type InventoryDialogApplyState,
  type InventoryFormErrors,
  type InventoryFormValues,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  getPublicInventoryNotice,
  type InventoryNotice,
} from "@/features/inventory/lib/inventory-utils";
import { type InventoryItem } from "@/features/inventory/types";
import { parseIntegerInput } from "@/lib/number-input";

export interface UsePublicInventoryAdjustOptions {
  items: InventoryItem[];
  onNotice: (notice: InventoryNotice) => void;
}

export function usePublicInventoryAdjust({
  items,
  onNotice,
}: UsePublicInventoryAdjustOptions) {
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [formValues, setFormValues] =
    useState<InventoryFormValues>(defaultInventoryFormValues);
  const [formErrors, setFormErrors] = useState<InventoryFormErrors>({});

  const adjustInventoryMutation = useMutation({
    mutationFn: (payload: AdjustInventoryPayload) => adjustInventory(payload),
    onSuccess: (_result, payload) => {
      const state = createInventoryDialogCloseState();

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onNotice({
        message: getPublicInventoryNotice(payload),
        tone: "success",
      });
      setAdjustOpen(state.open);
      applyInventoryDialogState(state.dialogApplyState);
    },
  });

  const currentProduct = useMemo(() => {
    const lengthMm = parseIntegerInput(formValues.lengthMm);

    return items.find(
      (item) =>
        item.productId === formValues.productId &&
        lengthMm !== null &&
        item.lengthMm === lengthMm &&
        item.color === formValues.color.trim(),
    );
  }, [formValues.color, formValues.lengthMm, formValues.productId, items]);
  const currentStockQuantity = currentProduct?.quantity ?? 0;

  const publicInventoryNotePlaceholder =
    formValues.movementType === "in"
      ? "例如：采购入库、补录库存"
      : formValues.movementType === "out"
        ? "例如：损耗出库、退回处理"
        : "例如：盘点校正、数量修正";

  function openAdjustDialog(item: InventoryItem) {
    adjustInventoryMutation.reset();
    const state = createInventoryDialogOpenState(createInventoryFormValues(item));

    applyInventoryDialogState(state.dialogApplyState);
    setAdjustOpen(state.open);
  }

  function handleAdjustOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setAdjustOpen(nextOpen);
      return;
    }

    const state = createInventoryDialogCloseState();

    setAdjustOpen(state.open);
    adjustInventoryMutation.reset();
    applyInventoryDialogState(state.dialogApplyState);
  }

  function applyInventoryDialogState(state: InventoryDialogApplyState) {
    setFormErrors(state.errors);
    setFormValues(state.values);
  }

  function updateFormValue<Key extends keyof InventoryFormValues>(
    key: Key,
    value: InventoryFormValues[Key],
  ) {
    const nextState = updateInventoryFormFieldState({
      errors: formErrors,
      key,
      value,
      values: formValues,
    });

    applyInventoryDialogState(nextState);
    adjustInventoryMutation.reset();
  }

  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors, payload } = collectInventoryAdjustmentSubmitState({
      currentQuantity: currentStockQuantity,
      values: formValues,
    });

    if (!payload) {
      setFormErrors(errors);
      return;
    }

    adjustInventoryMutation.mutate(payload);
  }

  return {
    adjustInventoryMutation,
    adjustOpen,
    currentProduct,
    currentStockQuantity,
    formErrors,
    formValues,
    handleAdjustOpenChange,
    openAdjustDialog,
    publicInventoryNotePlaceholder,
    submitAdjustment,
    updateFormValue,
  };
}
