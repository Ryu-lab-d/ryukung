import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type CustomerOrderSummary = {
  id: string
  order_no: string | null
  needed_date: string | null
  work_status: string
  payment_status: string
  grand_total: number
}

export function useCustomerOrders(customerId: string | null) {
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) { setOrders([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('orders')
      .select('id, order_no, needed_date, work_status, payment_status, grand_total')
      .eq('customer_id', customerId)
      .eq('is_draft', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data ?? []) as CustomerOrderSummary[])
        setLoading(false)
      })
  }, [customerId])

  return { orders, loading }
}
