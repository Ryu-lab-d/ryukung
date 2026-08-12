import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type IngredientMovement = {
  id: string
  qty_delta: number
  reason: string
  ref_order_id: string | null
  ref_withdrawal_id: string | null
  note: string | null
  created_at: string
}

export function useIngredientMovements(ingredientId: string | null) {
  const [movements, setMovements] = useState<IngredientMovement[]>([])
  const [loading, setLoading] = useState(!!ingredientId)

  const load = useCallback(async () => {
    if (!ingredientId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('ingredient_stock_movements')
      .select('*')
      .eq('ingredient_id', ingredientId)
      .order('created_at', { ascending: false })
    setMovements((data ?? []).map((r: any) => ({ ...r, qty_delta: Number(r.qty_delta) })))
    setLoading(false)
  }, [ingredientId])

  useEffect(() => {
    void load()
  }, [load])

  return { movements, loading, reload: load }
}
