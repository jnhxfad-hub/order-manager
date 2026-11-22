import type { OrderDetail, OrderItem } from "@/features/orders/types"
import { formatAppDateTime, formatIsoDate } from "@/lib/datetime"
import {
  formatTheoreticalWeightKg,
  formatThicknessMm,
  formatWeightPerMeterKg,
} from "@/lib/measurement"
import { formatCurrencyX100 } from "@/lib/money"
import {
  getProcessingCategoryFromColor,
  getProcessingCategoryLabel,
  processingCategories,
  type ProcessingCategory,
} from "@/lib/processing-fees"

const PRINT_ORDER_ITEMS_PER_PAGE = 22
function formatDateTime(value: string) {
  return formatAppDateTime(value, { includeYear: true })
}

function chunkOrderItems(items: OrderItem[]) {
  const pages: OrderItem[][] = []

  for (
    let index = 0;
    index < items.length;
    index += PRINT_ORDER_ITEMS_PER_PAGE
  ) {
    pages.push(items.slice(index, index + PRINT_ORDER_ITEMS_PER_PAGE))
  }

  return pages.length > 0 ? pages : [[]]
}

export function PrintOrderView({
  order,
  totalQuantity,
  totalTheoreticalWeightKgX100,
  variant,
}: {
  order: OrderDetail
  totalQuantity: number
  totalTheoreticalWeightKgX100: number
  variant: "preview" | "print"
}) {
  const itemGroups = order.items.reduce(
    (groups, item) => {
      const category = getProcessingCategoryFromColor(item.color)

      groups[category].quantity += item.quantity
      groups[category].weightKgX100 += item.theoreticalWeightKgX100

      return groups
    },
    {
      billet: { quantity: 0, weightKgX100: 0 },
      bridge: { quantity: 0, weightKgX100: 0 },
      electrophoresis: { quantity: 0, weightKgX100: 0 },
      oxidation: { quantity: 0, weightKgX100: 0 },
      powder: { quantity: 0, weightKgX100: 0 },
    } satisfies Record<
      ProcessingCategory,
      { quantity: number; weightKgX100: number }
    >
  )
  const quantityItems = processingCategories
    .map((category) => ({
      label: getProcessingCategoryLabel(category.key),
      value: itemGroups[category.key].quantity,
    }))
    .filter((item) => item.value > 0)
  const weightItems = processingCategories
    .map((category) => ({
      label: `${getProcessingCategoryLabel(category.key)}重量`,
      value: itemGroups[category.key].weightKgX100,
    }))
    .filter((item) => item.value > 0)
  const itemPages = chunkOrderItems(order.items)
  const orderDateText =
    order.status === "ordered"
      ? order.orderedDate
        ? formatIsoDate(order.orderedDate)
        : "未确认下单"
      : "客户未确认下单"
  const saveDateText = formatIsoDate(order.updatedAt)

  return (
    <article
      className={
        variant === "print"
          ? "print-order print-sales-order print-order--print"
          : "print-order print-sales-order"
      }
    >
      {itemPages.map((items, pageIndex) => {
        const isLastPage = pageIndex === itemPages.length - 1
        const itemOffset = pageIndex * PRINT_ORDER_ITEMS_PER_PAGE

        return (
          <section className="print-order__page" key={pageIndex}>
            <header className="print-order__header">
              <h1>山东虎标轻合金有限公司</h1>
              <div>销售订单</div>
            </header>

            <section className="print-order__meta">
              <div>
                <span>客户名称</span>
                <strong>{order.customerName}</strong>
              </div>
              <div>
                <span>下单日期</span>
                <strong>{orderDateText}</strong>
              </div>
              <div>
                <span>订单编号</span>
                <strong>{order.id}</strong>
              </div>
              <div>
                <span>经手人</span>
                <strong>{order.handlerName}</strong>
              </div>
              <div>
                <span>铝锭价</span>
                <strong>
                  {formatCurrencyX100(order.aluminumIngotPriceX100)}
                </strong>
              </div>
              <div>
                <span>计价方式</span>
                <strong>{order.pricingTaxIncluded ? "含税" : "不含税"}</strong>
              </div>
              <div
                className={
                  order.status === "ordered"
                    ? "print-order__meta-address"
                    : "print-order__meta-address print-order__meta-address--with-save-date"
                }
              >
                <span>客户地址</span>
                <strong>{order.customerAddress || "-"}</strong>
              </div>
              {order.status !== "ordered" && (
                <div className="print-order__meta-save-date">
                  <span>保存日期</span>
                  <strong>{saveDateText}</strong>
                </div>
              )}
              {order.status !== "ordered" && (
                <div className="print-order__meta-empty" />
              )}
            </section>

            <table className="print-order__table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>商品</th>
                  <th>模具编号</th>
                  <th>厚度(mm)</th>
                  <th>米重(kg/m)</th>
                  <th>长度(mm)</th>
                  <th>颜色</th>
                  <th>数量(支)</th>
                  <th>理论重量(kg)</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{itemOffset + index + 1}</td>
                    <td>{item.productName}</td>
                    <td>{item.productMoldCode}</td>
                    <td className="print-order__number">
                      {formatThicknessMm(item.thicknessMmX100)}
                    </td>
                    <td className="print-order__number">
                      {formatWeightPerMeterKg(item.weightPerMeterKgX1000)}
                    </td>
                    <td className="print-order__number">{item.lengthMm}</td>
                    <td>{item.color}</td>
                    <td className="print-order__number">{item.quantity}</td>
                    <td className="print-order__number">
                      {formatTheoreticalWeightKg(item.theoreticalWeightKgX100)}
                    </td>
                    <td>{item.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
              {isLastPage && (
                <tfoot>
                  <tr className="print-sales-order__table-summary">
                    <td colSpan={10}>
                      <div className="print-sales-order__totals-row">
                        <span>
                          商品总数
                          <strong>{order.items.length}</strong>
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
                <section className="print-sales-order__totals">
                  <div className="print-sales-order__totals-row">
                    {weightItems.map((item) => (
                      <span key={item.label}>
                        {item.label}
                        <strong>{formatTheoreticalWeightKg(item.value)}</strong>
                        kg
                      </span>
                    ))}
                    <span className="print-sales-order__totals-emphasis">
                      理论预估重量合计
                      <strong>
                        {formatTheoreticalWeightKg(
                          totalTheoreticalWeightKgX100
                        )}
                      </strong>
                      kg
                    </span>
                  </div>
                </section>

                <section className="print-order__note">
                  <span>备注：</span>
                  <p>{order.note || ""}</p>
                </section>
              </>
            ) : (
              <div className="print-order__continued">续下页</div>
            )}

            <footer className="print-order__footer">
              {isLastPage ? <span>客户签收：</span> : <span />}
              <span>
                第 {pageIndex + 1} / {itemPages.length} 页
              </span>
              <span>打印时间：{formatDateTime(new Date().toISOString())}</span>
            </footer>
          </section>
        )
      })}
    </article>
  )
}
