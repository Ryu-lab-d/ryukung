import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ผลลัพธ์จากการ join หลายตารางมีรูปร่างซับซ้อนเกินคุ้มที่จะประกาศ type เต็ม
export function useOrder(orderId: string | null) {
  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orderId) { setLoading(false); return }
    setLoading(true)
    const [{ data: o }, { data: i }, { data: p }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, customers(name, phone, note), staff_members(id, display_name, email)')
        .eq('id', orderId)
        .single(),
      supabase.from('order_items').select('*').eq('order_id', orderId).order('created_at'),
      supabase.from('payments').select('*').eq('order_id', orderId).order('paid_at'),
    ])
    setOrder(o)
    setItems(i ?? [])
    setPayments(p ?? [])
    setLoading(false)
  }, [orderId])

  useEffect(() => { void load() }, [load])

  return { order, items, payments, loading, reload: load }
}
