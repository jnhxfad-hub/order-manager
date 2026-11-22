import type { CustomerInventoryBatchRow } from "@/features/inventory/lib/inventory-utils"
import type {
  ParseCustomerInventoryImportResult,
  ParsedCustomerInventoryImportRow,
} from "@/features/inventory/api/inventory-api"
import type {
  CustomerInventoryBatch,
  CustomerInventoryStockItem,
  InventoryItem,
  OrderInventoryItem,
  OrderInventoryMovementType,
} from "@/features/inventory/types"
import { parseMoneyToX100 } from "@/lib/money"
import { getOrderInventoryQuantitySuggestion } from "./inventory-dialog-state-delivery-note"
import type {
  BatchOrderImageRecognitionUiState,
  CustomerInventoryAdjustDialogApplyState,
  CustomerInventoryAdjustDialogCloseState,
  CustomerInventoryAdjustDialogOpenState,
  CustomerInventoryAdjustFormValues,
  CustomerInventoryBatchFormValues,
  CustomerInventoryImportPreviewState,
  DeliveryNoteFormErrors,
  DeliveryNoteFormValues,
  InventoryDialogApplyState,
  InventoryDialogCloseState,
  InventoryDialogOpenState,
  InventoryFormValues,
  MergeDeliveryNoteDialogValues,
  OrderInventoryDialogApplyState,
  OrderInventoryDialogCloseState,
  OrderInventoryDialogOpenState,
  OrderInventoryFormValues,
  TransferInventoryDialogApplyState,
  TransferInventoryDialogCloseState,
  TransferInventoryDialogOpenState,
  TransferInventoryFormValues,
} from "./inventory-dialog-state-types"

export const defaultDeliveryNoteFormValues: DeliveryNoteFormValues = {
  extraCharges: [{ name: "", amount: "" }],
  billetWeightKg: "",
  bridgeWeightKg: "",
  electrophoresisWeightKg: "",
  extraChargeAmount: "",
  extraChargeName: "",
  handlerName: "",
  oxidationWeightKg: "",
  note: "",
  powderWeightKg: "",
  pricingTaxIncluded: true,
  specialNote: "",
}

export const defaultInventoryFormValues: InventoryFormValues = {
  color: "",
  lengthMm: "",
  movementType: "in",
  note: "",
  productId: "",
  quantity: "",
}

export const defaultOrderInventoryFormValues: OrderInventoryFormValues = {
  color: "",
  currentQuantity: 0,
  lengthMm: 0,
  moldCode: "",
  movementType: "produce",
  note: "",
  orderId: "",
  productId: "",
  productName: "",
  quantity: "",
  requiredQuantity: 0,
}

export const defaultTransferInventoryFormValues: TransferInventoryFormValues = {
  color: "",
  currentQuantity: 0,
  lengthMm: 0,
  moldCode: "",
  note: "",
  orderId: "",
  productId: "",
  productName: "",
  publicQuantity: 0,
  quantity: "",
  requiredQuantity: 0,
}

export const defaultCustomerInventoryBatchFormValues: CustomerInventoryBatchFormValues =
  {
    aluminumIngotPrice: "",
    batchId: "",
    billetProcessingFee: "",
    bridgeProcessingFee: "",
    customerId: "",
    electrophoresisProcessingFee: "",
    historicalOrderDate: "",
    historicalOrderRef: "",
    note: "",
    oxidationProcessingFee: "",
    powderProcessingFee: "",
    pricingTaxIncluded: true,
  }

export const defaultCustomerInventoryBatchRow: CustomerInventoryBatchRow = {
  color: "",
  lengthMm: "",
  moldCode: "",
  note: "",
  productId: "",
  productName: "",
  quantity: "",
  thicknessMmX100: 0,
  weightPerMeterKgX1000: 0,
}

export const defaultCustomerInventoryAdjustFormValues: CustomerInventoryAdjustFormValues =
  {
    batchId: "",
    color: "",
    currentQuantity: 0,
    lengthMm: 0,
    moldCode: "",
    note: "",
    productName: "",
    quantity: "",
    stockId: "",
  }

export const defaultMergeDeliveryNoteDialogValues: MergeDeliveryNoteDialogValues =
  {
    customGroupsByDeliveryNoteId: {},
    deliveryNoteIds: [],
    specialNote: "",
  }

