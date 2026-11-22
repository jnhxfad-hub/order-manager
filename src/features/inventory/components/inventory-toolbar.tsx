import { Download, Printer, UploadIcon } from "lucide-react"

import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import {
  inventoryViews,
  orderInventoryFilters,
  type InventoryView,
  type OrderInventoryFilter,
} from "@/features/inventory/lib/inventory-utils"

export interface InventoryToolbarProps {
  activeView: InventoryView
  customerInventoryExportItemCount: number
  customerInventoryTotalQuantity: number
  deliveredOrderGroupCount: number
  onActiveViewChange: (view: InventoryView) => void
  onDownloadImportTemplate: () => Promise<void>
  onExportCurrentCustomerInventory: () => Promise<void>
  onOpenCustomerInventoryDialog: () => void
  onOpenCustomerInventoryImportDialog: () => void
  onOpenCustomerInventoryPrintDialog: () => void
  onOpenMergeDeliveryNoteDialog: () => void
  onOrderInventoryFilterChange: (filter: OrderInventoryFilter) => void
  onSearchChange: (value: string) => void
  orderInventoryFilter: OrderInventoryFilter
  orderInventoryFilterCounts: Record<OrderInventoryFilter, number>
  search: string
}

export function InventoryToolbar({
  activeView,
  customerInventoryExportItemCount,
  customerInventoryTotalQuantity,
  deliveredOrderGroupCount,
  onActiveViewChange,
  onDownloadImportTemplate,
  onExportCurrentCustomerInventory,
  onOpenCustomerInventoryDialog,
  onOpenCustomerInventoryImportDialog,
  onOpenCustomerInventoryPrintDialog,
  onOpenMergeDeliveryNoteDialog,
  onOrderInventoryFilterChange,
  onSearchChange,
  orderInventoryFilter,
  orderInventoryFilterCounts,
  search,
}: InventoryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
      <div className="flex rounded-md border bg-background p-0.5">
        {inventoryViews.map((view) => (
          <Button
            className="h-7 px-3"
            key={view.value}
            onClick={() => onActiveViewChange(view.value)}
            size="sm"
            type="button"
            variant={activeView === view.value ? "secondary" : "ghost"}
          >
            {view.label}
          </Button>
        ))}
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        {activeView === "orders" && (
          <div className="flex max-w-full overflow-x-auto rounded-md border bg-background p-0.5">
            {orderInventoryFilters.map((filter) => (
              <Button
                className="h-7 gap-1.5 px-2.5"
                key={filter.value}
                onClick={() => onOrderInventoryFilterChange(filter.value)}
                size="sm"
                type="button"
                variant={
                  orderInventoryFilter === filter.value
                    ? "secondary"
                    : "ghost"
                }
              >
                {filter.label}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {orderInventoryFilterCounts[filter.value] ?? 0}
                </span>
              </Button>
            ))}
          </div>
        )}
        {activeView === "orders" && (
          <Button
            disabled={deliveredOrderGroupCount < 2}
            onClick={onOpenMergeDeliveryNoteDialog}
            size="sm"
            type="button"
            variant="outline"
          >
            <Printer className="size-4" />
            合并出库单
          </Button>
        )}
        {activeView === "customer" && (
          <>
            <Button
              onClick={() => void onDownloadImportTemplate()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="size-4" />
              下载模板
            </Button>
            <Button
              disabled={customerInventoryExportItemCount === 0}
              onClick={() => void onExportCurrentCustomerInventory()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download className="size-4" />
              批量导出
            </Button>
            <Button
              onClick={onOpenCustomerInventoryImportDialog}
              size="sm"
              type="button"
              variant="outline"
            >
              <UploadIcon className="size-4" />
              批量导入
            </Button>
            <Button
              disabled={customerInventoryTotalQuantity <= 0}
              onClick={onOpenCustomerInventoryPrintDialog}
              size="sm"
              type="button"
              variant="outline"
            >
              <Printer className="size-4" />
              打印客户库存
            </Button>
            <Button
              onClick={onOpenCustomerInventoryDialog}
              size="sm"
              type="button"
            >
              新增客户库存
            </Button>
          </>
        )}
        <SearchField
          onChange={onSearchChange}
          placeholder="搜索商品、模具、客户、订单"
          value={search}
        />
      </div>
    </div>
  )
}
