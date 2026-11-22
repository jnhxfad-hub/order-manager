import { PackageOpen, Users } from "lucide-react"
import { useEffect, useState } from "react"

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
import type { OrderInventoryGroup } from "@/features/inventory/lib/inventory-utils"

export function OrderInventoryRemainderDialog({
  errorMessage,
  isPending,
  onOpenChange,
  onTransfer,
  open,
  selectedOrderGroup,
  totalQuantity,
}: {
  errorMessage?: string | null
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onTransfer: (destination: "public" | "customer", note: string) => void
  open: boolean
  selectedOrderGroup: OrderInventoryGroup | undefined
  totalQuantity: number
}) {
  const [note, setNote] = useState("")

  useEffect(() => {
    if (open) {
      setNote(`订单 ${selectedOrderGroup?.orderId ?? ""} 剩余库存转入`)
    }
  }, [open, selectedOrderGroup?.orderId])

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>处理剩余库存</DialogTitle>
          <DialogDescription>
            {selectedOrderGroup?.orderId ?? ""} · 当前剩余 {totalQuantity} 支
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            本操作会一次性转移全部剩余库存并完结该订单库存，确认后不能继续出库。
          </div>
          <div className="grid gap-2">
            <Label htmlFor="order-remainder-note">操作备注</Label>
            <Input
              id="order-remainder-note"
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </div>
          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            disabled={isPending}
            onClick={() => onTransfer("customer", note)}
            type="button"
            variant="outline"
          >
            <Users className="size-4" />
            转入客户库存
          </Button>
          <div className="flex gap-2">
            <Button
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={isPending}
              onClick={() => onTransfer("public", note)}
              type="button"
            >
              <PackageOpen className="size-4" />
              转入公共库存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
