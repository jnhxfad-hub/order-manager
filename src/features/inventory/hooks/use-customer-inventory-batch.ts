import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  adjustCustomerInventoryStock,
  createCustomerInventoryBatch,
  getCustomerInventoryBatch,
  updateCustomerInventoryBatch,
  type AdjustCustomerInventoryStockPayload,
  type CreateCustomerInventoryBatchPayload,
  type UpdateCustomerInventoryBatchPayload,
} from "@/features/inventory/api/inventory-api";
import {
  appendCustomerInventoryBatchRowState,
  applyCustomerInventoryBatchRowProductState,
  clearCustomerInventoryBatchFormErrorState,
  collectCustomerInventoryAdjustmentSubmitState,
  collectCustomerInventoryBatchSubmitState,
  createCustomerInventoryAdjustDialogCloseState,
  createCustomerInventoryAdjustDialogOpenState,
  createCustomerInventoryAdjustFormValues,
  createCustomerInventoryBatchDialogCloseState,
  createCustomerInventoryBatchDialogOpenState,
  createCustomerInventoryBatchDialogValuesFromBatch,
  createCustomerInventoryBatchMissingProcessingFeesState,
  createCustomerInventoryBatchNoteFeesState,
  createCustomerInventoryBatchPricingFeesState,
  createEmptyCustomerInventoryBatchDialogValues,
  defaultCustomerInventoryAdjustFormValues,
  getNextCustomerInventoryDetailFocusTarget,
  removeCustomerInventoryBatchRowState,
  updateCustomerInventoryAdjustFormFieldState,
  updateCustomerInventoryBatchCustomerState,
  updateCustomerInventoryBatchFormFieldState,
  updateCustomerInventoryBatchRowFieldState,
  type CustomerInventoryAdjustDialogApplyState,
  type CustomerInventoryAdjustFormErrors,
  type CustomerInventoryAdjustFormValues,
  type CustomerInventoryBatchCustomerUpdateState,
  type CustomerInventoryBatchDialogApplyState,
  type CustomerInventoryBatchErrors,
  type CustomerInventoryBatchFormFieldUpdateState,
  type CustomerInventoryBatchFormValues,
  type CustomerInventoryBatchRowsOnlyUpdateState,
  type CustomerInventoryBatchRowsUpdateState,
  type CustomerInventoryDetailField,
  type CustomerInventoryDetailInputField,
  type CustomerInventoryProcessingFeeField,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  type CustomerInventoryBatchRow,
  getCustomerInventoryBatchCategoryQuantityItems,
  getCustomerInventoryBatchRequiredCategories,
  getCustomerInventoryBatchTotalQuantity,
  getCustomerInventoryBatchTotalTheoreticalWeightX100,
  type InventoryNotice,
} from "@/features/inventory/lib/inventory-utils";
import {
  getCustomerProcessingFeesX100,
  getMatchedSpecialPricingKeyword,
} from "@/features/customers/lib/customer-pricing";
import type { Customer } from "@/features/customers/types";
import type {
  CustomerInventoryBatch,
  CustomerInventoryStockItem,
} from "@/features/inventory/types";
import type { Product } from "@/features/products/types";
import { getErrorMessage } from "@/lib/errors";
import type { ProcessingCategory } from "@/lib/processing-fees";

const customerInventoryProcessingFeeFields = [
  {
    category: "bridge",
    formKey: "bridgeProcessingFee",
    snapshotKey: "bridgeProcessingFeeX100",
  },
  {
    category: "powder",
    formKey: "powderProcessingFee",
    snapshotKey: "powderProcessingFeeX100",
  },
  {
    category: "billet",
    formKey: "billetProcessingFee",
    snapshotKey: "billetProcessingFeeX100",
  },
  {
    category: "oxidation",
    formKey: "oxidationProcessingFee",
    snapshotKey: "oxidationProcessingFeeX100",
  },
  {
    category: "electrophoresis",
    formKey: "electrophoresisProcessingFee",
    snapshotKey: "electrophoresisProcessingFeeX100",
  },
] as const satisfies Array<{
  category: ProcessingCategory;
} & CustomerInventoryProcessingFeeField>;

