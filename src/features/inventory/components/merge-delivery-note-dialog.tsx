import { Printer } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DeliveryNoteFormErrors } from "@/features/inventory/lib/inventory-dialog-state"
import type { OrderInventoryGroup } from "@/features/inventory/lib/inventory-utils"

type MergeDeliveryNoteDialogProps = {
  deliveredOrderGroups: OrderInventoryGroup[]
  deliveredOrderGroupsByDeliveryNoteId: Map<string, OrderInventoryGroup>
  errors: DeliveryNoteFormErrors
  groupsByDeliveryNoteId: Record<string, string>
  isPending: boolean
  onGroupChange: (deliveryNoteId: string, value: string) => void
  onOpenChange: (open: boolean) => void
  onSpecialNoteChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleDeliveryNote: (deliveryNoteId: string, checked: boolean) => void
  open: boolean
  selectedDeliveryNoteIds: string[]
  specialNote: string
}

export function MergeDeliveryNoteDialog({
  deliveredOrderGroups,
  deliveredOrderGroupsByDeliveryNoteId,
  errors,
  groupsByDeliveryNoteId,
  isPending,
  onGroupChange,
  onOpenChange,
  onSpecialNoteChange,
  onSubmit,
  onToggleDeliveryNote,
  open,
  selectedDeliveryNoteIds,
  specialNote,
}: MergeDeliveryNoteDialogProps) {
  const firstSelectedGroup = selectedDeliveryNoteIds
    .map((id) => deliveredOrderGroupsByDeliveryNoteId.get(id))
    .find((item): item is OrderInventoryGroup => Boolean(item))

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[calc(100svh-1rem)] w-[min(1120px,calc(100vw-0.75rem))] max-h-[calc(100svh-1rem)] max-w-[calc(100vw-0.75rem)] flex-col overflow-hidden p-0 sm:max-w-[calc(100vw-0.75rem)]! xl:max-w-[1120px]!">
        <form className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle>合并出库单</DialogTitle>
            <DialogDescription>
              选择同一客户的已出库订单，按价格组生成一张合并打印单。
            </DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              已选择{" "}
              <strong className="text-foreground tabular-nums">
                {selectedDeliveryNoteIds.length}
              </strong>{" "}
              张出库单
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {errors.form && (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.form}
              </div>
            )}
            <Table className="w-full table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-14 px-3 text-center">
                    选择
                  </TableHead>
                  <TableHead className="h-10 w-44 px-3">订单编号</TableHead>
                  <TableHead className="h-10 w-[30%] px-3">客户</TableHead>
                  <TableHead className="h-10 w-56 px-3">分组说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveredOrderGroups.map((group) => {
                  const deliveryNoteId = group.deliveryNoteId
                  const checked = deliveryNoteId
                    ? selectedDeliveryNoteIds.includes(deliveryNoteId)
                    : false
                  const disabled = firstSelectedGroup
                    ? firstSelectedGroup.customerName !== group.customerName &&
                      !checked
                    : false

                  return (
                    <TableRow key={group.orderId}>
                      <TableCell className="px-3 py-2 text-center">
                        <input
                          checked={checked}
                          className="size-4 accent-[#6f7f3f]"
                          disabled={!deliveryNoteId || disabled}
                          onChange={(event) => {
                            if (deliveryNoteId) {
                              onToggleDeliveryNote(
                                deliveryNoteId,
                                event.target.checked,
                              )
                            }
                          }}
                          type="checkbox"
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2 font-mono text-sm">
                        {group.orderId}
                      </TableCell>
                      <TableCell className="truncate px-3 py-2">
                        {group.customerName}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <Input
                          disabled={!deliveryNoteId || !checked}
                          onChange={(event) => {
                            if (deliveryNoteId) {
                              onGroupChange(deliveryNoteId, event.target.value)
                            }
                          }}
                          placeholder="同价多单必填，如：第一车"
                          value={
                            deliveryNoteId
                              ? (groupsByDeliveryNoteId[deliveryNoteId] ?? "")
                              : ""
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="mt-4 grid gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="merge-delivery-note-special-note"
              >
                特殊提示
              </label>
              <Input
                id="merge-delivery-note-special-note"
                onChange={(event) => onSpecialNoteChange(event.target.value)}
                placeholder="仅本次合并打印使用，打印时醒目显示在备注下方"
                value={specialNote}
              />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 m-0 shrink-0 rounded-none">
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button disabled={isPending} size="sm" type="submit">
              <Printer className="size-4" />
              {isPending ? "生成中" : "预览合并单"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
