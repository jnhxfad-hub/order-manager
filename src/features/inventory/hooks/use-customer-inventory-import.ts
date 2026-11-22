import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";

import {
  importCustomerInventoryBatches,
  parseCustomerInventoryImportFile,
  type ParsedCustomerInventoryImportRow,
} from "@/features/inventory/api/inventory-api";
import {
  createCustomerInventoryImportErrorState,
  createCustomerInventoryImportFileSelectionState,
  createCustomerInventoryImportParseSuccessState,
  createEmptyCustomerInventoryImportPreviewState,
  getCustomerInventoryImportFileName,
  type CustomerInventoryImportPreviewState,
} from "@/features/inventory/lib/inventory-dialog-state";
import {
  createCustomerInventoryExportCsvRows,
  createCustomerInventoryImportTemplateCsvRows,
} from "@/features/inventory/lib/customer-inventory-import";
import type { InventoryNotice } from "@/features/inventory/lib/inventory-utils";
import type { CustomerInventoryBatch } from "@/features/inventory/types";
import { isTauriRuntime } from "@/lib/browser-runtime";
import { createCsv } from "@/lib/csv";
import { getErrorMessage } from "@/lib/errors";
import { saveCsvFile } from "@/lib/export-file";

export interface UseCustomerInventoryImportOptions {
  customerInventoryBatches: CustomerInventoryBatch[];
  customerInventoryExportItemCount: number;
  onNotice: (notice: InventoryNotice) => void;
  setSelectedCustomerInventoryBatch: (
    batch: CustomerInventoryBatch | null,
  ) => void;
  setSelectedCustomerInventoryDeliveryBatchIds: (ids: string[]) => void;
  setSelectedCustomerInventoryDeliveryBatches: (
    batches: CustomerInventoryBatch[],
  ) => void;
}

