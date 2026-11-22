export function formatThicknessMm(value: number) {
  return (value / 100).toFixed(2)
}

export function formatWeightPerMeterKg(value: number) {
  return (value / 1000).toFixed(3)
}

export function formatTheoreticalWeightKg(value: number) {
  return (value / 100).toFixed(2)
}
