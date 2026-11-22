import {
  getDefaultCustomerInventoryPrintGroupLabel,
  paginateMeasuredCustomerInventoryPrintSnapshot,
  paginateCustomerInventoryPrintSnapshot,
  type CustomerInventoryPrintGroupLabels,
  type CustomerInventoryPrintLayoutMetrics,
  type CustomerInventoryPrintLayoutResult,
  type CustomerInventoryPrintPage,
  type CustomerInventoryPrintTableGroup,
} from "@/features/inventory/lib/customer-inventory-print"
import type { CustomerInventoryPrintSnapshot } from "@/features/inventory/types"
import { formatAppDateTime } from "@/lib/datetime"
import { formatCurrencyX100 } from "@/lib/money"
import {
  getProcessingCategoryQuantityItems,
  processingCategories,
  processingFeeSnapshotKeys,
} from "@/lib/processing-fees"
import { useEffect, useMemo, useRef, useState } from "react"

export function PrintCustomerInventoryView({
  groupLabels,
  onLayoutResult,
  pages,
  snapshot,
  variant,
}: {
  groupLabels: CustomerInventoryPrintGroupLabels
  onLayoutResult?: (result: CustomerInventoryPrintLayoutResult) => void
  pages?: CustomerInventoryPrintPage[] | null
  snapshot: CustomerInventoryPrintSnapshot
  variant: "preview" | "print"
}) {
  const fallbackPages = useMemo(
    () => paginateCustomerInventoryPrintSnapshot(snapshot),
    [snapshot]
  )
  const [measuredPages, setMeasuredPages] =
    useState<CustomerInventoryPrintPage[] | null>(null)
  const renderedPages = pages ?? measuredPages ?? fallbackPages
  const rootRef = useRef<HTMLElement>(null)
  const layoutAttemptRef = useRef(0)
  const pageHeightAdjustmentRef = useRef(0)
  const categoryQuantityItems = getProcessingCategoryQuantityItems(
    snapshot.batches.flatMap((batch) => batch.items)
  )
  const generatedAt = formatAppDateTime(snapshot.generatedAt)

  useEffect(() => {
    setMeasuredPages(null)
    layoutAttemptRef.current = 0
    pageHeightAdjustmentRef.current = 0
  }, [groupLabels, snapshot])

  useEffect(() => {
    if (!onLayoutResult || pages) {
      return
    }

    let cancelled = false
    const layoutResultHandler = onLayoutResult

    async function measureLayout() {
      await document.fonts.ready
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

      if (cancelled || !rootRef.current) {
        return
      }

      const metrics = readCustomerInventoryPrintLayoutMetrics(rootRef.current)

      if (!metrics) {
        layoutResultHandler({
          errorMessage: "无法测量客户库存打印版式，请重新打开预览",
          pages: null,
        })
        return
      }

      if (measuredPages) {
        const overflowHeight = readCustomerInventoryPrintOverflowHeight(
          rootRef.current
        )

        if (overflowHeight <= 1) {
          layoutResultHandler({ errorMessage: null, pages: measuredPages })
          return
        }

        pageHeightAdjustmentRef.current += overflowHeight + 1
      }

      metrics.pageContentHeight -= pageHeightAdjustmentRef.current
      const result = paginateMeasuredCustomerInventoryPrintSnapshot(
        snapshot,
        groupLabels,
        metrics
      )

      if (result.errorMessage) {
        layoutResultHandler(result)
        return
      }

      layoutAttemptRef.current += 1

      if (layoutAttemptRef.current > 6) {
        layoutResultHandler({
          errorMessage: "客户库存无法在 A4 内完成自动分页，请检查分组内容",
          pages: null,
        })
        return
      }

      setMeasuredPages(result.pages)
    }

    void measureLayout()

    return () => {
      cancelled = true
    }
  }, [groupLabels, measuredPages, onLayoutResult, pages, snapshot])

  return (
    <article
      className={
        variant === "print"
          ? "print-order print-delivery-note print-customer-inventory print-order--print"
          : "print-order print-delivery-note print-customer-inventory"
      }
      ref={rootRef}
    >
      {renderedPages.map((page, pageIndex) => {
        const isLastPage = pageIndex === renderedPages.length - 1

        return (
          <section className="print-order__page" key={pageIndex}>
            <header className="print-order__header">
              <h1>山东虎标轻合金有限公司</h1>
              <div>客户库存清单</div>
            </header>
            <section className="print-order__meta">
              <div>
                <span>客户名称</span>
                <strong>{snapshot.customerName}</strong>
              </div>
              <div>
                <span>库存批次</span>
                <strong>{snapshot.batches.length} 批</strong>
              </div>
              <div>
                <span>库存明细</span>
                <strong>{snapshot.itemCount} 条</strong>
              </div>
              <div>
                <span>当前库存</span>
                <strong>{snapshot.totalQuantity} 支</strong>
              </div>
              <div className="print-delivery-note__meta-address">
                <span>客户地址</span>
                <strong>{snapshot.customerAddress || "-"}</strong>
              </div>
              <div className="print-customer-inventory__generated-at">
                <span>截至时间</span>
                <strong>{generatedAt}</strong>
              </div>
            </section>

            {page.tables.map((table) => (
              <section
                className="print-customer-inventory__date-group"
                data-customer-inventory-table-group={table.group.id}
                key={`${table.group.id}-${table.rowGroups[0]?.itemOffset ?? 0}`}
              >
                <div className="print-customer-inventory__date-meta">
                  <div className="print-customer-inventory__date-summary">
                    <strong>
                      {table.group.historicalOrderDate
                        ? `历史下单日期：${table.group.historicalOrderDate}`
                        : `历史日期未记录：${table.group.batches[0]?.id ?? "-"}`}
                      {!table.isFirstPart && "（续）"}
                    </strong>
                    <span>{table.group.batches.length} 个批次</span>
                    <span>{table.group.itemCount} 条明细</span>
                    <span>{table.group.totalQuantity} 支库存</span>
                  </div>
                  <CustomerInventoryPrintPriceSummary group={table.group} />
                </div>
                <table className="print-order__table print-customer-inventory__table">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>商品</th>
                      <th>模具编号</th>
                      <th>长度(mm)</th>
                      <th>颜色</th>
                      <th>当前库存(支)</th>
                      <th>备注</th>
                      <th>分组</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rowGroups.flatMap((rowGroup) =>
                      rowGroup.items.map((item, itemIndex) => (
                        <tr
                          data-customer-inventory-print-batch={rowGroup.batch.id}
                          key={item.id}
                        >
                          <td>{rowGroup.itemOffset + itemIndex + 1}</td>
                          <td>{item.productName}</td>
                          <td>{item.moldCode}</td>
                          <td className="print-order__number">
                            {item.lengthMm}
                          </td>
                          <td>{item.color}</td>
                          <td className="print-order__number">
                            {item.quantity}
                          </td>
                          <td>{item.note}</td>
                          {itemIndex === 0 && (
                            <td
                              className="print-customer-inventory__group-cell"
                              rowSpan={rowGroup.items.length}
                            >
                              <strong>
                                {groupLabels[rowGroup.batch.id]?.trim() ||
                                  getDefaultCustomerInventoryPrintGroupLabel(
                                    rowGroup.batch
                                  )}
                                {!rowGroup.isFirstPart && "（续）"}
                              </strong>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {table.isLastPart && (
                    <tfoot>
                      <tr className="print-delivery-note__table-summary">
                        <td colSpan={8}>
                          <CustomerInventoryDateGroupSummary
                            group={table.group}
                          />
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {!table.isLastPart && (
                  <div className="print-order__continued">本日期库存续下页</div>
                )}
              </section>
            ))}

            {isLastPage && (
              <section className="print-delivery-note__totals print-customer-inventory__grand-total">
                <div className="print-delivery-note__totals-row">
                  <span>
                    批次总数<strong>{snapshot.batches.length}</strong>批
                  </span>
                  <span>
                    明细总数<strong>{snapshot.itemCount}</strong>条
                  </span>
                  {categoryQuantityItems.map((item) => (
                    <span key={item.label}>
                      {item.label}<strong>{item.value}</strong>支
                    </span>
                  ))}
                  <span className="print-delivery-note__totals-emphasis">
                    当前库存合计<strong>{snapshot.totalQuantity}</strong>支
                  </span>
                </div>
              </section>
            )}

            <footer className="print-order__footer">
              {isLastPage ? <span>客户确认：</span> : <span />}
              {isLastPage ? <span>制表人：</span> : <span />}
              <span>
                第 {pageIndex + 1} / {renderedPages.length} 页
              </span>
              <span>打印时间：{generatedAt}</span>
            </footer>
          </section>
        )
      })}
      {onLayoutResult && !pages && (
        <div
          aria-hidden="true"
          className="print-order__continued print-customer-inventory__continued-measure"
        >
          本日期库存续下页
        </div>
      )}
    </article>
  )
}

function CustomerInventoryPrintPriceSummary({
  group,
}: {
  group: CustomerInventoryPrintTableGroup
}) {
  const batch = group.batches[0]
  const processingFees = processingCategories
    .map((category) => ({
      label: `${category.label}加工费`,
      value: batch[processingFeeSnapshotKeys[category.key]],
    }))
    .filter((item) => item.value > 0)

  return (
    <div className="print-customer-inventory__price-meta">
      <span>
        铝锭价<strong>{formatCurrencyX100(batch.aluminumIngotPriceX100)}</strong>
      </span>
      <span>
        计价方式<strong>{batch.pricingTaxIncluded ? "含税" : "不含税"}</strong>
      </span>
      {processingFees.map((item) => (
        <span key={item.label}>
          {item.label}<strong>{formatCurrencyX100(item.value)}</strong>
        </span>
      ))}
    </div>
  )
}

function readCustomerInventoryPrintLayoutMetrics(
  root: HTMLElement
): CustomerInventoryPrintLayoutMetrics | null {
  const page = root.querySelector<HTMLElement>(".print-order__page")
  const header = page?.querySelector<HTMLElement>(".print-order__header")
  const meta = page?.querySelector<HTMLElement>(".print-order__meta")
  const footer = page?.querySelector<HTMLElement>(".print-order__footer")
  const grandTotal = root.querySelector<HTMLElement>(
    ".print-customer-inventory__grand-total"
  )
  const continued = root.querySelector<HTMLElement>(
    ".print-customer-inventory__continued-measure"
  )

  if (!page || !header || !meta || !footer || !grandTotal || !continued) {
    return null
  }

  const pageStyle = window.getComputedStyle(page)
  const pageMinHeight = Number.parseFloat(pageStyle.minHeight)
  const pageContentHeight =
    pageMinHeight -
    Number.parseFloat(pageStyle.paddingTop) -
    Number.parseFloat(pageStyle.paddingBottom)
  const tableHeaderHeights: Record<string, number> = {}
  const tableSummaryHeights: Record<string, number> = {}
  const batchHeights: Record<string, number> = {}

  for (const tableGroup of root.querySelectorAll<HTMLElement>(
    "[data-customer-inventory-table-group]"
  )) {
    const groupId = tableGroup.dataset.customerInventoryTableGroup
    const dateMeta = tableGroup.querySelector<HTMLElement>(
      ".print-customer-inventory__date-meta"
    )
    const tableHeader = tableGroup.querySelector<HTMLElement>("thead")
    const tableSummary = tableGroup.querySelector<HTMLElement>("tfoot")

    if (!groupId || !dateMeta || !tableHeader) {
      return null
    }

    if (tableHeaderHeights[groupId] === undefined) {
      tableHeaderHeights[groupId] =
        Number.parseFloat(window.getComputedStyle(tableGroup).marginTop) +
        dateMeta.getBoundingClientRect().height +
        tableHeader.getBoundingClientRect().height
    }

    if (tableSummary) {
      tableSummaryHeights[groupId] = tableSummary.getBoundingClientRect().height
    }
  }

  for (const row of root.querySelectorAll<HTMLElement>(
    "[data-customer-inventory-print-batch]"
  )) {
    const batchId = row.dataset.customerInventoryPrintBatch

    if (batchId) {
      batchHeights[batchId] =
        (batchHeights[batchId] ?? 0) + row.getBoundingClientRect().height
    }
  }

  return {
    batchHeights,
    continuedHeight: continued.getBoundingClientRect().height,
    grandTotalHeight: getOuterHeight(grandTotal),
    pageContentHeight,
    pageFixedHeight:
      header.getBoundingClientRect().height +
      meta.getBoundingClientRect().height +
      footer.getBoundingClientRect().height,
    tableHeaderHeights,
    tableSummaryHeights,
  }
}

function readCustomerInventoryPrintOverflowHeight(root: HTMLElement) {
  return Math.max(
    0,
    ...[...root.querySelectorAll<HTMLElement>(".print-order__page")].map(
      (page) => {
        const minHeight = Number.parseFloat(
          window.getComputedStyle(page).minHeight
        )

        return page.getBoundingClientRect().height - minHeight
      }
    )
  )
}

function getOuterHeight(element: HTMLElement) {
  const style = window.getComputedStyle(element)

  return (
    element.getBoundingClientRect().height +
    Number.parseFloat(style.marginTop) +
    Number.parseFloat(style.marginBottom)
  )
}

function CustomerInventoryDateGroupSummary({
  group,
}: {
  group: CustomerInventoryPrintTableGroup
}) {
  const categoryQuantityItems = getProcessingCategoryQuantityItems(
    group.batches.flatMap((batch) => batch.items)
  )

  return (
    <div className="print-delivery-note__totals-row">
      <span>
        日期批次<strong>{group.batches.length}</strong>批
      </span>
      <span>
        日期明细<strong>{group.itemCount}</strong>条
      </span>
      {categoryQuantityItems.map((item) => (
        <span key={item.label}>
          {item.label}<strong>{item.value}</strong>支
        </span>
      ))}
      <span className="print-delivery-note__totals-emphasis">
        日期库存<strong>{group.totalQuantity}</strong>支
      </span>
    </div>
  )
}
