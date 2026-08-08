import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Customer = {
  id: string
  name: string
  phone: string | null
  channel: string | null
  channel_handle: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type CustomerWithStats = Customer & { order_count: number; total_spend: number }

export function useCustomers() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: rows }, { data: stats }] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('customer_order_stats').select('*'),
    ])
    const statsById = new Map((stats ?? []).map((s) => [s.customer_id, s]))
    setCustomers(
      (rows ?? []).map((c) => ({
        ...c,
        order_count: statsById.get(c.id)?.order_count ?? 0,
        total_spend: Number(statsById.get(c.id)?.total_spend ?? 0),
      })) as CustomerWithStats[]
    )
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const save = useCallback(
    async (id: string | null, patch: Partial<Customer>) => {
      const { data, error } = id
        ? await supabase.from('customers').update(patch).eq('id', id).select().single()
        : await supabase.from('customers').insert(patch).select().single()
      if (!error) await load()
      return { data: data as Customer | null, error: error ? { message: error.message } : null }
    },
    [load]
  )

  return { customers, loading, save, reload: load }
}
