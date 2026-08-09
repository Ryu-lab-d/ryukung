import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deleteOrder } from '../orders/api'

export type CleanupOrder = {
  id: string
  order_no: string | null
  customer_name: string | null
  fulfillment_type: string
  grand_total: number
  delivered_at: string
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function useStorageCleanup() {
  const [orders, setOrders] = useState<CleanupOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString()
    const { data } = await supabase
      .from('orders')
      .select('id, order_no, fulfillment_type, grand_total, delivered_at, customers(name)')
      .eq('work_status', 'delivered')
      .lte('delivered_at', cutoff)
      .order('delivered_at', { ascending: true })

    setOrders(
      (data ?? []).map((o: any) => ({
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customers?.name ?? null,
        fulfillment_type: o.fulfillment_type,
        grand_total: Number(o.grand_total),
        delivered_at: o.delivered_at,
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const deleteMany = useCallback(async (orderIds: string[]) => {
    const errors: string[] = []
    for (const id of orderIds) {
      const { error } = await deleteOrder(id)
      if (error) errors.push(error.message)
    }
    await load()
    return { errors }
  }, [load])

  return { orders, loading, reload: load, deleteMany }
}
