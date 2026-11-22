import { ChevronDown, ChevronUp, RotateCcw, RotateCw } from "lucide-react"

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
import {
  getInventoryDetailKey,
  type BatchOrderImagePreview,
  type BatchOrderImageRecognitionMatch,
  type BatchOrderInventoryRow,
} from "@/features/inventory/lib/inventory-utils"
import { cn } from "@/lib/utils"

export function BatchOrderOcrResultPanel({
  applyDisabled,
  errorMessage,
  imageMatches,
  isError,
  matchedCount,
  onApply,
  onToggleRawText,
  rawTextOpen,
  rawTexts,
  recognizedImagePaths,
  rows,
  skippedImagePaths,
  unresolvedCount,
}: {
  applyDisabled: boolean
  errorMessage?: string | null
  imageMatches: BatchOrderImageRecognitionMatch[]
  isError: boolean
  matchedCount: number
  onApply: () => void
  onToggleRawText: () => void
  rawTextOpen: boolean
  rawTexts: string[]
  recognizedImagePaths: string[]
  rows: BatchOrderInventoryRow[]
  skippedImagePaths: string[]
  unresolvedCount: number
}) {
  if (imageMatches.length === 0 && skippedImagePaths.length === 0 && !isError) {
    return null
  }

  return (
    <div className="sticky top-0 z-10 grid gap-2 rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur">
      {skippedImagePaths.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          已跳过重复图片：
          {skippedImagePaths.map((path) => path.split(/[\\/]/).pop()).join(" / ")}
        </div>
      )}

      {imageMatches.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">图片识别结果</div>
            {recognizedImagePaths.length > 0 && (
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {recognizedImagePaths
                  .map((path) => path.split(/[\\/]/).pop())
                  .join(" / ")}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border bg-background px-2 py-1">
              已识别 {imageMatches.length} 行
            </span>
            <span className="rounded-md border bg-background px-2 py-1 text-emerald-700">
              可应用 {matchedCount} 行
            </span>
            {unresolvedCount > 0 && (
              <span className="rounded-md border bg-background px-2 py-1 text-amber-700">
                待处理 {unresolvedCount} 行
              </span>
            )}
            <Button
              disabled={applyDisabled}
              onClick={onApply}
              size="sm"
              type="button"
            >
              应用识别结果
            </Button>
            {rawTexts.length > 0 && (
              <Button
                onClick={onToggleRawText}
                size="sm"
                type="button"
                variant="ghost"
              >
                {rawTextOpen ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                OCR 原文
              </Button>
            )}
          </div>
        </div>
      )}

      {rawTexts.length > 0 && rawTextOpen && (
        <div className="grid gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">OCR 原文</div>
          {rawTexts.map((rawText, index) => (
            <pre
              className="whitespace-pre-wrap wrap-break-word font-mono text-[11px] leading-5"
              key={`${index}-${rawText.slice(0, 16)}`}
            >
              {rawText}
            </pre>
          ))}
        </div>
      )}

      {imageMatches.length > 0 && (
        <div className="max-h-56 overflow-auto rounded-md border bg-background">
          <Table className="min-w-190 table-fixed">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-32.5 px-3">型号</TableHead>
                <TableHead className="h-9 w-22 px-3">图片颜色</TableHead>
                <TableHead className="h-9 w-25 px-3 text-right">
                  长度(mm)
                </TableHead>
                <TableHead className="h-9 w-22.5 px-3 text-right">
                  支数
                </TableHead>
                <TableHead className="h-9 w-40 px-3">匹配状态</TableHead>
                <TableHead className="h-9 px-3">订单颜色</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imageMatches.map((match, index) => {
                const matchedRow =
                  match.detailKey &&
                  rows.find(
                    (row) => getInventoryDetailKey(row) === match.detailKey,
                  )
                const statusClassName =
                  match.status === "matched"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : match.status === "ambiguous"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-destructive/30 bg-destructive/10 text-destructive"

                return (
                  <TableRow key={`${match.item.rawText}-${index}`}>
                    <TableCell className="px-3 py-2 font-mono text-sm">
                      {match.item.moldCode}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      {match.item.color}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">
                      {match.item.lengthMm}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-semibold tabular-nums">
                      {match.item.quantity ?? "未识别"}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                          statusClassName,
                        )}
                      >
                        {match.message}
                      </span>
                    </TableCell>
                    <TableCell className="truncate px-3 py-2 text-muted-foreground">
                      {matchedRow
                        ? matchedRow.color
                        : match.candidates?.map((row) => row.color).join(" / ") ||
                          "-"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {isError && errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

export function BatchOrderImagePreviewDialog({
  currentImage,
  imageCount,
  imageIndex,
  isPending,
  onConfirm,
  onIndexChange,
  onOpenChange,
  onRotate,
  open,
}: {
  currentImage: BatchOrderImagePreview | null
  imageCount: number
  imageIndex: number
  isPending: boolean
  onConfirm: () => void
  onIndexChange: (index: number) => void
  onOpenChange: (open: boolean) => void
  onRotate: (delta: number) => void
  open: boolean
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>预览入库图片</DialogTitle>
          <DialogDescription>
            {imageCount > 0 ? `第 ${imageIndex + 1} / ${imageCount} 张` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-3">
          {currentImage && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">
                  {currentImage.path.split(/[\\/]/).pop()}
                </span>
                <span>旋转 {currentImage.rotationDegrees}°</span>
              </div>
              <div className="flex min-h-[52vh] items-center justify-center overflow-hidden rounded-md border bg-muted/20 p-2">
                <img
                  alt="入库图片预览"
                  className="max-h-[50vh] max-w-full object-contain"
                  src={currentImage.previewUrl}
                  style={{
                    transform: `rotate(${currentImage.rotationDegrees}deg)`,
                  }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                disabled={imageIndex === 0}
                onClick={() => onIndexChange(Math.max(imageIndex - 1, 0))}
                type="button"
                variant="outline"
              >
                上一张
              </Button>
              <Button
                disabled={imageIndex + 1 >= imageCount}
                onClick={() =>
                  onIndexChange(Math.min(imageIndex + 1, imageCount - 1))
                }
                type="button"
                variant="outline"
              >
                下一张
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={isPending}
                onClick={() => onRotate(-90)}
                type="button"
                variant="outline"
              >
                <RotateCcw className="size-4" />
                左转 90
              </Button>
              <Button
                disabled={isPending}
                onClick={() => onRotate(90)}
                type="button"
                variant="outline"
              >
                <RotateCw className="size-4" />
                右转 90
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            取消
          </Button>
          <Button disabled={imageCount === 0 || isPending} onClick={onConfirm}>
            {isPending ? "识别中" : "确认识别"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
