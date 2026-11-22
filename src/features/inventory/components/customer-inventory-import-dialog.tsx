import { FileSpreadsheet, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ParsedCustomerInventoryImportRow } from "@/features/inventory/api/inventory-api"

type CustomerInventoryImportDialogProps = {
  errors: string[]
  fileName: string
  isImporting: boolean
  isParsing: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  onSelectFile: () => void
  open: boolean
  rows: ParsedCustomerInventoryImportRow[]
}

export function CustomerInventoryImportDialog({
  errors,
  fileName,
  isImporting,
  isParsing,
  onConfirm,
  onOpenChange,
  onSelectFile,
  open,
  rows,
}: CustomerInventoryImportDialogProps) {
  const customerCount = new Set(rows.map((row) => row.customerName.trim())).size
  const batchCount = new Set(rows.map((row) => row.batchKey.trim())).size
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0)
  const canConfirm = rows.length > 0 && errors.length === 0 && !isParsing && !isImporting

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex h-[calc(100svh-2rem)] w-[min(1080px,calc(100vw-2rem))] max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 xl:max-w-270!">
        <DialogHeader className="border-b px-4 py-4">
          <DialogTitle>批量导入客户库存</DialogTitle>
          <DialogDescription>
            一行一条库存明细，按“导入批次标识”分组；只新增批次，整份文件失败时全部回滚。
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">
              <FileSpreadsheet className="size-4" />
              <span className="truncate">{fileName || "尚未选择文件"}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              支持 CSV、XLSX、XLS；客户和商品归属必须已在系统中维护。
            </div>
          </div>
          <Button
            disabled={isParsing || isImporting}
            onClick={onSelectFile}
            size="sm"
            type="button"
            variant="outline"
          >
            {isParsing ? "正在解析…" : "选择文件"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {errors.length > 0 && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <div className="font-medium">文件存在 {errors.length} 个问题，暂不能导入</div>
              <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">
                {errors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {rows.length > 0 ? (
            <>
              <div className="mb-3 grid gap-2 sm:grid-cols-4">
                {[
                  ["客户", customerCount],
                  ["批次", batchCount],
                  ["明细", rows.length],
                  ["库存", `${totalQuantity} 支`],
                ].map(([label, value]) => (
                  <div className="rounded-md border bg-muted/20 px-3 py-2" key={label}>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 font-semibold tabular-nums">{value}</div>
                  </div>
                ))}
              </div>
              <div className="overflow-hidden rounded-md border">
                <Table className="min-w-230 table-fixed">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 w-16 px-3">行号</TableHead>
                      <TableHead className="h-10 w-36 px-3">批次标识</TableHead>
                      <TableHead className="h-10 w-36 px-3">客户</TableHead>
                      <TableHead className="h-10 w-52 px-3">商品 / 模具</TableHead>
                      <TableHead className="h-10 w-40 px-3">规格</TableHead>
                      <TableHead className="h-10 w-20 px-3 text-right">库存</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((row) => (
                      <TableRow key={`${row.rowNumber}-${row.batchKey}`}>
                        <TableCell className="px-3 py-2 text-muted-foreground tabular-nums">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell className="truncate px-3 py-2 font-mono text-xs" title={row.batchKey}>
                          {row.batchKey}
                        </TableCell>
                        <TableCell className="truncate px-3 py-2" title={row.customerName}>
                          {row.customerName}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <div className="truncate font-medium" title={row.productName}>
                            {row.productName}
                          </div>
                          <div className="truncate text-xs text-muted-foreground" title={row.moldCode}>
                            {row.moldCode}
                          </div>
                        </TableCell>
                        <TableCell className="truncate px-3 py-2 text-muted-foreground">
                          {row.lengthMm} mm / {row.color}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                          {row.quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 50 && (
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  预览前 50 条，共 {rows.length} 条；导入时会处理全部数据。
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-md border border-dashed text-center">
              <FileSpreadsheet className="mb-3 size-8 text-muted-foreground" />
              <div className="font-medium">选择文件后在这里核对导入内容</div>
              <div className="mt-1 text-sm text-muted-foreground">
                系统会先完成格式和业务校验，不会在预览阶段写入库存。
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="m-0 shrink-0 rounded-none">
          <Button
            disabled={isImporting}
            onClick={() => onOpenChange(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            取消
          </Button>
          <Button disabled={!canConfirm} onClick={onConfirm} size="sm" type="button">
            <UploadIcon className="size-4" />
            {isImporting ? "正在导入…" : `确认导入${batchCount > 0 ? ` ${batchCount} 个批次` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
