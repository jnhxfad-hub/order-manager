import type { FormEvent, KeyboardEvent } from "react"
import { ClipboardList, PlusIcon, Trash2Icon } from "lucide-react"

import { SectionHeading } from "@/components/section-heading"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip } from "@/components/ui/tooltip"
import type { Customer } from "@/features/customers/types"
import {
  getCustomerInventoryBatchRowWeightX100,
  type CustomerInventoryBatchRow,
} from "@/features/inventory/lib/inventory-utils"
import {
  type CustomerInventoryBatchErrors,
  type CustomerInventoryBatchFormValues,
  type CustomerInventoryDetailInputField,
  type CustomerInventoryProcessingFeeField,
} from "@/features/inventory/lib/inventory-dialog-state"
import type {
  CustomerInventoryBatch,
  CustomerInventoryStockItem,
} from "@/features/inventory/types"
import type { Product } from "@/features/products/types"
import {
  formatTheoreticalWeightKg,
  formatThicknessMm,
  formatWeightPerMeterKg,
} from "@/lib/measurement"
import {
  getProcessingCategoryLabel,
  type ProcessingCategory,
} from "@/lib/processing-fees"
import { cn } from "@/lib/utils"

type CustomerInventoryProcessingFeeFieldView = {
  category: ProcessingCategory
} & CustomerInventoryProcessingFeeField

type CustomerInventoryCategoryQuantityItem = {
  label: string
  value: number
}

type CustomerInventoryBatchDialogProps = {
  categoryQuantityItems: CustomerInventoryCategoryQuantityItem[]
  createErrorMessage?: string | null
  customers: Customer[]
  dialogTitle: string
  editingBatch: CustomerInventoryBatch | null
  errors: CustomerInventoryBatchErrors
  formValues: CustomerInventoryBatchFormValues
  isCreateError: boolean
  isCreatePending: boolean
  isReadOnly: boolean
  isUpdateError: boolean
  isUpdatePending: boolean
  isWriting: boolean
  matchedSpecialPricingKeyword: string
  onAddRow: () => void
  onAdjustStock: (
    batch: CustomerInventoryBatch,
    item: CustomerInventoryStockItem,
  ) => void
  onCustomerChange: (customerId: string) => void
  onFormValueChange: <Key extends keyof CustomerInventoryBatchFormValues>(
    key: Key,
    value: CustomerInventoryBatchFormValues[Key],
  ) => void
  onHistoricalOrderDateFocus: () => void
  onNoteChange: (note: string) => void
  onOpenChange: (open: boolean) => void
  onPricingTaxIncludedChange: (pricingTaxIncluded: boolean) => void
  onRemoveRow: (rowIndex: number) => void
  onRowFieldChange: (
    rowIndex: number,
    field: CustomerInventoryDetailInputField,
    value: string,
  ) => void
  onRowKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: CustomerInventoryDetailInputField,
  ) => void
  onRowProductChange: (rowIndex: number, productId: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  productPlaceholder: string
  products: Product[]
  rows: CustomerInventoryBatchRow[]
  shouldBlockProductSelect: boolean
  totalQuantity: number
  totalTheoreticalWeightKgX100: number
  updateErrorMessage?: string | null
  visibleProcessingFeeFields: readonly CustomerInventoryProcessingFeeFieldView[]
}

