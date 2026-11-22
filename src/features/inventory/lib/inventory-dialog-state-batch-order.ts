import {
  getInventoryDetailKey,
  type BatchOrderImagePreview,
  type BatchOrderImageRecognitionMatch,
  type BatchOrderImageRecognitionResult,
  type BatchOrderInventoryRow,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils"
import { parseIntegerInput } from "@/lib/number-input"
import { defaultBatchOrderImageRecognitionUiState } from "./inventory-dialog-state-forms"
import type {
  BatchOrderAdjustmentItem,
  BatchOrderDialogApplyState,
  BatchOrderDialogCloseState,
  BatchOrderDialogOpenState,
  BatchOrderImagePreviewDialogState,
  BatchOrderImagePreviewFailureState,
  BatchOrderImagePreviewRotationState,
  BatchOrderImageRawTextToggleState,
  BatchOrderImageRecognitionApplyDialogState,
  BatchOrderImageRecognitionApplyState,
  BatchOrderImageRecognitionConfirmState,
  BatchOrderImageRecognitionDuplicateSelectionState,
  BatchOrderImageRecognitionPathState,
  BatchOrderImageRecognitionSuccessState,
  BatchOrderInventoryFormErrors,
  BatchOrderNoteUpdateState,
  BatchOrderRowsUpdateState,
  BatchOrderSubmitState,
  BatchOrderSuccessDialogState,
} from "./inventory-dialog-state-types"

export function createBatchOrderRows(
  group: OrderInventoryGroup,
): BatchOrderInventoryRow[] {
  return group.items.map((item) => ({
    color: item.color,
    currentQuantity: item.orderQuantity,
    lengthMm: item.lengthMm,
    moldCode: item.moldCode,
    productId: item.productId,
    productName: item.productName,
    quantity: "",
    requiredQuantity: item.requiredQuantity,
  }))
}

export function createBatchOrderDialogApplyState({
  rows,
  note = "",
}: {
  note?: string
  rows: BatchOrderInventoryRow[]
}): BatchOrderDialogApplyState {
  return {
    ...defaultBatchOrderImageRecognitionUiState,
    errors: {},
    note,
    rows,
  }
}

export function createEmptyBatchOrderDialogApplyState(): BatchOrderDialogApplyState {
  return createBatchOrderDialogApplyState({ rows: [] })
}

export function createBatchOrderDialogOpenState(
  group: OrderInventoryGroup,
): BatchOrderDialogOpenState {
  return {
    dialogApplyState: createBatchOrderDialogApplyState({
      rows: createBatchOrderRows(group),
    }),
    open: true,
  }
}

export function createBatchOrderDialogCloseState(): BatchOrderDialogCloseState {
  return {
    dialogApplyState: createEmptyBatchOrderDialogApplyState(),
    open: false,
  }
}

export function createBatchOrderSuccessDialogState(): BatchOrderSuccessDialogState {
  return createBatchOrderDialogCloseState()
}

export function getBatchOrderEnteredQuantity(
  rows: BatchOrderInventoryRow[],
) {
  return rows.reduce((total, row) => {
    const quantity = parseIntegerInput(row.quantity)
    return quantity !== null && quantity > 0 ? total + quantity : total
  }, 0)
}

export function fillBatchOrderRequiredQuantities(
  rows: BatchOrderInventoryRow[],
): BatchOrderInventoryRow[] {
  return rows.map((row) => {
    const remainingQuantity = Math.max(
      row.requiredQuantity - row.currentQuantity,
      0,
    )

    return {
      ...row,
      quantity: remainingQuantity > 0 ? String(remainingQuantity) : "",
    }
  })
}

export function clearBatchOrderQuantities(
  rows: BatchOrderInventoryRow[],
): BatchOrderInventoryRow[] {
  return rows.map((row) => ({
    ...row,
    quantity: "",
  }))
}

export function updateBatchOrderRowQuantity(
  rows: BatchOrderInventoryRow[],
  detailKey: string,
  quantity: string,
): BatchOrderInventoryRow[] {
  return rows.map((row) =>
    getInventoryDetailKey(row) === detailKey ? { ...row, quantity } : row,
  )
}

export function clearBatchOrderFormError(
  errors: BatchOrderInventoryFormErrors,
  key: string,
): BatchOrderInventoryFormErrors {
  return {
    ...errors,
    [key]: undefined,
  }
}

export function clearBatchOrderAllErrors(): BatchOrderInventoryFormErrors {
  return {}
}

export function updateBatchOrderQuantityState({
  detailKey,
  errors,
  quantity,
  rows,
}: {
  detailKey: string
  errors: BatchOrderInventoryFormErrors
  quantity: string
  rows: BatchOrderInventoryRow[]
}): BatchOrderRowsUpdateState {
  return {
    errors: clearBatchOrderFormError(errors, detailKey),
    rows: updateBatchOrderRowQuantity(rows, detailKey, quantity),
  }
}

export function updateBatchOrderNoteState({
  errors,
  note,
}: {
  errors: BatchOrderInventoryFormErrors
  note: string
}): BatchOrderNoteUpdateState {
  return {
    errors: clearBatchOrderFormError(errors, "form"),
    note,
  }
}

export function fillBatchOrderRequiredQuantityState(
  rows: BatchOrderInventoryRow[],
): BatchOrderRowsUpdateState {
  return {
    errors: clearBatchOrderAllErrors(),
    rows: fillBatchOrderRequiredQuantities(rows),
  }
}

export function clearBatchOrderQuantityState(
  rows: BatchOrderInventoryRow[],
): BatchOrderRowsUpdateState {
  return {
    errors: clearBatchOrderAllErrors(),
    rows: clearBatchOrderQuantities(rows),
  }
}

export function prepareBatchOrderImageRecognitionPaths(
  selected: string | string[] | null | undefined,
  recognizedPaths: string[],
): BatchOrderImageRecognitionPathState {
  const paths =
    typeof selected === "string" ? [selected] : Array.isArray(selected) ? selected : []
  const normalizedPaths = Array.from(
    new Set(paths.map((path) => path.trim()).filter(Boolean)),
  )
  const existingPaths = new Set(recognizedPaths)
  const nextPaths = normalizedPaths.filter((path) => !existingPaths.has(path))
  const skippedPaths = normalizedPaths.filter((path) => existingPaths.has(path))

  return {
    nextPaths,
    normalizedPaths,
    skippedPaths,
  }
}

export function createBatchOrderImageRecognitionDuplicateSelectionState(
  skippedPaths: string[],
): BatchOrderImageRecognitionDuplicateSelectionState {
  return {
    errors: {
      form: "本次选择的图片都已经识别过了",
    },
    skippedImagePaths: skippedPaths,
  }
}

export function createBatchOrderImagePreviewFailureState(
  message: string | null | undefined,
): BatchOrderImagePreviewFailureState {
  return {
    errors: {
      form: message ?? "图片预览失败",
    },
  }
}

export function createBatchOrderImagePreview(
  path: string,
  previewUrl: string,
): BatchOrderImagePreview {
  return {
    path,
    previewUrl,
    rotationDegrees: 0,
  }
}

export function createBatchOrderImagePreviewDialogState(
  imagePreviews: BatchOrderImagePreview[],
): BatchOrderImagePreviewDialogState {
  return {
    imagePreviewIndex: 0,
    imagePreviewOpen: imagePreviews.length > 0,
    imagePreviews,
  }
}

export function rotateBatchOrderImagePreviews(
  previews: BatchOrderImagePreview[],
  previewIndex: number,
  delta: number,
): BatchOrderImagePreview[] {
  return previews.map((image, index) =>
    index === previewIndex
      ? {
          ...image,
          rotationDegrees:
            (((image.rotationDegrees + delta) % 360) + 360) % 360,
        }
      : image,
  )
}

export function createBatchOrderImagePreviewRotationState({
  delta,
  imagePreviewIndex,
  imagePreviews,
}: {
  delta: number
  imagePreviewIndex: number
  imagePreviews: BatchOrderImagePreview[]
}): BatchOrderImagePreviewRotationState {
  return {
    imagePreviews: rotateBatchOrderImagePreviews(
      imagePreviews,
      imagePreviewIndex,
      delta,
    ),
  }
}

export function createBatchOrderImageRawTextToggleState(
  imageRawTextOpen: boolean,
): BatchOrderImageRawTextToggleState {
  return {
    imageRawTextOpen: !imageRawTextOpen,
  }
}

export function createBatchOrderImageRecognitionConfirmState({
  imagePreviews,
  skippedPaths,
}: {
  imagePreviews: BatchOrderImagePreview[]
  skippedPaths: string[]
}): BatchOrderImageRecognitionConfirmState {
  return {
    imagePreviewOpen: false,
    request:
      imagePreviews.length > 0
        ? {
            images: imagePreviews,
            skippedPaths,
          }
        : null,
  }
}

export function applyBatchOrderImageRecognitionMatches(
  rows: BatchOrderInventoryRow[],
  matches: BatchOrderImageRecognitionMatch[],
): BatchOrderImageRecognitionApplyState {
  const matchedQuantitiesByDetailKey = new Map<string, number>()

  for (const match of matches) {
    if (
      match.status !== "matched" ||
      !match.detailKey ||
      match.item.quantity === null
    ) {
      continue
    }

    matchedQuantitiesByDetailKey.set(
      match.detailKey,
      (matchedQuantitiesByDetailKey.get(match.detailKey) ?? 0) +
        match.item.quantity,
    )
  }

  if (matchedQuantitiesByDetailKey.size === 0) {
    return {
      hasApplicableMatches: false,
      rows,
    }
  }

  return {
    hasApplicableMatches: true,
    rows: rows.map((row) => {
      const matchedQuantity =
        matchedQuantitiesByDetailKey.get(getInventoryDetailKey(row)) ?? 0

      if (matchedQuantity <= 0) {
        return row
      }

      return {
        ...row,
        quantity: String(matchedQuantity),
      }
    }),
  }
}

export function createBatchOrderImageRecognitionApplyState({
  matches,
  rows,
}: {
  matches: BatchOrderImageRecognitionMatch[]
  rows: BatchOrderInventoryRow[]
}): BatchOrderImageRecognitionApplyDialogState {
  const result = applyBatchOrderImageRecognitionMatches(rows, matches)

  return {
    errors: result.hasApplicableMatches
      ? {}
      : { form: "没有可应用的识别结果" },
    hasApplicableMatches: result.hasApplicableMatches,
    rows: result.rows,
  }
}

export function getBatchOrderImageRecognitionFailureMessage(
  failedImages: string[],
): string | null {
  return failedImages.length > 0
    ? `部分图片识别失败：\n${failedImages.join("\n")}`
    : null
}

export function mergeBatchOrderRecognizedImagePaths(
  currentPaths: string[],
  nextPaths: string[],
): string[] {
  return Array.from(new Set([...currentPaths, ...nextPaths]))
}

export function appendBatchOrderImageRecognitionRawTexts(
  currentRawTexts: string[],
  nextRawTexts: string[],
): string[] {
  return [...currentRawTexts, ...nextRawTexts]
}

export function appendBatchOrderImageRecognitionMatches(
  currentMatches: BatchOrderImageRecognitionMatch[],
  nextMatches: BatchOrderImageRecognitionMatch[],
): BatchOrderImageRecognitionMatch[] {
  return [...currentMatches, ...nextMatches]
}

export function mergeBatchOrderImageRecognitionSuccessState({
  currentImageMatches,
  currentImageRawTexts,
  currentRecognizedImagePaths,
  result,
}: {
  currentImageMatches: BatchOrderImageRecognitionMatch[]
  currentImageRawTexts: string[]
  currentRecognizedImagePaths: string[]
  result: BatchOrderImageRecognitionResult
}): BatchOrderImageRecognitionSuccessState {
  const failureMessage = getBatchOrderImageRecognitionFailureMessage(
    result.failedImages,
  )

  return {
    errors: failureMessage ? { form: failureMessage } : {},
    imageMatches: appendBatchOrderImageRecognitionMatches(
      currentImageMatches,
      result.matches,
    ),
    imageRawTexts: appendBatchOrderImageRecognitionRawTexts(
      currentImageRawTexts,
      result.rawTexts,
    ),
    recognizedImagePaths: mergeBatchOrderRecognizedImagePaths(
      currentRecognizedImagePaths,
      result.paths,
    ),
    skippedImagePaths: result.skippedPaths,
  }
}

export function collectBatchOrderAdjustmentItems(
  rows: BatchOrderInventoryRow[],
): {
  errors: BatchOrderInventoryFormErrors
  items: BatchOrderAdjustmentItem[]
} {
  const errors: BatchOrderInventoryFormErrors = {}
  const items = rows.flatMap((row) => {
    const detailKey = getInventoryDetailKey(row)
    const rawQuantity = row.quantity.trim()

    if (!rawQuantity) {
      return []
    }

    const quantity = parseIntegerInput(rawQuantity)

    if (quantity === null || quantity <= 0) {
      errors[detailKey] = "数量必须大于 0"
      return []
    }

    return [
      {
        color: row.color,
        lengthMm: row.lengthMm,
        productId: row.productId,
        quantity,
      },
    ]
  })

  if (items.length === 0) {
    errors.form = "请至少录入一项入库数量"
  }

  return { errors, items }
}

export function collectBatchOrderAdjustmentSubmitState({
  note,
  orderId,
  rows,
}: {
  note: string
  orderId?: string | null
  rows: BatchOrderInventoryRow[]
}): BatchOrderSubmitState {
  if (!orderId) {
    return {
      errors: { form: "请选择订单" },
      payload: null,
    }
  }

  const { errors, items } = collectBatchOrderAdjustmentItems(rows)

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      payload: null,
    }
  }

  return {
    errors,
    payload: {
      items,
      note: note.trim(),
      orderId,
    },
  }
}
