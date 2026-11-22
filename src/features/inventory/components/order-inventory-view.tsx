import { ArrowRightLeft, HistoryIcon, Printer } from "lucide-react"
import type { RefObject } from "react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatMovementSpec,
  getInventoryDetailKey,
  getOrderGroupStats,
  movementText,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils"
import type {
  InventoryMovement,
  InventoryMovementType,
  OrderInventoryItem,
  OrderInventoryMovementType,
} from "@/features/inventory/types"
import { formatAppDate, formatAppDateTime } from "@/lib/datetime"
import { cn } from "@/lib/utils"

const movementTone: Record<InventoryMovementType, string> = {
  adjust: "text-blue-700",
  in: "text-emerald-700",
  out: "text-amber-700",
  produce: "text-emerald-700",
  ship: "text-amber-700",
  transfer_customer: "text-blue-700",
  transfer_public: "text-blue-700",
}

type OrderInventoryViewProps = {
  filteredOrderGroups: OrderInventoryGroup[]
  isSelectedOrderDelivered: boolean
  onOpenBatchOrderAdjustDialog: (group: OrderInventoryGroup) => void
  onOpenDeliveryNoteDialog: (group: OrderInventoryGroup) => void
  onOpenDeliveryNotePrintPreview: (deliveryNoteId: string) => void
  onOpenOrderAdjustDialog: (
    item: OrderInventoryItem,
    movementType: OrderInventoryMovementType,
  ) => void
  onOpenTransferDialog: (item: OrderInventoryItem) => void
  onOpenRemainderDialog: () => void
  onSelectOrder: (orderId: string) => void
  orderMovementsAtBottom: boolean
  orderMovementsCanScroll: boolean
  orderMovementsScrollRef: RefObject<HTMLDivElement | null>
  selectedOrderGroup: OrderInventoryGroup | undefined
  selectedOrderMovements: InventoryMovement[]
  selectedOrderPendingQuantity: number
  selectedOrderPublicQuantity: number
  selectedOrderRequiredQuantity: number
  selectedOrderStockQuantity: number
}

