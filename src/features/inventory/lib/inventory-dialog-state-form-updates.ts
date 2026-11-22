import { parseIntegerInput } from "@/lib/number-input"
import type {
  CustomerInventoryAdjustDialogApplyState,
  CustomerInventoryAdjustFormErrors,
  CustomerInventoryAdjustFormValues,
  CustomerInventoryAdjustmentSubmitState,
  InventoryAdjustmentSubmitState,
  InventoryDialogApplyState,
  InventoryFormErrors,
  InventoryFormValues,
  OrderInventoryAdjustmentSubmitState,
  OrderInventoryDialogApplyState,
  OrderInventoryFormErrors,
  OrderInventoryFormValues,
  TransferInventoryDialogApplyState,
  TransferInventoryFormErrors,
  TransferInventoryFormValues,
  TransferInventorySubmitState,
} from "./inventory-dialog-state-types"

export function updateInventoryFormField<Key extends keyof InventoryFormValues>({
  key,
  value,
  values,
}: {
  key: Key
  value: InventoryFormValues[Key]
  values: InventoryFormValues
}): InventoryFormValues {
  return {
    ...values,
    [key]: value,
  }
}

export function clearInventoryFormError(
  errors: InventoryFormErrors,
  key: string,
): InventoryFormErrors {
  return {
    ...errors,
    [key]: undefined,
  }
}

export function updateInventoryFormFieldState<
  Key extends keyof InventoryFormValues,
>({
  errors,
  key,
  value,
  values,
}: {
  errors: InventoryFormErrors
  key: Key
  value: InventoryFormValues[Key]
  values: InventoryFormValues
}): InventoryDialogApplyState {
  return {
    errors: clearInventoryFormError(errors, key),
    values: updateInventoryFormField({ key, value, values }),
  }
}

export function collectInventoryAdjustmentSubmitState({
  currentQuantity,
  values,
}: {
  currentQuantity: number
  values: InventoryFormValues
}): InventoryAdjustmentSubmitState {
  const errors: InventoryFormErrors = {}
  const lengthMm = parseIntegerInput(values.lengthMm)
  const quantity = parseIntegerInput(values.quantity)

  if (!values.productId) {
    errors.productId = "请选择商品"
  }

  if (lengthMm === null || lengthMm <= 0) {
    errors.lengthMm = "请输入长度"
  }

  if (!values.color.trim()) {
    errors.color = "请输入颜色"
  }

  if (quantity === null) {
    errors.quantity = "请输入数量"
  } else if (values.movementType === "adjust" && quantity < 0) {
    errors.quantity = "盘点数量不能小于 0"
  } else if (values.movementType !== "adjust" && quantity <= 0) {
    errors.quantity = "数量必须大于 0"
  } else if (values.movementType === "out" && quantity > currentQuantity) {
    errors.quantity = "出库数量不能大于当前库存"
  }

  if (
    Object.keys(errors).length > 0 ||
    lengthMm === null ||
    quantity === null
  ) {
    return { errors, payload: null }
  }

  return {
    errors,
    payload: {
      color: values.color.trim(),
      lengthMm,
      movementType: values.movementType,
      note: values.note.trim(),
      productId: values.productId,
      quantity,
    },
  }
}

export function updateOrderInventoryFormField<
  Key extends keyof OrderInventoryFormValues,
>({
  key,
  value,
  values,
}: {
  key: Key
  value: OrderInventoryFormValues[Key]
  values: OrderInventoryFormValues
}): OrderInventoryFormValues {
  return {
    ...values,
    [key]: value,
  }
}

export function clearOrderInventoryFormError(
  errors: OrderInventoryFormErrors,
  key: string,
): OrderInventoryFormErrors {
  return {
    ...errors,
    [key]: undefined,
  }
}

export function updateOrderInventoryFormFieldState<
  Key extends keyof OrderInventoryFormValues,
>({
  errors,
  key,
  value,
  values,
}: {
  errors: OrderInventoryFormErrors
  key: Key
  value: OrderInventoryFormValues[Key]
  values: OrderInventoryFormValues
}): OrderInventoryDialogApplyState {
  return {
    errors: clearOrderInventoryFormError(errors, key),
    values: updateOrderInventoryFormField({ key, value, values }),
  }
}

