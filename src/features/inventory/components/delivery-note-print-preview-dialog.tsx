import { PencilLine, Printer, Save } from "lucide-react"

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
  PrintDeliveryNoteView,
  PrintMergedDeliveryNoteView,
} from "@/features/inventory/components/print-delivery-note-view"
import type {
  DeliveryNote,
  MergedDeliveryNote,
} from "@/features/inventory/types"

type DeliveryNotePrintPreviewDialogProps = {
  canSaveSpecialNote: boolean
  currentDeliveryNote: DeliveryNote | null
  currentDeliveryNoteTotalQuantity: number
  currentMergedDeliveryNote: MergedDeliveryNote | null
  isSavingSpecialNote: boolean
  onOpenChange: (open: boolean) => void
  onPrint: () => void
  onSaveSpecialNote: () => void
  onSpecialNoteEditorOpenChange: (open: boolean) => void
  onSpecialNoteChange: (value: string) => void
  open: boolean
  savedSpecialNote: string
  saveSpecialNoteErrorMessage?: string | null
  specialNoteEditorOpen: boolean
  specialNote: string
}

export function DeliveryNotePrintPreviewDialog({
  canSaveSpecialNote,
  currentDeliveryNote,
  currentDeliveryNoteTotalQuantity,
  currentMergedDeliveryNote,
  isSavingSpecialNote,
  onOpenChange,
  onPrint,
  onSaveSpecialNote,
  onSpecialNoteEditorOpenChange,
  onSpecialNoteChange,
  open,
  savedSpecialNote,
  saveSpecialNoteErrorMessage,
  specialNoteEditorOpen,
  specialNote,
}: DeliveryNotePrintPreviewDialogProps) {
  const hasUnsavedSpecialNote = specialNote.trim() !== savedSpecialNote.trim()

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 xl:max-w-295">
        <DialogHeader className="border-b px-4 py-4">
          <DialogTitle>出库单打印预览</DialogTitle>
          <DialogDescription>
            确认 A4 纵向版式和内容无误后再打印。
          </DialogDescription>
        </DialogHeader>
        {specialNoteEditorOpen && (
          <div className="grid shrink-0 gap-2 border-b bg-background px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="delivery-note-preview-special-note"
              >
                特殊提示
              </label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {canSaveSpecialNote ? (
                  hasUnsavedSpecialNote ? "有未保存修改" : "已保存"
                ) : (
                  "仅本次预览和打印"
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                className="min-h-17 flex-1 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                id="delivery-note-preview-special-note"
                onChange={(event) => onSpecialNoteChange(event.target.value)}
                placeholder="不填写则不显示；填写后会在备注下方醒目显示"
                value={specialNote}
              />
              {canSaveSpecialNote && (
                <Button
                  className="self-start sm:self-stretch"
                  disabled={isSavingSpecialNote}
                  onClick={onSaveSpecialNote}
                  size="sm"
                  type="button"
                >
                  <Save className="size-4" />
                  {isSavingSpecialNote ? "保存中" : "保存提示"}
                </Button>
              )}
            </div>
            {saveSpecialNoteErrorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveSpecialNoteErrorMessage}
              </div>
            )}
          </div>
        )}
        <div className="flex min-h-0 flex-1 overflow-auto bg-muted/60 p-4">
          <div className="mx-auto w-[210mm] shrink-0 text-[#111827]">
            {currentDeliveryNote && (
              <PrintDeliveryNoteView
                deliveryNote={currentDeliveryNote}
                totalQuantity={currentDeliveryNoteTotalQuantity}
                variant="preview"
              />
            )}
            {currentMergedDeliveryNote && (
              <PrintMergedDeliveryNoteView
                mergedDeliveryNote={currentMergedDeliveryNote}
                variant="preview"
              />
            )}
          </div>
        </div>
        <DialogFooter className="m-0 rounded-none">
          <Button
            onClick={() => onOpenChange(false)}
            size="sm"
            variant="outline"
          >
            关闭
          </Button>
          <Button
            onClick={() =>
              onSpecialNoteEditorOpenChange(!specialNoteEditorOpen)
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <PencilLine className="size-4" />
            {specialNoteEditorOpen ? "收起编辑" : "编辑特殊提示"}
          </Button>
          <Button onClick={onPrint} size="sm">
            <Printer className="size-4" />
            打印
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
