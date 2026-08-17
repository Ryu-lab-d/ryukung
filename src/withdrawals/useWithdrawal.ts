import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Withdrawal = {
  id: string
  withdrawn_at: string
  location: string | null
  note: string | null
  status: string
  settled_at: string | null
  withdrawn_by: string | null
  staff_members: { display_name: string | null; email: string } | null
}

export type WithdrawalItem = {
  id: string
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty_out: number
  qty_sold: number | null
  amount_collected: number | null
}

export function useWithdrawal(id: string | null) {
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null)
  const [items, setItems] = useState<WithdrawalItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: w }, { data: it }] = await Promise.all([
      supabase.from('stock_withdrawals').select('*, staff_members(display_name, email)').eq('id', id).single(),
      supabase.from('stock_withdrawal_items').select('*').eq('withdrawal_id', id).order('sort_order'),
    ])
    setWithdrawal(w as Withdrawal | null)
    setItems((it ?? []) as WithdrawalItem[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return { withdrawal, items, loading, reload: load }
}
