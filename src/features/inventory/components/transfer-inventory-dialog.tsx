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
  type TransferInventoryFormErrors,
  type TransferInventoryFormValues,
} from "@/features/inventory/lib/inventory-dialog-state"

type TransferInventoryDialogProps = {
  errors: TransferInventoryFormErrors
  formValues: TransferInventoryFormValues
  isError: boolean
  isPending: boolean
  isWriting: boolean
  onFormValueChange: <Key extends keyof TransferInventoryFormValues>(
    key: Key,
    value: TransferInventoryFormValues[Key],
  ) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  remainingQuantity: number
  submitErrorMessage?: string | null
  suggestedQuantity: number
}

export function TransferInventoryDialog({
  errors,
  formValues,
  isError,
  isPending,
  isWriting,
  onFormValueChange,
  onOpenChange,
  onSubmit,
  open,
  remainingQuantity,
  submitErrorMessage,
  suggestedQuantity,
}: TransferInventoryDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>从公共库存转入</DialogTitle>
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
              <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-background px-2 py-1">
                  <div className="text-xs text-muted-foreground">公共库存</div>
                  <div className="font-semibold tabular-nums">
                    {formValues.publicQuantity}
                  </div>
                </div>
                <div className="rounded-md bg-background px-2 py-1">
                  <div className="text-xs text-muted-foreground">当前库存</div>
                  <div className="font-semibold tabular-nums">
                    {formValues.currentQuantity}
                  </div>
                </div>
                <div className="rounded-md bg-background px-2 py-1">
                  <div className="text-xs text-muted-foreground">建议转入</div>
                  <div className="font-semibold tabular-nums">
                    {suggestedQuantity}
                  </div>
                </div>
              </div>
            </div>

            {remainingQuantity === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                当前库存已达到或超过下单数量，通常无需再转入。
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="transfer-inventory-quantity">
                转入数量（支）
              </Label>
              <Input
                aria-invalid={Boolean(errors.quantity)}
                id="transfer-inventory-quantity"
                inputMode="numeric"
                min={1}
                onChange={(event) =>
                  onFormValueChange("quantity", event.target.value)
                }
                placeholder={
                  suggestedQuantity > 0
                    ? `例如：${suggestedQuantity}`
                    : "请输入转入数量"
                }
                type="number"
                value={formValues.quantity}
              />
              <FieldError message={errors.quantity} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transfer-inventory-note">备注</Label>
              <Input
                id="transfer-inventory-note"
                onChange={(event) =>
                  onFormValueChange("note", event.target.value)
                }
                placeholder={`例如：转入订单 ${formValues.orderId}`}
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
              {isPending ? "转入中" : "确认转入"}
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
