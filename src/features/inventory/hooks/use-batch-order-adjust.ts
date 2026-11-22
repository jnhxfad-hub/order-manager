import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";

import {
  adjustOrderInventoryBatch,
  readInventoryImagePreview,
  recognizeInventoryImage,
  type AdjustOrderInventoryBatchPayload,
} from "@/features/inventory/api/inventory-api";
import {
  clearBatchOrderQuantityState,
  collectBatchOrderAdjustmentSubmitState,
  createBatchOrderDialogCloseState,
  createBatchOrderDialogOpenState,
  createBatchOrderImagePreview,
  createBatchOrderImagePreviewDialogState,
  createBatchOrderImagePreviewFailureState,
  createBatchOrderImagePreviewRotationState,
  createBatchOrderImageRawTextToggleState,
  createBatchOrderImageRecognitionApplyState,
  createBatchOrderImageRecognitionConfirmState,
  createBatchOrderImageRecognitionDuplicateSelectionState,
  createBatchOrderSuccessDialogState,
  fillBatchOrderRequiredQuantityState,
  getBatchOrderEnteredQuantity,
  mergeBatchOrderImageRecognitionSuccessState,
  prepareBatchOrderImageRecognitionPaths,
  updateBatchOrderNoteState,
  updateBatchOrderQuantityState,
  type BatchOrderDialogApplyState,
  type BatchOrderImagePreviewFailureState,
  type BatchOrderImagePreviewDialogState,
  type BatchOrderImageRecognitionConfirmState,
  type BatchOrderImageRecognitionDuplicateSelectionState,
  type BatchOrderImageRecognitionSuccessState,
  type BatchOrderInventoryFormErrors,
  type BatchOrderNoteUpdateState,
  type BatchOrderRowsUpdateState,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  buildBatchOrderImageRecognitionMatches,
  dedupeBatchOrderImageRecognitionMatches,
  getBatchOrderInventoryNotice,
  type BatchOrderImagePreview,
  type BatchOrderImageRecognitionMatch,
  type BatchOrderImageRecognitionRequest,
  type BatchOrderImageRecognitionResult,
  type BatchOrderInventoryRow,
  type InventoryNotice,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils";
import { getErrorMessage } from "@/lib/errors";

export interface UseBatchOrderAdjustOptions {
  onNotice: (notice: InventoryNotice) => void;
  selectedOrderId: string | undefined;
}

export function useBatchOrderAdjust({
  onNotice,
  selectedOrderId,
}: UseBatchOrderAdjustOptions) {
  const queryClient = useQueryClient();
  const [batchOrderAdjustOpen, setBatchOrderAdjustOpen] = useState(false);
  const [batchOrderRows, setBatchOrderRows] = useState<
    BatchOrderInventoryRow[]
  >([]);
  const [batchOrderNote, setBatchOrderNote] = useState("");
  const [batchOrderErrors, setBatchOrderErrors] =
    useState<BatchOrderInventoryFormErrors>({});
  const [batchOrderSkippedImagePaths, setBatchOrderSkippedImagePaths] =
    useState<string[]>([]);
  const [batchOrderRecognizedImagePaths, setBatchOrderRecognizedImagePaths] =
    useState<string[]>([]);
  const [batchOrderImagePreviewOpen, setBatchOrderImagePreviewOpen] =
    useState(false);
  const [batchOrderImagePreviewIndex, setBatchOrderImagePreviewIndex] =
    useState(0);
  const [batchOrderImagePreviews, setBatchOrderImagePreviews] = useState<
    BatchOrderImagePreview[]
  >([]);
  const [batchOrderImageMatches, setBatchOrderImageMatches] = useState<
    BatchOrderImageRecognitionMatch[]
  >([]);
  const [batchOrderImageRawTexts, setBatchOrderImageRawTexts] = useState<
    string[]
  >([]);
  const [batchOrderImageRawTextOpen, setBatchOrderImageRawTextOpen] =
    useState(false);

  const adjustOrderInventoryBatchMutation = useMutation({
    mutationFn: (payload: AdjustOrderInventoryBatchPayload) =>
      adjustOrderInventoryBatch(payload),
    onSuccess: (_result, payload) => {
      const successState = createBatchOrderSuccessDialogState();

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onNotice({
        message: getBatchOrderInventoryNotice(payload),
        tone: "success",
      });
      setBatchOrderAdjustOpen(successState.open);
      applyBatchOrderDialogState(successState.dialogApplyState);
    },
  });

  const recognizeInventoryImageMutation = useMutation({
    mutationFn: async (
      request: BatchOrderImageRecognitionRequest,
    ): Promise<BatchOrderImageRecognitionResult> => {
      const results = await Promise.allSettled(
        request.images.map(async (image) => {
          const result = await recognizeInventoryImage(
            image.path,
            image.rotationDegrees,
          );

          return {
            image,
            matches: dedupeBatchOrderImageRecognitionMatches(
              buildBatchOrderImageRecognitionMatches(result.items, batchOrderRows),
            ),
            rawText: result.rawText,
          };
        }),
      );
      const recognized = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      const failedImages = results
        .map((result, index) =>
          result.status === "rejected"
            ? `${request.images[index]?.path.split(/[\\/]/).pop() ?? request.images[index]?.path ?? "图片"}：${getErrorMessage(result.reason)}`
            : null,
        )
        .filter((message): message is string => message !== null);

      if (recognized.length === 0) {
        throw new Error(failedImages.join("\n") || "图片识别失败");
      }

      return {
        failedImages,
        matches: recognized.flatMap((result) => result.matches),
        paths: recognized.map((result) => result.image.path),
        rawTexts: recognized.map((result) => result.rawText),
        skippedPaths: request.skippedPaths,
      };
    },
    onSuccess: (result) => {
      applyBatchOrderImageRecognitionSuccessState(
        mergeBatchOrderImageRecognitionSuccessState({
          currentImageMatches: batchOrderImageMatches,
          currentImageRawTexts: batchOrderImageRawTexts,
          currentRecognizedImagePaths: batchOrderRecognizedImagePaths,
          result,
        }),
      );
    },
  });

  const batchOrderEnteredQuantity =
    getBatchOrderEnteredQuantity(batchOrderRows);
  const areBatchOrderQuantitiesEmpty = batchOrderRows.every(
    (row) => !row.quantity.trim(),
  );
  const batchOrderImageMatchedCount = batchOrderImageMatches.filter(
    (match) => match.status === "matched",
  ).length;
  const batchOrderImageUnresolvedCount =
    batchOrderImageMatches.length - batchOrderImageMatchedCount;
  const batchOrderCurrentPreviewImage =
    batchOrderImagePreviews[batchOrderImagePreviewIndex] ?? null;

  function openBatchOrderAdjustDialog(group: OrderInventoryGroup) {
    adjustOrderInventoryBatchMutation.reset();
    recognizeInventoryImageMutation.reset();
    const state = createBatchOrderDialogOpenState(group);

    applyBatchOrderDialogState(state.dialogApplyState);
    setBatchOrderAdjustOpen(state.open);
  }

  function handleBatchOrderAdjustOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setBatchOrderAdjustOpen(nextOpen);
      return;
    }

    const state = createBatchOrderDialogCloseState();

    setBatchOrderAdjustOpen(state.open);
    adjustOrderInventoryBatchMutation.reset();
    recognizeInventoryImageMutation.reset();
    applyBatchOrderDialogState(state.dialogApplyState);
  }

  function applyBatchOrderDialogState(state: BatchOrderDialogApplyState) {
    setBatchOrderErrors(state.errors);
    setBatchOrderNote(state.note);
    setBatchOrderRows(state.rows);
    setBatchOrderSkippedImagePaths(state.skippedImagePaths);
    setBatchOrderRecognizedImagePaths(state.recognizedImagePaths);
    setBatchOrderImagePreviewOpen(state.imagePreviewOpen);
    setBatchOrderImagePreviewIndex(state.imagePreviewIndex);
    setBatchOrderImagePreviews(state.imagePreviews);
    setBatchOrderImageMatches(state.imageMatches);
    setBatchOrderImageRawTexts(state.imageRawTexts);
    setBatchOrderImageRawTextOpen(state.imageRawTextOpen);
  }

  function applyBatchOrderRowsUpdateState(state: BatchOrderRowsUpdateState) {
    setBatchOrderRows(state.rows);
    setBatchOrderErrors(state.errors);
  }

  function applyBatchOrderNoteUpdateState(state: BatchOrderNoteUpdateState) {
    setBatchOrderNote(state.note);
    setBatchOrderErrors(state.errors);
  }

  function applyBatchOrderImageRecognitionSuccessState(
    state: BatchOrderImageRecognitionSuccessState,
  ) {
    setBatchOrderErrors(state.errors);
    setBatchOrderSkippedImagePaths(state.skippedImagePaths);
    setBatchOrderRecognizedImagePaths(state.recognizedImagePaths);
    setBatchOrderImageRawTexts(state.imageRawTexts);
    setBatchOrderImageMatches(state.imageMatches);
  }

  function applyBatchOrderImageRecognitionDuplicateSelectionState(
    state: BatchOrderImageRecognitionDuplicateSelectionState,
  ) {
    setBatchOrderErrors(state.errors);
    setBatchOrderSkippedImagePaths(state.skippedImagePaths);
  }

  function applyBatchOrderImagePreviewFailureState(
    state: BatchOrderImagePreviewFailureState,
  ) {
    setBatchOrderErrors(state.errors);
  }

  function applyBatchOrderImagePreviewDialogState(
    state: BatchOrderImagePreviewDialogState,
  ) {
    setBatchOrderImagePreviews(state.imagePreviews);
    setBatchOrderImagePreviewIndex(state.imagePreviewIndex);
    setBatchOrderImagePreviewOpen(state.imagePreviewOpen);
  }

  function applyBatchOrderImageRecognitionConfirmState(
    state: BatchOrderImageRecognitionConfirmState,
  ) {
    setBatchOrderImagePreviewOpen(state.imagePreviewOpen);
  }

  function updateBatchOrderQuantity(detailKey: string, quantity: string) {
    const nextState = updateBatchOrderQuantityState({
      detailKey,
      errors: batchOrderErrors,
      quantity,
      rows: batchOrderRows,
    });

    applyBatchOrderRowsUpdateState(nextState);
    adjustOrderInventoryBatchMutation.reset();
  }

  function updateBatchOrderNote(note: string) {
    const nextState = updateBatchOrderNoteState({
      errors: batchOrderErrors,
      note,
    });

    applyBatchOrderNoteUpdateState(nextState);
    adjustOrderInventoryBatchMutation.reset();
  }

  async function recognizeBatchOrderImage() {
    const selected = await openFileDialog({
      directory: false,
      filters: [
        {
          extensions: ["png", "jpg", "jpeg", "webp", "heic", "heif"],
          name: "图片文件",
        },
      ],
      multiple: true,
      title: "选择入库图片",
    });

    const pathState = prepareBatchOrderImageRecognitionPaths(
      selected,
      batchOrderRecognizedImagePaths,
    );

    if (pathState.normalizedPaths.length === 0) {
      return;
    }

    if (pathState.nextPaths.length === 0) {
      const nextState =
        createBatchOrderImageRecognitionDuplicateSelectionState(
          pathState.skippedPaths,
        );

      applyBatchOrderImageRecognitionDuplicateSelectionState(nextState);
      return;
    }

    adjustOrderInventoryBatchMutation.reset();
    setBatchOrderSkippedImagePaths(pathState.skippedPaths);

    try {
      const previews = await Promise.all(
        pathState.nextPaths.map(async (path) => {
          try {
            return createBatchOrderImagePreview(
              path,
              await readInventoryImagePreview(path),
            );
          } catch (error) {
            throw new Error(
              `${path.split(/[\\/]/).pop() ?? path} 预览失败：${getErrorMessage(error)}`,
            );
          }
        }),
      );

      const previewState = createBatchOrderImagePreviewDialogState(previews);

      applyBatchOrderImagePreviewDialogState(previewState);
    } catch (error) {
      const nextState = createBatchOrderImagePreviewFailureState(
        getErrorMessage(error),
      );

      applyBatchOrderImagePreviewFailureState(nextState);
    }
  }

  function updateBatchOrderPreviewRotation(delta: number) {
    setBatchOrderImagePreviews(
      (current) =>
        createBatchOrderImagePreviewRotationState({
          delta,
          imagePreviewIndex: batchOrderImagePreviewIndex,
          imagePreviews: current,
        }).imagePreviews,
    );
  }

  function toggleBatchOrderImageRawTextOpen() {
    setBatchOrderImageRawTextOpen(
      (current) =>
        createBatchOrderImageRawTextToggleState(current).imageRawTextOpen,
    );
  }

  function confirmBatchOrderImageRecognition() {
    const nextState = createBatchOrderImageRecognitionConfirmState({
      imagePreviews: batchOrderImagePreviews,
      skippedPaths: batchOrderSkippedImagePaths,
    });

    applyBatchOrderImageRecognitionConfirmState(nextState);

    if (!nextState.request) {
      return;
    }

    recognizeInventoryImageMutation.mutate(nextState.request);
  }

  function applyBatchOrderImageRecognition() {
    const nextState = createBatchOrderImageRecognitionApplyState({
      matches: batchOrderImageMatches,
      rows: batchOrderRows,
    });

    applyBatchOrderRowsUpdateState(nextState);

    if (!nextState.hasApplicableMatches) {
      return;
    }

    adjustOrderInventoryBatchMutation.reset();
  }

  function fillBatchOrderRequiredQuantities() {
    const nextState = fillBatchOrderRequiredQuantityState(batchOrderRows);

    applyBatchOrderRowsUpdateState(nextState);
    adjustOrderInventoryBatchMutation.reset();
  }

  function clearBatchOrderQuantities() {
    const nextState = clearBatchOrderQuantityState(batchOrderRows);

    applyBatchOrderRowsUpdateState(nextState);
    adjustOrderInventoryBatchMutation.reset();
  }

  function focusBatchOrderTarget(target: "note" | number) {
    requestAnimationFrame(() => {
      const element =
        target === "note"
          ? document.querySelector<HTMLElement>("[data-batch-order-note]")
          : document.querySelector<HTMLElement>(
              `[data-batch-order-quantity="${target}"]`,
            );

      element?.scrollIntoView({ block: "center", behavior: "smooth" });
      element?.focus();
    });
  }

  function focusNextBatchOrderQuantity(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    focusBatchOrderTarget(
      rowIndex + 1 < batchOrderRows.length ? rowIndex + 1 : "note",
    );
  }

  function submitBatchOrderAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { errors, payload } = collectBatchOrderAdjustmentSubmitState({
      note: batchOrderNote,
      orderId: selectedOrderId,
      rows: batchOrderRows,
    });

    if (!payload) {
      setBatchOrderErrors(errors);
      return;
    }

    adjustOrderInventoryBatchMutation.mutate(payload);
  }
  return {
    adjustOrderInventoryBatchMutation,
    applyBatchOrderImageRecognition,
    areBatchOrderQuantitiesEmpty,
    batchOrderAdjustOpen,
    batchOrderCurrentPreviewImage,
    batchOrderEnteredQuantity,
    batchOrderErrors,
    batchOrderImageMatchedCount,
    batchOrderImageMatches,
    batchOrderImagePreviewIndex,
    batchOrderImagePreviewOpen,
    batchOrderImagePreviews,
    batchOrderImageRawTextOpen,
    batchOrderImageRawTexts,
    batchOrderImageUnresolvedCount,
    batchOrderNote,
    batchOrderRecognizedImagePaths,
    batchOrderRows,
    batchOrderSkippedImagePaths,
    clearBatchOrderQuantities,
    confirmBatchOrderImageRecognition,
    fillBatchOrderRequiredQuantities,
    focusNextBatchOrderQuantity,
    handleBatchOrderAdjustOpenChange,
    openBatchOrderAdjustDialog,
    recognizeBatchOrderImage,
    recognizeInventoryImageMutation,
    setBatchOrderImagePreviewIndex,
    setBatchOrderImagePreviewOpen,
    submitBatchOrderAdjustment,
    toggleBatchOrderImageRawTextOpen,
    updateBatchOrderNote,
    updateBatchOrderPreviewRotation,
    updateBatchOrderQuantity,
  };
}
