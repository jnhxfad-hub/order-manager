import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  HistoryIcon,
  PackageIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState, RetryButton } from "@/components/data-state";
import {
  listCustomerInventory,
  listInventory,
} from "@/features/inventory/api/inventory-api";
import {
  BatchOrderImagePreviewDialog,
} from "@/features/inventory/components/batch-order-ocr-preview";
import { BatchOrderAdjustDialog } from "@/features/inventory/components/batch-order-adjust-dialog";
import { CustomerInventoryAdjustDialog } from "@/features/inventory/components/customer-inventory-adjust-dialog";
import { CustomerInventoryBatchDialog } from "@/features/inventory/components/customer-inventory-batch-dialog";
import { CustomerInventoryImportDialog } from "@/features/inventory/components/customer-inventory-import-dialog";
import { CustomerInventoryDeliveryDialog } from "@/features/inventory/components/customer-inventory-delivery-dialog";
import {
  CustomerInventoryPrintDialog,
} from "@/features/inventory/components/customer-inventory-print-dialog";
import { CustomerInventoryPrintGroupDialog } from "@/features/inventory/components/customer-inventory-print-group-dialog";
import { CustomerInventoryPrintPreviewDialog } from "@/features/inventory/components/customer-inventory-print-preview-dialog";
import { CustomerInventoryView } from "@/features/inventory/components/customer-inventory-view";
import { DeliveryNotePrintPreviewDialog } from "@/features/inventory/components/delivery-note-print-preview-dialog";
import { DeliveryNoteCreateDialog } from "@/features/inventory/components/delivery-note-create-dialog";
import { MergeDeliveryNoteDialog } from "@/features/inventory/components/merge-delivery-note-dialog";
import { OrderInventoryAdjustDialog } from "@/features/inventory/components/order-inventory-adjust-dialog";
import { OrderInventoryView } from "@/features/inventory/components/order-inventory-view";
import { OrderInventoryRemainderDialog } from "@/features/inventory/components/order-inventory-remainder-dialog";
import {
  PrintDeliveryNoteView,
  PrintMergedDeliveryNoteView,
} from "@/features/inventory/components/print-delivery-note-view";
import { PrintCustomerInventoryView } from "@/features/inventory/components/print-customer-inventory-view";
import {
  getCustomerInventoryExportItemCount,
} from "@/features/inventory/lib/customer-inventory-import";
import { PublicInventoryAdjustDialog } from "@/features/inventory/components/public-inventory-adjust-dialog";
import { InventoryMovementsTable } from "@/features/inventory/components/inventory-movements-table";
import { InventoryStatsHeader } from "@/features/inventory/components/inventory-stats-header";
import { InventoryToolbar } from "@/features/inventory/components/inventory-toolbar";
import { PublicInventoryTable } from "@/features/inventory/components/public-inventory-table";
import { TransferInventoryDialog } from "@/features/inventory/components/transfer-inventory-dialog";
import {
  buildOrderInventoryGroups,
  filterOrderInventoryGroups,
  getDeliveredOrderGroups,
  getDeliveredOrderGroupsByDeliveryNoteId,
  getInventoryNoticeClassName,
  getInventoryOverviewStats,
  getOrderGroupStats,
  getOrderInventoryFilterCounts,
  type InventoryNotice,
  type InventoryView,
  type OrderInventoryFilter,
} from "@/features/inventory/lib/inventory-utils";
import {
} from "@/features/inventory/lib/inventory-dialog-state";
import { usePublicInventoryAdjust } from "@/features/inventory/hooks/use-public-inventory-adjust";
import { useOrderInventoryAdjust } from "@/features/inventory/hooks/use-order-inventory-adjust";
import { useTransferInventory } from "@/features/inventory/hooks/use-transfer-inventory";
import { useOrderInventoryRemainder } from "@/features/inventory/hooks/use-order-inventory-remainder";
import { useMergeDeliveryNote } from "@/features/inventory/hooks/use-merge-delivery-note";
import { useBatchOrderAdjust } from "@/features/inventory/hooks/use-batch-order-adjust";
import { useDeliveryNote } from "@/features/inventory/hooks/use-delivery-note";
import { useCustomerInventoryPrint } from "@/features/inventory/hooks/use-customer-inventory-print";
import { useCustomerInventoryImport } from "@/features/inventory/hooks/use-customer-inventory-import";
import { useCustomerInventoryDelivery } from "@/features/inventory/hooks/use-customer-inventory-delivery";
import { useCustomerInventoryBatch } from "@/features/inventory/hooks/use-customer-inventory-batch";
import type {
} from "@/features/inventory/types";
import { listCustomers } from "@/features/customers/api/customers-api";
import { listProducts } from "@/features/products/api/products-api";
import { getErrorMessage } from "@/lib/errors";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export function InventoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [mergeDeliveryNoteOpen, setMergeDeliveryNoteOpen] = useState(false);
  const [activeView, setActiveView] = useState<InventoryView>("orders");
  const [orderInventoryFilter, setOrderInventoryFilter] =
    useState<OrderInventoryFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [inventoryNotice, setInventoryNotice] =
    useState<InventoryNotice | null>(null);
  const orderMovementsScrollRef = useRef<HTMLDivElement | null>(null);
  const [orderMovementsCanScroll, setOrderMovementsCanScroll] = useState(false);
  const [orderMovementsAtBottom, setOrderMovementsAtBottom] = useState(true);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", debouncedSearch],
    queryFn: () => listInventory({ search: debouncedSearch }),
    refetchOnMount: "always",
  });
  const customerInventoryQuery = useQuery({
    queryKey: ["customer-inventory", debouncedSearch],
    queryFn: () => listCustomerInventory({ search: debouncedSearch }),
    refetchOnMount: "always",
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "inventory-options"],
    queryFn: () => listCustomers({ page: 1, pageSize: 1000 }),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "inventory-options"],
    queryFn: () => listProducts({ page: 1, pageSize: 1000 }),
  });

  const inventory = inventoryQuery.data;
  const items = inventory?.items ?? [];
  const {
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
  } = usePublicInventoryAdjust({ items, onNotice: setInventoryNotice });
  const {
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
  } = useOrderInventoryAdjust({ onNotice: setInventoryNotice });
  const {
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
  } = useTransferInventory({ onNotice: setInventoryNotice });
  const orderItems = inventory?.orderItems ?? [];
  const orderMovements = inventory?.orderMovements ?? [];
  const recentMovements = inventory?.recentMovements ?? [];
  const customerInventory = customerInventoryQuery.data;
  const customerInventoryBatches = customerInventory?.batches ?? [];
  const customerInventoryExportItemCount = useMemo(
    () => getCustomerInventoryExportItemCount(customerInventoryBatches),
    [customerInventoryBatches],
  );
  const customerInventoryDeliveryNotes = customerInventory?.deliveryNotes ?? [];
  const customerInventoryMovements = customerInventory?.recentMovements ?? [];
  const customers = customersQuery.data?.customers ?? [];
  const products = productsQuery.data?.products ?? [];
  const orderGroups = useMemo(
    () => buildOrderInventoryGroups(orderItems),
    [orderItems],
  );
  const deliveredOrderGroups = useMemo(
    () => getDeliveredOrderGroups(orderGroups),
    [orderGroups],
  );
  const deliveredOrderGroupsByDeliveryNoteId = useMemo(
    () => getDeliveredOrderGroupsByDeliveryNoteId(deliveredOrderGroups),
    [deliveredOrderGroups],
  );
  const filteredOrderGroups = useMemo(
    () => filterOrderInventoryGroups(orderGroups, orderInventoryFilter),
    [orderGroups, orderInventoryFilter],
  );
  const orderInventoryFilterCounts = useMemo(
    () => getOrderInventoryFilterCounts(orderGroups),
    [orderGroups],
  );
  const selectedOrderGroup =
    filteredOrderGroups.find((group) => group.orderId === selectedOrderId) ??
    filteredOrderGroups[0];
  const {
    openRemainderDialog,
    orderRemainderOpen,
    setOrderRemainderOpen,
    transferOrderRemainder,
    transferOrderRemainderMutation,
  } = useOrderInventoryRemainder({
    onNotice: setInventoryNotice,
    selectedOrderGroup,
  });
  const {
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
  } = useCustomerInventoryBatch({
    customers,
    onNotice: setInventoryNotice,
    products,
  });
  const {
    applyDeliveryNoteFormError,
    applyDeliveryNotePreviewSpecialNoteState,
    applyMergeDeliveryNotePreviewSuccessState,
    canSaveDeliveryNotePreviewSpecialNote,
    clearAllDeliveryNoteQuantities,
    createDeliveryNoteMutation,
    currentDeliveryNote,
    currentDeliveryNoteTotalQuantity,
    currentMergedDeliveryNote,
    deliveryNoteErrors,
    deliveryNoteFormValues,
    deliveryNoteOpen,
    deliveryNotePreviewSpecialNote,
    deliveryNotePreviewSpecialNoteEditorOpen,
    deliveryNotePreviewSpecialNoteErrorMessage,
    deliveryNotePrintOpen,
    deliveryNoteRows,
    deliveryNoteTotalQuantity,
    deliveryNoteTransferQuantity,
    fillAllDeliveryNoteQuantities,
    focusNextDeliveryWeightField,
    getDeliveryNotePreviewSpecialNote,
    handleDeliveryNoteOpenChange,
    handleDeliveryNotePrintOpenChange,
    handleDeliveryNoteSpecialNoteEditorOpenChange,
    handleDeliveryNoteWeightFocus,
    isDeliveryPrintReady,
    isSavingDeliveryNotePreviewSpecialNote,
    openCustomerInventoryDeliveryNotePrintPreview,
    openDeliveryNoteDialog,
    openDeliveryNotePrintPreview,
    printDeliveryNote,
    requiredDeliveryWeights,
    saveDeliveryNotePreviewSpecialNote,
    savedDeliveryNotePreviewSpecialNote,
    setCurrentDeliveryNote,
    setCurrentMergedDeliveryNote,
    setDeliveryNoteErrors,
    setDeliveryNotePrintOpen,
    submitDeliveryNote,
    updateCustomerInventoryDeliveryNoteSpecialNoteMutation,
    updateDeliveryNoteFormValue,
    updateDeliveryNotePreviewSpecialNote,
    updateDeliveryNoteRow,
    updateDeliveryNoteSpecialNoteMutation,
    visibleDeliveryWeightFields,
  } = useDeliveryNote({
    onNotice: setInventoryNotice,
    selectedOrderGroup,
    setMergeDeliveryNoteOpen,
  });
  const {
    handleMergeDeliveryNoteOpenChange,
    mergeDeliveryNoteGroups,
    mergeDeliveryNoteIds,
    mergeDeliveryNoteMutation,
    mergeDeliveryNoteSpecialNote,
    openMergeDeliveryNoteDialog,
    submitMergeDeliveryNote,
    toggleMergeDeliveryNote,
    updateMergeDeliveryNoteGroup,
    updateMergeDeliveryNoteSpecialNote,
  } = useMergeDeliveryNote({
    deliveredOrderGroupsByDeliveryNoteId,
    onDeliveryNoteError: applyDeliveryNoteFormError,
    onPreviewSuccess: applyMergeDeliveryNotePreviewSuccessState,
    selectedOrderGroup,
    setCurrentDeliveryNote,
    setCurrentMergedDeliveryNote,
    setDeliveryNoteErrors,
    setMergeDeliveryNoteOpen,
  });
  const {
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
  } = useBatchOrderAdjust({
    onNotice: setInventoryNotice,
    selectedOrderId: selectedOrderGroup?.orderId,
  });
  const {
    backToCustomerInventoryPrintCustomer,
    currentCustomerInventoryPrintSnapshot,
    customerInventoryPrintCustomerId,
    customerInventoryPrintCustomers,
    customerInventoryPrintDialogOpen,
    customerInventoryPrintGroupLabels,
    customerInventoryPrintGroupOpen,
    customerInventoryPrintLayoutError,
    customerInventoryPrintOptionsQuery,
    customerInventoryPrintPages,
    customerInventoryPrintPreviewOpen,
    editCustomerInventoryPrintGroups,
    getCustomerInventoryPrintSnapshotMutation,
    handleCustomerInventoryPrintDialogOpenChange,
    handleCustomerInventoryPrintGroupOpenChange,
    handleCustomerInventoryPrintLayoutResult,
    isCustomerInventoryPrintReady,
    openCustomerInventoryPrintDialog,
    printCustomerInventory,
    setCustomerInventoryPrintCustomerId,
    setCustomerInventoryPrintPreviewOpen,
    submitCustomerInventoryPrint,
    submitCustomerInventoryPrintGroups,
    updateCustomerInventoryPrintGroup,
  } = useCustomerInventoryPrint({
    onNotice: setInventoryNotice,
  });
  const {
    canClearCustomerInventoryDeliveryQuantities,
    clearAllCustomerInventoryDeliveryQuantities,
    createCustomerInventoryDeliveryNoteMutation,
    customerInventoryDeliveryErrors,
    customerInventoryDeliveryFormValues,
    customerInventoryDeliveryGroups,
    customerInventoryDeliveryOpen,
    customerInventoryDeliveryPriceGroupFormValues,
    customerInventoryDeliveryPriceGroups,
    customerInventoryDeliveryRows,
    customerInventoryDeliveryTotalQuantity,
    fillAllCustomerInventoryDeliveryQuantities,
    focusNextCustomerInventoryDeliveryTarget,
    handleCustomerInventoryDeliveryFormValueChange,
    handleCustomerInventoryDeliveryGroupLabelChange,
    handleCustomerInventoryDeliveryOpenChange,
    handleCustomerInventoryDeliveryPriceGroupFormValueChange,
    handleCustomerInventoryDeliveryRowNoteChange,
    handleCustomerInventoryDeliveryRowQuantityChange,
    hasMultipleCustomerInventoryDeliveryPriceGroups,
    openCustomerInventoryDeliveryDialog,
    openSelectedCustomerInventoryDeliveryDialog,
    requiredCustomerInventoryDeliveryWeights,
    selectedCustomerInventoryDeliveryBatchIds,
    selectedCustomerInventoryDeliveryBatches,
    selectedCustomerInventoryPricingProfileName,
    setSelectedCustomerInventoryDeliveryBatchIds,
    setSelectedCustomerInventoryDeliveryBatches,
    submitCustomerInventoryDelivery,
    toggleCustomerInventoryDeliveryBatchSelection,
    visibleCustomerInventoryDeliveryWeightFields,
  } = useCustomerInventoryDelivery({
    applyDeliveryNotePreviewSpecialNoteState,
    customerInventoryBatches,
    customers,
    getDeliveryNotePreviewSpecialNote,
    onNotice: setInventoryNotice,
    selectedCustomerInventoryBatch,
    setCurrentDeliveryNote,
    setCurrentMergedDeliveryNote,
    setDeliveryNotePrintOpen,
    setSelectedCustomerInventoryBatch,
  });
  const {
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
  } = useCustomerInventoryImport({
    customerInventoryBatches,
    customerInventoryExportItemCount,
    onNotice: setInventoryNotice,
    setSelectedCustomerInventoryBatch,
    setSelectedCustomerInventoryDeliveryBatchIds,
    setSelectedCustomerInventoryDeliveryBatches,
  });
  const selectedOrderMovements = useMemo(
    () =>
      selectedOrderGroup
        ? orderMovements.filter(
            (movement) => movement.orderId === selectedOrderGroup.orderId,
          )
        : [],
    [orderMovements, selectedOrderGroup],
  );
  const selectedOrderStats = selectedOrderGroup
    ? getOrderGroupStats(selectedOrderGroup)
    : null;
  const inventoryOverviewStats = getInventoryOverviewStats({
    customerInventoryBatches,
    customerInventoryTotalQuantity: customerInventory?.totalQuantity ?? 0,
    orderGroups,
    publicInventoryItems: items,
    publicInventoryTotalQuantity: inventory?.totalQuantity ?? 0,
  });
  const selectedOrderRequiredQuantity =
    selectedOrderStats?.requiredQuantity ?? 0;
  const selectedOrderStockQuantity = selectedOrderStats?.orderQuantity ?? 0;
  const selectedOrderPublicQuantity = selectedOrderStats?.publicQuantity ?? 0;
  const selectedOrderPendingQuantity = selectedOrderStats?.pendingQuantity ?? 0;
  const isSelectedOrderDelivered = Boolean(
    selectedOrderGroup?.inventoryLockedAt,
  );

  useEffect(() => {
    const scrollElement = orderMovementsScrollRef.current;

    if (!scrollElement) {
      setOrderMovementsCanScroll(false);
      setOrderMovementsAtBottom(true);
      return;
    }

    const scrollContainer = scrollElement;

    function updateScrollHint() {
      const canScroll =
        scrollContainer.scrollHeight > scrollContainer.clientHeight + 1;
      const atBottom =
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
        scrollContainer.scrollHeight - 1;

      setOrderMovementsCanScroll(canScroll);
      setOrderMovementsAtBottom(atBottom);
    }

    updateScrollHint();
    scrollContainer.addEventListener("scroll", updateScrollHint);
    window.addEventListener("resize", updateScrollHint);

    return () => {
      scrollContainer.removeEventListener("scroll", updateScrollHint);
      window.removeEventListener("resize", updateScrollHint);
    };
  }, [selectedOrderMovements]);

  useEffect(() => {
    if (!inventoryNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInventoryNotice(null);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [inventoryNotice]);

  const isInventoryPrintReady =
    isDeliveryPrintReady || isCustomerInventoryPrintReady;
  const activeInventoryQuery =
    activeView === "customer" ? customerInventoryQuery : inventoryQuery;
  const activeInventoryQueryLabel =
    activeView === "customer" ? "客户库存" : "库存";
  const isRefreshing =
    inventoryQuery.isFetching || customerInventoryQuery.isFetching;
  const isWriting =
    adjustInventoryMutation.isPending ||
    adjustCustomerInventoryStockMutation.isPending ||
    adjustOrderInventoryMutation.isPending ||
    adjustOrderInventoryBatchMutation.isPending ||
    recognizeInventoryImageMutation.isPending ||
    transferPublicInventoryMutation.isPending ||
    createDeliveryNoteMutation.isPending ||
    mergeDeliveryNoteMutation.isPending ||
    getCustomerInventoryBatchMutation.isPending ||
    createCustomerInventoryBatchMutation.isPending ||
    updateCustomerInventoryBatchMutation.isPending ||
    createCustomerInventoryDeliveryNoteMutation.isPending ||
    updateDeliveryNoteSpecialNoteMutation.isPending ||
    updateCustomerInventoryDeliveryNoteSpecialNoteMutation.isPending;

  return (
    <div
      className={
        isInventoryPrintReady
          ? "order-form-printing delivery-note-printing workspace-page inventory-page"
          : "workspace-page inventory-page"
      }
    >
      {inventoryNotice && (
        <div
          className={`fixed left-1/2 top-[calc(50%-170px)] z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 rounded-md border px-4 py-2.5 text-center text-sm shadow-xl ${getInventoryNoticeClassName(inventoryNotice.tone)}`}
          role="status"
        >
          {inventoryNotice.message}
        </div>
      )}

      <section className="workspace-card inventory-card overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
        <InventoryStatsHeader
          isRefreshing={isRefreshing}
          onRefresh={() => {
            void inventoryQuery.refetch();
            void customerInventoryQuery.refetch();
          }}
          stats={inventoryOverviewStats}
        />

        <InventoryToolbar
          activeView={activeView}
          customerInventoryExportItemCount={customerInventoryExportItemCount}
          customerInventoryTotalQuantity={customerInventory?.totalQuantity ?? 0}
          deliveredOrderGroupCount={deliveredOrderGroups.length}
          onActiveViewChange={setActiveView}
          onDownloadImportTemplate={downloadCustomerInventoryImportTemplate}
          onExportCurrentCustomerInventory={exportCurrentCustomerInventory}
          onOpenCustomerInventoryDialog={openCustomerInventoryDialog}
          onOpenCustomerInventoryImportDialog={openCustomerInventoryImportDialog}
          onOpenCustomerInventoryPrintDialog={openCustomerInventoryPrintDialog}
          onOpenMergeDeliveryNoteDialog={openMergeDeliveryNoteDialog}
          onOrderInventoryFilterChange={setOrderInventoryFilter}
          onSearchChange={setSearch}
          orderInventoryFilter={orderInventoryFilter}
          orderInventoryFilterCounts={orderInventoryFilterCounts}
          search={search}
        />

        <div className="inventory-content">
          {activeInventoryQuery.isLoading ? (
            <LoadingState title={`正在读取${activeInventoryQueryLabel}数据`} />
          ) : activeInventoryQuery.isError ? (
            <ErrorState
              action={
                <RetryButton
                  disabled={activeInventoryQuery.isFetching}
                  onClick={() => void activeInventoryQuery.refetch()}
                />
              }
              description={getErrorMessage(activeInventoryQuery.error)}
              title={`读取${activeInventoryQueryLabel}失败`}
            />
          ) : activeView === "stock" && items.length === 0 ? (
            <EmptyState
              action={
                <Button
                  onClick={() => setActiveView("orders")}
                  size="sm"
                  variant="outline"
                >
                  <ClipboardList className="size-4" />
                  查看订单库存
                </Button>
              }
              description="公共库存会在出库剩余转入或公共库存调整后出现。"
              icon={<PackageIcon className="size-4" />}
              title="暂无公共库存"
            />
          ) : activeView === "orders" && orderGroups.length === 0 ? (
            <EmptyState
              action={
                <Button
                  onClick={() => navigate({ to: "/orders/new" })}
                  size="sm"
                >
                  新建订单
                </Button>
              }
              description="订单下单后会自动初始化订单库存，车间可从这里按订单入库、出库。"
              icon={<ClipboardList className="size-4" />}
              title="暂无订单库存"
            />
          ) : activeView === "orders" && filteredOrderGroups.length === 0 ? (
            <EmptyState
              action={
                <Button
                  onClick={() => setOrderInventoryFilter("all")}
                  size="sm"
                  variant="outline"
                >
                  查看全部订单库存
                </Button>
              }
              description="切换订单库存状态筛选后再试。"
              icon={<ClipboardList className="size-4" />}
              title="当前筛选下没有订单"
            />
          ) : activeView === "customer" &&
            customerInventoryBatches.length === 0 ? (
            <EmptyState
              action={
                <Button onClick={openCustomerInventoryDialog} size="sm">
                  新增客户库存
                </Button>
              }
              description="用于录入系统上线前已经属于客户、但尚未发货的历史库存。"
              icon={<PackageIcon className="size-4" />}
              title="暂无客户库存"
            />
          ) : activeView === "movements" && recentMovements.length === 0 ? (
            <EmptyState
              action={
                <Button
                  onClick={() => setActiveView("orders")}
                  size="sm"
                  variant="outline"
                >
                  <ClipboardList className="size-4" />
                  查看订单库存
                </Button>
              }
              description="入库、出库、盘点或公共库存转入订单后，这里会记录最近流水。"
              icon={<HistoryIcon className="size-4" />}
              title="暂无库存流水"
            />
          ) : activeView === "stock" ? (
            <PublicInventoryTable items={items} onOpenAdjustDialog={openAdjustDialog} />
          ) : activeView === "orders" ? (
            <OrderInventoryView
              filteredOrderGroups={filteredOrderGroups}
              isSelectedOrderDelivered={isSelectedOrderDelivered}
              onOpenBatchOrderAdjustDialog={openBatchOrderAdjustDialog}
              onOpenDeliveryNoteDialog={openDeliveryNoteDialog}
              onOpenDeliveryNotePrintPreview={openDeliveryNotePrintPreview}
              onOpenOrderAdjustDialog={openOrderAdjustDialog}
              onOpenTransferDialog={openTransferDialog}
              onOpenRemainderDialog={openRemainderDialog}
              onSelectOrder={setSelectedOrderId}
              orderMovementsAtBottom={orderMovementsAtBottom}
              orderMovementsCanScroll={orderMovementsCanScroll}
              orderMovementsScrollRef={orderMovementsScrollRef}
              selectedOrderGroup={selectedOrderGroup}
              selectedOrderMovements={selectedOrderMovements}
              selectedOrderPendingQuantity={selectedOrderPendingQuantity}
              selectedOrderPublicQuantity={selectedOrderPublicQuantity}
              selectedOrderRequiredQuantity={selectedOrderRequiredQuantity}
              selectedOrderStockQuantity={selectedOrderStockQuantity}
            />
          ) : activeView === "customer" ? (
            <CustomerInventoryView
              batches={customerInventoryBatches}
              customers={customers}
              deliveryNotes={customerInventoryDeliveryNotes}
              isReadingBatch={getCustomerInventoryBatchMutation.isPending}
              movements={customerInventoryMovements}
              onCreateBatch={openCustomerInventoryDialog}
              onOpenBatch={openCustomerInventoryBatchDialog}
              onOpenDelivery={openCustomerInventoryDeliveryDialog}
              onOpenDeliveryNotePrintPreview={
                openCustomerInventoryDeliveryNotePrintPreview
              }
              onOpenMergedDelivery={openSelectedCustomerInventoryDeliveryDialog}
              onToggleDeliveryBatchSelection={
                toggleCustomerInventoryDeliveryBatchSelection
              }
              selectedDeliveryBatchIds={
                selectedCustomerInventoryDeliveryBatchIds
              }
            />
          ) : (
            <InventoryMovementsTable movements={recentMovements} />
          )}
        </div>
      </section>

      {deliveryNoteErrors.form && !deliveryNoteOpen && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {deliveryNoteErrors.form}
        </div>
      )}

      {isInventoryPrintReady && (
        <div aria-hidden="true" className="print-root">
          {isDeliveryPrintReady && currentDeliveryNote && (
            <PrintDeliveryNoteView
              deliveryNote={currentDeliveryNote}
              totalQuantity={currentDeliveryNoteTotalQuantity}
              variant="print"
            />
          )}
          {isDeliveryPrintReady && currentMergedDeliveryNote && (
            <PrintMergedDeliveryNoteView
              mergedDeliveryNote={currentMergedDeliveryNote}
              variant="print"
            />
          )}
          {isCustomerInventoryPrintReady &&
            currentCustomerInventoryPrintSnapshot && (
              <PrintCustomerInventoryView
                groupLabels={customerInventoryPrintGroupLabels}
                pages={customerInventoryPrintPages}
                snapshot={currentCustomerInventoryPrintSnapshot}
                variant="print"
              />
            )}
        </div>
      )}

      <DeliveryNoteCreateDialog
        createErrorMessage={getErrorMessage(createDeliveryNoteMutation.error)}
        errors={deliveryNoteErrors}
        formValues={deliveryNoteFormValues}
        isCreateError={createDeliveryNoteMutation.isError}
        isPending={createDeliveryNoteMutation.isPending}
        isWriting={isWriting}
        onClearQuantities={clearAllDeliveryNoteQuantities}
        onFillAllQuantities={fillAllDeliveryNoteQuantities}
        onFormValueChange={updateDeliveryNoteFormValue}
        onOpenChange={handleDeliveryNoteOpenChange}
        onRowChange={updateDeliveryNoteRow}
        onSubmit={submitDeliveryNote}
        onWeightFocus={handleDeliveryNoteWeightFocus}
        onWeightKeyDown={focusNextDeliveryWeightField}
        open={deliveryNoteOpen}
        requiredWeights={requiredDeliveryWeights}
        rows={deliveryNoteRows}
        selectedOrderGroup={selectedOrderGroup}
        totalQuantity={deliveryNoteTotalQuantity}
        transferQuantity={deliveryNoteTransferQuantity}
        visibleWeightFields={visibleDeliveryWeightFields}
      />

      <OrderInventoryRemainderDialog
        errorMessage={getErrorMessage(transferOrderRemainderMutation.error)}
        isPending={transferOrderRemainderMutation.isPending}
        onOpenChange={setOrderRemainderOpen}
        onTransfer={transferOrderRemainder}
        open={orderRemainderOpen}
        selectedOrderGroup={selectedOrderGroup}
        totalQuantity={selectedOrderStockQuantity}
      />

      <MergeDeliveryNoteDialog
        deliveredOrderGroups={deliveredOrderGroups}
        deliveredOrderGroupsByDeliveryNoteId={deliveredOrderGroupsByDeliveryNoteId}
        errors={deliveryNoteErrors}
        groupsByDeliveryNoteId={mergeDeliveryNoteGroups}
        isPending={mergeDeliveryNoteMutation.isPending}
        onGroupChange={updateMergeDeliveryNoteGroup}
        onOpenChange={handleMergeDeliveryNoteOpenChange}
        onSpecialNoteChange={updateMergeDeliveryNoteSpecialNote}
        onSubmit={submitMergeDeliveryNote}
        onToggleDeliveryNote={toggleMergeDeliveryNote}
        open={mergeDeliveryNoteOpen}
        selectedDeliveryNoteIds={mergeDeliveryNoteIds}
        specialNote={mergeDeliveryNoteSpecialNote}
      />

      <DeliveryNotePrintPreviewDialog
        canSaveSpecialNote={canSaveDeliveryNotePreviewSpecialNote}
        currentDeliveryNote={currentDeliveryNote}
        currentDeliveryNoteTotalQuantity={currentDeliveryNoteTotalQuantity}
        currentMergedDeliveryNote={currentMergedDeliveryNote}
        isSavingSpecialNote={isSavingDeliveryNotePreviewSpecialNote}
        onOpenChange={handleDeliveryNotePrintOpenChange}
        onPrint={() => void printDeliveryNote()}
        onSaveSpecialNote={saveDeliveryNotePreviewSpecialNote}
        onSpecialNoteEditorOpenChange={
          handleDeliveryNoteSpecialNoteEditorOpenChange
        }
        onSpecialNoteChange={updateDeliveryNotePreviewSpecialNote}
        open={deliveryNotePrintOpen}
        savedSpecialNote={savedDeliveryNotePreviewSpecialNote}
        saveSpecialNoteErrorMessage={
          deliveryNotePreviewSpecialNoteErrorMessage
        }
        specialNoteEditorOpen={deliveryNotePreviewSpecialNoteEditorOpen}
        specialNote={deliveryNotePreviewSpecialNote}
      />

      <CustomerInventoryPrintDialog
        customerId={customerInventoryPrintCustomerId}
        customers={customerInventoryPrintCustomers}
        errorMessage={getErrorMessage(
          getCustomerInventoryPrintSnapshotMutation.error,
        )}
        isLoading={customerInventoryPrintOptionsQuery.isLoading}
        isPending={getCustomerInventoryPrintSnapshotMutation.isPending}
        onCustomerChange={setCustomerInventoryPrintCustomerId}
        onOpenChange={handleCustomerInventoryPrintDialogOpenChange}
        onSubmit={submitCustomerInventoryPrint}
        open={customerInventoryPrintDialogOpen}
      />

      <CustomerInventoryPrintPreviewDialog
        groupLabels={customerInventoryPrintGroupLabels}
        onLayoutResult={handleCustomerInventoryPrintLayoutResult}
        onEditGroups={editCustomerInventoryPrintGroups}
        onOpenChange={setCustomerInventoryPrintPreviewOpen}
        onPrint={() => void printCustomerInventory()}
        open={customerInventoryPrintPreviewOpen}
        pages={customerInventoryPrintPages}
        snapshot={currentCustomerInventoryPrintSnapshot}
      />

      <CustomerInventoryPrintGroupDialog
        errorMessage={customerInventoryPrintLayoutError}
        groupLabels={customerInventoryPrintGroupLabels}
        onBack={backToCustomerInventoryPrintCustomer}
        onGroupChange={updateCustomerInventoryPrintGroup}
        onOpenChange={handleCustomerInventoryPrintGroupOpenChange}
        onSubmit={submitCustomerInventoryPrintGroups}
        open={customerInventoryPrintGroupOpen}
        snapshot={currentCustomerInventoryPrintSnapshot}
      />

      <CustomerInventoryImportDialog
        errors={customerInventoryImportErrors}
        fileName={customerInventoryImportFileName}
        isImporting={importCustomerInventoryMutation.isPending}
        isParsing={parseCustomerInventoryImportMutation.isPending}
        onConfirm={confirmCustomerInventoryImport}
        onOpenChange={handleCustomerInventoryImportOpenChange}
        onSelectFile={() => void selectCustomerInventoryImportFile()}
        open={customerInventoryImportOpen}
        rows={customerInventoryImportRows}
      />

      <CustomerInventoryBatchDialog
        categoryQuantityItems={customerInventoryCategoryQuantityItems}
        createErrorMessage={getErrorMessage(createCustomerInventoryBatchMutation.error)}
        customers={customers}
        dialogTitle={customerInventoryDialogTitle}
        editingBatch={editingCustomerInventoryBatch}
        errors={customerInventoryErrors}
        formValues={customerInventoryFormValues}
        isCreateError={createCustomerInventoryBatchMutation.isError}
        isCreatePending={createCustomerInventoryBatchMutation.isPending}
        isReadOnly={isCustomerInventoryReadOnly}
        isUpdateError={updateCustomerInventoryBatchMutation.isError}
        isUpdatePending={updateCustomerInventoryBatchMutation.isPending}
        isWriting={isWriting}
        matchedSpecialPricingKeyword={customerInventoryMatchedSpecialPricingKeyword}
        onAddRow={appendCustomerInventoryRow}
        onAdjustStock={openCustomerInventoryAdjustDialog}
        onCustomerChange={handleCustomerInventoryCustomerChange}
        onFormValueChange={handleCustomerInventoryFormValueChange}
        onHistoricalOrderDateFocus={
          handleCustomerInventoryHistoricalOrderDateFocus
        }
        onNoteChange={handleCustomerInventoryNoteChange}
        onOpenChange={handleCustomerInventoryOpenChange}
        onPricingTaxIncludedChange={
          handleCustomerInventoryPricingTaxIncludedChange
        }
        onRemoveRow={handleCustomerInventoryRemoveRow}
        onRowFieldChange={handleCustomerInventoryRowFieldChange}
        onRowKeyDown={confirmCustomerInventoryDetailOnEnter}
        onRowProductChange={handleCustomerInventoryRowProductChange}
        onSubmit={submitCustomerInventoryBatch}
        open={customerInventoryOpen}
        productPlaceholder={customerInventoryProductPlaceholder}
        products={customerInventoryProducts}
        rows={customerInventoryRows}
        shouldBlockProductSelect={shouldBlockCustomerInventoryProductSelect}
        totalQuantity={customerInventoryTotalQuantity}
        totalTheoreticalWeightKgX100={customerInventoryTotalTheoreticalWeightKgX100}
        updateErrorMessage={getErrorMessage(updateCustomerInventoryBatchMutation.error)}
        visibleProcessingFeeFields={visibleCustomerInventoryProcessingFeeFields}
      />

      <CustomerInventoryDeliveryDialog
        canClearCustomerInventoryDeliveryQuantities={
          canClearCustomerInventoryDeliveryQuantities
        }
        clearAllCustomerInventoryDeliveryQuantities={
          clearAllCustomerInventoryDeliveryQuantities
        }
        createErrorMessage={getErrorMessage(
          createCustomerInventoryDeliveryNoteMutation.error,
        )}
        customerInventoryDeliveryErrors={customerInventoryDeliveryErrors}
        customerInventoryDeliveryFormValues={
          customerInventoryDeliveryFormValues
        }
        customerInventoryDeliveryGroups={customerInventoryDeliveryGroups}
        customerInventoryDeliveryOpen={customerInventoryDeliveryOpen}
        customerInventoryDeliveryPriceGroupFormValues={
          customerInventoryDeliveryPriceGroupFormValues
        }
        customerInventoryDeliveryPriceGroups={
          customerInventoryDeliveryPriceGroups
        }
        customerInventoryDeliveryRows={customerInventoryDeliveryRows}
        customerInventoryDeliveryTotalQuantity={
          customerInventoryDeliveryTotalQuantity
        }
        fillAllCustomerInventoryDeliveryQuantities={
          fillAllCustomerInventoryDeliveryQuantities
        }
        focusNextCustomerInventoryDeliveryTarget={
          focusNextCustomerInventoryDeliveryTarget
        }
        handleCustomerInventoryDeliveryOpenChange={
          handleCustomerInventoryDeliveryOpenChange
        }
        hasMultipleCustomerInventoryDeliveryPriceGroups={
          hasMultipleCustomerInventoryDeliveryPriceGroups
        }
        isCreateError={createCustomerInventoryDeliveryNoteMutation.isError}
        isCreatePending={createCustomerInventoryDeliveryNoteMutation.isPending}
        isWriting={isWriting}
        onFormValueChange={handleCustomerInventoryDeliveryFormValueChange}
        onGroupLabelChange={
          handleCustomerInventoryDeliveryGroupLabelChange
        }
        onPriceGroupFormValueChange={
          handleCustomerInventoryDeliveryPriceGroupFormValueChange
        }
        onRowNoteChange={handleCustomerInventoryDeliveryRowNoteChange}
        onRowQuantityChange={
          handleCustomerInventoryDeliveryRowQuantityChange
        }
        requiredCustomerInventoryDeliveryWeights={
          requiredCustomerInventoryDeliveryWeights
        }
        selectedCustomerInventoryBatch={selectedCustomerInventoryBatch}
        selectedCustomerInventoryDeliveryBatches={
          selectedCustomerInventoryDeliveryBatches
        }
        selectedCustomerInventoryPricingProfileName={
          selectedCustomerInventoryPricingProfileName
        }
        submitCustomerInventoryDelivery={submitCustomerInventoryDelivery}
        visibleCustomerInventoryDeliveryWeightFields={
          visibleCustomerInventoryDeliveryWeightFields
        }
      />

      <CustomerInventoryAdjustDialog
        errors={customerInventoryAdjustErrors}
        formValues={customerInventoryAdjustFormValues}
        isError={adjustCustomerInventoryStockMutation.isError}
        isPending={adjustCustomerInventoryStockMutation.isPending}
        isWriting={isWriting}
        onFormValueChange={handleCustomerInventoryAdjustFormValueChange}
        onOpenChange={handleCustomerInventoryAdjustOpenChange}
        onSubmit={submitCustomerInventoryAdjustment}
        open={customerInventoryAdjustOpen}
        submitErrorMessage={getErrorMessage(
          adjustCustomerInventoryStockMutation.error,
        )}
      />

      <TransferInventoryDialog
        errors={transferFormErrors}
        formValues={transferFormValues}
        isError={transferPublicInventoryMutation.isError}
        isPending={transferPublicInventoryMutation.isPending}
        isWriting={isWriting}
        onFormValueChange={updateTransferFormValue}
        onOpenChange={handleTransferOpenChange}
        onSubmit={submitTransfer}
        open={transferOpen}
        remainingQuantity={transferRemainingQuantity}
        submitErrorMessage={getErrorMessage(
          transferPublicInventoryMutation.error,
        )}
        suggestedQuantity={transferSuggestedQuantity}
      />

      <BatchOrderAdjustDialog
        areQuantitiesEmpty={areBatchOrderQuantitiesEmpty}
        enteredQuantity={batchOrderEnteredQuantity}
        errors={batchOrderErrors}
        imageMatches={batchOrderImageMatches}
        imageRecognitionErrorMessage={getErrorMessage(
          recognizeInventoryImageMutation.error,
        )}
        isImageRecognitionError={recognizeInventoryImageMutation.isError}
        isImageRecognitionPending={recognizeInventoryImageMutation.isPending}
        isSubmitError={adjustOrderInventoryBatchMutation.isError}
        isSubmitPending={adjustOrderInventoryBatchMutation.isPending}
        isWriting={isWriting}
        matchedImageCount={batchOrderImageMatchedCount}
        note={batchOrderNote}
        onApplyImageRecognition={applyBatchOrderImageRecognition}
        onClearQuantities={clearBatchOrderQuantities}
        onFillRequiredQuantities={fillBatchOrderRequiredQuantities}
        onNoteChange={updateBatchOrderNote}
        onOpenChange={handleBatchOrderAdjustOpenChange}
        onQuantityChange={updateBatchOrderQuantity}
        onQuantityKeyDown={focusNextBatchOrderQuantity}
        onRecognizeImage={recognizeBatchOrderImage}
        onSubmit={submitBatchOrderAdjustment}
        onToggleRawText={toggleBatchOrderImageRawTextOpen}
        open={batchOrderAdjustOpen}
        rawTextOpen={batchOrderImageRawTextOpen}
        rawTexts={batchOrderImageRawTexts}
        recognizedImagePaths={batchOrderRecognizedImagePaths}
        rows={batchOrderRows}
        selectedOrderGroup={selectedOrderGroup}
        skippedImagePaths={batchOrderSkippedImagePaths}
        submitErrorMessage={getErrorMessage(
          adjustOrderInventoryBatchMutation.error,
        )}
        unresolvedImageCount={batchOrderImageUnresolvedCount}
      />

      <BatchOrderImagePreviewDialog
        currentImage={batchOrderCurrentPreviewImage}
        imageCount={batchOrderImagePreviews.length}
        imageIndex={batchOrderImagePreviewIndex}
        isPending={recognizeInventoryImageMutation.isPending}
        onConfirm={confirmBatchOrderImageRecognition}
        onIndexChange={setBatchOrderImagePreviewIndex}
        onOpenChange={setBatchOrderImagePreviewOpen}
        onRotate={updateBatchOrderPreviewRotation}
        open={batchOrderImagePreviewOpen}
      />

      <OrderInventoryAdjustDialog
        errors={orderFormErrors}
        formValues={orderFormValues}
        isError={adjustOrderInventoryMutation.isError}
        isPending={adjustOrderInventoryMutation.isPending}
        isWriting={isWriting}
        notePlaceholder={orderInventoryNotePlaceholder}
        onFormValueChange={updateOrderFormValue}
        onOpenChange={handleOrderAdjustOpenChange}
        onSubmit={submitOrderAdjustment}
        open={orderAdjustOpen}
        quantityPlaceholder={orderInventoryQuantityPlaceholder}
        submitErrorMessage={getErrorMessage(adjustOrderInventoryMutation.error)}
      />

      <PublicInventoryAdjustDialog
        currentProduct={currentProduct}
        currentStockQuantity={currentStockQuantity}
        errors={formErrors}
        formValues={formValues}
        isError={adjustInventoryMutation.isError}
        isPending={adjustInventoryMutation.isPending}
        isWriting={isWriting}
        notePlaceholder={publicInventoryNotePlaceholder}
        onFormValueChange={updateFormValue}
        onOpenChange={handleAdjustOpenChange}
        onSubmit={submitAdjustment}
        open={adjustOpen}
        submitErrorMessage={getErrorMessage(adjustInventoryMutation.error)}
      />
    </div>
  );
}
