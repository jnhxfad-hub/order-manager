import {
  EyeIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  TruckIcon,
  Printer,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { SectionHeading } from "@/components/section-heading"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip } from "@/components/ui/tooltip"
import { getMatchedSpecialPricingKeyword } from "@/features/customers/lib/customer-pricing"
import type { Customer } from "@/features/customers/types"
import { formatMovementSpec } from "@/features/inventory/lib/inventory-utils"
import type {
  CustomerInventoryDeliveryNoteSummary,
  CustomerInventoryBatch,
  CustomerInventoryMovement,
  CustomerInventoryMovementType,
} from "@/features/inventory/types"
import { formatAppDateTime } from "@/lib/datetime"
import { formatCurrencyX100 } from "@/lib/money"
import {
  getProcessingCategoryLabel,
  type ProcessingCategory,
} from "@/lib/processing-fees"
import { cn } from "@/lib/utils"

const customerInventoryMovementMeta: Record<
  CustomerInventoryMovementType,
  { label: string; className: string }
> = {
  adjust: { label: "盘点", className: "text-blue-700" },
  historical_import: { label: "补录", className: "text-emerald-700" },
  out: { label: "出库", className: "text-amber-700" },
  transfer_order: { label: "订单转入", className: "text-blue-700" },
}

const customerInventoryProcessingFeeSnapshotFields = [
  { category: "bridge", snapshotKey: "bridgeProcessingFeeX100" },
  { category: "powder", snapshotKey: "powderProcessingFeeX100" },
  { category: "billet", snapshotKey: "billetProcessingFeeX100" },
  { category: "oxidation", snapshotKey: "oxidationProcessingFeeX100" },
  {
    category: "electrophoresis",
    snapshotKey: "electrophoresisProcessingFeeX100",
  },
] as const satisfies Array<{
  category: ProcessingCategory
  snapshotKey:
    | "bridgeProcessingFeeX100"
    | "powderProcessingFeeX100"
    | "billetProcessingFeeX100"
    | "oxidationProcessingFeeX100"
    | "electrophoresisProcessingFeeX100"
}>

function formatDateTime(value: string | null) {
  return formatAppDateTime(value, { fallback: "未调整" })
}

