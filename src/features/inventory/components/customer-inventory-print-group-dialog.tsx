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
import type { CustomerInventoryPrintGroupLabels } from "@/features/inventory/lib/customer-inventory-print"
import type { CustomerInventoryPrintSnapshot } from "@/features/inventory/types"

type CustomerInventoryPrintGroupDialogProps = {
  errorMessage?: string
  groupLabels: CustomerInventoryPrintGroupLabels
  onBack: () => void
  onGroupChange: (batchId: string, value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  snapshot: CustomerInventoryPrintSnapshot | null
}

export function CustomerInventoryPrintGroupDialog({
  errorMessage,
  groupLabels,
  onBack,
  onGroupChange,
  onOpenChange,
  onSubmit,
  open,
  snapshot,
}: CustomerInventoryPrintGroupDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[calc(100svh-2rem)] w-[min(960px,calc(100vw-2rem))] max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden gap-0 p-0 xl:max-w-240!">
        <form className="flex h-full min-h-0 flex-col" onSubmit={onSubmit}>
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle>设置库存打印分组</DialogTitle>
            <DialogDescription>
              同一批次的库存行共用一个分组，可在预览前修改。
            </DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3 text-sm">
            <span className="font-medium">{snapshot?.customerName || "-"}</span>
            <span className="text-muted-foreground">
              {snapshot?.batches.length ?? 0} 个批次，当前库存
              <strong className="mx-1 text-foreground tabular-nums">
                {snapshot?.totalQuantity ?? 0}
              </strong>
              支
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {errorMessage && (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <Table className="w-full table-fixed">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 w-28 px-3">历史日期</TableHead>
                  <TableHead className="h-10 w-48 px-3">批次</TableHead>
                  <TableHead className="h-10 w-44 px-3">历史单号</TableHead>
                  <TableHead className="h-10 w-24 px-3 text-right">
                    当前库存
                  </TableHead>
                  <TableHead className="h-10 px-3">分组</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(snapshot?.batches ?? []).map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="px-3 py-2 text-muted-foreground">
                      {batch.historicalOrderDate || "-"}
                    </TableCell>
                    <TableCell className="px-3 py-2 font-mono text-sm">
                      {batch.id}
                    </TableCell>
                    <TableCell className="truncate px-3 py-2 text-muted-foreground">
                      {batch.historicalOrderRef || "-"}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                      {batch.totalQuantity}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Input
                        aria-label={`批次 ${batch.id} 分组`}
                        onChange={(event) =>
                          onGroupChange(batch.id, event.target.value)
                        }
                        placeholder={batch.id}
                        value={groupLabels[batch.id] ?? ""}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="m-0 shrink-0 rounded-none">
            <Button onClick={onBack} size="sm" type="button" variant="outline">
              上一步
            </Button>
            <Button disabled={!snapshot} size="sm" type="submit">
              <Printer className="size-4" />
              预览库存清单
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
