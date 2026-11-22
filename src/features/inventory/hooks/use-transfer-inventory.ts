import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  transferPublicInventoryToOrder,
  type TransferPublicInventoryToOrderPayload,
} from "@/features/inventory/api/inventory-api";
import {
  collectTransferInventorySubmitState,
  createTransferInventoryDialogCloseState,
  createTransferInventoryDialogOpenState,
  createTransferInventoryFormValues,
  defaultTransferInventoryFormValues,
  updateTransferInventoryFormFieldState,
  type TransferInventoryDialogApplyState,
  type TransferInventoryFormErrors,
  type TransferInventoryFormValues,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  getTransferInventoryNotice,
  type InventoryNotice,
} from "@/features/inventory/lib/inventory-utils";
import { type OrderInventoryItem } from "@/features/inventory/types";

export interface UseTransferInventoryOptions {
  onNotice: (notice: InventoryNotice) => void;
}

export function useTransferInventory({
  onNotice,
}: UseTransferInventoryOptions) {
  const queryClient = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFormValues, setTransferFormValues] =
    useState<TransferInventoryFormValues>(defaultTransferInventoryFormValues);
  const [transferFormErrors, setTransferFormErrors] =
    useState<TransferInventoryFormErrors>({});

  const transferPublicInventoryMutation = useMutation({
    mutationFn: (payload: TransferPublicInventoryToOrderPayload) =>
      transferPublicInventoryToOrder(payload),
    onSuccess: (_result, payload) => {
      const state = createTransferInventoryDialogCloseState();

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onNotice({
        message: getTransferInventoryNotice(payload),
        tone: "success",
      });
      setTransferOpen(state.open);
      applyTransferInventoryDialogState(state.dialogApplyState);
    },
  });

  const transferRemainingQuantity = Math.max(
    transferFormValues.requiredQuantity - transferFormValues.currentQuantity,
    0,
  );
  const transferSuggestedQuantity = Math.min(
    transferFormValues.publicQuantity,
    transferRemainingQuantity,
  );

  function openTransferDialog(item: OrderInventoryItem) {
    transferPublicInventoryMutation.reset();
    const state = createTransferInventoryDialogOpenState(
      createTransferInventoryFormValues(item),
    );

    applyTransferInventoryDialogState(state.dialogApplyState);
    setTransferOpen(state.open);
  }

  function handleTransferOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setTransferOpen(nextOpen);
      return;
    }

    const state = createTransferInventoryDialogCloseState();

    setTransferOpen(state.open);
    transferPublicInventoryMutation.reset();
    applyTransferInventoryDialogState(state.dialogApplyState);
  }

  function applyTransferInventoryDialogState(
    state: TransferInventoryDialogApplyState,
  ) {
    setTransferFormErrors(state.errors);
    setTransferFormValues(state.values);
  }

  function updateTransferFormValue<
    Key extends keyof TransferInventoryFormValues,
  >(key: Key, value: TransferInventoryFormValues[Key]) {
    const nextState = updateTransferInventoryFormFieldState({
      errors: transferFormErrors,
      key,
      value,
      values: transferFormValues,
    });

    applyTransferInventoryDialogState(nextState);
    transferPublicInventoryMutation.reset();
  }

  function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors, payload } =
      collectTransferInventorySubmitState(transferFormValues);

    if (!payload) {
      setTransferFormErrors(errors);
      return;
    }

    transferPublicInventoryMutation.mutate(payload);
  }

  return {
    handleTransferOpenChange,
    openTransferDialog,
    submitTransfer,
    transferFormErrors,
    transferFormValues,
    transferOpen,
    transferPublicInventoryMutation,
    transferRemainingQuantity,
    transferSuggestedQuantity,
    updateTransferFormValue,
  };
}
