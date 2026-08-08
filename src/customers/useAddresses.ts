import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Address = {
  id: string
  customer_id: string
  label: string
  recipient_name: string | null
  recipient_phone: string | null
  address_text: string
  is_default: boolean
}

export function useAddresses(customerId: string | null) {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!customerId) { setAddresses([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
    setAddresses((data ?? []) as Address[])
    setLoading(false)
  }, [customerId])

  useEffect(() => { void load() }, [load])

  const save = useCallback(
    async (id: string | null, patch: Partial<Address>) => {
      const { error } = id
        ? await supabase.from('customer_addresses').update(patch).eq('id', id)
        : await supabase.from('customer_addresses').insert({ ...patch, customer_id: customerId })
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [customerId, load]
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('customer_addresses').delete().eq('id', id)
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  return { addresses, loading, save, remove, reload: load }
}
