import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  adjustOrderInventory,
  type AdjustOrderInventoryPayload,
} from "@/features/inventory/api/inventory-api";
import {
  collectOrderInventoryAdjustmentSubmitState,
  createOrderInventoryDialogCloseState,
  createOrderInventoryDialogOpenState,
  createOrderInventoryFormValues,
  defaultOrderInventoryFormValues,
  updateOrderInventoryFormFieldState,
  type OrderInventoryDialogApplyState,
  type OrderInventoryFormErrors,
  type OrderInventoryFormValues,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  getOrderInventoryNotice,
  type InventoryNotice,
} from "@/features/inventory/lib/inventory-utils";
import {
  type OrderInventoryItem,
  type OrderInventoryMovementType,
} from "@/features/inventory/types";

export interface UseOrderInventoryAdjustOptions {
  onNotice: (notice: InventoryNotice) => void;
}

export function useOrderInventoryAdjust({
  onNotice,
}: UseOrderInventoryAdjustOptions) {
  const queryClient = useQueryClient();
  const [orderAdjustOpen, setOrderAdjustOpen] = useState(false);
  const [orderFormValues, setOrderFormValues] =
    useState<OrderInventoryFormValues>(defaultOrderInventoryFormValues);
  const [orderFormErrors, setOrderFormErrors] =
    useState<OrderInventoryFormErrors>({});

  const adjustOrderInventoryMutation = useMutation({
    mutationFn: (payload: AdjustOrderInventoryPayload) =>
      adjustOrderInventory(payload),
    onSuccess: (_result, payload) => {
      const state = createOrderInventoryDialogCloseState();

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onNotice({
        message: getOrderInventoryNotice(payload),
        tone: "success",
      });
      setOrderAdjustOpen(state.open);
      applyOrderInventoryDialogState(state.dialogApplyState);
    },
  });

  const orderInventoryNotePlaceholder =
    orderFormValues.movementType === "produce"
      ? "例如：生产完成、补录入库"
      : orderFormValues.movementType === "ship"
        ? "例如：客户发货、样品出库"
        : "例如：盘点校正、录入修正";
  const orderInventoryQuantityPlaceholder =
    orderFormValues.movementType === "produce"
      ? `例如：下单数量 ${orderFormValues.requiredQuantity}`
      : orderFormValues.movementType === "ship"
        ? `例如：当前库存数量 ${orderFormValues.currentQuantity}`
        : `例如：实际库存数量 ${orderFormValues.currentQuantity}`;

  function openOrderAdjustDialog(
    item: OrderInventoryItem,
    movementType: OrderInventoryMovementType,
  ) {
    adjustOrderInventoryMutation.reset();
    const state = createOrderInventoryDialogOpenState(
      createOrderInventoryFormValues({ item, movementType }),
    );

    applyOrderInventoryDialogState(state.dialogApplyState);
    setOrderAdjustOpen(state.open);
  }

  function handleOrderAdjustOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOrderAdjustOpen(nextOpen);
      return;
    }

    const state = createOrderInventoryDialogCloseState();

    setOrderAdjustOpen(state.open);
    adjustOrderInventoryMutation.reset();
    applyOrderInventoryDialogState(state.dialogApplyState);
  }

  function applyOrderInventoryDialogState(
    state: OrderInventoryDialogApplyState,
  ) {
    setOrderFormErrors(state.errors);
    setOrderFormValues(state.values);
  }

  function updateOrderFormValue<Key extends keyof OrderInventoryFormValues>(
    key: Key,
    value: OrderInventoryFormValues[Key],
  ) {
    const nextState = updateOrderInventoryFormFieldState({
      errors: orderFormErrors,
      key,
      value,
      values: orderFormValues,
    });

    applyOrderInventoryDialogState(nextState);
    adjustOrderInventoryMutation.reset();
  }

  function submitOrderAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors, payload } =
      collectOrderInventoryAdjustmentSubmitState(orderFormValues);

    if (!payload) {
      setOrderFormErrors(errors);
      return;
    }

    adjustOrderInventoryMutation.mutate(payload);
  }

  return {
    adjustOrderInventoryMutation,
    handleOrderAdjustOpenChange,
    openOrderAdjustDialog,
    orderAdjustOpen,
    orderFormErrors,
    orderFormValues,
    orderInventoryNotePlaceholder,
    orderInventoryQuantityPlaceholder,
    submitOrderAdjustment,
    updateOrderFormValue,
  };
}
