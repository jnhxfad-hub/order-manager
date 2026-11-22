import type { FormEvent } from "react"

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
  type CustomerInventoryAdjustFormErrors,
  type CustomerInventoryAdjustFormValues,
} from "@/features/inventory/lib/inventory-dialog-state"

type CustomerInventoryAdjustDialogProps = {
  errors: CustomerInventoryAdjustFormErrors
  formValues: CustomerInventoryAdjustFormValues
  isError: boolean
  isPending: boolean
  isWriting: boolean
  onFormValueChange: <Key extends keyof CustomerInventoryAdjustFormValues>(
    key: Key,
    value: CustomerInventoryAdjustFormValues[Key],
  ) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  submitErrorMessage?: string | null
}

export function CustomerInventoryAdjustDialog({
  errors,
  formValues,
  isError,
  isPending,
  isWriting,
  onFormValueChange,
  onOpenChange,
  onSubmit,
  open,
  submitErrorMessage,
}: CustomerInventoryAdjustDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>客户库存盘点</DialogTitle>
            <DialogDescription>
              只调整当前剩余库存，已生成的出库单不会被改动。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">批次</span>
                <span className="font-mono font-medium">
                  {formValues.batchId || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">模具编号</span>
                <span className="font-mono font-medium">
                  {formValues.moldCode || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">长度(mm)</span>
                <span className="tabular-nums">
                  {formValues.lengthMm || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">颜色</span>
                <span>{formValues.color || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-muted-foreground">
                  商品名称
                </span>
                <span className="text-right font-medium whitespace-nowrap">
                  {formValues.productName || "-"}
                </span>
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              当前剩余：
              <span className="font-semibold text-foreground">
                {formValues.currentQuantity}
              </span>
              <span className="ml-1">支</span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-inventory-adjust-quantity">
                实际库存（支）
              </Label>
              <Input
                aria-invalid={Boolean(errors.quantity)}
                id="customer-inventory-adjust-quantity"
                inputMode="numeric"
                min={0}
                onChange={(event) => {
                  onFormValueChange("quantity", event.target.value)
                }}
                placeholder="例如：20"
                type="number"
                value={formValues.quantity}
              />
              <FieldError message={errors.quantity} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-inventory-adjust-note">备注</Label>
              <Input
                id="customer-inventory-adjust-note"
                onChange={(event) =>
                  onFormValueChange("note", event.target.value)
                }
                placeholder="例如：盘点修正、损耗确认"
                value={formValues.note}
              />
            </div>

            {errors.form && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.form}
              </div>
            )}
            {isError && submitErrorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitErrorMessage}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={isWriting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button disabled={isWriting} type="submit">
              {isPending ? "盘点中" : "确认盘点"}
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

  return <div className="text-xs text-destructive">{message}</div>
}
