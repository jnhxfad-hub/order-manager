const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
})

const dateTimeWithYearFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export function parseAppDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }

  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`)
}

export function formatAppDate(
  value: string | null | undefined,
  fallback = "-"
) {
  if (!value) {
    return fallback
  }

  const date = parseAppDate(value)
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "-"
}

export function formatIsoDate(value: string | null | undefined, fallback = "-") {
  if (!value) {
    return fallback
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = parseAppDate(value)

  if (!Number.isFinite(date.getTime())) {
    return fallback
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function formatDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function formatCompactDatePart(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("")
}

export function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join("")
}

export function formatAppDateTime(
  value: string | null | undefined,
  { fallback = "-", includeYear = false } = {}
) {
  if (!value) {
    return fallback
  }

  const date = parseAppDate(value)
  if (!Number.isFinite(date.getTime())) {
    return "-"
  }

  return includeYear
    ? dateTimeWithYearFormatter.format(date)
    : dateTimeFormatter.format(date)
}
