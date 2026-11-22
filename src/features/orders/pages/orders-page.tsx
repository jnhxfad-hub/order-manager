import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  ArrowDownUp,
  Download,
  Eye,
  Pencil,
  PlusIcon,
  RefreshCcw,
  Trash2Icon,
  ClipboardList,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState, RetryButton } from "@/components/data-state";
import { EmptyState } from "@/components/empty-state";
import { SearchField } from "@/components/search-field";
import { SectionHeading } from "@/components/section-heading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteOrder, listOrders } from "@/features/orders/api/orders-api";
import type { Order, OrderStatus } from "@/features/orders/types";
import { createCsv } from "@/lib/csv";
import {
  formatAppDate,
  formatAppDateTime,
  formatDateInputValue,
} from "@/lib/datetime";
import { getErrorMessage } from "@/lib/errors";
import { saveCsvFile } from "@/lib/export-file";
import { formatTheoreticalWeightKg } from "@/lib/measurement";
import { formatPlainMoneyX100 } from "@/lib/money";
import { Tooltip } from "@/components/ui/tooltip";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

const statusText: Record<OrderStatus, string> = {
  editing: "编辑",
  ordered: "已下单",
  saved: "保存",
};

type StatusFilter = "all" | OrderStatus;

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: "全部", value: "all" },
  { label: "编辑", value: "editing" },
  { label: "保存", value: "saved" },
  { label: "已下单", value: "ordered" },
];

const statusClassName: Record<OrderStatus, string> = {
  editing: "border-amber-200 bg-amber-50 text-amber-700",
  ordered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  saved: "border-blue-200 bg-blue-50 text-blue-700",
};

function getOrderDisplayStatus(order: Order) {
  if (order.inventoryClosedAt) {
    switch (order.inventoryCloseDestination) {
      case "public":
        return {
          className: "border-blue-200 bg-blue-50 text-blue-700",
          label: "剩余转公共",
        };
      case "customer":
        return {
          className: "border-amber-200 bg-amber-50 text-amber-700",
          label: "剩余转客户",
        };
      case "shipped":
      default:
        return {
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
          label: "已全部出库",
        };
    }
  }

  if (order.inventoryLockedAt) {
    return {
      className: "border-cyan-200 bg-cyan-50 text-cyan-700",
      label: `部分出库 · ${order.deliveryNoteIds.length} 次`,
    };
  }

  return {
    className: statusClassName[order.status],
    label: statusText[order.status],
  };
}

function formatDate(value: string | null) {
  return formatAppDate(value, "未下单");
}

function formatDateTime(value: string) {
  return formatAppDateTime(value);
}

function formatMoneyX100(value: number) {
  return formatPlainMoneyX100(value);
}

function formatPricingTaxIncluded(value: boolean) {
  return value ? "含税" : "不含税";
}

