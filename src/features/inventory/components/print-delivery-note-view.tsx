import {
  getMergedDeliveryNotePrintRows,
} from "@/features/inventory/lib/inventory-utils"
import type {
  DeliveryNote,
  DeliveryNoteItem,
  MergedDeliveryNote,
  MergedDeliveryNoteItem,
  MergedDeliveryNotePriceGroup,
} from "@/features/inventory/types"
import { formatAppDateTime } from "@/lib/datetime"
import { formatTheoreticalWeightKg } from "@/lib/measurement"
import { formatCurrencyX100 } from "@/lib/money"
import {
  getProcessingCategoryFromColor,
  getProcessingCategoryLabel,
  processingCategories,
  type ProcessingCategory,
} from "@/lib/processing-fees"

const PRINT_DELIVERY_NOTE_ITEMS_PER_PAGE = 36
const PRINT_MERGED_DELIVERY_NOTE_ITEMS_PER_PAGE = 36
const PRINT_MERGED_DELIVERY_NOTE_PAGE_UNITS = 44
const PRINT_MERGED_DELIVERY_NOTE_CONTINUED_SECTION_UNITS = 2
const PRINT_MERGED_DELIVERY_NOTE_FINAL_SECTION_UNITS = 8
const PRINT_MERGED_DELIVERY_NOTE_GRAND_TOTAL_UNITS = 7

type DeliveryPriceSnapshot = Pick<
  DeliveryNote,
  | "aluminumIngotPriceX100"
  | "billetProcessingFeeX100"
  | "billetWeightKgX100"
  | "bridgeProcessingFeeX100"
  | "bridgeWeightKgX100"
  | "electrophoresisProcessingFeeX100"
  | "electrophoresisWeightKgX100"
  | "extraCharges"
  | "oxidationProcessingFeeX100"
  | "oxidationWeightKgX100"
  | "powderProcessingFeeX100"
  | "powderWeightKgX100"
>

const chineseCurrencyDigits = [
  "零",
  "壹",
  "贰",
  "叁",
  "肆",
  "伍",
  "陆",
  "柒",
  "捌",
  "玖",
]
const chineseCurrencySectionUnits = ["", "万", "亿", "兆"]
const chineseCurrencyUnits = ["", "拾", "佰", "仟"]

function formatDateTime(value: string) {
  return formatAppDateTime(value, { includeYear: true })
}

function formatPricingProfileName(value: string) {
  const trimmedValue = value.trim() || "默认价"

  return trimmedValue.endsWith("价") ? trimmedValue.slice(0, -1) : trimmedValue
}

function formatChineseCurrencyX100(value: number) {
  const normalizedValue = Math.max(0, Math.round(value))
  const yuan = Math.floor(normalizedValue / 100)
  const jiao = Math.floor((normalizedValue % 100) / 10)
  const fen = normalizedValue % 10
  let result = `人民币${formatChineseInteger(yuan)}元`

  if (jiao === 0 && fen === 0) {
    return `${result}整`
  }

  if (jiao > 0) {
    result += `${chineseCurrencyDigits[jiao]}角`
  } else if (fen > 0) {
    result += "零"
  }

  if (fen > 0) {
    result += `${chineseCurrencyDigits[fen]}分`
  }

  return result
}

function formatChineseInteger(value: number) {
  if (value === 0) {
    return chineseCurrencyDigits[0]
  }

  let sectionIndex = 0
  let remainingValue = value
  let result = ""
  let shouldInsertZero = false

  while (remainingValue > 0) {
    const section = remainingValue % 10000

    if (section === 0) {
      shouldInsertZero = result.length > 0
    } else {
      const sectionText =
        formatChineseSection(section) + chineseCurrencySectionUnits[sectionIndex]

      if (shouldInsertZero || (section < 1000 && result.length > 0)) {
        result = `${chineseCurrencyDigits[0]}${result}`
      }

      result = `${sectionText}${result}`
      shouldInsertZero = false
    }

    remainingValue = Math.floor(remainingValue / 10000)
    sectionIndex += 1
  }

  return result
}

function formatChineseSection(value: number) {
  let remainingValue = value
  let unitIndex = 0
  let result = ""
  let shouldInsertZero = false

  while (remainingValue > 0) {
    const digit = remainingValue % 10

    if (digit === 0) {
      if (result.length > 0) {
        shouldInsertZero = true
      }
    } else {
      const digitText = `${chineseCurrencyDigits[digit]}${chineseCurrencyUnits[unitIndex]}`
      result = shouldInsertZero
        ? `${digitText}${chineseCurrencyDigits[0]}${result}`
        : `${digitText}${result}`
      shouldInsertZero = false
    }

    remainingValue = Math.floor(remainingValue / 10)
    unitIndex += 1
  }

  return result
}

