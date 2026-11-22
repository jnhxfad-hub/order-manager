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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CustomerInventoryPrintCustomerOption = {
  id: string
  name: string
  batchCount: number
  totalQuantity: number
}
type CustomerInventoryPrintDialogProps = {
  customerId: string
  customers: CustomerInventoryPrintCustomerOption[]
  errorMessage?: string
  isLoading: boolean
  isPending: boolean
  onCustomerChange: (customerId: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
}

export function CustomerInventoryPrintDialog({
  customerId,
  customers,
  errorMessage,
  isLoading,
  isPending,
  onCustomerChange,
  onOpenChange,
  onSubmit,
  open,
}: CustomerInventoryPrintDialogProps) {
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId
  )

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>打印客户库存</DialogTitle>
            <DialogDescription>
              按客户生成全部当前剩余库存的 A4 纵向清单。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-4 py-4">
            <label className="grid gap-1.5 text-sm" htmlFor="inventory-print-customer">
              <span className="font-medium">客户</span>
              <Select
                disabled={isLoading || customers.length === 0}
                onValueChange={(value) => onCustomerChange(value ?? "")}
                value={customerId}
              >
                <SelectTrigger
                  className="w-full"
                  id="inventory-print-customer"
                >
                  <SelectValue>
                    {() =>
                      selectedCustomer?.name ??
                      (isLoading ? "正在读取客户库存" : "请选择客户")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}（{customer.batchCount} 批，
                      {customer.totalQuantity} 支）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {customers.length === 0 && !isLoading && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                暂无可打印的客户库存
              </div>
            )}
            {errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={!customerId || isLoading || isPending}
              size="sm"
              type="submit"
            >
              <Printer className="size-4" />
              {isPending ? "读取中" : "下一步：设置分组"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