export function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOrderToDelete(null);
    },
  });

  const orders = ordersQuery.data ?? [];
  const filteredOrders = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          order.id,
          order.customerName,
          order.customerAddress,
          order.handlerName,
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [orders, debouncedSearch, statusFilter]);
  const editingCount = orders.filter(
    (order) => order.status === "editing",
  ).length;
  const savedCount = orders.filter((order) => order.status === "saved").length;
  const orderedCount = orders.filter(
    (order) => order.status === "ordered",
  ).length;
  const statusFilterCounts: Record<StatusFilter, number> = {
    all: orders.length,
    editing: editingCount,
    ordered: orderedCount,
    saved: savedCount,
  };
  const isRefreshing = ordersQuery.isFetching;
  const hasOrderFilters = Boolean(search.trim()) || statusFilter !== "all";

  async function refreshOrders() {
    await ordersQuery.refetch();
  }

  async function exportOrders() {
    const csv = createCsv([
      [
        "订单编号",
        "客户",
        "客户地址",
        "经手人",
        "铝锭价",
        "计价是否含税",
        "状态",
        "创建时间",
        "下单日期",
        "理论重量(kg)",
      ],
      ...filteredOrders.map((order) => [
        order.id,
        order.customerName,
        order.customerAddress,
        order.handlerName,
        formatMoneyX100(order.aluminumIngotPriceX100),
        formatPricingTaxIncluded(order.pricingTaxIncluded),
        getOrderDisplayStatus(order).label,
        formatDateTime(order.createdAt),
        formatDate(order.orderedDate),
        formatTheoreticalWeightKg(order.totalTheoreticalWeightKgX100),
      ]),
    ]);

    await saveCsvFile({
      contents: csv,
      defaultPath: `订单列表_${formatDateInputValue(new Date())}.csv`,
    });
  }

  function openOrder(orderId: string) {
    navigate({
      params: { orderId },
      to: "/orders/$orderId",
    });
  }

  function handleOrderRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    orderId: string,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openOrder(orderId);
  }

  return (
    <div className="workspace-page list-page">
      <div className="workspace-list-grid grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <SectionHeading
            badge={`${orders.length} 单`}
            icon={<ClipboardList className="size-4" />}
            title="订单概览"
          />
          <div className="mt-4 space-y-3">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="text-xs text-muted-foreground">订单数量</div>
              <div className="mt-1 text-xl font-semibold">{orders.length}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">编辑中</div>
                <div className="mt-1 text-lg font-semibold text-amber-700">
                  {editingCount}
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">已保存</div>
                <div className="mt-1 text-lg font-semibold text-blue-700">
                  {savedCount}
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs text-muted-foreground">已下单</div>
                <div className="mt-1 text-lg font-semibold text-emerald-700">
                  {orderedCount}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 border-t pt-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              快速筛选
            </div>
            <div className="grid gap-1">
              {statusFilters.map((filter) => (
                <Button
                  className="justify-start"
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  size="sm"
                  variant={
                    statusFilter === filter.value ? "secondary" : "ghost"
                  }
                >
                  <span className="flex-1 text-left">{filter.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {statusFilterCounts[filter.value]}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </aside>

        <section className="workspace-card overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <SectionHeading
              badge={`${filteredOrders.length} 条`}
              title="订单列表"
            />
            <div className="flex items-center gap-2">
              <Button
                disabled={isRefreshing}
                onClick={() => void refreshOrders()}
                size="sm"
                variant="outline"
              >
                <RefreshCcw
                  className={cn("size-4", isRefreshing && "animate-spin")}
                />
                刷新
              </Button>
              <Button
                aria-label="导出订单列表"
                disabled={ordersQuery.isLoading || filteredOrders.length === 0}
                onClick={() => void exportOrders()}
                size="sm"
                variant="outline"
              >
                <Download className="size-4" />
                导出列表
              </Button>
              <Button
                className="h-8"
                onClick={() => navigate({ to: "/orders/new" })}
                size="sm"
              >
                <PlusIcon className="size-4" />
                新建订单
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
            <SearchField
              onChange={setSearch}
              placeholder="搜索订单编号、客户"
              value={search}
            />
          </div>

          {ordersQuery.isLoading ? (
            <LoadingState title="正在读取订单数据" />
          ) : ordersQuery.isError ? (
            <ErrorState
              action={
                <RetryButton
                  disabled={ordersQuery.isFetching}
                  onClick={() => void refreshOrders()}
                />
              }
              description={getErrorMessage(ordersQuery.error)}
              title="读取订单失败"
            />
          ) : (
            <Table className="min-w-0 table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-35.5 py-2 pr-2.5 pl-4">
                    <div className="flex items-center gap-1">
                      订单编号
                      <ArrowDownUp className="size-3 text-muted-foreground" />
                    </div>
                  </TableHead>
                  <TableHead className="w-26 px-2.5">客户</TableHead>
                  <TableHead className="w-26 px-2.5">客户地址</TableHead>
                  <TableHead className="w-14 py-2 pr-2 pl-2">经手人</TableHead>
                  <TableHead className="w-23.5 py-2 pr-2.5 pl-1.5 text-right">
                    铝锭价
                  </TableHead>
                  <TableHead className="w-18.5 py-2 pr-2.5 pl-3.5">
                    计价
                  </TableHead>
                  <TableHead className="w-25 px-2.5">状态</TableHead>
                  <TableHead className="w-23 px-2.5">创建时间</TableHead>
                  <TableHead className="w-24 py-2 pr-2.5 pl-3.5 text-right">
                    下单日期
                  </TableHead>
                  <TableHead className="w-21 px-2.5 text-right">
                    理论重量
                  </TableHead>
                  <TableHead className="sticky right-0 z-10 w-17 bg-card py-2 pr-4 pl-2.5 text-center shadow-[-1px_0_0_0_var(--color-border)]">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="p-0" colSpan={11}>
                      <EmptyState
                        action={
                          orders.length === 0 ? (
                            <Button
                              onClick={() => navigate({ to: "/orders/new" })}
                              size="sm"
                            >
                              <PlusIcon className="size-4" />
                              新建订单
                            </Button>
                          ) : hasOrderFilters ? (
                            <Button
                              onClick={() => {
                                setSearch("");
                                setStatusFilter("all");
                              }}
                              size="sm"
                              variant="outline"
                            >
                              清空筛选
                            </Button>
                          ) : null
                        }
                        description={
                          orders.length === 0
                            ? "新建订单后，这里会显示客户、状态、下单日期和理论重量。"
                            : "调整搜索关键字或状态筛选后再试。"
                        }
                        icon={<ClipboardList className="size-4" />}
                        title={
                          orders.length === 0
                            ? "还没有订单"
                            : "没有符合条件的订单"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const displayStatus = getOrderDisplayStatus(order);

                    return (
                      <TableRow
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      key={order.id}
                      onClick={() => openOrder(order.id)}
                      onKeyDown={(event) =>
                        handleOrderRowKeyDown(event, order.id)
                      }
                      role="button"
                      tabIndex={0}
                    >
                      <TableCell
                        className="truncate py-3 pr-2.5 pl-4 font-mono text-sm font-medium"
                        title={order.id}
                      >
                        {order.id}
                      </TableCell>
                      <TableCell
                        className="truncate px-2.5 py-3 font-medium"
                        title={order.customerName}
                      >
                        {order.customerName}
                      </TableCell>
                      <TableCell
                        className="truncate px-2.5 py-3 text-muted-foreground"
                        title={order.customerAddress}
                      >
                        {order.customerAddress}
                      </TableCell>
                      <TableCell
                        className="truncate py-3 pr-2 pl-2 text-muted-foreground"
                        title={order.handlerName}
                      >
                        {order.handlerName}
                      </TableCell>
                      <TableCell className="py-3 pr-2.5 pl-1.5 text-right text-muted-foreground tabular-nums">
                        {formatMoneyX100(order.aluminumIngotPriceX100)}
                      </TableCell>
                      <TableCell className="py-3 pr-2.5 pl-3.5 text-muted-foreground">
                        {formatPricingTaxIncluded(order.pricingTaxIncluded)}
                      </TableCell>
                      <TableCell className="px-2.5 py-3">
                        <Badge
                          className={cn(
                            "whitespace-nowrap px-1.5 font-medium",
                            displayStatus.className,
                          )}
                          variant="outline"
                        >
                          {displayStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-2.5 py-3 text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </TableCell>
                      <TableCell className="py-3 pr-2.5 pl-3.5 text-right text-muted-foreground">
                        {formatDate(order.orderedDate)}
                      </TableCell>
                      <TableCell className="px-2.5 py-3 text-right font-medium tabular-nums">
                        {formatTheoreticalWeightKg(
                          order.totalTheoreticalWeightKgX100,
                        )}{" "}
                        <span className="text-muted-foreground">kg</span>
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-card py-3 pr-4 pl-2.5 shadow-[-1px_0_0_0_var(--color-border)]">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip
                            align="end"
                            content={
                              order.status === "ordered"
                                ? "查看订单"
                                : "编辑订单"
                            }
                            side="top"
                          >
                            <Button
                              aria-label={
                                order.status === "ordered"
                                  ? "查看订单"
                                  : "编辑订单"
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                openOrder(order.id);
                              }}
                              size="icon-xs"
                              variant="ghost"
                            >
                              {order.status === "ordered" ? (
                                <Eye className="size-4" />
                              ) : (
                                <Pencil className="size-4" />
                              )}
                            </Button>
                          </Tooltip>
                          {order.status !== "ordered" && (
                            <Tooltip align="end" content="删除订单" side="top">
                              <Button
                                aria-label="删除订单"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  deleteOrderMutation.reset();
                                  setOrderToDelete(order);
                                }}
                                size="icon-xs"
                                variant="ghost-destructive"
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setOrderToDelete(null);
            deleteOrderMutation.reset();
          }
        }}
        open={Boolean(orderToDelete)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除订单</DialogTitle>
            <DialogDescription>
              只能删除编辑中或已保存但未下单的订单；删除后订单明细会一起移除且无法恢复。已下单订单会作为库存和出库凭据保留，不能删除。
            </DialogDescription>
          </DialogHeader>

          {orderToDelete && (
            <div className="space-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-mono font-medium">{orderToDelete.id}</div>
              <div className="text-muted-foreground">
                {orderToDelete.customerName} /{" "}
                {statusText[orderToDelete.status]}
              </div>
            </div>
          )}

          {deleteOrderMutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(deleteOrderMutation.error)}
            </div>
          )}

          <DialogFooter>
            <Button
              disabled={deleteOrderMutation.isPending}
              onClick={() => setOrderToDelete(null)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={deleteOrderMutation.isPending || !orderToDelete}
              onClick={() => {
                if (orderToDelete) {
                  deleteOrderMutation.mutate(orderToDelete.id);
                }
              }}
              type="button"
              variant="destructive"
            >
              {deleteOrderMutation.isPending ? "删除中" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