export const defaultBatchOrderImageRecognitionUiState: BatchOrderImageRecognitionUiState =
  {
    imageMatches: [],
    imagePreviewIndex: 0,
    imagePreviewOpen: false,
    imagePreviews: [],
    imageRawTextOpen: false,
    imageRawTexts: [],
    recognizedImagePaths: [],
    skippedImagePaths: [],
  }

export function parseDeliveryExtraCharges(values: DeliveryNoteFormValues): {
  amountX100: number
  errors: DeliveryNoteFormErrors
  name: string
  charges: Array<{ name: string; amountX100: number }>
} {
  const errors: DeliveryNoteFormErrors = {}
  const charges = values.extraCharges.flatMap((row, index) => {
    const name = row.name.trim()
    if (!name && !row.amount.trim()) return []
    const amountX100 = parseMoneyToX100(row.amount)
    if (!name) errors[`extraChargeName-${index}`] = "请填写收费名称"
    if (amountX100 === null || amountX100 <= 0) {
      errors[`extraChargeAmount-${index}`] = "收费金额必须大于 0"
    }
    return [{ name, amountX100: amountX100 ?? 0 }]
  })
  const amountX100 = charges.reduce((total, row) => total + row.amountX100, 0)
  if (!Number.isSafeInteger(amountX100)) errors.form = "其他费用合计超出允许范围"
  return {
    amountX100,
    errors,
    name: charges.map((row) => row.name).join("、"),
    charges,
  }
}

export function parseDeliveryExtraCharge(values: DeliveryNoteFormValues): {
  amountX100: number | null
  errors: DeliveryNoteFormErrors
  name: string
} {
  const name = values.extraChargeName.trim()
  const amountX100 = name ? parseMoneyToX100(values.extraChargeAmount) : 0
  const errors: Pick<
    DeliveryNoteFormErrors,
    "extraChargeAmount" | "extraChargeName"
  > = {}

  if (!name && values.extraChargeAmount.trim()) {
    errors.extraChargeName = "请填写收费名称"
  }

  if (name && amountX100 === null) {
    errors.extraChargeAmount = "收费金额只能输入数字"
  }

  if (name && amountX100 !== null && amountX100 <= 0) {
    errors.extraChargeAmount = "收费金额必须大于 0"
  }

  return { amountX100, errors, name }
}

export function normalizeCustomerInventoryHistoricalOrderDate(value: string): {
  error?: string
  value: string | null
} {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return { value: null }
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue)

  if (!match) {
    return { error: "日期格式为 YYYY-MM-DD", value: null }
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return { error: "请输入有效日期", value: null }
  }

  return { value: trimmedValue }
}

export function createInventoryFormValues(item: InventoryItem): InventoryFormValues {
  return {
    ...defaultInventoryFormValues,
    color: item.color,
    lengthMm: String(item.lengthMm),
    productId: item.productId,
  }
}

export function createInventoryDialogApplyState(
  values: InventoryFormValues,
): InventoryDialogApplyState {
  return {
    errors: {},
    values,
  }
}

export function createEmptyInventoryDialogApplyState(): InventoryDialogApplyState {
  return createInventoryDialogApplyState(defaultInventoryFormValues)
}

export function createInventoryDialogOpenState(
  values: InventoryFormValues,
): InventoryDialogOpenState {
  return {
    dialogApplyState: createInventoryDialogApplyState(values),
    open: true,
  }
}

export function createInventoryDialogCloseState(): InventoryDialogCloseState {
  return {
    dialogApplyState: createEmptyInventoryDialogApplyState(),
    open: false,
  }
}

export function createOrderInventoryFormValues({
  item,
  movementType,
}: {
  item: OrderInventoryItem
  movementType: OrderInventoryMovementType
}): OrderInventoryFormValues {
  return {
    color: item.color,
    currentQuantity: item.orderQuantity,
    lengthMm: item.lengthMm,
    moldCode: item.moldCode,
    movementType,
    note: "",
    orderId: item.orderId,
    productId: item.productId,
    productName: item.productName,
    quantity: getOrderInventoryQuantitySuggestion({
      currentQuantity: item.orderQuantity,
      movementType,
      requiredQuantity: item.requiredQuantity,
    }),
    requiredQuantity: item.requiredQuantity,
  }
}

export function createOrderInventoryDialogApplyState(
  values: OrderInventoryFormValues,
): OrderInventoryDialogApplyState {
  return {
    errors: {},
    values,
  }
}

export function createEmptyOrderInventoryDialogApplyState(): OrderInventoryDialogApplyState {
  return createOrderInventoryDialogApplyState(defaultOrderInventoryFormValues)
}

