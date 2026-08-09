import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deleteManyOrders } from './deleteManyOrders'

export type CancelledOrder = {
  id: string
  order_no: string | null
  customer_name: string | null
  grand_total: number
  refund_status: string
  updated_at: string
}

export function useCancelledOrders() {
  const [orders, setOrders] = useState<CancelledOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('id, order_no, grand_total, refund_status, updated_at, customers(name)')
      .eq('work_status', 'cancelled')
      .order('updated_at', { ascending: true })

    setOrders(
      (data ?? []).map((o: any) => ({
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customers?.name ?? null,
        grand_total: Number(o.grand_total),
        refund_status: o.refund_status,
        updated_at: o.updated_at,
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

  return { orders, loading, reload: load, deleteMany }
}
