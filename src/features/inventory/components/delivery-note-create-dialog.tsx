import { formatCurrencyX100, parseMoneyToX100 } from "@/lib/money"
import type { KeyboardEvent } from "react"

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
import {
  type DeliveryNoteFormErrors,
  type DeliveryNoteFormValues,
} from "@/features/inventory/lib/inventory-dialog-state"
import {
  getInventoryDetailKey,
  type DeliveryNoteFocusTarget,
  type DeliveryNoteFormRow,
  type DeliveryNoteWeightKey,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils"
import {
  getProcessingCategoryLabel,
  type ProcessingCategory,
} from "@/lib/processing-fees"

type DeliveryNoteWeightField = {
  category: ProcessingCategory
  key: DeliveryNoteWeightKey
  placeholder: string
}

type RequiredDeliveryWeights = Record<ProcessingCategory, boolean>

export function DeliveryNoteCreateDialog({
  createErrorMessage,
  errors,
  formValues,
  isCreateError,
  isPending,
  isWriting,
  onClearQuantities,
  onFillAllQuantities,
  onFormValueChange,
  onOpenChange,
  onRowChange,
  onSubmit,
  onWeightFocus,
  onWeightKeyDown,
  open,
  requiredWeights,
  rows,
  selectedOrderGroup,
  totalQuantity,
  transferQuantity,
  visibleWeightFields,
}: {
  createErrorMessage?: string | null
  errors: DeliveryNoteFormErrors
  formValues: DeliveryNoteFormValues
  isCreateError: boolean
  isPending: boolean
  isWriting: boolean
  onClearQuantities: () => void
  onFillAllQuantities: () => void
  onFormValueChange: <Key extends keyof DeliveryNoteFormValues>(
    key: Key,
    value: DeliveryNoteFormValues[Key],
  ) => void
  onOpenChange: (open: boolean) => void
  onRowChange: (
    detailKey: string,
    values: Partial<Pick<DeliveryNoteFormRow, "note" | "quantity">>,
  ) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onWeightFocus: (key: DeliveryNoteWeightKey) => void
  onWeightKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    target: DeliveryNoteFocusTarget,
  ) => void
  open: boolean
  requiredWeights: RequiredDeliveryWeights
  rows: DeliveryNoteFormRow[]
  selectedOrderGroup: OrderInventoryGroup | null
  totalQuantity: number
  transferQuantity: number
  visibleWeightFields: DeliveryNoteWeightField[]
}) {
  const canClearQuantities = rows.some((row) => row.quantity.trim())

  const charges = formValues.extraCharges
  const updateCharges = (next: typeof charges) =>
    onFormValueChange("extraCharges", next)
  const updateCharge = (index: number, values: Partial<(typeof charges)[number]>) =>
    updateCharges(charges.map((row, i) => i === index ? { ...row, ...values } : row))
  const totalCharges = charges.reduce(
    (total, row) => total + (parseMoneyToX100(row.amount) ?? 0),
    0,
  )

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-6xl">
        <form
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          onSubmit={onSubmit}
        >
          <DialogHeader>
            <DialogTitle>新建出库单</DialogTitle>
            <DialogDescription>
              {selectedOrderGroup?.orderId ?? ""} ·{" "}
              {selectedOrderGroup?.customerName ?? ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-auto px-1 py-4">
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-4">
              <div className="text-sm">
                <div className="text-xs text-muted-foreground">客户名称</div>
                <div className="mt-1 font-medium">
                  {selectedOrderGroup?.customerName ?? "-"}
                </div>
              </div>
              <div className="text-sm">
                <div className="text-xs text-muted-foreground">经手人</div>
                <div className="mt-1 font-medium">
                  {selectedOrderGroup?.handlerName || "-"}
                </div>
              </div>
              <div className="text-sm md:col-span-2">
                <div className="text-xs text-muted-foreground">客户地址</div>
                <div className="mt-1 truncate font-medium">
                  {selectedOrderGroup?.customerAddress || "-"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="delivery-pricing-tax-included">计价方式</Label>
                <Select
                  onValueChange={(value) =>
                    onFormValueChange("pricingTaxIncluded", value !== "excluded")
                  }
                  value={formValues.pricingTaxIncluded ? "included" : "excluded"}
                >
                  <SelectTrigger
                    className="w-full min-w-0"
                    id="delivery-pricing-tax-included"
                  >
                    <SelectValue>
                      {() =>
                        formValues.pricingTaxIncluded ? "含税" : "不含税"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="included">含税</SelectItem>
                    <SelectItem value="excluded">不含税</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {visibleWeightFields.map((field, index) => {
                const nextField = visibleWeightFields[index + 1]
                const nextTarget: DeliveryNoteFocusTarget = nextField
                  ? { kind: "field", field: nextField.key }
                  : rows[0]
                    ? {
                        kind: "row",
                        detailKey: getInventoryDetailKey(rows[0]),
                        field: "quantity",
                      }
                    : { kind: "field", field: "note" }

                return (
                  <div className="grid gap-2" key={field.key}>
                    <Label htmlFor={`delivery-${field.category}-weight`}>
                      {getProcessingCategoryLabel(field.category)}重量(kg)
                      {requiredWeights[field.category] && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Input
                      aria-invalid={Boolean(errors[field.key])}
                      data-delivery-note-field={field.key}
                      id={`delivery-${field.category}-weight`}
                      inputMode="decimal"
                      min={0}
                      onChange={(event) =>
                        onFormValueChange(field.key, event.target.value)
                      }
                      onFocus={() => onWeightFocus(field.key)}
                      onKeyDown={(event) => onWeightKeyDown(event, nextTarget)}
                      placeholder={errors[field.key] ?? field.placeholder}
                      step="0.01"
                      type="number"
                      value={formValues[field.key]}
                    />
                  </div>
                )
              })}
            </div>

            <div className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">其他费用（选填）</span>
                <Button
                  disabled={isWriting}
                  onClick={() => updateCharges([...charges, { name: "", amount: "" }])}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  ＋ 添加费用
                </Button>
              </div>
              {charges.map((row, index) => {
                const nameError = errors[`extraChargeName-${index}`]
                const amountError = errors[`extraChargeAmount-${index}`]

                return (
                  <div
                    className="grid grid-cols-[1fr_1fr_auto] items-start gap-3"
                    key={index}
                  >
                    <div className="grid gap-2">
                      <Label htmlFor={`delivery-charge-name-${index}`}>收费名称</Label>
                      <Input
                        aria-invalid={Boolean(nameError)}
                        data-delivery-note-field={`extraChargeName-${index}`}
                        disabled={isWriting}
                        id={`delivery-charge-name-${index}`}
                        onChange={(event) => updateCharge(index, { name: event.target.value })}
                        placeholder="例如：运费、装车费"
                        value={row.name}
                      />
                      <FieldError message={nameError} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`delivery-charge-amount-${index}`}>收费金额</Label>
                      <Input
                        aria-invalid={Boolean(amountError)}
                        data-delivery-note-field={`extraChargeAmount-${index}`}
                        disabled={isWriting}
                        id={`delivery-charge-amount-${index}`}
                        inputMode="decimal"
                        min={0}
                        onChange={(event) => updateCharge(index, { amount: event.target.value })}
                        placeholder="例如：200"
                        step="0.01"
                        type="number"
                        value={row.amount}
                      />
                      <FieldError message={amountError} />
                    </div>
                    <Button
                      aria-label={`删除第 ${index + 1} 条费用`}
                      className="mt-6"
                      disabled={isWriting}
                      onClick={() => updateCharges(charges.filter((_, i) => i !== index))}
                      type="button"
                      variant="ghost"
                    >
                      删除
                    </Button>
                  </div>
                )
              })}
              <div className="text-right text-sm font-medium">
                其他费用合计：{formatCurrencyX100(totalCharges)}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-background px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">本次出库数量</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {totalQuantity}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    支
                  </span>
                </div>
              </div>
              <div className="rounded-md border bg-background px-3 py-2 text-sm">
                <div className="text-xs text-muted-foreground">
                  出库后订单剩余
                </div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {transferQuantity}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    支
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
              首次出库后订单库存将锁定入库和调整；未出数量继续保留，可再次分批出库，或手动转入公共库存/客户库存。
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">出库明细</div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={isWriting || !canClearQuantities}
                  onClick={onClearQuantities}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  清空
                </Button>
                <Button
                  disabled={isWriting || rows.length === 0}
                  onClick={onFillAllQuantities}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  全部出库
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-245 table-fixed">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 w-55 px-4">商品名称</TableHead>
                    <TableHead className="h-10 w-29 px-4">模具编号</TableHead>
                    <TableHead className="h-10 w-26 px-5 text-right">
                      长度(mm)
                    </TableHead>
                    <TableHead className="h-10 w-27 px-5">颜色</TableHead>
                    <TableHead className="h-10 w-28 px-4 text-right">
                      下单数量（支）
                    </TableHead>
                    <TableHead className="h-10 w-28 px-4 text-right">
                      当前库存（支）
                    </TableHead>
                    <TableHead className="h-10 w-35 px-4">
                      出库数量（支）
                    </TableHead>
                    <TableHead className="h-10 w-42.5 px-4">备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const detailKey = getInventoryDetailKey(row)

                    return (
                      <TableRow key={detailKey}>
                        <TableCell className="truncate px-4 py-3 font-medium">
                          {row.productName}
                        </TableCell>
                        <TableCell className="px-4 py-3 font-mono text-sm">
                          {row.moldCode}
                        </TableCell>
                        <TableCell className="px-5 py-3 text-right tabular-nums">
                          {row.lengthMm}
                        </TableCell>
                        <TableCell className="truncate px-5 py-3 text-muted-foreground">
                          {row.color || "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right tabular-nums">
                          {row.requiredQuantity}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                          {row.currentQuantity}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            aria-invalid={Boolean(errors[detailKey])}
                            className="h-8"
                            data-delivery-note-detail={detailKey}
                            data-delivery-note-field="quantity"
                            inputMode="numeric"
                            max={row.currentQuantity}
                            min={0}
                            onChange={(event) =>
                              onRowChange(detailKey, {
                                quantity: event.target.value,
                              })
                            }
                            placeholder={`例如：${row.currentQuantity}`}
                            type="number"
                            value={row.quantity}
                          />
                          <FieldError message={errors[detailKey]} />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            className="h-8"
                            data-delivery-note-detail={detailKey}
                            data-delivery-note-field="note"
                            onChange={(event) =>
                              onRowChange(detailKey, {
                                note: event.target.value,
                              })
                            }
                            placeholder="例如：本次发货"
                            value={row.note}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="delivery-note-note">出库单备注</Label>
              <Input
                data-delivery-note-field="note"
                id="delivery-note-note"
                onChange={(event) =>
                  onFormValueChange("note", event.target.value)
                }
                placeholder="例如：客户自提、物流发货"
                value={formValues.note}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="delivery-note-special-note">特殊提示</Label>
              <Input
                id="delivery-note-special-note"
                onChange={(event) =>
                  onFormValueChange("specialNote", event.target.value)
                }
                placeholder="仅特殊订单填写，打印时醒目显示在备注下方"
                value={formValues.specialNote}
              />
            </div>

            {rows.length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                当前订单没有可出库库存。
              </div>
            )}

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
          </div>

          <DialogFooter className="shrink-0">
            <Button
              disabled={isWriting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button disabled={isWriting || rows.length === 0} type="submit">
              {isPending ? "出库中" : "确认出库并预览"}
            </Button>
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

  return <div className="mt-1 text-xs text-destructive">{message}</div>
}
