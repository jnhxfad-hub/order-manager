import type { CustomerInventoryBatch } from "@/features/inventory/types"
import { formatPlainMoneyX100 } from "@/lib/money"

export const customerInventoryImportHeaders = [
  "导入批次标识",
  "客户名称",
  "历史下单日期",
  "历史单号",
  "铝锭价",
  "计价方式",
  "断桥加工费",
  "喷涂加工费",
  "坯料加工费",
  "氧化加工费",
  "电泳加工费",
  "批次备注",
  "商品名称",
  "模具编号",
  "长度(mm)",
  "颜色",
  "当前库存(支)",
  "明细备注",
] as const

export function createCustomerInventoryImportTemplateCsvRows() {
  return [[...customerInventoryImportHeaders]]
}

export function createCustomerInventoryExportCsvRows(
  batches: CustomerInventoryBatch[]
) {
  return [
    [...customerInventoryImportHeaders],
    ...batches.flatMap((batch) =>
      batch.items
        .filter((item) => item.quantity > 0)
        .map((item) => [
          batch.id,
          batch.customerName,
          batch.historicalOrderDate ?? "",
          batch.historicalOrderRef,
          formatPlainMoneyX100(batch.aluminumIngotPriceX100),
          batch.pricingTaxIncluded ? "含税" : "不含税",
          formatPlainMoneyX100(batch.bridgeProcessingFeeX100),
          formatPlainMoneyX100(batch.powderProcessingFeeX100),
          formatPlainMoneyX100(batch.billetProcessingFeeX100),
          formatPlainMoneyX100(batch.oxidationProcessingFeeX100),
          formatPlainMoneyX100(batch.electrophoresisProcessingFeeX100),
          batch.note,
          item.productName,
          item.moldCode,
          item.lengthMm,
          item.color,
          item.quantity,
          item.note,
        ])
    ),
  ]
}

export function getCustomerInventoryExportItemCount(
  batches: CustomerInventoryBatch[]
) {
  return batches.reduce(
    (total, batch) =>
      total + batch.items.filter((item) => item.quantity > 0).length,
    0
  )
}