function getProcessingFeeX100(
  deliveryNote: DeliveryPriceSnapshot,
  category: ProcessingCategory
) {
  if (category === "billet") {
    return deliveryNote.billetProcessingFeeX100
  }

  if (category === "bridge") {
    return deliveryNote.bridgeProcessingFeeX100
  }

  if (category === "oxidation") {
    return deliveryNote.oxidationProcessingFeeX100
  }

  if (category === "electrophoresis") {
    return deliveryNote.electrophoresisProcessingFeeX100
  }

  return deliveryNote.powderProcessingFeeX100
}

function getWeightKgX100(
  deliveryNote: DeliveryPriceSnapshot,
  category: ProcessingCategory
) {
  if (category === "billet") {
    return deliveryNote.billetWeightKgX100
  }

  if (category === "bridge") {
    return deliveryNote.bridgeWeightKgX100
  }

  if (category === "oxidation") {
    return deliveryNote.oxidationWeightKgX100
  }

  if (category === "electrophoresis") {
    return deliveryNote.electrophoresisWeightKgX100
  }

  return deliveryNote.powderWeightKgX100
}

function chunkDeliveryNoteItems(items: DeliveryNoteItem[]) {
  const pages: DeliveryNoteItem[][] = []

  for (
    let index = 0;
    index < items.length;
    index += PRINT_DELIVERY_NOTE_ITEMS_PER_PAGE
  ) {
    pages.push(items.slice(index, index + PRINT_DELIVERY_NOTE_ITEMS_PER_PAGE))
  }

  return pages.length > 0 ? pages : [[]]
}

type DeliveryNotePrintRow = DeliveryNoteItem & {
  groupRowSpan: number
  showGroup: boolean
}

function getDeliveryNoteItemGroup(item: DeliveryNoteItem) {
  return (
    item.groupLabel?.trim() ||
    item.sourceBatchNote?.trim() ||
    item.sourceBatchId?.trim() ||
    ""
  )
}

function getDeliveryNotePrintRows(items: DeliveryNoteItem[]): DeliveryNotePrintRow[] {
  return items.map((item, index) => {
    const group = getDeliveryNoteItemGroup(item)

    if (!group) {
      return { ...item, groupRowSpan: 0, showGroup: false }
    }

    const previousGroup = items[index - 1]
      ? getDeliveryNoteItemGroup(items[index - 1])
      : ""
    if (previousGroup === group) {
      return { ...item, groupRowSpan: 0, showGroup: false }
    }

    let rowSpan = 1
    for (
      let nextIndex = index + 1;
      nextIndex < items.length &&
      getDeliveryNoteItemGroup(items[nextIndex]) === group;
      nextIndex += 1
    ) {
      rowSpan += 1
    }

    return { ...item, groupRowSpan: rowSpan, showGroup: true }
  })
}

function chunkMergedDeliveryNoteItems(items: MergedDeliveryNoteItem[]) {
  const pages: MergedDeliveryNoteItem[][] = []

  for (
    let index = 0;
    index < items.length;
    index += PRINT_MERGED_DELIVERY_NOTE_ITEMS_PER_PAGE
  ) {
    pages.push(items.slice(index, index + PRINT_MERGED_DELIVERY_NOTE_ITEMS_PER_PAGE))
  }

  return pages.length > 0 ? pages : [[]]
}

type MergedDeliveryNotePrintSection = {
  itemOffset: number
  items: MergedDeliveryNoteItem[]
  pageIndex: number
  priceGroup: MergedDeliveryNotePriceGroup
  totalPagesInSection: number
}

type MergedDeliveryNotePrintPage = {
  sections: MergedDeliveryNotePrintSection[]
}

function paginateSingleMergedDeliveryNotePriceGroup(
  priceGroup: MergedDeliveryNotePriceGroup,
): MergedDeliveryNotePrintPage[] {
  const itemPages = chunkMergedDeliveryNoteItems(priceGroup.items)

  return itemPages.map((items, pageIndex) => ({
    sections: [
      {
        itemOffset: pageIndex * PRINT_MERGED_DELIVERY_NOTE_ITEMS_PER_PAGE,
        items,
        pageIndex,
        priceGroup,
        totalPagesInSection: itemPages.length,
      },
    ],
  }))
}

