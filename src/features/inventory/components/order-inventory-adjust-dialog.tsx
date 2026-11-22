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
  type OrderInventoryFormErrors,
  type OrderInventoryFormValues,
} from "@/features/inventory/lib/inventory-dialog-state"

type OrderInventoryAdjustDialogProps = {
  errors: OrderInventoryFormErrors
  formValues: OrderInventoryFormValues
  isError: boolean
  isPending: boolean
  isWriting: boolean
  notePlaceholder: string
  onFormValueChange: <Key extends keyof OrderInventoryFormValues>(
    key: Key,
    value: OrderInventoryFormValues[Key],
  ) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  quantityPlaceholder: string
  submitErrorMessage?: string | null
}

export function OrderInventoryAdjustDialog({
  errors,
  formValues,
  isError,
  isPending,
  isWriting,
  notePlaceholder,
  onFormValueChange,
  onOpenChange,
  onSubmit,
  open,
  quantityPlaceholder,
  submitErrorMessage,
}: OrderInventoryAdjustDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {formValues.movementType === "produce"
                ? "订单入库"
                : formValues.movementType === "ship"
                  ? "订单出库"
                  : "订单库存调整"}
            </DialogTitle>
            <DialogDescription>
              {formValues.orderId} · {formValues.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">模具编号</span>
                <span className="font-mono">{formValues.moldCode}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">长度(mm)</span>
                <span className="tabular-nums">{formValues.lengthMm}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">颜色</span>
                <span>{formValues.color || "-"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">当前库存（支）</span>
                <span className="font-semibold tabular-nums">
                  {formValues.currentQuantity}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="order-inventory-quantity">
                {formValues.movementType === "produce"
                  ? "入库数量（支）"
                  : formValues.movementType === "ship"
                    ? "出库数量（支）"
                    : "实际库存（支）"}
              </Label>
              <Input
                aria-invalid={Boolean(errors.quantity)}
                id="order-inventory-quantity"
                inputMode="numeric"
                min={1}
                onChange={(event) =>
                  onFormValueChange("quantity", event.target.value)
                }
                placeholder={quantityPlaceholder}
                type="number"
                value={formValues.quantity}
              />
              <FieldError message={errors.quantity} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="order-inventory-note">备注</Label>
              <Input
                id="order-inventory-note"
                onChange={(event) =>
                  onFormValueChange("note", event.target.value)
                }
                placeholder={notePlaceholder}
                value={formValues.note}
              />
            </div>

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
              {isPending ? "处理中" : "确认"}
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
