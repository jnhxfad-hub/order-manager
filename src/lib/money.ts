const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  currency: "CNY",
  style: "currency",
})

export function formatCurrencyX100(value: number) {
  return currencyFormatter.format(value / 100)
}

export function formatOptionalCurrencyX100(value: number, fallback = "未设置") {
  return value > 0 ? formatCurrencyX100(value) : fallback
}

export function formatMoneyInput(value: number) {
  return value > 0 ? (value / 100).toFixed(2) : ""
}

export function formatPlainMoneyX100(value: number) {
  return (value / 100).toFixed(2)
}

export function parseMoneyToX100(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return 0
  }

  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null
  }

  const [yuan, cents = ""] = trimmed.split(".")
  return Number(yuan) * 100 + Number(cents.padEnd(2, "0"))
}
