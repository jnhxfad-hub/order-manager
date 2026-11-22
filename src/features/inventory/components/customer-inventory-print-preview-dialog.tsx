import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PrintCustomerInventoryView } from "@/features/inventory/components/print-customer-inventory-view"
import type {
  CustomerInventoryPrintGroupLabels,
  CustomerInventoryPrintLayoutResult,
  CustomerInventoryPrintPage,
} from "@/features/inventory/lib/customer-inventory-print"
import type { CustomerInventoryPrintSnapshot } from "@/features/inventory/types"

type CustomerInventoryPrintPreviewDialogProps = {
  groupLabels: CustomerInventoryPrintGroupLabels
  onEditGroups: () => void
  onLayoutResult: (result: CustomerInventoryPrintLayoutResult) => void
  onOpenChange: (open: boolean) => void
  onPrint: () => void
  open: boolean
  pages: CustomerInventoryPrintPage[] | null
  snapshot: CustomerInventoryPrintSnapshot | null
}
export function CustomerInventoryPrintPreviewDialog({
  groupLabels,
  onEditGroups,
  onLayoutResult,
  onOpenChange,
  onPrint,
  open,
  pages,
  snapshot,
}: CustomerInventoryPrintPreviewDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 xl:max-w-295">
        <DialogHeader className="border-b px-4 py-4">
          <DialogTitle>客户库存打印预览</DialogTitle>
          <DialogDescription>
            确认 A4 纵向版式和当前库存数量无误后再打印。
          </DialogDescription>
        </DialogHeader>
        <div className="relative flex min-h-0 flex-1 overflow-auto bg-muted/60 p-4">
          {!pages && (
            <div className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
              正在按 A4 实际高度计算分页
            </div>
          )}
          <div
            className={`mx-auto w-[210mm] shrink-0 text-[#111827] ${pages ? "" : "invisible"}`}
          >
            {snapshot && (
              <PrintCustomerInventoryView
                groupLabels={groupLabels}
                onLayoutResult={onLayoutResult}
                pages={pages}
                snapshot={snapshot}
                variant="preview"
              />
            )}
          </div>
        </div>
        <DialogFooter className="m-0 rounded-none">
          <Button onClick={onEditGroups} size="sm" variant="outline">
            修改分组
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            size="sm"
            variant="outline"
          >
            关闭
          </Button>
          <Button disabled={!snapshot || !pages} onClick={onPrint} size="sm">
            <Printer className="size-4" />
            打印
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
