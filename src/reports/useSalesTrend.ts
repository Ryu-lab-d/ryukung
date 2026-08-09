import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type TrendDay = { date: string; sales: number }

function dateKey(d: Date): string {
  // en-CA locale ให้รูปแบบ yyyy-mm-dd ตรงตัว ใช้ timezone ของเครื่องผู้ใช้เอง (เหมือนจุดอื่นในแอปที่ไม่ล็อก timezone)
  return d.toLocaleDateString('en-CA')
}

/** แบ่งยอดขายเป็นก้อนรายวัน ย้อนหลัง `days` วันนับจาก `today` รวมวันที่ไม่มีออเดอร์เลยด้วย (ยอด 0) ให้กราฟไม่ขาดช่วง */
export function bucketSalesByDay(
  orders: { created_at: string; grand_total: number }[],
  days: number,
  today: Date
): TrendDay[] {
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  const buckets = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    buckets.set(dateKey(d), 0)
  }
  for (const o of orders) {
    const key = dateKey(new Date(o.created_at))
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(o.grand_total))
  }
  return [...buckets.entries()].map(([date, sales]) => ({ date, sales }))
}

export function useSalesTrend(days: number) {
  const [trend, setTrend] = useState<TrendDay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - (days - 1))
    from.setHours(0, 0, 0, 0)

    supabase
      .from('orders')
      .select('created_at, grand_total')
      .eq('is_draft', false)
      .neq('work_status', 'cancelled')
      .gte('created_at', from.toISOString())
      .then(({ data }) => {
        setTrend(bucketSalesByDay((data ?? []) as { created_at: string; grand_total: number }[], days, today))
        setLoading(false)
      })
  }, [days])

  return { trend, loading }
}