export function createOrderInventoryDialogOpenState(
  values: OrderInventoryFormValues,
): OrderInventoryDialogOpenState {
  return {
    dialogApplyState: createOrderInventoryDialogApplyState(values),
    open: true,
  }
}

export function createOrderInventoryDialogCloseState(): OrderInventoryDialogCloseState {
  return {
    dialogApplyState: createEmptyOrderInventoryDialogApplyState(),
    open: false,
  }
}

export function createTransferInventoryFormValues(
  item: OrderInventoryItem,
): TransferInventoryFormValues {
  const suggestedQuantity = Math.min(
    item.publicQuantity,
    Math.max(item.requiredQuantity - item.orderQuantity, 0),
  )

  return {
    color: item.color,
    currentQuantity: item.orderQuantity,
    lengthMm: item.lengthMm,
    moldCode: item.moldCode,
    note: "",
    orderId: item.orderId,
    productId: item.productId,
    productName: item.productName,
    publicQuantity: item.publicQuantity,
    quantity: suggestedQuantity > 0 ? String(suggestedQuantity) : "",
    requiredQuantity: item.requiredQuantity,
  }
}

export function createTransferInventoryDialogApplyState(
  values: TransferInventoryFormValues,
): TransferInventoryDialogApplyState {
  return {
    errors: {},
    values,
  }
}

export function createEmptyTransferInventoryDialogApplyState(): TransferInventoryDialogApplyState {
  return createTransferInventoryDialogApplyState(defaultTransferInventoryFormValues)
}

export function createTransferInventoryDialogOpenState(
  values: TransferInventoryFormValues,
): TransferInventoryDialogOpenState {
  return {
    dialogApplyState: createTransferInventoryDialogApplyState(values),
    open: true,
  }
}

export function createTransferInventoryDialogCloseState(): TransferInventoryDialogCloseState {
  return {
    dialogApplyState: createEmptyTransferInventoryDialogApplyState(),
    open: false,
  }
}

export function createCustomerInventoryAdjustFormValues({
  batch,
  item,
}: {
  batch: CustomerInventoryBatch
  item: CustomerInventoryStockItem
}): CustomerInventoryAdjustFormValues {
  return {
    batchId: batch.id,
    color: item.color,
    currentQuantity: item.quantity,
    lengthMm: item.lengthMm,
    moldCode: item.moldCode,
    note: "",
    productName: item.productName,
    quantity: String(item.quantity),
    stockId: item.id,
  }
}

export function createCustomerInventoryAdjustDialogApplyState(
  values: CustomerInventoryAdjustFormValues,
): CustomerInventoryAdjustDialogApplyState {
  return {
    errors: {},
    values,
  }
}

export function createEmptyCustomerInventoryAdjustDialogApplyState(): CustomerInventoryAdjustDialogApplyState {
  return createCustomerInventoryAdjustDialogApplyState(
    defaultCustomerInventoryAdjustFormValues,
  )
}

export function createCustomerInventoryAdjustDialogOpenState(
  values: CustomerInventoryAdjustFormValues,
): CustomerInventoryAdjustDialogOpenState {
  return {
    dialogApplyState: createCustomerInventoryAdjustDialogApplyState(values),
    open: true,
  }
}

export function createCustomerInventoryAdjustDialogCloseState(): CustomerInventoryAdjustDialogCloseState {
  return {
    dialogApplyState: createEmptyCustomerInventoryAdjustDialogApplyState(),
    open: false,
  }
}

export function createEmptyCustomerInventoryImportPreviewState(): CustomerInventoryImportPreviewState {
  return {
    errors: [],
    fileName: "",
    rows: [],
  }
}

export function getCustomerInventoryImportFileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

export function createCustomerInventoryImportFileSelectionState(
  filePath: string,
): CustomerInventoryImportPreviewState {
  return {
    errors: [],
    fileName: getCustomerInventoryImportFileName(filePath),
    rows: [],
  }
}

export function createCustomerInventoryImportParseSuccessState({
  fileName,
  result,
}: {
  fileName: string
  result: ParseCustomerInventoryImportResult
}): CustomerInventoryImportPreviewState {
  return {
    errors: result.errors,
    fileName,
    rows: result.rows,
  }
}

export function createCustomerInventoryImportErrorState({
  fileName,
  message,
  rows = [],
}: {
  fileName: string
  message: string
  rows?: ParsedCustomerInventoryImportRow[]
}): CustomerInventoryImportPreviewState {
  return {
    errors: [message],
    fileName,
    rows,
  }
}