function paginateMergedDeliveryNotePriceGroups(
  priceGroups: MergedDeliveryNotePriceGroup[],
): MergedDeliveryNotePrintPage[] {
  if (priceGroups.length <= 1) {
    return priceGroups.flatMap(paginateSingleMergedDeliveryNotePriceGroup)
  }

  const pages: MergedDeliveryNotePrintPage[] = []
  let currentPage: MergedDeliveryNotePrintPage = { sections: [] }
  let remainingPageUnits = PRINT_MERGED_DELIVERY_NOTE_PAGE_UNITS
  const sectionsByPriceGroup = new Map<string, MergedDeliveryNotePrintSection[]>()

  function pushCurrentPage() {
    if (currentPage.sections.length > 0) {
      pages.push(currentPage)
      currentPage = { sections: [] }
      remainingPageUnits = PRINT_MERGED_DELIVERY_NOTE_PAGE_UNITS
    }
  }

  function addSection(section: MergedDeliveryNotePrintSection) {
    currentPage.sections.push(section)

    const priceGroupSections =
      sectionsByPriceGroup.get(section.priceGroup.id) ?? []
    priceGroupSections.push(section)
    sectionsByPriceGroup.set(section.priceGroup.id, priceGroupSections)
  }

  priceGroups.forEach((priceGroup, priceGroupIndex) => {
    const isLastPriceGroup = priceGroupIndex === priceGroups.length - 1
    let itemOffset = 0
    let sectionPageIndex = 0
    let renderedEmptySection = false

    while (
      itemOffset < priceGroup.items.length ||
      (!renderedEmptySection && priceGroup.items.length === 0)
    ) {
      const remainingItems = priceGroup.items.length - itemOffset
      const finalSectionUnits =
        PRINT_MERGED_DELIVERY_NOTE_FINAL_SECTION_UNITS +
        (isLastPriceGroup ? PRINT_MERGED_DELIVERY_NOTE_GRAND_TOTAL_UNITS : 0)
      const canFitFinalSection =
        remainingItems + finalSectionUnits <= remainingPageUnits

      if (canFitFinalSection) {
        addSection({
          itemOffset,
          items: priceGroup.items.slice(itemOffset),
          pageIndex: sectionPageIndex,
          priceGroup,
          totalPagesInSection: 0,
        })
        remainingPageUnits -= remainingItems + finalSectionUnits
        itemOffset = priceGroup.items.length
        renderedEmptySection = true
        break
      }

      const continuedItemCapacity =
        remainingPageUnits - PRINT_MERGED_DELIVERY_NOTE_CONTINUED_SECTION_UNITS
      const itemsToTake = Math.min(remainingItems - 1, continuedItemCapacity)

      if (itemsToTake <= 0) {
        pushCurrentPage()
        continue
      }

      addSection({
        itemOffset,
        items: priceGroup.items.slice(itemOffset, itemOffset + itemsToTake),
        pageIndex: sectionPageIndex,
        priceGroup,
        totalPagesInSection: 0,
      })
      itemOffset += itemsToTake
      sectionPageIndex += 1
      remainingPageUnits = 0
      pushCurrentPage()
    }
  })

  pushCurrentPage()

  for (const priceGroupSections of sectionsByPriceGroup.values()) {
    priceGroupSections.forEach((section) => {
      section.totalPagesInSection = priceGroupSections.length
    })
  }

  return pages
}

function getDeliveryPaymentSummary(deliveryNote: DeliveryPriceSnapshot) {
  const paymentItems = processingCategories
    .map((category) => {
      const weightKgX100 = getWeightKgX100(deliveryNote, category.key)
      const processingFeeX100 = getProcessingFeeX100(deliveryNote, category.key)

      return {
        amountX100: Math.round(
          (weightKgX100 *
            (deliveryNote.aluminumIngotPriceX100 + processingFeeX100)) /
            100000
        ),
        label: category.label,
        processingFeeX100,
        weightKgX100,
      }
    })
    .filter((item) => item.weightKgX100 > 0)
  const extraChargePaymentItems = deliveryNote.extraCharges.map(
    (row) => ({ amountX100: row.amountX100, label: row.name }),
  )
  const extraChargeAmountX100 = extraChargePaymentItems.reduce(
    (total, row) => total + row.amountX100,
    0,
  )
  const goodsPaymentAmountX100 = paymentItems.reduce(
    (total, item) => total + item.amountX100,
    0
  )
  const paymentAmountX100 =
    goodsPaymentAmountX100 + extraChargeAmountX100

  return {
    extraChargePaymentItems,
    extraChargeAmountX100,
    goodsPaymentAmountX100,
    paymentAmountX100,
    paymentItems,
  }
}

