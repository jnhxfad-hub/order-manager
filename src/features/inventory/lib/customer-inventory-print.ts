import type {
  CustomerInventoryPrintBatch,
  CustomerInventoryPrintSnapshot,
  CustomerInventoryStockItem,
} from "@/features/inventory/types"

const defaultPageCapacity = 43
const tableHeaderUnits = 3
const tableSummaryUnits = 1
const minimumContinuationRows = 6

export type CustomerInventoryPrintGroupLabels = Record<string, string>

export type CustomerInventoryPrintTableGroup = {
  batches: CustomerInventoryPrintBatch[]
  historicalOrderDate: string | null
  id: string
  itemCount: number
  totalQuantity: number
}

export type CustomerInventoryPrintRowGroup = {
  batch: CustomerInventoryPrintBatch
  isFirstPart: boolean
  isLastPart: boolean
  itemOffset: number
  items: CustomerInventoryStockItem[]
}

export type CustomerInventoryPrintTable = {
  group: CustomerInventoryPrintTableGroup
  isFirstPart: boolean
  isLastPart: boolean
  rowGroups: CustomerInventoryPrintRowGroup[]
}

export type CustomerInventoryPrintPage = {
  tables: CustomerInventoryPrintTable[]
}

export type CustomerInventoryPrintLayoutMetrics = {
  batchHeights: Record<string, number>
  continuedHeight: number
  grandTotalHeight: number
  pageContentHeight: number
  pageFixedHeight: number
  tableHeaderHeights: Record<string, number>
  tableSummaryHeights: Record<string, number>
}

export type CustomerInventoryPrintLayoutResult =
  | { errorMessage: string; pages: null }
  | { errorMessage: null; pages: CustomerInventoryPrintPage[] }

type CustomerInventoryPrintRow = {
  batch: CustomerInventoryPrintBatch
  batchItemIndex: number
  globalItemIndex: number
  item: CustomerInventoryStockItem
}

export function getDefaultCustomerInventoryPrintGroupLabel(
  batch: CustomerInventoryPrintBatch
) {
  const note = batch.note.trim()

  if (!note) {
    return batch.id
  }

  const delimiterIndex = note.search(/[，,]/)

  if (delimiterIndex < 0) {
    return note
  }

  return note.slice(delimiterIndex + 1).trim() || batch.id
}

export function createCustomerInventoryPrintGroupLabels(
  snapshot: CustomerInventoryPrintSnapshot
): CustomerInventoryPrintGroupLabels {
  return Object.fromEntries(
    snapshot.batches.map((batch) => [
      batch.id,
      getDefaultCustomerInventoryPrintGroupLabel(batch),
    ])
  )
}

export function normalizeCustomerInventoryPrintGroupLabels(
  snapshot: CustomerInventoryPrintSnapshot,
  groupLabels: CustomerInventoryPrintGroupLabels
): CustomerInventoryPrintGroupLabels {
  return Object.fromEntries(
    snapshot.batches.map((batch) => [
      batch.id,
      groupLabels[batch.id]?.trim() ||
        getDefaultCustomerInventoryPrintGroupLabel(batch),
    ])
  )
}

function getCustomerInventoryPrintPriceGroupKey(
  batch: CustomerInventoryPrintBatch
) {
  return [
    batch.aluminumIngotPriceX100,
    batch.pricingTaxIncluded ? 1 : 0,
    batch.bridgeProcessingFeeX100,
    batch.powderProcessingFeeX100,
    batch.billetProcessingFeeX100,
    batch.oxidationProcessingFeeX100,
    batch.electrophoresisProcessingFeeX100,
  ].join(":")
}

export function buildCustomerInventoryPrintTableGroups(
  snapshot: CustomerInventoryPrintSnapshot
): CustomerInventoryPrintTableGroup[] {
  const groups = new Map<string, CustomerInventoryPrintTableGroup>()

  for (const batch of snapshot.batches) {
    const historicalOrderDate = batch.historicalOrderDate?.trim() || null
    const priceGroupKey = getCustomerInventoryPrintPriceGroupKey(batch)
    const groupId = historicalOrderDate
      ? `date:${historicalOrderDate}:price:${priceGroupKey}`
      : `batch:${batch.id}`
    const existingGroup = groups.get(groupId)

    if (existingGroup) {
      existingGroup.batches.push(batch)
      existingGroup.itemCount += batch.itemCount
      existingGroup.totalQuantity += batch.totalQuantity
      continue
    }

    groups.set(groupId, {
      batches: [batch],
      historicalOrderDate,
      id: groupId,
      itemCount: batch.itemCount,
      totalQuantity: batch.totalQuantity,
    })
  }

  return [...groups.values()]
}

