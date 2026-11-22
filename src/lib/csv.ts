export function createCsv(rows: Array<Array<string | number | null | undefined>>) {
  const content = rows
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n")

  return `\uFEFF${content}\r\n`
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value)

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}
