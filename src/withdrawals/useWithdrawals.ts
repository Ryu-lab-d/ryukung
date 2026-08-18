import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type WithdrawalListItem = {
  id: string
  withdrawn_at: string
  location: string | null
  status: string
  settled_at: string | null
  withdrawn_by: string | null
  staff_members: { display_name: string | null; email: string } | null
  proceeds_received: boolean
  items: { qty_out: number; qty_sold: number | null; amount_collected: number | null; unit_cost: number; is_wage: boolean }[]
}

export function useWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalListItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('stock_withdrawals')
      .select(
        'id, withdrawn_at, location, status, settled_at, withdrawn_by, proceeds_received, staff_members(display_name, email), stock_withdrawal_items(qty_out, qty_sold, amount_collected, unit_cost, is_wage)'
      )
      .order('withdrawn_at', { ascending: false })

    setWithdrawals(
      (data ?? []).map((w: any) => ({
        id: w.id,
        withdrawn_at: w.withdrawn_at,
        location: w.location,
        status: w.status,
        settled_at: w.settled_at,
        withdrawn_by: w.withdrawn_by,
        staff_members: w.staff_members,
        proceeds_received: w.proceeds_received,
        items: (w.stock_withdrawal_items ?? []).map((it: any) => ({
          qty_out: Number(it.qty_out),
          qty_sold: it.qty_sold === null ? null : Number(it.qty_sold),
          amount_collected: it.amount_collected === null ? null : Number(it.amount_collected),
          unit_cost: Number(it.unit_cost),
          is_wage: it.is_wage,
        })),
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { withdrawals, loading, reload: load }
}
