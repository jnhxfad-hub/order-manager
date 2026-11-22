import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InventoryItem } from "@/features/inventory/types"
import { formatAppDateTime } from "@/lib/datetime"
import {
  formatThicknessMm,
  formatWeightPerMeterKg,
} from "@/lib/measurement"

function formatDateTime(value: string | null) {
  return formatAppDateTime(value, { fallback: "未调整" })
}

export interface PublicInventoryTableProps {
  items: InventoryItem[]
  onOpenAdjustDialog: (item: InventoryItem) => void
}

export function PublicInventoryTable({
  items,
  onOpenAdjustDialog,
}: PublicInventoryTableProps) {
  return (
    <Table className="min-w-7xl table-fixed">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 w-[18%] px-4">商品名称</TableHead>
          <TableHead className="h-10 w-[11%] px-4">模具编号</TableHead>
          <TableHead className="h-10 w-[8%] px-3 pr-6 text-right">
            长度(mm)
          </TableHead>
          <TableHead className="h-10 w-[11%] px-6">颜色</TableHead>
          <TableHead className="h-10 w-[6%] px-3 text-right">
            厚度 mm
          </TableHead>
          <TableHead className="h-10 w-[7%] px-3 text-right">
            米重 kg/m
          </TableHead>
          <TableHead className="h-10 w-[7%] px-3 pr-4 text-right">
            当前库存
          </TableHead>
          <TableHead className="h-10 w-[26%] px-4">
            最近流水备注
          </TableHead>
          <TableHead className="h-10 w-26 px-3">最近调整</TableHead>
          <TableHead className="h-10 w-16 px-3 text-center">
            操作
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={`${item.productId}-${item.lengthMm}-${item.color}`}
          >
            <TableCell className="truncate px-4 py-3 font-medium">
              {item.productName}
            </TableCell>
            <TableCell className="px-4 py-3 font-mono text-sm font-medium">
              {item.moldCode}
            </TableCell>
            <TableCell className="px-3 py-3 pr-6 text-right tabular-nums">
              {item.lengthMm}
            </TableCell>
            <TableCell className="truncate px-6 py-3 text-muted-foreground">
              {item.color}
            </TableCell>
            <TableCell className="px-3 py-3 text-right tabular-nums">
              {formatThicknessMm(item.thicknessMmX100)}
            </TableCell>
            <TableCell className="px-3 py-3 text-right tabular-nums">
              {formatWeightPerMeterKg(item.weightPerMeterKgX1000)}
            </TableCell>
            <TableCell className="px-3 py-3 pr-4 text-right font-semibold tabular-nums">
              {item.quantity}
            </TableCell>
            <TableCell
              className="truncate px-4 py-3 text-muted-foreground"
              title={item.latestNote || undefined}
            >
              {item.latestNote || "-"}
            </TableCell>
            <TableCell className="px-3 py-3 text-muted-foreground">
              {formatDateTime(item.updatedAt)}
            </TableCell>
            <TableCell className="px-3 py-3 text-center">
              <Button
                onClick={() => onOpenAdjustDialog(item)}
                size="sm"
                variant="outline"
              >
                调整
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