function CustomerInventoryProcessingFeeSummary({
  batch,
  customer,
}: {
  batch: CustomerInventoryBatch
  customer: Customer | null
}) {
  const fees = customerInventoryProcessingFeeSnapshotFields
    .map((field) => ({
      category: getProcessingCategoryLabel(field.category),
      value: batch[field.snapshotKey],
    }))
    .filter((fee) => fee.value > 0)
  const specialPricingKeyword = getMatchedSpecialPricingKeyword(
    customer,
    batch.note,
  )
  const label = specialPricingKeyword || "默认"

  if (fees.length === 0) {
    return <span className="text-muted-foreground">未设置</span>
  }

  return (
    <div className="space-y-1 text-xs leading-5">
      <div className="min-w-0 space-y-0.5">
        <span
          className={cn(
            "inline-flex h-5 max-w-full items-center rounded border px-1.5 text-[11px] leading-none font-normal",
            specialPricingKeyword
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-border bg-muted/30 text-muted-foreground",
          )}
          title={label}
        >
          <span className="truncate">{label}</span>
        </span>
        <div
          className={cn(
            "flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 tabular-nums",
            specialPricingKeyword && "text-muted-foreground",
          )}
        >
          {fees.map((fee) => (
            <span
              className="inline-grid grid-cols-[2rem_3.75rem] items-baseline gap-1 whitespace-nowrap"
              key={fee.category}
            >
              <span className="text-muted-foreground">{fee.category}</span>
              <span className="text-right font-medium text-foreground">
                {formatCurrencyX100(fee.value)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CustomerInventoryView({
  batches,
  customers,
  isReadingBatch,
  deliveryNotes,
  movements,
  onCreateBatch,
  onOpenBatch,
  onOpenDelivery,
  onOpenDeliveryNotePrintPreview,
  onOpenMergedDelivery,
  onToggleDeliveryBatchSelection,
  selectedDeliveryBatchIds,
}: {
  batches: CustomerInventoryBatch[]
  customers: Customer[]
  isReadingBatch: boolean
  deliveryNotes: CustomerInventoryDeliveryNoteSummary[]
  movements: CustomerInventoryMovement[]
  onCreateBatch: () => void
  onOpenBatch: (batch: CustomerInventoryBatch) => void
  onOpenDelivery: (batch: CustomerInventoryBatch) => void
  onOpenDeliveryNotePrintPreview: (deliveryNoteId: string) => void
  onOpenMergedDelivery: () => void
  onToggleDeliveryBatchSelection: (
    batch: CustomerInventoryBatch,
    checked: boolean,
  ) => void
  selectedDeliveryBatchIds: string[]
}) {
  const selectedCustomerId =
    batches.find((batch) => selectedDeliveryBatchIds.includes(batch.id))
      ?.customerId ?? null

  return (
    <div className="customer-inventory-panels">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="text-sm text-muted-foreground">
          已选择{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {selectedDeliveryBatchIds.length}
          </span>{" "}
          个可出库批次
        </div>
        <Button
          disabled={selectedDeliveryBatchIds.length === 0}
          onClick={onOpenMergedDelivery}
          size="sm"
          type="button"
          variant="outline"
        >
          <TruckIcon className="size-4" />
          合并出库
        </Button>
      </div>
      <div className="workspace-card customer-inventory-history rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <SectionHeading
            badge={`${deliveryNotes.length} 张`}
            description="单独查看和补打客户库存出库单。"
            title="客户库存出库单"
          />
        </div>
        {deliveryNotes.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={onCreateBatch} size="sm">
                <PlusIcon className="size-4" />
                新增客户库存
              </Button>
            }
            className="min-h-44 border-0"
            description="客户库存出库后，这里会显示已保存的出库单。"
            icon={<Printer className="size-4" />}
            title="暂无客户库存出库单"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-300 table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-[11%] px-4">出库日期</TableHead>
                  <TableHead className="h-10 w-[16%] px-4">出库单号</TableHead>
                  <TableHead className="h-10 w-[9%] px-4">类型</TableHead>
                  <TableHead className="h-10 w-[14%] px-4">客户</TableHead>
                  <TableHead className="h-10 w-[16%] px-4">关联批次</TableHead>
                  <TableHead className="h-10 w-[8%] px-4 text-right">明细</TableHead>
                  <TableHead className="h-10 w-[8%] px-4 text-right">数量</TableHead>
                  <TableHead className="h-10 w-[10%] px-4">经手人</TableHead>
                  <TableHead className="h-10 w-[8%] px-4 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNotes.map((deliveryNote) => (
                  <TableRow key={deliveryNote.id}>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {deliveryNote.deliveryDate}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-sm font-medium">
                      {deliveryNote.id}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded border px-2 text-xs leading-none font-medium",
                          deliveryNote.batchIds.length > 1
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-border bg-muted/30 text-muted-foreground",
                        )}
                      >
                        {deliveryNote.batchIds.length > 1 ? "合并" : "单批次"}
                      </span>
                    </TableCell>
                    <TableCell className="truncate px-4 py-3 font-medium">
                      {deliveryNote.customerName}
                    </TableCell>
                    <TableCell className="truncate px-4 py-3 text-muted-foreground">
                      {deliveryNote.batchIds.length > 0
                        ? deliveryNote.batchIds.join("、")
                        : "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">
                      {deliveryNote.itemCount}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                      {deliveryNote.totalQuantity}
                    </TableCell>
                    <TableCell className="truncate px-4 py-3">
                      {deliveryNote.handlerName || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Tooltip align="end" content="预览/补打" side="top">
                          <Button
                            aria-label="预览/补打"
                            onClick={() =>
                              onOpenDeliveryNotePrintPreview(deliveryNote.id)
                            }
                            size="icon-xs"
                            variant="ghost"
                          >
                            <Printer className="size-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Table className="w-full table-fixed">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 w-[5%] px-3 text-center">
              选择
            </TableHead>
            <TableHead className="h-10 w-[12%] px-3">批次</TableHead>
            <TableHead className="h-10 w-[13%] px-3">客户</TableHead>
            <TableHead className="h-10 w-[10%] px-3">历史日期</TableHead>
            <TableHead className="h-10 w-[9%] px-3 pr-7 text-right">
              铝锭价
            </TableHead>
            <TableHead className="h-10 w-[7%] px-3 pl-7">计价</TableHead>
            <TableHead className="h-10 w-[6%] px-3 text-right">
              明细
            </TableHead>
            <TableHead className="h-10 w-[8%] px-3 text-right">
              当前库存
            </TableHead>
            <TableHead className="h-10 w-[28%] px-3">加工费</TableHead>
            <TableHead className="h-10 w-[10%] px-3 text-right">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => {
            const isSelected = selectedDeliveryBatchIds.includes(batch.id)
            const isSelectionDisabled =
              batch.totalQuantity <= 0 ||
              Boolean(
                selectedCustomerId &&
                  selectedCustomerId !== batch.customerId &&
                  !isSelected,
              )

            return (
              <TableRow data-customer-inventory-batch={batch.id} key={batch.id}>
                <TableCell className="px-3 py-3 text-center">
                  <input
                    aria-label={`选择批次 ${batch.id}`}
                    checked={isSelected}
                    className="size-4 accent-[#6f7f3f]"
                    disabled={isSelectionDisabled}
                    onChange={(event) =>
                      onToggleDeliveryBatchSelection(batch, event.target.checked)
                    }
                    type="checkbox"
                  />
                </TableCell>
                <TableCell className="px-3 py-3 font-mono text-sm font-medium">
                  {batch.id}
                </TableCell>
                <TableCell className="truncate px-3 py-3 font-medium">
                  {batch.customerName}
                </TableCell>
                <TableCell className="px-3 py-3 text-muted-foreground">
                  {batch.historicalOrderDate || "-"}
                </TableCell>
                <TableCell className="px-3 py-3 pr-7 text-right tabular-nums">
                  {formatCurrencyX100(batch.aluminumIngotPriceX100)}
                </TableCell>
                <TableCell className="px-3 py-3 pl-7 text-muted-foreground">
                  {batch.pricingTaxIncluded ? "含税" : "不含税"}
                </TableCell>
                <TableCell className="px-3 py-3 text-right tabular-nums">
                  {batch.itemCount}
                </TableCell>
                <TableCell className="px-3 py-3 text-right font-semibold tabular-nums">
                  {batch.totalQuantity}
                </TableCell>
                <TableCell className="px-3 py-3">
                  <CustomerInventoryProcessingFeeSummary
                    batch={batch}
                    customer={
                      customers.find(
                        (customer) => customer.id === batch.customerId,
                      ) ?? null
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <Tooltip
                      align="end"
                      content={batch.hasDeliveryNote ? "查看批次" : "修改批次"}
                      side="top"
                    >
                      <Button
                        aria-label={
                          batch.hasDeliveryNote ? "查看批次" : "修改批次"
                        }
                        disabled={isReadingBatch}
                        onClick={() => onOpenBatch(batch)}
                        size="icon-xs"
                        variant="ghost"
                      >
                        {batch.hasDeliveryNote ? (
                          <EyeIcon className="size-4" />
                        ) : (
                          <PencilIcon className="size-4" />
                        )}
                      </Button>
                    </Tooltip>
                    {batch.totalQuantity > 0 && (
                      <Tooltip align="end" content="出库" side="top">
                        <Button
                          aria-label="出库"
                          onClick={() => onOpenDelivery(batch)}
                          size="icon-xs"
                          variant="ghost"
                        >
                          <TruckIcon className="size-4" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="workspace-card customer-inventory-history rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <SectionHeading
            badge={`${movements.length} 条`}
            description="记录客户历史库存的补录、出库和盘点。"
            title="客户库存流水"
          />
        </div>
        {movements.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={onCreateBatch} size="sm">
                <PlusIcon className="size-4" />
                新增客户库存
              </Button>
            }
            className="min-h-44 border-0"
            description="补录、出库或盘点客户库存后，这里会显示最近流水。"
            icon={<HistoryIcon className="size-4" />}
            title="暂无客户库存流水"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-300 table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-29 px-4">时间</TableHead>
                  <TableHead className="h-10 w-52 px-4">
                    批次/出库单
                  </TableHead>
                  <TableHead className="h-10 w-[16%] px-4">客户</TableHead>
                  <TableHead className="h-10 w-[16%] px-4">
                    商品名称
                  </TableHead>
                  <TableHead className="h-10 w-28 px-4">模具编号</TableHead>
                  <TableHead className="h-10 w-45 px-4">规格</TableHead>
                  <TableHead className="h-10 w-22 px-4">类型</TableHead>
                  <TableHead className="h-10 w-19.5 px-3 text-right">
                    变动
                  </TableHead>
                  <TableHead className="h-10 w-23 px-3 text-right">
                    变动后
                  </TableHead>
                  <TableHead className="h-10 w-56 px-4">备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => {
                  const movementMeta =
                    customerInventoryMovementMeta[movement.movementType]

                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(movement.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-sm font-medium">
                            {movement.batchId || "-"}
                          </div>
                          {movement.deliveryNoteId && (
                            <div className="truncate text-xs text-muted-foreground">
                              出库单 {movement.deliveryNoteId}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 font-medium">
                        {movement.customerName}
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 font-medium">
                        {movement.productName}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-sm">
                        {movement.moldCode}
                      </TableCell>
                      <TableCell className="truncate px-4 py-3 text-muted-foreground">
                        {formatMovementSpec(movement)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "px-4 py-3 font-medium",
                          movementMeta.className,
                        )}
                      >
                        {movementMeta.label}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right font-medium tabular-nums">
                        {movement.deltaQuantity > 0 ? "+" : ""}
                        {movement.deltaQuantity}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right tabular-nums">
                        {movement.quantityAfter}
                      </TableCell>
                      <TableCell
                        className="px-4 py-3 text-muted-foreground"
                        title={movement.note || undefined}
                      >
                        <span className="block max-w-[22ch] truncate">
                          {movement.note || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