function buildCustomerInventoryPrintRows(
  snapshot: CustomerInventoryPrintSnapshot,
  tableGroup: CustomerInventoryPrintTableGroup
): CustomerInventoryPrintRow[] {
  const globalOffsets = new Map<string, number>()
  let globalItemOffset = 0

  for (const batch of snapshot.batches) {
    globalOffsets.set(batch.id, globalItemOffset)
    globalItemOffset += batch.items.length
  }

  return tableGroup.batches.flatMap((batch) =>
    batch.items.map((item, batchItemIndex) => ({
      batch,
      batchItemIndex,
      globalItemIndex: (globalOffsets.get(batch.id) ?? 0) + batchItemIndex,
      item,
    }))
  )
}

function groupCustomerInventoryPrintRowsByBatch(
  rows: CustomerInventoryPrintRow[]
): CustomerInventoryPrintRowGroup[] {
  const rowGroups: CustomerInventoryPrintRowGroup[] = []

  for (const row of rows) {
    const current = rowGroups[rowGroups.length - 1]

    if (current?.batch.id === row.batch.id) {
      current.items.push(row.item)
      current.isLastPart =
        row.batchItemIndex === row.batch.items.length - 1
      continue
    }

    rowGroups.push({
      batch: row.batch,
      isFirstPart: row.batchItemIndex === 0,
      isLastPart: row.batchItemIndex === row.batch.items.length - 1,
      itemOffset: row.globalItemIndex,
      items: [row.item],
    })
  }

  return rowGroups
}

export function paginateCustomerInventoryPrintSnapshot(
  snapshot: CustomerInventoryPrintSnapshot,
  pageCapacity = defaultPageCapacity
): CustomerInventoryPrintPage[] {
  if (pageCapacity <= tableHeaderUnits + tableSummaryUnits) {
    throw new Error("客户库存打印分页容量过小")
  }

  const continuationRows = Math.min(
    minimumContinuationRows,
    Math.max(
      1,
      pageCapacity - tableHeaderUnits - tableSummaryUnits - 1
    )
  )

  const pages: CustomerInventoryPrintPage[] = []
  let currentPage: CustomerInventoryPrintPage = { tables: [] }
  let usedUnits = 0

  function startNewPage() {
    if (currentPage.tables.length > 0) {
      pages.push(currentPage)
    }

    currentPage = { tables: [] }
    usedUnits = 0
  }

  for (const group of buildCustomerInventoryPrintTableGroups(snapshot)) {
    const rows = buildCustomerInventoryPrintRows(snapshot, group)
    let rowOffset = 0

    while (rowOffset < rows.length) {
      const remainingRows = rows.length - rowOffset
      const availableRowUnits = pageCapacity - usedUnits - tableHeaderUnits
      const canFinishOnCurrentPage =
        remainingRows + tableSummaryUnits <= availableRowUnits
      const canFinishOnEmptyPage =
        remainingRows + tableSummaryUnits <= pageCapacity - tableHeaderUnits

      if (
        availableRowUnits < 1 ||
        (!canFinishOnCurrentPage &&
          canFinishOnEmptyPage &&
          (remainingRows <= availableRowUnits ||
            availableRowUnits < continuationRows))
      ) {
        startNewPage()
        continue
      }

      const rowCount = canFinishOnCurrentPage
        ? remainingRows
        : Math.min(
            availableRowUnits,
            Math.max(1, remainingRows - continuationRows)
          )
      const isLastPart = rowCount === remainingRows
      const pageRows = rows.slice(rowOffset, rowOffset + rowCount)

      currentPage.tables.push({
        group,
        isFirstPart: rowOffset === 0,
        isLastPart,
        rowGroups: groupCustomerInventoryPrintRowsByBatch(pageRows),
      })
      usedUnits +=
        tableHeaderUnits + rowCount + (isLastPart ? tableSummaryUnits : 0)
      rowOffset += rowCount

      if (!isLastPart) {
        startNewPage()
      }
    }
  }

  startNewPage()
  return pages
}

