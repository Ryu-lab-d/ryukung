import { describe, it, expect } from 'vitest'
import { bucketSalesByDay } from './useSalesTrend'

describe('bucketSalesByDay', () => {
  it('รวมยอดขายของวันเดียวกันเข้าด้วยกัน และวันที่ไม่มีออเดอร์เลยได้ยอด 0', () => {
    const today = new Date('2026-08-09T12:00:00')
    const orders = [
      { created_at: '2026-08-09T03:00:00', grand_total: 100 },
      { created_at: '2026-08-09T10:00:00', grand_total: 50 },
      { created_at: '2026-08-08T20:00:00', grand_total: 30 },
    ]
    const trend = bucketSalesByDay(orders, 3, today)
    expect(trend).toEqual([
      { date: '2026-08-07', sales: 0 },
      { date: '2026-08-08', sales: 30 },
      { date: '2026-08-09', sales: 150 },
    ])
  })

  it('ออเดอร์ที่เก่ากว่าช่วงที่ขอ ไม่ถูกนับรวม', () => {
    const today = new Date('2026-08-09T12:00:00')
    const orders = [{ created_at: '2026-08-01T12:00:00', grand_total: 999 }]
    const trend = bucketSalesByDay(orders, 3, today)
    expect(trend.reduce((sum, d) => sum + d.sales, 0)).toBe(0)
  })

  it('ไม่มีออเดอร์เลย ได้ทุกวันเป็น 0 ครบตามจำนวนวันที่ขอ', () => {
    const trend = bucketSalesByDay([], 5, new Date('2026-08-09T12:00:00'))
    expect(trend).toHaveLength(5)
    expect(trend.every((d) => d.sales === 0)).toBe(true)
  })
})
