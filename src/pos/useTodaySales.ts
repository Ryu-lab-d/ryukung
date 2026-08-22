import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type TodaySale = {
  id: string
  order_no: string | null
  grand_total: number
  created_at: string
}

/** ยอดขายหน้าร้าน (POS) ของวันนี้ — แยกจากออเดอร์นัดล่วงหน้าปกติด้วย customer_id เป็น null + fulfillment_type
 * เป็น pickup (ลายเซ็นเฉพาะของ create_pos_sale RPC เท่านั้น ออเดอร์ปกติต้องเลือก/สร้างลูกค้าเสมอ) */
export function useTodaySales() {
  const [sales, setSales] = useState<TodaySale[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('orders')
      .select('id, order_no, grand_total, created_at')
      .is('customer_id', null)
      .eq('fulfillment_type', 'pickup')
      .eq('work_status', 'delivered')
      .gte('created_at', startOfToday.toISOString())
      .order('created_at', { ascending: false })

    setSales(
      (data ?? []).map((o) => ({
        id: o.id,
        order_no: o.order_no,
        grand_total: Number(o.grand_total),
        created_at: o.created_at,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { sales, loading, reload: load }
}
