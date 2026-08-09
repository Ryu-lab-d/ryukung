import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deleteManyOrders } from './deleteManyOrders'

export type AbandonedDraft = {
  id: string
  customer_name: string | null
  items_summary: string
  created_at: string
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** ออเดอร์ร่างที่สร้างไว้แล้วไม่มีการแก้ไข/ยืนยันมานานเกิน 7 วัน — มักเป็นร่างที่พิมพ์ค้างไว้เฉยๆ ไม่ได้ใช้จริง */
export function useAbandonedDrafts() {
  const [drafts, setDrafts] = useState<AbandonedDraft[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, customers(name), order_items(product_name, qty)')
      .eq('is_draft', true)
      .lte('created_at', cutoff)
      .order('created_at', { ascending: true })

    setDrafts(
      (data ?? []).map((o: any) => ({
        id: o.id,
        customer_name: o.customers?.name ?? null,
        items_summary: (o.order_items ?? []).map((it: any) => `${it.product_name} x${it.qty}`).join(', '),
        created_at: o.created_at,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const deleteMany = useCallback(async (orderIds: string[]) => {
    const result = await deleteManyOrders(orderIds)
    await load()
    return result
  }, [load])

  return { drafts, loading, reload: load, deleteMany }
}
