import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type CalendarOrder = {
  id: string
  order_no: string | null
  customer_name: string | null
  work_status: string
  fulfillment_type: string
  is_draft: boolean
}

/** โหลดออเดอร์ที่มีวันอบหรือวันต้องส่งอยู่ในช่วงที่ปฏิทินกำลังแสดง แล้วจัดกลุ่มตามวันไว้ให้พร้อมใช้ */
export function useCalendarOrders(rangeStart: string, rangeEnd: string) {
  const [byBakeDate, setByBakeDate] = useState<Map<string, CalendarOrder[]>>(new Map())
  const [byNeededDate, setByNeededDate] = useState<Map<string, CalendarOrder[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_no, bake_date, needed_date, work_status, fulfillment_type, is_draft, customers(name)')
      .neq('work_status', 'cancelled')
      .or(
        `and(bake_date.gte.${rangeStart},bake_date.lte.${rangeEnd}),and(needed_date.gte.${rangeStart},needed_date.lte.${rangeEnd})`
      )

    const bakeMap = new Map<string, CalendarOrder[]>()
    const neededMap = new Map<string, CalendarOrder[]>()
    for (const o of (data ?? []) as any[]) {
      const summary: CalendarOrder = {
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customers?.name ?? null,
        work_status: o.work_status,
        fulfillment_type: o.fulfillment_type,
        is_draft: o.is_draft,
      }
      if (o.bake_date) {
        const list = bakeMap.get(o.bake_date) ?? []
        list.push(summary)
        bakeMap.set(o.bake_date, list)
      }
      if (o.needed_date) {
        const list = neededMap.get(o.needed_date) ?? []
        list.push(summary)
        neededMap.set(o.needed_date, list)
      }
    }
    setByBakeDate(bakeMap)
    setByNeededDate(neededMap)
    setLoading(false)
  }, [rangeStart, rangeEnd])

  useEffect(() => { void load() }, [load])

  return { byBakeDate, byNeededDate, loading, reload: load }
}