const initialCustomerInventoryBatchDialogValues =
  createEmptyCustomerInventoryBatchDialogValues();
export interface UseCustomerInventoryBatchOptions {
  customers: Customer[];
  onNotice: (notice: InventoryNotice) => void;
  products: Product[];
}

export function useCustomerInventoryBatch({
  customers,
  onNotice,
  products,
}: UseCustomerInventoryBatchOptions) {
  const queryClient = useQueryClient();
  const [customerInventoryOpen, setCustomerInventoryOpen] = useState(false);
  const [customerInventoryAdjustOpen, setCustomerInventoryAdjustOpen] =
    useState(false);
  const [customerInventoryFormValues, setCustomerInventoryFormValues] =
    useState<CustomerInventoryBatchFormValues>(
      initialCustomerInventoryBatchDialogValues.formValues,
    );
  const [customerInventoryRows, setCustomerInventoryRows] = useState<
    CustomerInventoryBatchRow[]
  >(initialCustomerInventoryBatchDialogValues.rows);
  const [customerInventoryErrors, setCustomerInventoryErrors] =
    useState<CustomerInventoryBatchErrors>({});
  const [editingCustomerInventoryBatch, setEditingCustomerInventoryBatch] =
    useState<CustomerInventoryBatch | null>(null);
  const [selectedCustomerInventoryBatch, setSelectedCustomerInventoryBatch] =
    useState<CustomerInventoryBatch | null>(null);
  const [
    customerInventoryAdjustFormValues,
    setCustomerInventoryAdjustFormValues,
  ] = useState<CustomerInventoryAdjustFormValues>(
    defaultCustomerInventoryAdjustFormValues,
  );
  const [customerInventoryAdjustErrors, setCustomerInventoryAdjustErrors] =
    useState<CustomerInventoryAdjustFormErrors>({});

  const adjustCustomerInventoryStockMutation = useMutation({
    mutationFn: (payload: AdjustCustomerInventoryStockPayload) =>
      adjustCustomerInventoryStock(payload),
    onSuccess: (_result, payload) => {
      const state = createCustomerInventoryAdjustDialogCloseState();

      queryClient.invalidateQueries({ queryKey: ["customer-inventory"] });
      onNotice({
        message: `客户库存已盘点，实际库存 ${payload.quantity} 支`,
        tone: "success",
      });
      setCustomerInventoryAdjustOpen(state.open);
      applyCustomerInventoryAdjustDialogState(state.dialogApplyState);
    },
  });

  const createCustomerInventoryBatchMutation = useMutation({
    mutationFn: (payload: CreateCustomerInventoryBatchPayload) =>
      createCustomerInventoryBatch(payload),
    onSuccess: () => {
      const state = createCustomerInventoryBatchDialogCloseState();

      queryClient.invalidateQueries({ queryKey: ["customer-inventory"] });
      onNotice({
        message: "客户历史库存已录入",
        tone: "success",
      });
      setCustomerInventoryOpen(state.open);
      setEditingCustomerInventoryBatch(state.editingBatch);
      applyCustomerInventoryBatchDialogState(state.dialogApplyState);
    },
  });

  const updateCustomerInventoryBatchMutation = useMutation({
    mutationFn: (payload: UpdateCustomerInventoryBatchPayload) =>
      updateCustomerInventoryBatch(payload),
    onSuccess: () => {
      const state = createCustomerInventoryBatchDialogCloseState();

      queryClient.invalidateQueries({ queryKey: ["customer-inventory"] });
      onNotice({
        message: "客户历史库存已更新",
        tone: "success",
      });
      setCustomerInventoryOpen(state.open);
      setEditingCustomerInventoryBatch(state.editingBatch);
      applyCustomerInventoryBatchDialogState(state.dialogApplyState);
    },
  });

  const getCustomerInventoryBatchMutation = useMutation({
    mutationFn: (batchId: string) => getCustomerInventoryBatch(batchId),
    onError: (error) => {
      onNotice({
        message: getErrorMessage(error) || "读取客户库存失败",
        tone: "warning",
      });
    },
    onSuccess: (batch) => {
      showCustomerInventoryBatchDialog(batch);
    },
  });

  const currentCustomerInventoryCustomer =
    customers.find(
      (customer) => customer.id === customerInventoryFormValues.customerId,
    ) ?? null;
  const isCustomerInventoryReadOnly = Boolean(
    editingCustomerInventoryBatch?.hasDeliveryNote,
  );
  const customerInventoryMatchedSpecialPricingKeyword =
    getMatchedSpecialPricingKeyword(
      currentCustomerInventoryCustomer,
      customerInventoryFormValues.note,
    );
  const customerInventoryProducts = customerInventoryFormValues.customerId
    ? products.filter((product) =>
        product.assignedCustomerIds.includes(
          customerInventoryFormValues.customerId,
        ),
      )
    : [];
  const shouldBlockCustomerInventoryProductSelect =
    !customerInventoryFormValues.customerId ||
    customerInventoryProducts.length === 0;
  const customerInventoryProductPlaceholder =
    !customerInventoryFormValues.customerId
      ? "请先选择客户"
      : customerInventoryProducts.length === 0
        ? "请先添加客户商品"
        : "选择商品";
  const customerInventoryDialogTitle = editingCustomerInventoryBatch
    ? isCustomerInventoryReadOnly
      ? "查看客户历史库存"
      : "修改客户历史库存"
    : "新增客户历史库存";
  const customerInventoryRequiredCategories = useMemo(
    () => getCustomerInventoryBatchRequiredCategories(customerInventoryRows),
    [customerInventoryRows],
  );
  const visibleCustomerInventoryProcessingFeeFields = useMemo(
    () =>
      customerInventoryProcessingFeeFields.filter((field) =>
        customerInventoryRequiredCategories.includes(field.category),
      ),
    [customerInventoryRequiredCategories],
  );
  const customerInventoryTotalQuantity = getCustomerInventoryBatchTotalQuantity(
    customerInventoryRows,
  );
  const customerInventoryCategoryQuantityItems = useMemo(
    () => getCustomerInventoryBatchCategoryQuantityItems(customerInventoryRows),
    [customerInventoryRows],
  );
  const customerInventoryTotalTheoreticalWeightKgX100 =
    getCustomerInventoryBatchTotalTheoreticalWeightX100(
      customerInventoryRows,
    );

  useEffect(() => {
    if (!customerInventoryFormValues.customerId) {
      return;
    }

    const customer = customers.find(
      (item) => item.id === customerInventoryFormValues.customerId,
    );

    if (!customer) {
      return;
    }

    const fees = getCustomerProcessingFeesX100(
      customer,
      customerInventoryFormValues.pricingTaxIncluded,
      customerInventoryFormValues.note,
    );

    setCustomerInventoryFormValues(
      (current) =>
        createCustomerInventoryBatchMissingProcessingFeesState({
          fees,
          fields: visibleCustomerInventoryProcessingFeeFields,
          values: current,
        }).values,
    );
  }, [
    customerInventoryFormValues.customerId,
    customerInventoryFormValues.note,
    customerInventoryFormValues.pricingTaxIncluded,
    customers,
    visibleCustomerInventoryProcessingFeeFields,
  ]);

  function openCustomerInventoryAdjustDialog(
    batch: CustomerInventoryBatch,
    item: CustomerInventoryStockItem,
  ) {
    adjustCustomerInventoryStockMutation.reset();
    const state = createCustomerInventoryAdjustDialogOpenState(
      createCustomerInventoryAdjustFormValues({ batch, item }),
    );

    applyCustomerInventoryAdjustDialogState(state.dialogApplyState);
    setCustomerInventoryAdjustOpen(state.open);
  }

  function handleCustomerInventoryAdjustOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setCustomerInventoryAdjustOpen(nextOpen);
      return;
    }

    const state = createCustomerInventoryAdjustDialogCloseState();

    setCustomerInventoryAdjustOpen(state.open);
    adjustCustomerInventoryStockMutation.reset();
    applyCustomerInventoryAdjustDialogState(state.dialogApplyState);
  }

  function applyCustomerInventoryAdjustDialogState(
    state: CustomerInventoryAdjustDialogApplyState,
  ) {
    setCustomerInventoryAdjustErrors(state.errors);
    setCustomerInventoryAdjustFormValues(state.values);
  }

  function handleCustomerInventoryAdjustFormValueChange<
    Key extends keyof CustomerInventoryAdjustFormValues,
  >(key: Key, value: CustomerInventoryAdjustFormValues[Key]) {
    const nextState = updateCustomerInventoryAdjustFormFieldState({
      errors: customerInventoryAdjustErrors,
      key,
      value,
      values: customerInventoryAdjustFormValues,
    });

    applyCustomerInventoryAdjustDialogState(nextState);
  }

  function applyCustomerInventoryBatchDialogState(
    state: CustomerInventoryBatchDialogApplyState,
  ) {
    setCustomerInventoryFormValues(state.formValues);
    setCustomerInventoryRows(state.rows);
    setCustomerInventoryErrors(state.errors);
  }

  function applyCustomerInventoryBatchCustomerUpdateState(
    state: CustomerInventoryBatchCustomerUpdateState,
  ) {
    setCustomerInventoryFormValues(state.values);
    setCustomerInventoryRows(state.rows);
    setCustomerInventoryErrors(state.errors);
  }

  function applyCustomerInventoryBatchFormFieldUpdateState(
    state: CustomerInventoryBatchFormFieldUpdateState,
  ) {
    setCustomerInventoryFormValues(state.values);
    setCustomerInventoryErrors(state.errors);
  }

  function applyCustomerInventoryBatchRowsUpdateState(
    state: CustomerInventoryBatchRowsUpdateState,
  ) {
    setCustomerInventoryRows(state.rows);
    setCustomerInventoryErrors(state.errors);
  }

  function applyCustomerInventoryBatchRowsOnlyUpdateState(
    state: CustomerInventoryBatchRowsOnlyUpdateState,
  ) {
    setCustomerInventoryRows(state.rows);
  }

  function openCustomerInventoryDialog() {
    createCustomerInventoryBatchMutation.reset();
    updateCustomerInventoryBatchMutation.reset();
    const state = createCustomerInventoryBatchDialogOpenState({
      editingBatch: null,
      values: createEmptyCustomerInventoryBatchDialogValues(),
    });

    setEditingCustomerInventoryBatch(state.editingBatch);
    applyCustomerInventoryBatchDialogState(state.dialogApplyState);
    setCustomerInventoryOpen(state.open);
  }

  function showCustomerInventoryBatchDialog(batch: CustomerInventoryBatch) {
    createCustomerInventoryBatchMutation.reset();
    updateCustomerInventoryBatchMutation.reset();
    const state = createCustomerInventoryBatchDialogOpenState({
      editingBatch: batch,
      values: createCustomerInventoryBatchDialogValuesFromBatch({
        batch,
        products,
      }),
    });

    setEditingCustomerInventoryBatch(state.editingBatch);
    applyCustomerInventoryBatchDialogState(state.dialogApplyState);
    setCustomerInventoryOpen(state.open);
  }

  function openCustomerInventoryBatchDialog(batch: CustomerInventoryBatch) {
    getCustomerInventoryBatchMutation.mutate(batch.id);
  }

  function handleCustomerInventoryOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setCustomerInventoryOpen(nextOpen);
      return;
    }

    const state = createCustomerInventoryBatchDialogCloseState();

    setCustomerInventoryOpen(state.open);
    createCustomerInventoryBatchMutation.reset();
    updateCustomerInventoryBatchMutation.reset();
    setEditingCustomerInventoryBatch(state.editingBatch);
    applyCustomerInventoryBatchDialogState(state.dialogApplyState);
  }

  function handleCustomerInventoryClearError(key: string) {
    setCustomerInventoryErrors(
      (current) =>
        clearCustomerInventoryBatchFormErrorState({
          errors: current,
          key,
        }).errors,
    );
  }

  function handleCustomerInventoryHistoricalOrderDateFocus() {
    handleCustomerInventoryClearError("historicalOrderDate");
  }

  function handleCustomerInventoryCustomerChange(nextCustomerId: string) {
    const nextCustomer = customers.find(
      (customer) => customer.id === nextCustomerId,
    );
    const nextPricingTaxIncluded =
      nextCustomer?.defaultPricingTaxIncluded ??
      customerInventoryFormValues.pricingTaxIncluded;

    const fees = getCustomerProcessingFeesX100(
      nextCustomer,
      nextPricingTaxIncluded,
      customerInventoryFormValues.note,
    );

    const nextState = updateCustomerInventoryBatchCustomerState({
      customerId: nextCustomerId,
      errors: customerInventoryErrors,
      fees,
      pricingTaxIncluded: nextPricingTaxIncluded,
      rows: customerInventoryRows,
      values: customerInventoryFormValues,
    });

    applyCustomerInventoryBatchCustomerUpdateState(nextState);
  }

  function handleCustomerInventoryFormValueChange<
    Key extends keyof CustomerInventoryBatchFormValues,
  >(key: Key, value: CustomerInventoryBatchFormValues[Key]) {
    const nextState = updateCustomerInventoryBatchFormFieldState({
      errors: customerInventoryErrors,
      key,
      value,
      values: customerInventoryFormValues,
    });

    applyCustomerInventoryBatchFormFieldUpdateState(nextState);
  }

  function handleCustomerInventoryNoteChange(nextNote: string) {
    const customer = customers.find(
      (item) => item.id === customerInventoryFormValues.customerId,
    );
    const fees = getCustomerProcessingFeesX100(
      customer,
      customerInventoryFormValues.pricingTaxIncluded,
      nextNote,
    );

    setCustomerInventoryFormValues(
      (current) =>
        createCustomerInventoryBatchNoteFeesState({
          fees,
          note: nextNote,
          values: current,
        }).values,
    );
  }

  function handleCustomerInventoryPricingTaxIncludedChange(
    nextPricingTaxIncluded: boolean,
  ) {
    const fees = getCustomerProcessingFeesX100(
      currentCustomerInventoryCustomer,
      nextPricingTaxIncluded,
      customerInventoryFormValues.note,
    );

    setCustomerInventoryFormValues(
      (current) =>
        createCustomerInventoryBatchPricingFeesState({
          fees,
          pricingTaxIncluded: nextPricingTaxIncluded,
          values: current,
        }).values,
    );
  }

  function handleCustomerInventoryRemoveRow(rowIndex: number) {
    const nextState = removeCustomerInventoryBatchRowState({
      rowIndex,
      rows: customerInventoryRows,
    });

    applyCustomerInventoryBatchRowsOnlyUpdateState(nextState);
  }

  function appendCustomerInventoryRow() {
    setCustomerInventoryRows(
      (current) => appendCustomerInventoryBatchRowState(current).rows,
    );
  }

  function handleCustomerInventoryRowFieldChange(
    rowIndex: number,
    field: CustomerInventoryDetailInputField,
    value: string,
  ) {
    const nextState = updateCustomerInventoryBatchRowFieldState({
      errors: customerInventoryErrors,
      field,
      rowIndex,
      rows: customerInventoryRows,
      value,
    });

    applyCustomerInventoryBatchRowsUpdateState(nextState);
  }

  function handleCustomerInventoryRowProductChange(
    rowIndex: number,
    productId: string,
  ) {
    const product = customerInventoryProducts.find(
      (item) => item.id === productId,
    );
    const nextState = applyCustomerInventoryBatchRowProductState({
      errors: customerInventoryErrors,
      product,
      rowIndex,
      rows: customerInventoryRows,
    });

    applyCustomerInventoryBatchRowsUpdateState(nextState);
    focusCustomerInventoryDetailTarget(rowIndex, "lengthMm");
  }

  function focusCustomerInventoryDetailTarget(
    rowIndex: number,
    field: CustomerInventoryDetailField,
  ) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = document.querySelector<HTMLElement>(
          `[data-customer-inventory-row="${rowIndex}"][data-customer-inventory-field="${field}"]`,
        );

        element?.focus();
        element?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
  }

  function confirmCustomerInventoryDetailOnEnter(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: CustomerInventoryDetailInputField,
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    const target = getNextCustomerInventoryDetailFocusTarget({
      field,
      rowCount: customerInventoryRows.length,
      rowIndex,
    });

    if (target.shouldAppendRow) {
      appendCustomerInventoryRow();
    }

    focusCustomerInventoryDetailTarget(target.rowIndex, target.field);
  }

  function submitCustomerInventoryAdjustment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const { errors, payload } = collectCustomerInventoryAdjustmentSubmitState(
      customerInventoryAdjustFormValues,
    );

    if (!payload) {
      setCustomerInventoryAdjustErrors(errors);
      return;
    }

    adjustCustomerInventoryStockMutation.mutate(payload);
  }

  function submitCustomerInventoryBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCustomerInventoryReadOnly) {
      return;
    }

    const { errors, payload } = collectCustomerInventoryBatchSubmitState({
      requiredCategories: customerInventoryRequiredCategories,
      rows: customerInventoryRows,
      values: customerInventoryFormValues,
    });

    if (!payload) {
      setCustomerInventoryErrors(errors);
      return;
    }

    if (
      editingCustomerInventoryBatch &&
      !editingCustomerInventoryBatch.hasDeliveryNote
    ) {
      updateCustomerInventoryBatchMutation.mutate({
        ...payload,
        batchId: editingCustomerInventoryBatch.id,
      });
      return;
    }

    createCustomerInventoryBatchMutation.mutate(payload);
  }
  return {
    adjustCustomerInventoryStockMutation,
    appendCustomerInventoryRow,
    confirmCustomerInventoryDetailOnEnter,
    createCustomerInventoryBatchMutation,
    customerInventoryAdjustErrors,
    customerInventoryAdjustFormValues,
    customerInventoryAdjustOpen,
    customerInventoryCategoryQuantityItems,
    customerInventoryDialogTitle,
    customerInventoryErrors,
    customerInventoryFormValues,
    customerInventoryMatchedSpecialPricingKeyword,
    customerInventoryOpen,
    customerInventoryProductPlaceholder,
    customerInventoryProducts,
    customerInventoryRows,
    customerInventoryTotalQuantity,
    customerInventoryTotalTheoreticalWeightKgX100,
    editingCustomerInventoryBatch,
    getCustomerInventoryBatchMutation,
    handleCustomerInventoryAdjustFormValueChange,
    handleCustomerInventoryAdjustOpenChange,
    handleCustomerInventoryCustomerChange,
    handleCustomerInventoryFormValueChange,
    handleCustomerInventoryHistoricalOrderDateFocus,
    handleCustomerInventoryNoteChange,
    handleCustomerInventoryOpenChange,
    handleCustomerInventoryPricingTaxIncludedChange,
    handleCustomerInventoryRemoveRow,
    handleCustomerInventoryRowFieldChange,
    handleCustomerInventoryRowProductChange,
    isCustomerInventoryReadOnly,
    openCustomerInventoryAdjustDialog,
    openCustomerInventoryBatchDialog,
    openCustomerInventoryDialog,
    selectedCustomerInventoryBatch,
    setSelectedCustomerInventoryBatch,
    shouldBlockCustomerInventoryProductSelect,
    submitCustomerInventoryAdjustment,
    submitCustomerInventoryBatch,
    updateCustomerInventoryBatchMutation,
    visibleCustomerInventoryProcessingFeeFields,
  };
}
