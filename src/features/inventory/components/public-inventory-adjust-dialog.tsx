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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type InventoryFormErrors,
  type InventoryFormValues,
} from "@/features/inventory/lib/inventory-dialog-state"
import { movementText } from "@/features/inventory/lib/inventory-utils"
import type {
  InventoryItem,
  PublicInventoryMovementType,
} from "@/features/inventory/types"

type PublicInventoryAdjustDialogProps = {
  currentProduct?: InventoryItem | null
  currentStockQuantity: number
  errors: InventoryFormErrors
  formValues: InventoryFormValues
  isError: boolean
  isPending: boolean
  isWriting: boolean
  notePlaceholder: string
  onFormValueChange: <Key extends keyof InventoryFormValues>(
    key: Key,
    value: InventoryFormValues[Key],
  ) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  submitErrorMessage?: string | null
}

export function PublicInventoryAdjustDialog({
  currentProduct,
  currentStockQuantity,
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
  submitErrorMessage,
}: PublicInventoryAdjustDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>公共库存调整</DialogTitle>
            <DialogDescription>
              对当前公共库存记录入库、出库或盘点，操作会写入库存流水。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">模具编号</span>
                <span className="font-mono font-medium">
                  {currentProduct?.moldCode ?? "-"}
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
                  {currentProduct?.productName ?? "-"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="inventory-type">类型</Label>
                <Select
                  onValueChange={(value) =>
                    onFormValueChange(
                      "movementType",
                      value as PublicInventoryMovementType,
                    )
                  }
                  value={formValues.movementType}
                >
                  <SelectTrigger id="inventory-type">
                    <SelectValue>
                      {() => movementText[formValues.movementType]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">入库</SelectItem>
                    <SelectItem value="out">出库</SelectItem>
                    <SelectItem value="adjust">盘点</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="inventory-quantity">
                  {formValues.movementType === "adjust"
                    ? "实际库存（支）"
                    : "变动数量（支）"}
                </Label>
                <Input
                  aria-invalid={Boolean(errors.quantity)}
                  id="inventory-quantity"
                  inputMode="numeric"
                  min={formValues.movementType === "adjust" ? 0 : 1}
                  onChange={(event) =>
                    onFormValueChange("quantity", event.target.value)
                  }
                  placeholder={
                    formValues.movementType === "adjust"
                      ? "例如：120"
                      : "例如：20"
                  }
                  type="number"
                  value={formValues.quantity}
                />
                <FieldError message={errors.quantity} />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              当前库存：
              <span className="font-semibold text-foreground">
                {currentStockQuantity}
              </span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="inventory-note">备注</Label>
              <Input
                id="inventory-note"
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
              {isPending ? "调整中" : "确认调整"}
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
