import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type SalesOrder = {
  id: string
  order_no: string | null
  created_at: string
  items_total: number
  items_cost_total: number
  grand_total: number
}

export function useSalesSummary(from: string, to: string) {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('orders')
      .select('id, order_no, created_at, items_total, items_cost_total, grand_total')
      .eq('is_draft', false)
      .neq('work_status', 'cancelled')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data ?? []) as SalesOrder[])
        setLoading(false)
      })
  }, [from, to])

  const sales = orders.reduce((sum, o) => sum + Number(o.grand_total), 0)
  const cost = orders.reduce((sum, o) => sum + Number(o.items_cost_total), 0)
  const profit = sales - cost
  const profitPercent = sales > 0 ? (profit / sales) * 100 : 0
  const avgOrder = orders.length > 0 ? sales / orders.length : 0

  return { orders, loading, sales, cost, profit, profitPercent, avgOrder }
}