export function paginateMeasuredCustomerInventoryPrintSnapshot(
  snapshot: CustomerInventoryPrintSnapshot,
  groupLabels: CustomerInventoryPrintGroupLabels,
  metrics: CustomerInventoryPrintLayoutMetrics
): CustomerInventoryPrintLayoutResult {
  const availableHeight = metrics.pageContentHeight - metrics.pageFixedHeight

  if (!Number.isFinite(availableHeight) || availableHeight <= 0) {
    return { errorMessage: "无法计算客户库存打印页面高度", pages: null }
  }

  const tableGroups = buildCustomerInventoryPrintTableGroups(snapshot)
  const pages: CustomerInventoryPrintPage[] = []
  let currentPage: CustomerInventoryPrintPage = { tables: [] }
  let usedHeight = 0

  function pushCurrentPage() {
    if (currentPage.tables.length > 0) {
      pages.push(currentPage)
    }

    currentPage = { tables: [] }
    usedHeight = 0
  }

  for (const [tableGroupIndex, group] of tableGroups.entries()) {
    const rowGroups = groupCustomerInventoryPrintRowsByBatch(
      buildCustomerInventoryPrintRows(snapshot, group)
    )
    const tableHeaderHeight = metrics.tableHeaderHeights[group.id]
    const tableSummaryHeight = metrics.tableSummaryHeights[group.id]

    if (
      !Number.isFinite(tableHeaderHeight) ||
      !Number.isFinite(tableSummaryHeight)
    ) {
      return { errorMessage: "无法计算客户库存日期表高度", pages: null }
    }

    let rowGroupIndex = 0

    while (rowGroupIndex < rowGroups.length) {
      const isFirstPart = rowGroupIndex === 0
      const table: CustomerInventoryPrintTable = {
        group,
        isFirstPart,
        isLastPart: false,
        rowGroups: [],
      }

      if (usedHeight + tableHeaderHeight > availableHeight) {
        pushCurrentPage()
      }

      currentPage.tables.push(table)
      usedHeight += tableHeaderHeight

      while (rowGroupIndex < rowGroups.length) {
        const rowGroup = rowGroups[rowGroupIndex]
        const batchHeight = metrics.batchHeights[rowGroup.batch.id]
        const isLastRowGroup = rowGroupIndex === rowGroups.length - 1
        const isLastTableGroup = tableGroupIndex === tableGroups.length - 1
        const isLastBatch = isLastRowGroup && isLastTableGroup
        const tableTailHeight = isLastRowGroup
          ? tableSummaryHeight
          : metrics.continuedHeight
        const grandTotalHeight = isLastBatch ? metrics.grandTotalHeight : 0

        if (!Number.isFinite(batchHeight)) {
          return {
            errorMessage: `无法计算批次 ${rowGroup.batch.id} 的打印高度`,
            pages: null,
          }
        }

        if (
          usedHeight +
            batchHeight +
            tableTailHeight +
            grandTotalHeight <=
          availableHeight
        ) {
          table.rowGroups.push(rowGroup)
          usedHeight += batchHeight
          rowGroupIndex += 1

          if (isLastRowGroup) {
            table.isLastPart = true
            usedHeight += tableSummaryHeight

            if (isLastBatch) {
              usedHeight += metrics.grandTotalHeight
            }
          }

          continue
        }

        if (
          isLastBatch &&
          usedHeight + batchHeight + tableTailHeight <= availableHeight
        ) {
          table.rowGroups.push(rowGroup)
          table.isLastPart = true
          usedHeight += batchHeight + tableSummaryHeight
          rowGroupIndex += 1
          pushCurrentPage()
          pages.push({ tables: [] })
          break
        }

        if (table.rowGroups.length > 0) {
          usedHeight += metrics.continuedHeight
          pushCurrentPage()
          break
        }

        if (currentPage.tables.length > 1) {
          currentPage.tables.pop()
          usedHeight -= tableHeaderHeight
          pushCurrentPage()
          break
        }

        const requiredGroupHeight =
          tableHeaderHeight +
          batchHeight +
          (isLastRowGroup ? tableSummaryHeight : metrics.continuedHeight)

        if (requiredGroupHeight > availableHeight) {
          const groupLabel =
            groupLabels[rowGroup.batch.id]?.trim() ||
            getDefaultCustomerInventoryPrintGroupLabel(rowGroup.batch)

          return {
            errorMessage: `批次 ${rowGroup.batch.id} 的分组“${groupLabel}”共有 ${rowGroup.items.length} 条明细，无法完整放入一张 A4，请拆分批次后重新打印`,
            pages: null,
          }
        }

        table.rowGroups.push(rowGroup)
        table.isLastPart = isLastRowGroup
        usedHeight += batchHeight +
          (isLastRowGroup ? tableSummaryHeight : metrics.continuedHeight)
        rowGroupIndex += 1

        if (isLastBatch) {
          pushCurrentPage()
          pages.push({ tables: [] })
        } else if (!isLastRowGroup) {
          pushCurrentPage()
        }

        break
      }
    }
  }

  pushCurrentPage()
  return { errorMessage: null, pages }
}
