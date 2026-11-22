export function parseIntegerInput(value: string) {
  const trimmedValue = value.trim()

  if (!/^\d+$/.test(trimmedValue)) {
    return null
  }

  const parsedValue = Number(trimmedValue)

  return Number.isSafeInteger(parsedValue) ? parsedValue : null
}