export function useCustomerInventoryImport({
  customerInventoryBatches,
  customerInventoryExportItemCount,
  onNotice,
  setSelectedCustomerInventoryBatch,
  setSelectedCustomerInventoryDeliveryBatchIds,
  setSelectedCustomerInventoryDeliveryBatches,
}: UseCustomerInventoryImportOptions) {
  const queryClient = useQueryClient();
  const [customerInventoryImportOpen, setCustomerInventoryImportOpen] =
    useState(false);
  const [customerInventoryImportFileName, setCustomerInventoryImportFileName] =
    useState("");
  const [customerInventoryImportRows, setCustomerInventoryImportRows] = useState<
    ParsedCustomerInventoryImportRow[]
  >([]);
  const [customerInventoryImportErrors, setCustomerInventoryImportErrors] =
    useState<string[]>([]);

  function applyCustomerInventoryImportPreviewState(
    state: CustomerInventoryImportPreviewState,
  ) {
    setCustomerInventoryImportFileName(state.fileName);
    setCustomerInventoryImportRows(state.rows);
    setCustomerInventoryImportErrors(state.errors);
  }

  function resetCustomerInventoryImportPreview() {
    applyCustomerInventoryImportPreviewState(
      createEmptyCustomerInventoryImportPreviewState(),
    );
  }

  const parseCustomerInventoryImportMutation = useMutation({
    mutationFn: (path: string) => parseCustomerInventoryImportFile(path),
    onError: (error, path) => {
      applyCustomerInventoryImportPreviewState(
        createCustomerInventoryImportErrorState({
          fileName: getCustomerInventoryImportFileName(path),
          message: getErrorMessage(error) || "无法解析客户库存导入文件",
        }),
      );
    },
    onSuccess: (result, path) => {
      applyCustomerInventoryImportPreviewState(
        createCustomerInventoryImportParseSuccessState({
          fileName: getCustomerInventoryImportFileName(path),
          result,
        }),
      );
    },
  });

  const importCustomerInventoryMutation = useMutation({
    mutationFn: () => importCustomerInventoryBatches(customerInventoryImportRows),
    onError: (error) => {
      applyCustomerInventoryImportPreviewState(
        createCustomerInventoryImportErrorState({
          fileName: customerInventoryImportFileName,
          message: getErrorMessage(error) || "客户库存批量导入失败",
          rows: customerInventoryImportRows,
        }),
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["customer-inventory"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-inventory-print-options"],
      });
      setSelectedCustomerInventoryBatch(null);
      setSelectedCustomerInventoryDeliveryBatches([]);
      setSelectedCustomerInventoryDeliveryBatchIds([]);
      setCustomerInventoryImportOpen(false);
      resetCustomerInventoryImportPreview();
      onNotice({
        message: `已导入 ${result.batchCount} 个批次、${result.itemCount} 条明细，共 ${result.totalQuantity} 支`,
        tone: "success",
      });
    },
  });

  async function downloadCustomerInventoryImportTemplate() {
    try {
      await saveCsvFile({
        contents: createCsv(createCustomerInventoryImportTemplateCsvRows()),
        defaultPath: "客户库存批量导入模板.csv",
      });
    } catch (error) {
      onNotice({
        message: getErrorMessage(error) || "下载客户库存导入模板失败",
        tone: "warning",
      });
    }
  }

  async function exportCurrentCustomerInventory() {
    if (customerInventoryExportItemCount === 0) {
      onNotice({
        message: "当前搜索结果中没有可导出的正库存明细",
        tone: "warning",
      });
      return;
    }

    try {
      await saveCsvFile({
        contents: createCsv(
          createCustomerInventoryExportCsvRows(customerInventoryBatches),
        ),
        defaultPath: "客户库存导出.csv",
      });
    } catch (error) {
      onNotice({
        message: getErrorMessage(error) || "导出客户库存失败",
        tone: "warning",
      });
    }
  }

  function openCustomerInventoryImportDialog() {
    parseCustomerInventoryImportMutation.reset();
    importCustomerInventoryMutation.reset();
    resetCustomerInventoryImportPreview();
    setCustomerInventoryImportOpen(true);
  }

  function handleCustomerInventoryImportOpenChange(nextOpen: boolean) {
    if (importCustomerInventoryMutation.isPending) {
      return;
    }

    setCustomerInventoryImportOpen(nextOpen);

    if (!nextOpen) {
      parseCustomerInventoryImportMutation.reset();
      importCustomerInventoryMutation.reset();
      resetCustomerInventoryImportPreview();
    }
  }

  async function selectCustomerInventoryImportFile() {
    if (!isTauriRuntime()) {
      applyCustomerInventoryImportPreviewState(
        createCustomerInventoryImportErrorState({
          fileName: customerInventoryImportFileName,
          message: "系统文件选择器只能在 Tauri 应用窗口中使用。",
          rows: customerInventoryImportRows,
        }),
      );
      return;
    }

    const selected = await openFileDialog({
      directory: false,
      filters: [
        {
          extensions: ["csv", "xlsx", "xls"],
          name: "客户库存导入文件",
        },
      ],
      multiple: false,
      title: "选择客户库存导入文件",
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    applyCustomerInventoryImportPreviewState(
      createCustomerInventoryImportFileSelectionState(selected),
    );
    importCustomerInventoryMutation.reset();
    await parseCustomerInventoryImportMutation.mutateAsync(selected).catch(() => undefined);
  }

  function confirmCustomerInventoryImport() {
    if (
      customerInventoryImportRows.length === 0 ||
      customerInventoryImportErrors.length > 0
    ) {
      return;
    }

    importCustomerInventoryMutation.mutate();
  }
  return {
    confirmCustomerInventoryImport,
    customerInventoryImportErrors,
    customerInventoryImportFileName,
    customerInventoryImportOpen,
    customerInventoryImportRows,
    downloadCustomerInventoryImportTemplate,
    exportCurrentCustomerInventory,
    handleCustomerInventoryImportOpenChange,
    importCustomerInventoryMutation,
    openCustomerInventoryImportDialog,
    parseCustomerInventoryImportMutation,
    selectCustomerInventoryImportFile,
  };
}