export function CustomerInventoryBatchDialog({
  categoryQuantityItems,
  createErrorMessage,
  dialogTitle,
  editingBatch,
  errors,
  formValues,
  isCreateError,
  isCreatePending,
  isReadOnly,
  isUpdateError,
  isUpdatePending,
  isWriting,
  matchedSpecialPricingKeyword,
  onAddRow,
  onAdjustStock,
  onCustomerChange,
  onFormValueChange,
  onHistoricalOrderDateFocus,
  onNoteChange,
  onOpenChange,
  onPricingTaxIncludedChange,
  onRemoveRow,
  onRowFieldChange,
  onRowKeyDown,
  onRowProductChange,
  onSubmit,
  open,
  productPlaceholder,
  products,
  rows,
  shouldBlockProductSelect,
  totalQuantity,
  totalTheoreticalWeightKgX100,
  updateErrorMessage,
  visibleProcessingFeeFields,
  customers,
}: CustomerInventoryBatchDialogProps) {
  function getProductLabel(productId: string) {
    return products.find((product) => product.id === productId)?.productName ?? ""
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] w-[calc(100vw-18.5rem)] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[calc(100vw-18.5rem)]!">
        <form className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
          <DialogHeader className="shrink-0 border-b px-4 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle>{dialogTitle}</DialogTitle>
              {matchedSpecialPricingKeyword && (
                <Badge
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  variant="outline"
                >
                  已匹配特殊计价：{matchedSpecialPricingKeyword}
                </Badge>
              )}
            </div>
            <DialogDescription>
              录入系统使用前已经属于客户、但尚未发货的库存批次。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-4 py-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>客户</Label>
                <Select
                  disabled={isReadOnly}
                  onValueChange={(value) => onCustomerChange(value ?? "")}
                  value={formValues.customerId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {() =>
                        customers.find(
                          (customer) => customer.id === formValues.customerId,
                        )?.customerName || "选择客户"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.customerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.customerId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-inventory-date">历史下单日期</Label>
                <Input
                  aria-invalid={Boolean(errors.historicalOrderDate)}
                  data-testid="customer-inventory-historical-order-date"
                  disabled={isReadOnly}
                  id="customer-inventory-date"
                  onChange={(event) => {
                    onFormValueChange("historicalOrderDate", event.target.value)
                  }}
                  onFocus={onHistoricalOrderDateFocus}
                  type="date"
                  value={formValues.historicalOrderDate}
                />
                <FieldError message={errors.historicalOrderDate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-inventory-ref">历史单号</Label>
                <Input
                  disabled={isReadOnly}
                  id="customer-inventory-ref"
                  onChange={(event) =>
                    onFormValueChange("historicalOrderRef", event.target.value)
                  }
                  value={formValues.historicalOrderRef}
                />
              </div>
              <div className="space-y-2">
                <Label>计价方式</Label>
                <Select
                  disabled={isReadOnly}
                  onValueChange={(value) =>
                    onPricingTaxIncludedChange(value !== "excluded")
                  }
                  value={formValues.pricingTaxIncluded ? "included" : "excluded"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {() => (formValues.pricingTaxIncluded ? "含税" : "不含税")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="included">含税</SelectItem>
                    <SelectItem value="excluded">不含税</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-6">
              <div className="space-y-2">
                <Label>
                  铝锭价 <span className="text-destructive">*</span>
                </Label>
                <Input
                  disabled={isReadOnly}
                  inputMode="decimal"
                  onChange={(event) => {
                    onFormValueChange("aluminumIngotPrice", event.target.value)
                  }}
                  placeholder="0.00"
                  value={formValues.aluminumIngotPrice}
                />
                <FieldError message={errors.aluminumIngotPrice} />
              </div>
              {visibleProcessingFeeFields.map((field) => (
                <div className="space-y-2" key={field.formKey}>
                  <Label>
                    {getProcessingCategoryLabel(field.category)}加工费{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    disabled={isReadOnly}
                    inputMode="decimal"
                    onChange={(event) => {
                      onFormValueChange(field.formKey, event.target.value)
                    }}
                    placeholder="0.00"
                    value={formValues[field.formKey]}
                  />
                  <FieldError message={errors[field.formKey]} />
                </div>
              ))}
            </div>

            <section className="flex max-h-[34rem] min-h-72 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
                <SectionHeading
                  badge={`${rows.length} 条`}
                  description={`合计 ${formatTheoreticalWeightKg(
                    totalTheoreticalWeightKgX100,
                  )} kg`}
                  title="商品明细"
                />
                <Button
                  disabled={isReadOnly}
                  onClick={onAddRow}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <PlusIcon className="size-4" />
                  添加商品
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <Table className="min-w-260 table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-muted/40 shadow-[0_1px_0_var(--border)]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-52.5 px-3">商品</TableHead>
                      <TableHead className="w-23 px-3">模具编号</TableHead>
                      <TableHead className="w-19 px-3 text-right">
                        厚度(mm)
                      </TableHead>
                      <TableHead className="w-22 px-3 text-right">
                        米重(kg/m)
                      </TableHead>
                      <TableHead className="w-26 px-3">
                        长度(mm)
                        <span className="ml-0.5 text-destructive">*</span>
                      </TableHead>
                      <TableHead className="w-26 px-3">
                        颜色<span className="ml-0.5 text-destructive">*</span>
                      </TableHead>
                      <TableHead className="w-22 px-3">
                        数量(支)
                        <span className="ml-0.5 text-destructive">*</span>
                      </TableHead>
                      <TableHead className="w-26 px-3 pr-6 text-right">
                        理论重量
                      </TableHead>
                      <TableHead className="w-29.5 px-3">备注</TableHead>
                      <TableHead className="w-20 px-3 text-center">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => {
                      const rowKey = `row-${index}`
                      const stockItem = editingBatch?.items[index] ?? null
                      const canAdjustStock =
                        isReadOnly &&
                        editingBatch !== null &&
                        stockItem !== null &&
                        stockItem.quantity > 0
                      const canDeleteRow = !isReadOnly && rows.length > 1

                      return (
                        <TableRow key={rowKey}>
                          <TableCell className="px-3 py-3">
                            <Select
                              disabled={shouldBlockProductSelect || isReadOnly}
                              onValueChange={(value) =>
                                onRowProductChange(index, value ?? "")
                              }
                              value={row.productId}
                            >
                              <SelectTrigger
                                className="w-full"
                                data-customer-inventory-field="product"
                                data-customer-inventory-row={index}
                              >
                                <SelectValue
                                  className={cn(
                                    shouldBlockProductSelect &&
                                      "text-destructive",
                                  )}
                                >
                                  {() =>
                                    !shouldBlockProductSelect
                                      ? getProductLabel(row.productId) ||
                                        productPlaceholder
                                      : productPlaceholder
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.productName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FieldError
                              message={errors[`${rowKey}-productId`]}
                            />
                          </TableCell>
                          <TableCell className="truncate px-3 py-3 text-muted-foreground">
                            {row.moldCode || "-"}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                            {row.thicknessMmX100
                              ? formatThicknessMm(row.thicknessMmX100)
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                            {row.weightPerMeterKgX1000
                              ? formatWeightPerMeterKg(row.weightPerMeterKgX1000)
                              : "-"}
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Input
                              disabled={isReadOnly}
                              className="w-full tabular-nums"
                              data-customer-inventory-field="lengthMm"
                              data-customer-inventory-row={index}
                              inputMode="numeric"
                              onKeyDown={(event) =>
                                onRowKeyDown(event, index, "lengthMm")
                              }
                              onChange={(event) =>
                                onRowFieldChange(
                                  index,
                                  "lengthMm",
                                  event.target.value,
                                )
                              }
                              value={row.lengthMm}
                            />
                            <FieldError message={errors[`${rowKey}-lengthMm`]} />
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Input
                              disabled={isReadOnly}
                              className="w-full"
                              data-customer-inventory-field="color"
                              data-customer-inventory-row={index}
                              onKeyDown={(event) =>
                                onRowKeyDown(event, index, "color")
                              }
                              onChange={(event) =>
                                onRowFieldChange(
                                  index,
                                  "color",
                                  event.target.value,
                                )
                              }
                              value={row.color}
                            />
                            <FieldError message={errors[`${rowKey}-color`]} />
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Input
                              disabled={isReadOnly}
                              className="w-full tabular-nums"
                              data-customer-inventory-field="quantity"
                              data-customer-inventory-row={index}
                              inputMode="numeric"
                              onKeyDown={(event) =>
                                onRowKeyDown(event, index, "quantity")
                              }
                              onChange={(event) =>
                                onRowFieldChange(
                                  index,
                                  "quantity",
                                  event.target.value,
                                )
                              }
                              value={row.quantity}
                            />
                            <FieldError message={errors[`${rowKey}-quantity`]} />
                          </TableCell>
                          <TableCell className="px-3 py-3 pr-6 text-right font-medium tabular-nums">
                            {formatTheoreticalWeightKg(
                              getCustomerInventoryBatchRowWeightX100(row),
                            )}{" "}
                            kg
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Input
                              disabled={isReadOnly}
                              data-customer-inventory-field="note"
                              data-customer-inventory-row={index}
                              onKeyDown={(event) =>
                                onRowKeyDown(event, index, "note")
                              }
                              onChange={(event) =>
                                onRowFieldChange(
                                  index,
                                  "note",
                                  event.target.value,
                                )
                              }
                              value={row.note}
                            />
                          </TableCell>
                          <TableCell className="px-3 py-3 text-center">
                            {canAdjustStock && editingBatch && stockItem && (
                              <Tooltip content="盘点剩余库存" side="top">
                                <Button
                                  aria-label="盘点剩余库存"
                                  onClick={() =>
                                    onAdjustStock(editingBatch, stockItem)
                                  }
                                  size="icon-sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <ClipboardList className="size-4" />
                                </Button>
                              </Tooltip>
                            )}
                            {canDeleteRow && (
                              <Button
                                aria-label="删除明细"
                                onClick={() => onRemoveRow(index)}
                                size="icon-sm"
                                type="button"
                                variant="ghost-destructive"
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3 text-sm">
                <div className="text-muted-foreground">
                  带 <span className="font-medium text-destructive">*</span>{" "}
                  为必填
                </div>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                  <div className="text-muted-foreground">
                    商品数量
                    <span className="ml-2 font-medium text-foreground tabular-nums">
                      {rows.length}
                    </span>
                  </div>
                  {categoryQuantityItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                      {categoryQuantityItems.map((item) => (
                        <span key={item.label}>
                          {item.label}
                          <span className="ml-1 font-medium text-foreground tabular-nums">
                            {item.value}
                          </span>
                          <span className="ml-0.5">支</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    数量合计
                    <span className="ml-2 font-medium text-foreground tabular-nums">
                      {totalQuantity}
                    </span>
                    <span className="ml-1">支</span>
                  </div>
                  <div className="text-muted-foreground">
                    理论重量合计
                    <span className="ml-2 font-semibold text-foreground tabular-nums">
                      {formatTheoreticalWeightKg(totalTheoreticalWeightKgX100)}
                    </span>
                    <span className="ml-1">kg</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-2">
              <Label htmlFor="customer-inventory-note">批次备注</Label>
              <Input
                disabled={isReadOnly}
                id="customer-inventory-note"
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="批次备注"
                value={formValues.note}
              />
            </div>

            {errors.form && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.form}
              </div>
            )}
            {isCreateError && createErrorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createErrorMessage}
              </div>
            )}
            {isUpdateError && updateErrorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {updateErrorMessage}
              </div>
            )}
          </div>

          <DialogFooter className="m-0 rounded-none">
            <Button
              disabled={isWriting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            {!isReadOnly && (
              <Button disabled={isWriting} type="submit">
                {isCreatePending || isUpdatePending
                  ? "保存中"
                  : editingBatch
                    ? "保存修改"
                    : "保存客户库存"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <div className="text-xs text-destructive">{message}</div>
}
