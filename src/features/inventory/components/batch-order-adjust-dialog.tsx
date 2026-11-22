import { ImagePlus } from "lucide-react"
import type { FormEvent, KeyboardEvent } from "react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BatchOrderOcrResultPanel } from "@/features/inventory/components/batch-order-ocr-preview"
import type { BatchOrderInventoryFormErrors } from "@/features/inventory/lib/inventory-dialog-state"
import {
  getInventoryDetailKey,
  getOrderInventoryStatus,
  type BatchOrderImageRecognitionMatch,
  type BatchOrderInventoryRow,
  type OrderInventoryGroup,
} from "@/features/inventory/lib/inventory-utils"
import { parseIntegerInput } from "@/lib/number-input"
import { cn } from "@/lib/utils"

type BatchOrderAdjustDialogProps = {
  areQuantitiesEmpty: boolean
  enteredQuantity: number
  errors: BatchOrderInventoryFormErrors
  imageMatches: BatchOrderImageRecognitionMatch[]
  isImageRecognitionError: boolean
  isImageRecognitionPending: boolean
  isSubmitError: boolean
  isSubmitPending: boolean
  isWriting: boolean
  matchedImageCount: number
  note: string
  onApplyImageRecognition: () => void
  onClearQuantities: () => void
  onFillRequiredQuantities: () => void
  onNoteChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  onQuantityChange: (detailKey: string, value: string) => void
  onQuantityKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
  ) => void
  onRecognizeImage: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleRawText: () => void
  open: boolean
  rawTextOpen: boolean
  rawTexts: string[]
  recognizedImagePaths: string[]
  rows: BatchOrderInventoryRow[]
  selectedOrderGroup: OrderInventoryGroup | null
  skippedImagePaths: string[]
  submitErrorMessage?: string | null
  imageRecognitionErrorMessage?: string | null
  unresolvedImageCount: number
}

export function BatchOrderAdjustDialog({
  areQuantitiesEmpty,
  enteredQuantity,
  errors,
  imageMatches,
  imageRecognitionErrorMessage,
  isImageRecognitionError,
  isImageRecognitionPending,
  isSubmitError,
  isSubmitPending,
  isWriting,
  matchedImageCount,
  note,
  onApplyImageRecognition,
  onClearQuantities,
  onFillRequiredQuantities,
  onNoteChange,
  onOpenChange,
  onQuantityChange,
  onQuantityKeyDown,
  onRecognizeImage,
  onSubmit,
  onToggleRawText,
  open,
  rawTextOpen,
  rawTexts,
  recognizedImagePaths,
  rows,
  selectedOrderGroup,
  skippedImagePaths,
  submitErrorMessage,
  unresolvedImageCount,
}: BatchOrderAdjustDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-6xl">
        <form
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          onSubmit={onSubmit}
        >
          <DialogHeader>
            <DialogTitle>批量入库</DialogTitle>
            <DialogDescription>
              {selectedOrderGroup?.orderId ?? ""} ·{" "}
              {selectedOrderGroup?.customerName ?? ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-auto px-1 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-md border bg-muted/20 px-2.5 py-1">
                  明细：
                  <span className="font-semibold text-foreground tabular-nums">
                    {rows.length}
                  </span>
                </span>
                <span className="rounded-md border bg-muted/20 px-2.5 py-1">
                  本次入库：
                  <span className="font-semibold text-foreground tabular-nums">
                    {enteredQuantity}
                  </span>
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={isImageRecognitionPending}
                  onClick={onRecognizeImage}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ImagePlus className="size-4" />
                  {isImageRecognitionPending ? "识别中" : "识别图片"}
                </Button>
                <Button
                  onClick={onFillRequiredQuantities}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  填入默认入库
                </Button>
                <Button
                  disabled={areQuantitiesEmpty}
                  onClick={onClearQuantities}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  清空
                </Button>
              </div>
            </div>

            <BatchOrderOcrResultPanel
              applyDisabled={matchedImageCount === 0}
              errorMessage={imageRecognitionErrorMessage}
              imageMatches={imageMatches}
              isError={isImageRecognitionError}
              matchedCount={matchedImageCount}
              onApply={onApplyImageRecognition}
              onToggleRawText={onToggleRawText}
              rawTextOpen={rawTextOpen}
              rawTexts={rawTexts}
              recognizedImagePaths={recognizedImagePaths}
              rows={rows}
              skippedImagePaths={skippedImagePaths}
              unresolvedCount={unresolvedImageCount}
            />

            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-245 table-fixed">
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 w-52.5 px-4">
                      商品名称
                    </TableHead>
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
                    <TableHead className="h-10 w-33 px-4">库存状态</TableHead>
                    <TableHead className="h-10 w-42 px-4">
                      本次入库（支）
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, rowIndex) => {
                    const detailKey = getInventoryDetailKey(row)
                    const remainingQuantity = Math.max(
                      row.requiredQuantity - row.currentQuantity,
                      0,
                    )
                    const enteredRowQuantity = parseIntegerInput(row.quantity)
                    const expectedQuantity =
                      row.currentQuantity +
                      (enteredRowQuantity !== null && enteredRowQuantity > 0
                        ? enteredRowQuantity
                        : 0)
                    const status = getOrderInventoryStatus(
                      row.requiredQuantity,
                      row.currentQuantity,
                    )
                    const expectedOverQuantity = Math.max(
                      expectedQuantity - row.requiredQuantity,
                      0,
                    )
                    const shouldShowOverStockHint =
                      Boolean(row.quantity.trim()) &&
                      enteredRowQuantity !== null &&
                      enteredRowQuantity > 0 &&
                      expectedOverQuantity > 0
                    const displayedStatus = shouldShowOverStockHint
                      ? {
                          className:
                            "border-amber-200 bg-amber-50 text-amber-700",
                          label: `填后超入库 ${expectedOverQuantity} 支`,
                        }
                      : status

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
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                              displayedStatus.className,
                            )}
                          >
                            {displayedStatus.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            aria-invalid={Boolean(errors[detailKey])}
                            className="h-8"
                            data-batch-order-quantity={rowIndex}
                            inputMode="numeric"
                            min={1}
                            onChange={(event) =>
                              onQuantityChange(detailKey, event.target.value)
                            }
                            onKeyDown={(event) =>
                              onQuantityKeyDown(event, rowIndex)
                            }
                            placeholder={
                              remainingQuantity > 0
                                ? `建议入库 ${remainingQuantity}`
                                : "可继续超入库"
                            }
                            type="number"
                            value={row.quantity}
                          />
                          <FieldError message={errors[detailKey]} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="batch-order-inventory-note">备注</Label>
              <Input
                data-batch-order-note
                id="batch-order-inventory-note"
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="例如：本批生产完成、批量补录入库"
                value={note}
              />
            </div>

            {errors.form && (
              <div className="whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.form}
              </div>
            )}

            {isSubmitError && submitErrorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitErrorMessage}
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
            <Button disabled={isWriting} type="submit">
              {isSubmitPending ? "入库中" : "确认入库"}
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
