import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type BoardOrder = {
  id: string
  order_no: string | null
  customer_name: string | null
  items_summary: string
  needed_date: string | null
  bake_date: string | null
  fulfillment_type: string
  work_status: string
  payment_status: string
  grand_total: number
  is_draft: boolean
  address_edited_at: string | null
  assignee_name: string | null
}

export function useOrderBoard() {
  const [orders, setOrders] = useState<BoardOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(
        'id, order_no, needed_date, bake_date, fulfillment_type, work_status, payment_status, grand_total, is_draft, updated_at, address_edited_at, customers(name), order_items(product_name, qty), staff_members(display_name, email)'
      )
      .neq('work_status', 'cancelled')
      .order('bake_date', { ascending: true })

    const sevenDaysAgo = Date.now() - 7 * 86400000
    const rows = (data ?? [])
      .filter((o: any) => o.work_status !== 'delivered' || new Date(o.updated_at).getTime() >= sevenDaysAgo)
      .map((o: any) => ({
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customers?.name ?? null,
        items_summary: (o.order_items ?? []).map((it: any) => `${it.product_name} x${it.qty}`).join(', '),
        needed_date: o.needed_date,
        bake_date: o.bake_date,
        fulfillment_type: o.fulfillment_type,
        work_status: o.work_status,
        payment_status: o.payment_status,
        grand_total: Number(o.grand_total),
        is_draft: o.is_draft,
        address_edited_at: o.address_edited_at,
        assignee_name: o.staff_members?.display_name ?? o.staff_members?.email ?? null,
      }))
    setOrders(rows)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const changeStatus = useCallback(
    async (orderId: string, workStatus: string) => {
      const { error } = await supabase.from('orders').update({ work_status: workStatus }).eq('id', orderId)
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  return { orders, loading, changeStatus, reload: load }
}
