export type RangeKey = 'today' | '7d' | '30d' | 'custom'

export function rangeToDates(key: RangeKey, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  if (key === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { from: start.toISOString(), to: endOfToday.toISOString() }
  }
  if (key === '7d') {
    const start = new Date(endOfToday.getTime() - 6 * 86400000)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: endOfToday.toISOString() }
  }
  if (key === '30d') {
    const start = new Date(endOfToday.getTime() - 29 * 86400000)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: endOfToday.toISOString() }
  }
  return { from: `${customFrom}T00:00:00`, to: `${customTo}T23:59:59` }
}