export function OrderInventoryView({
  filteredOrderGroups,
  isSelectedOrderDelivered,
  onOpenBatchOrderAdjustDialog,
  onOpenDeliveryNoteDialog,
  onOpenDeliveryNotePrintPreview,
  onOpenOrderAdjustDialog,
  onOpenTransferDialog,
  onOpenRemainderDialog,
  onSelectOrder,
  orderMovementsAtBottom,
  orderMovementsCanScroll,
  orderMovementsScrollRef,
  selectedOrderGroup,
  selectedOrderMovements,
  selectedOrderPendingQuantity,
  selectedOrderPublicQuantity,
  selectedOrderRequiredQuantity,
  selectedOrderStockQuantity,
}: OrderInventoryViewProps) {
  return (
    <div className="order-inventory-panels grid lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="inventory-order-picker border-b bg-muted/20 p-3 lg:border-b-0 lg:border-r">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>订单</span>
          <span>{filteredOrderGroups.length} 单</span>
        </div>
        <div className="inventory-order-list grid gap-2 overflow-y-auto pr-1">
          {filteredOrderGroups.map((group) => {
            const {
              hasOverStock,
              isDelivered,
              orderQuantity,
              pendingQuantity,
              requiredQuantity,
            } = getOrderGroupStats(group)
            const isSelected = group.orderId === selectedOrderGroup?.orderId

            return (
              <button
                className={cn(
                  "rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/40",
                  isSelected && "border-l-4 border-l-[#6f7f3f] bg-[#f6f7ee]",
                  hasOverStock && "border-amber-400",
                )}
                key={group.orderId}
                onClick={() => onSelectOrder(group.orderId)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-sm font-semibold">
                    {group.orderId}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatOrderDate(group.orderedDate)}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-medium">
                  {group.customerName}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{group.items.length} 项商品</span>
                  <span className="tabular-nums">
                    当前 {orderQuantity} / 下单 {requiredQuantity}
                  </span>
                </div>
                {hasOverStock && (
                  <div className="mt-1 text-xs font-medium text-amber-700">
                    已超入库
                  </div>
                )}
                {!isDelivered && pendingQuantity > 0 && (
                  <div className="mt-1 text-xs font-medium text-blue-700">
                    待入库 {pendingQuantity} 支
                  </div>
                )}
                {group.inventoryClosedAt ? (
                  <div className="mt-1 text-xs font-medium text-emerald-700">
                    {group.inventoryCloseDestination === "public"
                      ? "剩余已转公共库存"
                      : group.inventoryCloseDestination === "customer"
                        ? "剩余已转客户库存"
                        : "已全部出库"}
                  </div>
                ) : isDelivered ? (
                  <div className="mt-1 text-xs font-medium text-emerald-700">
                    部分出库 · {group.deliveryNoteIds.length} 张单
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="inventory-order-detail min-w-0">
        {selectedOrderGroup ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-start gap-x-8 gap-y-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold">
                    {selectedOrderGroup.orderId}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedOrderGroup.customerName} ·{" "}
                    {formatOrderDate(selectedOrderGroup.orderedDate)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5 text-xs text-muted-foreground">
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                    商品：
                    <span className="font-semibold text-foreground tabular-nums">
                      {selectedOrderGroup.items.length}
                    </span>
                  </span>
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                    下单数量：
                    <span className="font-semibold text-foreground tabular-nums">
                      {selectedOrderRequiredQuantity}
                    </span>
                  </span>
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                    当前库存：
                    <span className="font-semibold text-foreground tabular-nums">
                      {selectedOrderStockQuantity}
                    </span>
                  </span>
                  <span className="rounded-md border border-border bg-muted/20 px-2.5 py-1 text-muted-foreground">
                    计价：
                    <span className="font-semibold text-foreground">
                      {selectedOrderGroup.pricingTaxIncluded ? "含税" : "不含税"}
                    </span>
                  </span>
                  {isSelectedOrderDelivered && !selectedOrderGroup.inventoryClosedAt && (
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                      部分出库 · {selectedOrderGroup.deliveryNoteIds.length} 张单
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={Boolean(selectedOrderGroup.inventoryClosedAt) || selectedOrderStockQuantity === 0}
                  onClick={() => onOpenDeliveryNoteDialog(selectedOrderGroup)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Printer className="size-4" />
                  新建出库单
                </Button>
                {isSelectedOrderDelivered &&
                  !selectedOrderGroup.inventoryClosedAt &&
                  selectedOrderStockQuantity > 0 && (
                    <Button
                      onClick={onOpenRemainderDialog}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ArrowRightLeft className="size-4" />
                      处理剩余库存
                    </Button>
                  )}
                <Button
                  disabled={isSelectedOrderDelivered}
                  onClick={() => onOpenBatchOrderAdjustDialog(selectedOrderGroup)}
                  size="sm"
                  type="button"
                >
                  批量入库
                </Button>
              </div>
            </div>

            {selectedOrderGroup.deliveryNoteIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2">
                <span className="mr-1 text-xs text-muted-foreground">出库记录</span>
                {selectedOrderGroup.deliveryNoteIds.map((deliveryNoteId) => (
                  <Button
                    key={deliveryNoteId}
                    onClick={() => onOpenDeliveryNotePrintPreview(deliveryNoteId)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    <Printer className="size-3.5" />
                    {deliveryNoteId}
                  </Button>
                ))}
              </div>
            )}

            <Table className="min-w-235 table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-5">商品名称</TableHead>
                  <TableHead className="h-10 w-29 px-4">模具编号</TableHead>
                  <TableHead className="h-10 w-26 px-5 text-right">
                    长度(mm)
                  </TableHead>
                  <TableHead className="h-10 w-27 px-5">颜色</TableHead>
                  <TableHead className="h-10 w-29 px-4 text-right">
                    下单数量（支）
                  </TableHead>
                  <TableHead className="h-10 w-29 px-4 text-right">
                    当前库存（支）
                  </TableHead>
                  <TableHead className="h-10 w-32 px-4 text-right">
                    公共库存
                  </TableHead>
                  <TableHead className="h-10 w-44 px-4 text-center">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOrderGroup.items.map((item) => (
                  <TableRow key={`${item.orderId}-${getInventoryDetailKey(item)}`}>
                    <TableCell className="truncate px-5 py-3 font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-sm">
                      {item.moldCode}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-right tabular-nums">
                      {item.lengthMm}
                    </TableCell>
                    <TableCell className="truncate px-5 py-3 text-muted-foreground">
                      {item.color || "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right tabular-nums">
                      {item.requiredQuantity}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                      {item.orderQuantity}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-muted-foreground">
                          {item.publicQuantity}
                        </span>
                        {item.publicQuantity > 0 && !isSelectedOrderDelivered && (
                          <Button
                            onClick={() => onOpenTransferDialog(item)}
                            size="xs"
                            variant="outline"
                          >
                            转入
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-center gap-1.5">
                        <Button
                          disabled={isSelectedOrderDelivered}
                          onClick={() => onOpenOrderAdjustDialog(item, "produce")}
                          size="xs"
                          variant="outline"
                        >
                          入库
                        </Button>
                        <Button
                          disabled={
                            isSelectedOrderDelivered || item.orderQuantity === 0
                          }
                          onClick={() => onOpenOrderAdjustDialog(item, "ship")}
                          size="xs"
                          variant="outline"
                        >
                          出库
                        </Button>
                        <Button
                          disabled={isSelectedOrderDelivered}
                          onClick={() => onOpenOrderAdjustDialog(item, "adjust")}
                          size="xs"
                          variant="outline"
                        >
                          调整
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3 text-sm">
              <div className="text-muted-foreground">当前订单库存统计</div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="text-muted-foreground">
                  明细
                  <span className="ml-2 font-medium text-foreground tabular-nums">
                    {selectedOrderGroup.items.length}
                  </span>
                  <span className="ml-1">项</span>
                </div>
                <div className="text-muted-foreground">
                  下单合计
                  <span className="ml-2 font-medium text-foreground tabular-nums">
                    {selectedOrderRequiredQuantity}
                  </span>
                  <span className="ml-1">支</span>
                </div>
                <div className="text-muted-foreground">
                  当前库存合计
                  <span className="ml-2 font-semibold text-foreground tabular-nums">
                    {selectedOrderStockQuantity}
                  </span>
                  <span className="ml-1">支</span>
                </div>
                <div className="text-muted-foreground">
                  待入库
                  <span
                    className={cn(
                      "ml-2 font-semibold tabular-nums",
                      selectedOrderPendingQuantity > 0
                        ? "text-amber-700"
                        : "text-foreground",
                    )}
                  >
                    {selectedOrderPendingQuantity}
                  </span>
                  <span className="ml-1">支</span>
                </div>
                <div className="text-muted-foreground">
                  公共库存可转
                  <span className="ml-2 font-medium text-foreground tabular-nums">
                    {selectedOrderPublicQuantity}
                  </span>
                  <span className="ml-1">支</span>
                </div>
              </div>
            </div>

            <div className="inventory-order-history border-t px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>当前订单流水</span>
                <span>共 {selectedOrderMovements.length} 条</span>
              </div>
              {selectedOrderMovements.length === 0 ? (
                <EmptyState
                  action={
                    !isSelectedOrderDelivered ? (
                      <Button
                        onClick={() =>
                          onOpenBatchOrderAdjustDialog(selectedOrderGroup)
                        }
                        size="sm"
                      >
                        批量入库
                      </Button>
                    ) : undefined
                  }
                  className="min-h-32 rounded-md border border-dashed py-6"
                  description="订单入库、出库、盘点或公共库存转入后，这里会显示当前订单流水。"
                  icon={<HistoryIcon className="size-4" />}
                  title="当前订单暂无流水"
                />
              ) : (
                <div className="relative overflow-hidden rounded-md border">
                  <div className="overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
                    <div className="min-w-190">
                      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                        <colgroup>
                          <col className="w-[10%]" />
                          <col className="w-[9%]" />
                          <col className="w-[27%]" />
                          <col className="w-[20%]" />
                          <col className="w-[8%]" />
                          <col className="w-[26%]" />
                        </colgroup>
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="h-9 border-b bg-muted px-3 text-left align-middle font-medium whitespace-nowrap text-foreground">
                              时间
                            </th>
                            <th className="h-9 border-b bg-muted px-3 text-left align-middle font-medium whitespace-nowrap text-foreground">
                              类型
                            </th>
                            <th className="h-9 border-b bg-muted px-3 text-left align-middle font-medium whitespace-nowrap text-foreground">
                              商品名称
                            </th>
                            <th className="h-9 border-b bg-muted px-3 text-left align-middle font-medium whitespace-nowrap text-foreground">
                              规格
                            </th>
                            <th className="h-9 border-b bg-muted px-3 pr-5 text-right align-middle font-medium whitespace-nowrap text-foreground">
                              变动
                            </th>
                            <th className="h-9 border-b bg-muted px-4 text-left align-middle font-medium whitespace-nowrap text-foreground">
                              备注
                            </th>
                          </tr>
                        </thead>
                      </table>
                      <div
                        className="inventory-movement-rows overflow-y-auto overflow-x-hidden scrollbar-none hover:scrollbar-thin [&::-webkit-scrollbar]:size-0 hover:[&::-webkit-scrollbar]:size-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
                        ref={orderMovementsScrollRef}
                      >
                        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                          <colgroup>
                            <col className="w-[10%]" />
                            <col className="w-[9%]" />
                            <col className="w-[27%]" />
                            <col className="w-[20%]" />
                            <col className="w-[8%]" />
                            <col className="w-[26%]" />
                          </colgroup>
                          <tbody>
                            {selectedOrderMovements.map((movement) => (
                              <tr
                                className="border-b transition-colors hover:bg-muted/50"
                                key={movement.id}
                              >
                                <td className="border-b px-3 py-2 align-middle whitespace-nowrap text-muted-foreground">
                                  {formatOrderMovementDateTime(
                                    movement.createdAt,
                                  )}
                                </td>
                                <td
                                  className={cn(
                                    "border-b px-3 py-2 align-middle font-medium whitespace-nowrap",
                                    movementTone[movement.movementType],
                                  )}
                                >
                                  {movementText[movement.movementType]}
                                </td>
                                <td className="truncate border-b px-3 py-2 align-middle font-medium whitespace-nowrap">
                                  {movement.productName}
                                </td>
                                <td className="truncate border-b px-3 py-2 align-middle whitespace-nowrap text-muted-foreground">
                                  {formatMovementSpec(movement)}
                                </td>
                                <td className="border-b px-3 py-2 pr-5 text-right align-middle font-medium whitespace-nowrap tabular-nums">
                                  {movement.deltaQuantity > 0 ? "+" : ""}
                                  {movement.deltaQuantity}
                                </td>
                                <td
                                  className="border-b px-4 py-2 align-middle whitespace-nowrap text-muted-foreground"
                                  title={movement.note || undefined}
                                >
                                  <span className="block max-w-[24ch] truncate">
                                    {movement.note || "-"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {orderMovementsCanScroll && !orderMovementsAtBottom && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-md bg-linear-to-b from-transparent to-card" />
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function formatOrderDate(value: string | null) {
  return formatAppDate(value, "未下单")
}

function formatOrderMovementDateTime(value: string | null) {
  return formatAppDateTime(value, { fallback: "未调整" })
}
