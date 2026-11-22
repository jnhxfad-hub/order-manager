import type {
  BatchOrderImagePreview,
  BatchOrderImageRecognitionMatch,
  BatchOrderImageRecognitionRequest,
  BatchOrderInventoryRow,
  CustomerInventoryDeliveryCreateResult,
  CustomerInventoryBatchRow,
  CustomerInventoryDeliveryPriceGroupView,
  CustomerInventoryDeliveryRow,
  DeliveryNoteFormRow,
  DeliveryNoteWeightKey,
  OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils"
import type {
  AdjustCustomerInventoryStockPayload,
  AdjustInventoryPayload,
  AdjustOrderInventoryPayload,
  AdjustOrderInventoryBatchPayload,
  CreateCustomerInventoryBatchPayload,
  CreateCustomerInventoryDeliveryNotePayload,
  CreateDeliveryNotePayload,
  ParsedCustomerInventoryImportRow,
  TransferPublicInventoryToOrderPayload,
} from "@/features/inventory/api/inventory-api"
import type {
  CustomerInventoryBatch,
  DeliveryNote,
  MergedDeliveryNote,
  OrderInventoryMovementType,
} from "@/features/inventory/types"

export type DeliveryNoteFormValues = {
  extraCharges: Array<{ name: string; amount: string }>
  pricingTaxIncluded: boolean
  handlerName: string
  bridgeWeightKg: string
  powderWeightKg: string
  billetWeightKg: string
  oxidationWeightKg: string
  electrophoresisWeightKg: string
  extraChargeAmount: string
  extraChargeName: string
  note: string
  specialNote: string
}

export type DeliveryNoteFormErrors = Partial<
  Record<
    | "bridgeWeightKg"
    | "powderWeightKg"
    | "billetWeightKg"
    | "oxidationWeightKg"
    | "electrophoresisWeightKg"
    | "extraChargeAmount"
    | "extraChargeName",
    string
  >
> &
  Partial<Record<"handlerName", string>> &
  Partial<Record<string, string>> & {
    form?: string
  }

export type BatchOrderInventoryFormErrors = Partial<Record<string, string>> & {
  form?: string
}

export type InventoryFormValues = {
  productId: string
  lengthMm: string
  color: string
  movementType: "adjust" | "in" | "out"
  quantity: string
  note: string
}

export type InventoryFormErrors = Partial<Record<keyof InventoryFormValues, string>>

export type OrderInventoryFormValues = {
  orderId: string
  productId: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  currentQuantity: number
  requiredQuantity: number
  movementType: OrderInventoryMovementType
  quantity: string
  note: string
}

export type OrderInventoryFormErrors = Partial<
  Record<"quantity" | "productId", string>
>

export type CustomerInventoryBatchFormValues = {
  batchId: string
  customerId: string
  historicalOrderDate: string
  historicalOrderRef: string
  aluminumIngotPrice: string
  pricingTaxIncluded: boolean
  bridgeProcessingFee: string
  powderProcessingFee: string
  billetProcessingFee: string
  oxidationProcessingFee: string
  electrophoresisProcessingFee: string
  note: string
}

export type CustomerInventoryBatchErrors = Partial<
  Record<keyof CustomerInventoryBatchFormValues, string>
> &
  Partial<Record<string, string>> & {
    form?: string
  }

export type TransferInventoryFormValues = {
  orderId: string
  productId: string
  productName: string
  moldCode: string
  lengthMm: number
  color: string
  currentQuantity: number
  publicQuantity: number
  requiredQuantity: number
  quantity: string
  note: string
}

export type TransferInventoryFormErrors = Partial<Record<"quantity", string>>

export type CustomerInventoryAdjustFormValues = {
  batchId: string
  color: string
  currentQuantity: number
  lengthMm: number
  moldCode: string
  note: string
  productName: string
  quantity: string
  stockId: string
}

export type CustomerInventoryAdjustFormErrors = Partial<
  Record<keyof CustomerInventoryAdjustFormValues, string>
> & {
  form?: string
}

export type BatchOrderAdjustmentItem = {
  color: string
  lengthMm: number
  productId: string
  quantity: number
}

export type BatchOrderRowsUpdateState = {
  errors: BatchOrderInventoryFormErrors
  rows: BatchOrderInventoryRow[]
}

export type BatchOrderNoteUpdateState = {
  errors: BatchOrderInventoryFormErrors
  note: string
}

export type BatchOrderSubmitState = {
  errors: BatchOrderInventoryFormErrors
  payload: AdjustOrderInventoryBatchPayload | null
}

export type BatchOrderImageRecognitionApplyState = {
  hasApplicableMatches: boolean
  rows: BatchOrderInventoryRow[]
}

export type BatchOrderImageRecognitionApplyDialogState =
  BatchOrderRowsUpdateState & {
    hasApplicableMatches: boolean
  }

export type BatchOrderImageRecognitionPathState = {
  nextPaths: string[]
  normalizedPaths: string[]
  skippedPaths: string[]
}

export type BatchOrderImageRecognitionDuplicateSelectionState = {
  errors: BatchOrderInventoryFormErrors
  skippedImagePaths: string[]
}

export type BatchOrderImagePreviewFailureState = {
  errors: BatchOrderInventoryFormErrors
}

export type BatchOrderImagePreviewRotationState = {
  imagePreviews: BatchOrderImagePreview[]
}

export type BatchOrderImageRawTextToggleState = {
  imageRawTextOpen: boolean
}

export type BatchOrderImageRecognitionUiState = {
  imageMatches: BatchOrderImageRecognitionMatch[]
  imagePreviewIndex: number
  imagePreviewOpen: boolean
  imagePreviews: BatchOrderImagePreview[]
  imageRawTextOpen: boolean
  imageRawTexts: string[]
  recognizedImagePaths: string[]
  skippedImagePaths: string[]
}

export type BatchOrderImageRecognitionSuccessState = {
  errors: BatchOrderInventoryFormErrors
  imageMatches: BatchOrderImageRecognitionMatch[]
  imageRawTexts: string[]
  recognizedImagePaths: string[]
  skippedImagePaths: string[]
}

export type BatchOrderImagePreviewDialogState = Pick<
  BatchOrderImageRecognitionUiState,
  "imagePreviewIndex" | "imagePreviewOpen" | "imagePreviews"
>

export type BatchOrderImageRecognitionConfirmState = Pick<
  BatchOrderImageRecognitionUiState,
  "imagePreviewOpen"
> & {
  request: BatchOrderImageRecognitionRequest | null
}

export type BatchOrderDialogApplyState = BatchOrderImageRecognitionUiState & {
  errors: BatchOrderInventoryFormErrors
  note: string
  rows: BatchOrderInventoryRow[]
}

export type BatchOrderSuccessDialogState = {
  dialogApplyState: BatchOrderDialogApplyState
  open: boolean
}

export type BatchOrderDialogOpenState = {
  dialogApplyState: BatchOrderDialogApplyState
  open: boolean
}

export type BatchOrderDialogCloseState = {
  dialogApplyState: BatchOrderDialogApplyState
  open: boolean
}

export type InventoryDialogApplyState = {
  errors: InventoryFormErrors
  values: InventoryFormValues
}

export type InventoryDialogOpenState = {
  dialogApplyState: InventoryDialogApplyState
  open: boolean
}

export type InventoryDialogCloseState = {
  dialogApplyState: InventoryDialogApplyState
  open: boolean
}

export type OrderInventoryDialogApplyState = {
  errors: OrderInventoryFormErrors
  values: OrderInventoryFormValues
}

export type OrderInventoryDialogOpenState = {
  dialogApplyState: OrderInventoryDialogApplyState
  open: boolean
}

export type OrderInventoryDialogCloseState = {
  dialogApplyState: OrderInventoryDialogApplyState
  open: boolean
}

export type TransferInventoryDialogApplyState = {
  errors: TransferInventoryFormErrors
  values: TransferInventoryFormValues
}

export type TransferInventoryDialogOpenState = {
  dialogApplyState: TransferInventoryDialogApplyState
  open: boolean
}

export type TransferInventoryDialogCloseState = {
  dialogApplyState: TransferInventoryDialogApplyState
  open: boolean
}

export type CustomerInventoryAdjustDialogApplyState = {
  errors: CustomerInventoryAdjustFormErrors
  values: CustomerInventoryAdjustFormValues
}

export type CustomerInventoryAdjustDialogOpenState = {
  dialogApplyState: CustomerInventoryAdjustDialogApplyState
  open: boolean
}

export type CustomerInventoryAdjustDialogCloseState = {
  dialogApplyState: CustomerInventoryAdjustDialogApplyState
  open: boolean
}

export type CustomerInventoryImportPreviewState = {
  errors: string[]
  fileName: string
  rows: ParsedCustomerInventoryImportRow[]
}

export type OrderInventoryQuantitySuggestionInput = {
  currentQuantity: number
  movementType: "adjust" | "produce" | "ship"
  requiredQuantity: number
}

export type CustomerInventoryDeliveryDialogState = {
  batches: CustomerInventoryBatch[]
  firstBatch: CustomerInventoryBatch | null
  errorMessage: string | null
}

export type CustomerInventoryBatchDialogValues = {
  formValues: CustomerInventoryBatchFormValues
  rows: CustomerInventoryBatchRow[]
}

export type CustomerInventoryBatchDialogApplyState =
  CustomerInventoryBatchDialogValues & {
    errors: CustomerInventoryBatchErrors
  }

export type CustomerInventoryBatchDialogOpenState = {
  dialogApplyState: CustomerInventoryBatchDialogApplyState
  editingBatch: CustomerInventoryBatch | null
  open: boolean
}

export type CustomerInventoryBatchDialogCloseState = {
  dialogApplyState: CustomerInventoryBatchDialogApplyState
  editingBatch: CustomerInventoryBatch | null
  open: boolean
}

export type CustomerInventoryDeliveryDialogValues = {
  errorMessage: string | null
  formValues: DeliveryNoteFormValues
  priceGroupFormValues: Record<string, DeliveryNoteFormValues>
  priceGroups: CustomerInventoryDeliveryPriceGroupView[]
  rows: CustomerInventoryDeliveryRow[]
  selectedBatch: CustomerInventoryBatch | null
  selectedBatches: CustomerInventoryBatch[]
}

export type CustomerInventoryDeliveryDialogApplyState = {
  errors: DeliveryNoteFormErrors
  formValues: DeliveryNoteFormValues
  priceGroupFormValues: Record<string, DeliveryNoteFormValues>
  rows: CustomerInventoryDeliveryRow[]
  selectedBatch: CustomerInventoryBatch | null
  selectedBatches: CustomerInventoryBatch[]
}

export type CustomerInventoryDeliveryDialogOpenState = {
  dialogApplyState: CustomerInventoryDeliveryDialogApplyState
  open: boolean
}

export type CustomerInventoryDeliveryDialogCloseState = {
  dialogApplyState: CustomerInventoryDeliveryDialogApplyState
  open: boolean
}

export type CustomerInventoryDeliverySuccessDialogState = {
  deliveryOpen: boolean
  dialogApplyState: CustomerInventoryDeliveryDialogApplyState
  printOpen: boolean
  selectedBatchIds: string[]
}

export type CustomerInventoryDeliveryCreateSuccessState =
  CustomerInventoryDeliveryCreateResult &
    CustomerInventoryDeliverySuccessDialogState

export type CustomerInventoryDeliveryBatchSelectionInput = {
  batchId: string
  checked: boolean
  selectedBatchIds: string[]
}

export type CustomerInventoryDeliveryBatchSelectionState = {
  selectedBatchIds: string[]
}

export type CustomerInventoryDeliveryFocusTarget =
  | {
      kind: "row"
      rowIndex: number
      field: "quantity" | "note"
    }
  | {
      kind: "price-group-weight"
      priceGroupKey: string
      field: DeliveryNoteWeightKey
    }
  | {
      kind: "price-group-field"
      priceGroupKey: string
      field: "extraChargeAmount" | "extraChargeName"
    }
  | {
      kind: "group-label"
      batchId: string
    }
  | {
      kind: "field"
      field:
        | DeliveryNoteWeightKey
        | "delivery-note"
        | "extraChargeAmount"
        | "extraChargeName"
        | "handler"
    }

export type CustomerInventoryDeliveryFocusRequest =
  | { kind: "handler" }
  | { kind: "extra-charge"; field: "extraChargeAmount" | "extraChargeName" }
  | {
      kind: "price-group-extra-charge"
      priceGroupIndex: number
      field: "extraChargeAmount" | "extraChargeName"
    }
  | { kind: "row"; rowIndex: number; field: "quantity" | "note" }
  | { kind: "weight"; fieldIndex: number }
  | { kind: "price-group-weight"; priceGroupIndex: number; fieldIndex: number }

export type CustomerInventoryBatchMoneyKey =
  | "aluminumIngotPrice"
  | "bridgeProcessingFee"
  | "powderProcessingFee"
  | "billetProcessingFee"
  | "oxidationProcessingFee"
  | "electrophoresisProcessingFee"

export type CustomerInventoryProcessingFeeFormKey = Exclude<
  CustomerInventoryBatchMoneyKey,
  "aluminumIngotPrice"
>

export type CustomerInventoryProcessingFeeSnapshotKey =
  | "bridgeProcessingFeeX100"
  | "powderProcessingFeeX100"
  | "billetProcessingFeeX100"
  | "oxidationProcessingFeeX100"
  | "electrophoresisProcessingFeeX100"

export type CustomerInventoryProcessingFeeSnapshotX100 = Record<
  CustomerInventoryProcessingFeeSnapshotKey,
  number
>

export type CustomerInventoryProcessingFeeField = {
  formKey: CustomerInventoryProcessingFeeFormKey
  snapshotKey: CustomerInventoryProcessingFeeSnapshotKey
}

export type CustomerInventoryBatchSubmitState = {
  errors: CustomerInventoryBatchErrors
  payload: CreateCustomerInventoryBatchPayload | null
}

export type CustomerInventoryBatchRowsUpdateState = {
  errors: CustomerInventoryBatchErrors
  rows: CustomerInventoryBatchRow[]
}

export type CustomerInventoryBatchRowsOnlyUpdateState = {
  rows: CustomerInventoryBatchRow[]
}

export type CustomerInventoryBatchFormFieldUpdateState = {
  errors: CustomerInventoryBatchErrors
  values: CustomerInventoryBatchFormValues
}

export type CustomerInventoryBatchFormValuesUpdateState = {
  values: CustomerInventoryBatchFormValues
}

export type CustomerInventoryBatchFormErrorClearState = {
  errors: CustomerInventoryBatchErrors
}

export type CustomerInventoryBatchCustomerUpdateState =
  CustomerInventoryBatchRowsUpdateState & {
    values: CustomerInventoryBatchFormValues
  }

export type CustomerInventoryBatchFormCustomerStateInput = {
  customerId: string
  fees: CustomerInventoryProcessingFeeSnapshotX100
  pricingTaxIncluded: boolean
  values: CustomerInventoryBatchFormValues
}

export type CustomerInventoryBatchFormPricingStateInput = {
  fees: CustomerInventoryProcessingFeeSnapshotX100
  pricingTaxIncluded: boolean
  values: CustomerInventoryBatchFormValues
}

export type DeliveryNoteSubmitState = {
  errors: DeliveryNoteFormErrors
  payload: CreateDeliveryNotePayload | null
}

export type DeliveryNoteRowsUpdateState = {
  errors: DeliveryNoteFormErrors
  rows: DeliveryNoteFormRow[]
}

export type DeliveryNoteFormErrorClearState = {
  errors: DeliveryNoteFormErrors
}

export type DeliveryNoteFormErrorState = {
  errors: Pick<DeliveryNoteFormErrors, "form">
}

export type DeliveryNoteFormFieldUpdateState = {
  errors: DeliveryNoteFormErrors
  values: DeliveryNoteFormValues
}

export type CustomerInventoryDeliveryFormFieldUpdateState = {
  errors: DeliveryNoteFormErrors
  values: DeliveryNoteFormValues
}

export type CustomerInventoryDeliveryPriceGroupFormFieldUpdateState = {
  errors: DeliveryNoteFormErrors
  priceGroupFormValues: Record<string, DeliveryNoteFormValues>
}

export type DeliveryNoteDialogValues = {
  formValues: DeliveryNoteFormValues
  rows: DeliveryNoteFormRow[]
}

export type DeliveryNoteDialogApplyState = DeliveryNoteDialogValues & {
  errors: DeliveryNoteFormErrors
}

export type DeliveryNoteDialogOpenState = {
  dialogApplyState: DeliveryNoteDialogApplyState
  open: boolean
}

export type DeliveryNoteDialogCloseState = {
  dialogApplyState: DeliveryNoteDialogApplyState
  open: boolean
}

export type DeliveryNoteSuccessDialogState = {
  dialogApplyState: DeliveryNoteDialogApplyState
  open: boolean
  printOpen: boolean
}

export type DeliveryNoteCreateSuccessState = DeliveryNoteSuccessDialogState & {
  currentDeliveryNote: DeliveryNote
}

export type DeliveryNotePrintPreviewSuccessState = {
  currentDeliveryNote: DeliveryNote | null
  currentMergedDeliveryNote: MergedDeliveryNote | null
  printOpen: boolean
}

export type DeliveryNotePrintPreviewRequestState = {
  currentMergedDeliveryNote: null
  errors: DeliveryNoteFormErrors
}

export type CustomerInventoryDeliveryRowsUpdateState = {
  errors: DeliveryNoteFormErrors
  rows: CustomerInventoryDeliveryRow[]
}

export type CustomerInventoryDeliveryRowsOnlyUpdateState = {
  rows: CustomerInventoryDeliveryRow[]
}

export type CustomerInventoryDeliverySubmitState = {
  errors: DeliveryNoteFormErrors
  payloads: CreateCustomerInventoryDeliveryNotePayload[]
}

export type InventoryAdjustmentSubmitState = {
  errors: InventoryFormErrors
  payload: AdjustInventoryPayload | null
}

export type OrderInventoryAdjustmentSubmitState = {
  errors: OrderInventoryFormErrors
  payload: AdjustOrderInventoryPayload | null
}

export type TransferInventorySubmitState = {
  errors: TransferInventoryFormErrors
  payload: TransferPublicInventoryToOrderPayload | null
}

export type CustomerInventoryAdjustmentSubmitState = {
  errors: CustomerInventoryAdjustFormErrors
  payload: AdjustCustomerInventoryStockPayload | null
}

export type MergeDeliveryNoteSelectionState = {
  deliveryNoteIds: string[]
  error: string | null
}

export type MergeDeliveryNoteSelectionApplyState = {
  deliveryNoteIds: string[]
  errors: Pick<DeliveryNoteFormErrors, "form">
}

export type MergeDeliveryNoteSubmitState = {
  errors: Pick<DeliveryNoteFormErrors, "form">
  selectedGroups: OrderInventoryGroup[]
}

export type MergeDeliveryNoteSubmitRequestState = {
  errors: DeliveryNoteFormErrors
}

export type MergeDeliveryNoteDialogValues = {
  customGroupsByDeliveryNoteId: Record<string, string>
  deliveryNoteIds: string[]
  specialNote: string
}

export type MergeDeliveryNoteGroupUpdateState = Pick<
  MergeDeliveryNoteDialogValues,
  "customGroupsByDeliveryNoteId"
>

export type MergeDeliveryNoteSpecialNoteUpdateState = Pick<
  MergeDeliveryNoteDialogValues,
  "specialNote"
>

export type MergeDeliveryNoteDialogApplyState = MergeDeliveryNoteDialogValues & {
  errors: Pick<DeliveryNoteFormErrors, "form">
}

export type MergeDeliveryNoteDialogOpenState = {
  currentDeliveryNote: null
  currentMergedDeliveryNote: null
  dialogApplyState: MergeDeliveryNoteDialogApplyState
  mergeOpen: boolean
}

export type MergeDeliveryNoteDialogCloseState = {
  dialogApplyState: MergeDeliveryNoteDialogApplyState
  mergeOpen: boolean
}

export type MergeDeliveryNotePreviewSuccessState = {
  currentDeliveryNote: null
  currentMergedDeliveryNote: MergedDeliveryNote
  mergeOpen: boolean
  printOpen: boolean
}

export type CustomerInventoryBatchRowProductSnapshot = Pick<
  CustomerInventoryBatchRow,
  "moldCode" | "productName" | "thicknessMmX100" | "weightPerMeterKgX1000"
>

export type CustomerInventoryBatchRowProductSelection =
  CustomerInventoryBatchRowProductSnapshot & {
    id: string
  }

export type CustomerInventoryDetailField =
  | "product"
  | "lengthMm"
  | "color"
  | "quantity"
  | "note"

export type CustomerInventoryDetailInputField = Exclude<
  CustomerInventoryDetailField,
  "product"
>

export type CustomerInventoryDetailFocusTarget = {
  field: CustomerInventoryDetailField
  rowIndex: number
  shouldAppendRow: boolean
}
