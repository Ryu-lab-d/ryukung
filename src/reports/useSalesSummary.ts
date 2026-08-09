import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type SalesOrder = {
  id: string
  order_no: string | null
  created_at: string
  items_total: number
  items_cost_total: number
  grand_total: number
  order_items: { product_name: string; qty: number; line_total: number }[]
}

export type TopProduct = { name: string; qty: number; revenue: number }

/** รวมยอดขายต่อสินค้าจากออเดอร์ทั้งหมดในช่วงที่เลือก เรียงจากขายดีสุด (ตามจำนวนชิ้น) ไปน้อยสุด */
export function computeTopProducts(orders: SalesOrder[]): TopProduct[] {
  const byName = new Map<string, TopProduct>()
  for (const o of orders) {
    for (const it of o.order_items ?? []) {
      const cur = byName.get(it.product_name) ?? { name: it.product_name, qty: 0, revenue: 0 }
      cur.qty += Number(it.qty)
      cur.revenue += Number(it.line_total)
      byName.set(it.product_name, cur)
    }
  }
  return [...byName.values()].sort((a, b) => b.qty - a.qty)
}

export function useSalesSummary(from: string, to: string) {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase
      .from('orders')
      .select('id, order_no, created_at, items_total, items_cost_total, grand_total, order_items(product_name, qty, line_total)')
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
  const topProducts = computeTopProducts(orders)

  return { orders, loading, sales, cost, profit, profitPercent, avgOrder, topProducts }
}
