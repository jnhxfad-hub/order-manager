import { RefreshCcw } from "lucide-react"

import { SectionHeading } from "@/components/section-heading"
import { Button } from "@/components/ui/button"
import type { InventoryOverviewStats } from "@/features/inventory/lib/inventory-utils"
import { cn } from "@/lib/utils"

export interface InventoryStatsHeaderProps {
  isRefreshing: boolean
  onRefresh: () => void
  stats: InventoryOverviewStats
}

export function InventoryStatsHeader({
  isRefreshing,
  onRefresh,
  stats,
}: InventoryStatsHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
      <div className="space-y-3">
        <SectionHeading title="库存管理" />
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="min-w-28 rounded-md border bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">公共库存</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {stats.publicInventoryItemCount} 项
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {stats.publicInventoryTotalQuantity} 支
            </div>
          </div>
          <div className="min-w-28 rounded-md border bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">订单库存</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {stats.orderInventoryOrderCount} 单
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {stats.orderInventoryTotalQuantity} 支
            </div>
          </div>
          <div className="min-w-28 rounded-md border bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">客户库存</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {stats.customerInventoryBatchCount} 批
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {stats.customerInventoryTotalStockQuantity} 支
            </div>
          </div>
          <div className="min-w-28 rounded-md border bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">库存合计</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {stats.inventoryOverviewTotalQuantity} 支
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              公共 + 订单 + 客户
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          aria-label="刷新库存"
          disabled={isRefreshing}
          onClick={onRefresh}
          size="sm"
          variant="outline"
        >
          <RefreshCcw
            className={cn("size-4", isRefreshing && "animate-spin")}
          />
          刷新
        </Button>
      </div>
    </div>
  )
}