export function PrintDeliveryNoteView({
  deliveryNote,
  totalQuantity,
  variant,
}: {
  deliveryNote: DeliveryNote
  totalQuantity: number
  variant: "preview" | "print"
}) {
  const totalWeightKgX100 =
    deliveryNote.bridgeWeightKgX100 +
    deliveryNote.powderWeightKgX100 +
    deliveryNote.billetWeightKgX100 +
    deliveryNote.oxidationWeightKgX100 +
    deliveryNote.electrophoresisWeightKgX100
  const paymentSummary = getDeliveryPaymentSummary(deliveryNote)
  const quantityGroups = deliveryNote.items.reduce(
    (groups, item) => {
      const category = getProcessingCategoryFromColor(item.color)

      groups[category] += item.quantity

      return groups
    },
    {
      billet: 0,
      bridge: 0,
      electrophoresis: 0,
      oxidation: 0,
      powder: 0,
    } satisfies Record<ProcessingCategory, number>
  )
  const weightItems = processingCategories
    .map((category) => ({
      label: `${category.label}重量`,
      value: getWeightKgX100(deliveryNote, category.key),
    }))
    .filter((item) => item.value > 0)
  const quantityItems = processingCategories
    .map((category) => ({
      label: getProcessingCategoryLabel(category.key),
      value: quantityGroups[category.key],
    }))
    .filter((item) => item.value > 0)
  const itemPages = chunkDeliveryNoteItems(deliveryNote.items)
  const printTime = formatDateTime(new Date().toISOString())
  const isHistoricalInventory = deliveryNote.id !== deliveryNote.orderId
  const showGroupColumn = deliveryNote.items.some((item) =>
    Boolean(getDeliveryNoteItemGroup(item)),
  )
  const tableColumnCount = showGroupColumn ? 9 : 8

  return (
    <article
      className={
        variant === "print"
          ? "print-order print-delivery-note print-order--print"
          : "print-order print-delivery-note"
      }
    >
      {itemPages.map((items, pageIndex) => {
        const isLastPage = pageIndex === itemPages.length - 1
        const itemOffset = pageIndex * PRINT_DELIVERY_NOTE_ITEMS_PER_PAGE
        const printRows = getDeliveryNotePrintRows(items)

        return (
          <section className="print-order__page" key={pageIndex}>
            <header className="print-order__header">
              <h1>山东虎标轻合金有限公司</h1>
              <div>出库单</div>
            </header>

            <section className="print-order__meta">
              <div>
                <span>客户名称</span>
                <strong>{deliveryNote.customerName}</strong>
              </div>
              <div>
                <span>出库日期</span>
                <strong>{deliveryNote.deliveryDate}</strong>
              </div>
              <div>
                <span>{isHistoricalInventory ? "出库单号" : "订单编号"}</span>
                <strong>
                  {isHistoricalInventory ? deliveryNote.id : deliveryNote.orderId}
                </strong>
              </div>
              <div>
                <span>经手人</span>
                <strong>{deliveryNote.handlerName || "-"}</strong>
              </div>
              <div>
                <span>铝锭价</span>
                <strong>
                  {formatCurrencyX100(deliveryNote.aluminumIngotPriceX100)}
                </strong>
              </div>
              <div>
                <span>计价方式</span>
                <strong>
                  {deliveryNote.pricingTaxIncluded ? "含税" : "不含税"}
                </strong>
              </div>
              <div className="print-delivery-note__meta-address">
                <span>客户地址</span>
                <strong>{deliveryNote.customerAddress || "-"}</strong>
              </div>
              <div>
                <span>计价方案</span>
                <strong>
                  {formatPricingProfileName(deliveryNote.pricingProfileName)}
                </strong>
              </div>
            </section>

            <table
              className={
                showGroupColumn
                  ? "print-order__table print-delivery-note__table print-merged-delivery-note__table--grouped"
                  : "print-order__table print-delivery-note__table"
              }
            >
              <thead>
                <tr>
                  <th>序号</th>
                  <th>商品</th>
                  <th>模具编号</th>
                  <th>长度(mm)</th>
                  <th>颜色</th>
                  <th>下单数量</th>
                  <th>出库数量(支)</th>
                  <th>备注</th>
                  {showGroupColumn && <th>分组</th>}
                </tr>
              </thead>
              <tbody>
                {printRows.map((item, index) => (
                  <tr key={item.id}>
                    <td>{itemOffset + index + 1}</td>
                    <td>{item.productName}</td>
                    <td>{item.moldCode}</td>
                    <td className="print-order__number">{item.lengthMm}</td>
                    <td>{item.color}</td>
                    <td className="print-order__number">
                      {item.orderQuantity}
                    </td>
                    <td className="print-order__number">{item.quantity}</td>
                    <td>{item.note}</td>
                    {showGroupColumn && item.showGroup && (
                      <td rowSpan={item.groupRowSpan}>
                        {getDeliveryNoteItemGroup(item)}
                      </td>
                    )}
                    {showGroupColumn &&
                      !item.showGroup &&
                      !getDeliveryNoteItemGroup(item) && <td />}
                  </tr>
                ))}
              </tbody>
              {isLastPage && (
                <tfoot>
                  <tr className="print-delivery-note__table-summary">
                    <td colSpan={tableColumnCount}>
                      <div className="print-delivery-note__totals-row">
                        <span>
                          商品总数
                          <strong>{deliveryNote.items.length}</strong>
                        </span>
                        {quantityItems.map((item) => (
                          <span key={item.label}>
                            {item.label}
                            <strong>{item.value}</strong>
                            支
                          </span>
                        ))}
                        <span>
                          数量合计
                          <strong>{totalQuantity}</strong>
                          支
                        </span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>

            {isLastPage ? (
              <>
                <section className="print-delivery-note__totals">
                  {(weightItems.length > 0 || totalWeightKgX100 > 0) && (
                    <div className="print-delivery-note__totals-row">
                      {weightItems.map((item) => (
                        <span key={item.label}>
                          {item.label}
                          <strong>
                            {formatTheoreticalWeightKg(item.value)}
                          </strong>
                          kg
                        </span>
                      ))}
                      {totalWeightKgX100 > 0 && (
                        <span className="print-delivery-note__totals-emphasis">
                          重量合计
                          <strong>
                            {formatTheoreticalWeightKg(totalWeightKgX100)}
                          </strong>
                          kg
                        </span>
                      )}
                    </div>
                  )}
                </section>

                <section className="print-delivery-note__payment">
                  <DeliveryPaymentBreakdown summary={paymentSummary} />
                  <div className="print-delivery-note__payment-upper">
                    <span>应收合计大写</span>
                    <strong>
                      {formatChineseCurrencyX100(
                        paymentSummary.paymentAmountX100
                      )}
                    </strong>
                  </div>
                  <div className="print-delivery-note__payment-lower">
                    <span>应收合计小写</span>
                    <strong>
                      {formatCurrencyX100(paymentSummary.paymentAmountX100)}
                    </strong>
                  </div>
                </section>

                <section className="print-order__note">
                  <span>备注：</span>
                  <p>{deliveryNote.note}</p>
                </section>
                <DeliverySpecialNoteBlock specialNote={deliveryNote.specialNote} />
              </>
            ) : (
              <div className="print-order__continued">续下页</div>
            )}

            <footer className="print-order__footer">
              {isLastPage ? <span>客户签收：</span> : <span />}
              {isLastPage ? <span>发货人：</span> : <span />}
              <span>
                第 {pageIndex + 1} / {itemPages.length} 页
              </span>
              <span>打印时间：{printTime}</span>
            </footer>
          </section>
        )
      })}
    </article>
  )
}

function DeliverySpecialNoteBlock({
  specialNote,
}: {
  specialNote?: string | null
}) {
  const trimmedSpecialNote = specialNote?.trim() ?? ""

  if (!trimmedSpecialNote) {
    return null
  }

  return (
    <section className="print-delivery-note__special-note">
      {trimmedSpecialNote}
    </section>
  )
}

function DeliveryPaymentBreakdown({
  summary,
}: {
  summary: ReturnType<typeof getDeliveryPaymentSummary>
}) {
  return (
    <>
      {summary.paymentItems.length > 0 && (
        <div className="print-delivery-note__payment-breakdown">
          <div className="print-delivery-note__payment-breakdown-heading">
            <span>货款明细</span>
          </div>
          <div className="print-delivery-note__payment-breakdown-items">
            {summary.paymentItems.map((item) => (
              <span key={item.label}>
                <em>{item.label}</em>
                <small>
                  加工费 {formatCurrencyX100(item.processingFeeX100)}
                </small>
                <small>
                  过磅重量 {formatTheoreticalWeightKg(item.weightKgX100)} kg
                </small>
                <b>货款 {formatCurrencyX100(item.amountX100)}</b>
              </span>
            ))}
          </div>
          <div className="print-delivery-note__payment-breakdown-subtotal">
            <span>型材货款小计</span>
            <strong>
              {formatCurrencyX100(summary.goodsPaymentAmountX100)}
            </strong>
          </div>
        </div>
      )}
      {summary.extraChargePaymentItems.length > 0 && (
        <div className="print-delivery-note__payment-breakdown print-delivery-note__extra-charge-breakdown">
          <div className="print-delivery-note__payment-breakdown-heading">
            <span>其他费用</span>
          </div>
          <div className="print-delivery-note__payment-breakdown-items">
            {summary.extraChargePaymentItems.map((item, index) => (
              <span className="print-delivery-note__extra-charge-item" key={index}>
                <em>{item.label}</em>
                <b>金额 {formatCurrencyX100(item.amountX100)}</b>
              </span>
            ))}
          </div>
          <div className="print-delivery-note__payment-breakdown-subtotal">
            <span>其他费用小计</span>
            <strong>
              {formatCurrencyX100(summary.extraChargeAmountX100)}
            </strong>
          </div>
        </div>
      )}
    </>
  )
}

export function PrintMergedDeliveryNoteView({
  mergedDeliveryNote,
  variant,
}: {
  mergedDeliveryNote: MergedDeliveryNote
  variant: "preview" | "print"
}) {
  const printPages = paginateMergedDeliveryNotePriceGroups(
    mergedDeliveryNote.priceGroups,
  )
  const printTime = formatDateTime(new Date().toISOString())
  const showGroupColumn = mergedDeliveryNote.priceGroups.some((priceGroup) =>
    priceGroup.items.some((item) => item.customGroup),
  )
  const showSectionTotals = mergedDeliveryNote.priceGroups.length > 1
  const grandTotals = getMergedDeliveryGrandTotals(mergedDeliveryNote.priceGroups)

  return (
    <article
      className={
        variant === "print"
          ? "print-order print-delivery-note print-order--print"
          : "print-order print-delivery-note"
      }
    >
      {printPages.map((page, pageIndex) => {
        const isLastPage = pageIndex === printPages.length - 1
        const showPageHeader = !showSectionTotals || pageIndex === 0
        const firstSection = page.sections[0]
        const tableColumnCount = showGroupColumn ? 9 : 8

        return (
          <section
            className="print-order__page"
            key={page.sections
              .map((section) => `${section.priceGroup.id}-${section.pageIndex}`)
              .join(":")}
          >
            {showPageHeader && (
              <>
                <header className="print-order__header">
                  <h1>山东虎标轻合金有限公司</h1>
                  <div>合并出库单</div>
                </header>

                <section className="print-order__meta">
                  <div>
                    <span>客户名称</span>
                    <strong>{mergedDeliveryNote.customerName}</strong>
                  </div>
                  <div>
                    <span>出库日期</span>
                    <strong>{mergedDeliveryNote.deliveryDate}</strong>
                  </div>
                  <div>
                    <span>合并单号</span>
                    <strong>{mergedDeliveryNote.id}</strong>
                  </div>
                  <div>
                    <span>经手人</span>
                    <strong>{mergedDeliveryNote.handlerName || "-"}</strong>
                  </div>
                  {!showSectionTotals && (
                    <>
                      <div>
                        <span>铝锭价</span>
                        <strong>
                          {formatCurrencyX100(
                            firstSection.priceGroup.aluminumIngotPriceX100
                          )}
                        </strong>
                      </div>
                      <div>
                        <span>计价方式</span>
                        <strong>
                          {firstSection.priceGroup.pricingTaxIncluded
                            ? "含税"
                            : "不含税"}
                        </strong>
                      </div>
                    </>
                  )}
                  <div className="print-delivery-note__meta-address">
                    <span>客户地址</span>
                    <strong>{mergedDeliveryNote.customerAddress || "-"}</strong>
                  </div>
                  {!showSectionTotals && (
                    <div>
                      <span>计价方案</span>
                      <strong>{formatPricingProfileName("默认价")}</strong>
                    </div>
                  )}
                </section>
              </>
            )}

            {page.sections.map((section, sectionIndex) => {
              const isLastSectionOnPage =
                sectionIndex === page.sections.length - 1
              const isLastContentSection = isLastPage && isLastSectionOnPage
              const isLastSectionPage =
                section.pageIndex === section.totalPagesInSection - 1
              const printRows = getMergedDeliveryNotePrintRows(section.items)

              return (
                <div key={`${section.priceGroup.id}-${section.pageIndex}`}>
                  <table
                    className={
                      showGroupColumn
                        ? "print-order__table print-delivery-note__table print-merged-delivery-note__table print-merged-delivery-note__table--grouped"
                        : "print-order__table print-delivery-note__table print-merged-delivery-note__table"
                    }
                  >
                    <thead>
                      <tr>
                        <th>序号</th>
                        <th>商品</th>
                        <th>模具编号</th>
                        <th>长度(mm)</th>
                        <th>颜色</th>
                        <th>下单数量</th>
                        <th>出库数量(支)</th>
                        <th>备注</th>
                        {showGroupColumn && (
                          <th>{mergedDeliveryNote.groupColumnLabel}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {printRows.map((item, index) => (
                        <tr key={item.id}>
                          <td>{section.itemOffset + index + 1}</td>
                          <td>{item.productName}</td>
                          <td>{item.moldCode}</td>
                          <td className="print-order__number">{item.lengthMm}</td>
                          <td>{item.color}</td>
                          <td className="print-order__number">
                            {item.orderQuantity}
                          </td>
                          <td className="print-order__number">{item.quantity}</td>
                          <td>{item.note}</td>
                          {showGroupColumn && item.showCustomGroup && (
                            <td rowSpan={item.customGroupRowSpan}>
                              {item.customGroup}
                            </td>
                          )}
                          {showGroupColumn &&
                            !item.showCustomGroup &&
                            !item.customGroup && <td />}
                        </tr>
                      ))}
                    </tbody>
                    {isLastSectionPage && (
                      <tfoot>
                        <tr className="print-delivery-note__table-summary">
                          <td colSpan={tableColumnCount}>
                            <MergedDeliverySectionQuantitySummary
                              priceGroup={section.priceGroup}
                            />
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>

                  {isLastSectionPage ? (
                    <>
                      <MergedDeliverySectionTotals
                        showAluminumIngotPrice={showSectionTotals}
                        priceGroup={section.priceGroup}
                        showPaymentAmount={!showSectionTotals}
                      />
                      {isLastContentSection && (
                        <>
                          {showSectionTotals && (
                            <section className="print-delivery-note__totals">
                              <div className="print-delivery-note__totals-row print-merged-delivery-note__grand-summary">
                                <span>
                                  合并总数量
                                  <strong>{grandTotals.totalQuantity}</strong>
                                  支
                                </span>
                                <span className="print-delivery-note__totals-emphasis">
                                  合并总重量
                                  <strong>
                                    {formatTheoreticalWeightKg(
                                      grandTotals.totalWeightKgX100
                                    )}
                                  </strong>
                                  kg
                                </span>
                                <span>
                                  型材货款合计
                                  <strong>
                                    {formatCurrencyX100(
                                      grandTotals.goodsPaymentAmountX100
                                    )}
                                  </strong>
                                </span>
                                {grandTotals.extraChargeAmountX100 > 0 && (
                                  <span>
                                    其他费用合计
                                    <strong>
                                      {formatCurrencyX100(
                                        grandTotals.extraChargeAmountX100
                                      )}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            </section>
                          )}
                          {showSectionTotals && (
                            <section className="print-delivery-note__payment">
                              <div className="print-delivery-note__payment-upper">
                                <span>合并应收大写</span>
                                <strong>
                                  {formatChineseCurrencyX100(
                                    grandTotals.paymentAmountX100
                                  )}
                                </strong>
                              </div>
                              <div className="print-delivery-note__payment-lower">
                                <span>合并应收小写</span>
                                <strong>
                                  {formatCurrencyX100(
                                    grandTotals.paymentAmountX100
                                  )}
                                </strong>
                              </div>
                            </section>
                          )}
                          <section className="print-order__note">
                            <span>备注：</span>
                            <p>{mergedDeliveryNote.note}</p>
                          </section>
                          <DeliverySpecialNoteBlock
                            specialNote={mergedDeliveryNote.specialNote}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <div className="print-order__continued">续下页</div>
                  )}
                </div>
              )
            })}

            <footer className="print-order__footer">
              {isLastPage ? <span>客户签收：</span> : <span />}
              {isLastPage ? <span>发货人：</span> : <span />}
              <span>
                第 {pageIndex + 1} / {printPages.length} 页
              </span>
              <span>打印时间：{printTime}</span>
            </footer>
          </section>
        )
      })}
    </article>
  )
}

function MergedDeliverySectionQuantitySummary({
  priceGroup,
}: {
  priceGroup: MergedDeliveryNotePriceGroup
}) {
  const quantityGroups = priceGroup.items.reduce(
    (groups, item) => {
      const category = getProcessingCategoryFromColor(item.color)

      groups[category] += item.quantity

      return groups
    },
    {
      billet: 0,
      bridge: 0,
      electrophoresis: 0,
      oxidation: 0,
      powder: 0,
    } satisfies Record<ProcessingCategory, number>
  )
  const quantityItems = processingCategories
    .map((category) => ({
      label: getProcessingCategoryLabel(category.key),
      value: quantityGroups[category.key],
    }))
    .filter((item) => item.value > 0)
  const totalQuantity = priceGroup.items.reduce(
    (total, item) => total + item.quantity,
    0
  )

  return (
    <div className="print-delivery-note__totals-row">
      <span>
        商品总数
        <strong>{priceGroup.items.length}</strong>
      </span>
      {quantityItems.map((item) => (
        <span key={item.label}>
          {item.label}
          <strong>{item.value}</strong>
          支
        </span>
      ))}
      <span>
        数量合计
        <strong>{totalQuantity}</strong>
        支
      </span>
    </div>
  )
}

function MergedDeliverySectionTotals({
  priceGroup,
  showAluminumIngotPrice,
  showPaymentAmount,
}: {
  priceGroup: MergedDeliveryNotePriceGroup
  showAluminumIngotPrice: boolean
  showPaymentAmount: boolean
}) {
  const totalWeightKgX100 =
    priceGroup.bridgeWeightKgX100 +
    priceGroup.powderWeightKgX100 +
    priceGroup.billetWeightKgX100 +
    priceGroup.oxidationWeightKgX100 +
    priceGroup.electrophoresisWeightKgX100
  const weightItems = processingCategories
    .map((category) => ({
      label: `${category.label}重量`,
      value: getWeightKgX100(priceGroup, category.key),
    }))
    .filter((item) => item.value > 0)
  const paymentSummary = getDeliveryPaymentSummary(priceGroup)

  return (
    <>
      <section className="print-delivery-note__totals">
        {(showAluminumIngotPrice ||
          weightItems.length > 0 ||
          totalWeightKgX100 > 0) && (
          <div className="print-delivery-note__totals-row">
            {showAluminumIngotPrice && (
              <span className="print-merged-delivery-note__aluminum-price">
                铝锭价
                <strong>
                  {formatCurrencyX100(priceGroup.aluminumIngotPriceX100)}
                </strong>
              </span>
            )}
            {weightItems.map((item) => (
              <span key={item.label}>
                {item.label}
                <strong>{formatTheoreticalWeightKg(item.value)}</strong>
                kg
              </span>
            ))}
            {totalWeightKgX100 > 0 && (
              <span className="print-delivery-note__totals-emphasis">
                重量合计
                <strong>{formatTheoreticalWeightKg(totalWeightKgX100)}</strong>
                kg
              </span>
            )}
          </div>
        )}
      </section>

      <section className="print-delivery-note__payment print-merged-delivery-note__section-payment">
        <DeliveryPaymentBreakdown summary={paymentSummary} />
        {showPaymentAmount && (
          <>
            <div className="print-delivery-note__payment-upper">
              <span>应收合计大写</span>
              <strong>
                {formatChineseCurrencyX100(paymentSummary.paymentAmountX100)}
              </strong>
            </div>
            <div className="print-delivery-note__payment-lower">
              <span>应收合计小写</span>
              <strong>
                {formatCurrencyX100(paymentSummary.paymentAmountX100)}
              </strong>
            </div>
          </>
        )}
      </section>
    </>
  )
}

function getMergedDeliveryGrandTotals(
  priceGroups: MergedDeliveryNotePriceGroup[]
) {
  return priceGroups.reduce(
    (totals, priceGroup) => {
      const payment = getDeliveryPaymentSummary(priceGroup)

      return {
        extraChargeAmountX100:
          totals.extraChargeAmountX100 +
          payment.extraChargeAmountX100,
        goodsPaymentAmountX100:
          totals.goodsPaymentAmountX100 + payment.goodsPaymentAmountX100,
        paymentAmountX100:
          totals.paymentAmountX100 + payment.paymentAmountX100,
        totalQuantity:
          totals.totalQuantity +
          priceGroup.items.reduce((total, item) => total + item.quantity, 0),
        totalWeightKgX100:
          totals.totalWeightKgX100 +
          priceGroup.bridgeWeightKgX100 +
          priceGroup.powderWeightKgX100 +
          priceGroup.billetWeightKgX100 +
          priceGroup.oxidationWeightKgX100 +
          priceGroup.electrophoresisWeightKgX100,
      }
    },
    {
      extraChargeAmountX100: 0,
      goodsPaymentAmountX100: 0,
      paymentAmountX100: 0,
      totalQuantity: 0,
      totalWeightKgX100: 0,
    }
  )
}
