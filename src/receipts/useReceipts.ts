import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Receipt = {
  id: string
  order_id: string
  receipt_no: string
  issued_at: string
  status: 'issued' | 'cancelled'
  cancelled_at: string | null
  replaced_by_receipt_id: string | null
  snapshot: any
}

export function useReceipts(orderId: string | null) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orderId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('receipts').select('*').eq('order_id', orderId).order('issued_at')
    setReceipts((data ?? []) as Receipt[])
    setLoading(false)
  }, [orderId])

  useEffect(() => { void load() }, [load])

  return { receipts, loading, reload: load }
}
