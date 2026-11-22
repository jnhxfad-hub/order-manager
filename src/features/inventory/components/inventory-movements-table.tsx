import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatMovementSpec,
  movementText,
} from "@/features/inventory/lib/inventory-utils"
import type {
  InventoryMovement,
  InventoryMovementType,
} from "@/features/inventory/types"
import { formatAppDateTime } from "@/lib/datetime"
import { cn } from "@/lib/utils"

const movementTone: Record<InventoryMovementType, string> = {
  adjust: "text-blue-700",
  in: "text-emerald-700",
  out: "text-amber-700",
  produce: "text-emerald-700",
  ship: "text-amber-700",
  transfer_customer: "text-blue-700",
  transfer_public: "text-blue-700",
}

function formatDateTime(value: string | null) {
  return formatAppDateTime(value, { fallback: "未调整" })
}

export interface InventoryMovementsTableProps {
  movements: InventoryMovement[]
}

export function InventoryMovementsTable({
  movements,
}: InventoryMovementsTableProps) {
  return (
    <Table className="min-w-315 table-fixed">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 w-29 px-4">时间</TableHead>
          <TableHead className="h-10 w-43 px-4">订单/出库单</TableHead>
          <TableHead className="h-10 w-[18%] px-4">商品名称</TableHead>
          <TableHead className="h-10 w-28 px-4">模具编号</TableHead>
          <TableHead className="h-10 w-45 px-4">规格</TableHead>
          <TableHead className="h-10 w-24] px-4">类型</TableHead>
          <TableHead className="h-10 w-19.5 px-3 text-right">
            变动
          </TableHead>
          <TableHead className="h-10 w-23 px-3 text-right">
            变动后
          </TableHead>
          <TableHead className="h-10 w-60 px-4">备注</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => (
          <TableRow key={movement.id}>
            <TableCell className="px-4 py-3 text-muted-foreground">
              {formatDateTime(movement.createdAt)}
            </TableCell>
            <TableCell className="px-4 py-3">
              {movement.orderId ? (
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-medium">
                    {movement.orderId}
                  </div>
                  {movement.deliveryNoteId && (
                    <div className="truncate text-xs text-muted-foreground">
                      出库单 {movement.deliveryNoteId}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">公共库存</span>
              )}
            </TableCell>
            <TableCell className="truncate px-4 py-3 font-medium">
              {movement.productName}
            </TableCell>
            <TableCell className="px-4 py-3 font-mono text-sm">
              {movement.moldCode}
            </TableCell>
            <TableCell className="truncate px-4 py-3 text-muted-foreground">
              {formatMovementSpec(movement)}
            </TableCell>
            <TableCell
              className={cn(
                "px-4 py-3 font-medium",
                movementTone[movement.movementType],
              )}
            >
              {movementText[movement.movementType]}
            </TableCell>
            <TableCell className="px-3 py-3 text-right font-medium tabular-nums">
              {movement.deltaQuantity > 0 ? "+" : ""}
              {movement.deltaQuantity}
            </TableCell>
            <TableCell className="px-3 py-3 text-right tabular-nums">
              {movement.quantityAfter}
            </TableCell>
            <TableCell
              className="px-4 py-3 text-muted-foreground"
              title={movement.note || undefined}
            >
              <span className="block max-w-[24ch] truncate">
                {movement.note || "-"}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