export function collectOrderInventoryAdjustmentSubmitState(
  values: OrderInventoryFormValues,
): OrderInventoryAdjustmentSubmitState {
  const errors: OrderInventoryFormErrors = {}
  const quantity = parseIntegerInput(values.quantity)

  if (!values.productId) {
    errors.productId = "请选择商品"
  }

  if (quantity === null || (values.movementType !== "adjust" && quantity === 0)) {
    errors.quantity =
      values.movementType === "adjust" ? "调整数量不能小于 0" : "数量必须大于 0"
  } else if (
    values.movementType === "ship" &&
    quantity > values.currentQuantity
  ) {
    errors.quantity = "出库数量不能大于当前库存"
  }

  if (Object.keys(errors).length > 0 || quantity === null) {
    return { errors, payload: null }
  }

  return {
    errors,
    payload: {
      color: values.color,
      lengthMm: values.lengthMm,
      movementType: values.movementType,
      note: values.note.trim(),
      orderId: values.orderId,
      productId: values.productId,
      quantity,
    },
  }
}

export function updateCustomerInventoryAdjustFormField<
  Key extends keyof CustomerInventoryAdjustFormValues,
>({
  key,
  value,
  values,
}: {
  key: Key
  value: CustomerInventoryAdjustFormValues[Key]
  values: CustomerInventoryAdjustFormValues
}): CustomerInventoryAdjustFormValues {
  return {
    ...values,
    [key]: value,
  }
}

export function clearCustomerInventoryAdjustFormError(
  errors: CustomerInventoryAdjustFormErrors,
  key: string,
): CustomerInventoryAdjustFormErrors {
  return {
    ...errors,
    [key]: undefined,
  }
}

export function updateCustomerInventoryAdjustFormFieldState<
  Key extends keyof CustomerInventoryAdjustFormValues,
>({
  errors,
  key,
  value,
  values,
}: {
  errors: CustomerInventoryAdjustFormErrors
  key: Key
  value: CustomerInventoryAdjustFormValues[Key]
  values: CustomerInventoryAdjustFormValues
}): CustomerInventoryAdjustDialogApplyState {
  return {
    errors: clearCustomerInventoryAdjustFormError(errors, key),
    values: updateCustomerInventoryAdjustFormField({ key, value, values }),
  }
}

export function collectCustomerInventoryAdjustmentSubmitState(
  values: CustomerInventoryAdjustFormValues,
): CustomerInventoryAdjustmentSubmitState {
  const errors: CustomerInventoryAdjustFormErrors = {}
  const quantity = parseIntegerInput(values.quantity)

  if (!values.stockId) {
    errors.form = "请选择客户库存明细"
  }

  if (quantity === null) {
    errors.quantity = "请输入实际库存"
  } else if (quantity < 0) {
    errors.quantity = "盘点数量不能小于 0"
  } else if (quantity === values.currentQuantity) {
    errors.quantity = "盘点数量未变化"
  }

  if (Object.keys(errors).length > 0 || quantity === null) {
    return { errors, payload: null }
  }

  return {
    errors,
    payload: {
      note: values.note.trim(),
      quantity,
      stockId: values.stockId,
    },
  }
}

export function updateTransferInventoryFormField<
  Key extends keyof TransferInventoryFormValues,
>({
  key,
  value,
  values,
}: {
  key: Key
  value: TransferInventoryFormValues[Key]
  values: TransferInventoryFormValues
}): TransferInventoryFormValues {
  return {
    ...values,
    [key]: value,
  }
}

export function clearTransferInventoryFormError(
  errors: TransferInventoryFormErrors,
  key: string,
): TransferInventoryFormErrors {
  return {
    ...errors,
    [key]: undefined,
  }
}

export function updateTransferInventoryFormFieldState<
  Key extends keyof TransferInventoryFormValues,
>({
  errors,
  key,
  value,
  values,
}: {
  errors: TransferInventoryFormErrors
  key: Key
  value: TransferInventoryFormValues[Key]
  values: TransferInventoryFormValues
}): TransferInventoryDialogApplyState {
  return {
    errors: clearTransferInventoryFormError(errors, key),
    values: updateTransferInventoryFormField({ key, value, values }),
  }
}

export function collectTransferInventorySubmitState(
  values: TransferInventoryFormValues,
): TransferInventorySubmitState {
  const errors: TransferInventoryFormErrors = {}
  const quantity = parseIntegerInput(values.quantity)

  if (quantity === null || quantity <= 0) {
    errors.quantity = "转入数量必须大于 0"
  } else if (quantity > values.publicQuantity) {
    errors.quantity = "转入数量不能大于公共库存"
  }

  if (Object.keys(errors).length > 0 || quantity === null) {
    return { errors, payload: null }
  }

  return {
    errors,
    payload: {
      color: values.color,
      lengthMm: values.lengthMm,
      note: values.note.trim() || `转入订单 ${values.orderId}`,
      orderId: values.orderId,
      productId: values.productId,
      quantity,
    },
  }
}
