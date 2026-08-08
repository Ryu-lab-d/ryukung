export type MoneyInput = number | string | null | undefined

export function toNumber(value: MoneyInput): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(n) ? n : 0
}

export function formatBaht(value: MoneyInput): string {
  return toNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
