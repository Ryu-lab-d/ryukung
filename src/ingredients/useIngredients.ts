import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Ingredient = {
  id: string
  name: string
  unit: string
  stock_qty: number
  low_stock_threshold: number
  cost_per_unit: number
  note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useIngredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ingredients').select('*').order('name')
    setIngredients(
      (data ?? []).map((r: any) => ({
        ...r,
        stock_qty: Number(r.stock_qty),
        low_stock_threshold: Number(r.low_stock_threshold),
        cost_per_unit: Number(r.cost_per_unit),
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { ingredients, loading, reload: load }
}

export function useIngredient(id: string | null) {
  const [ingredient, setIngredient] = useState<Ingredient | null>(null)
  const [loading, setLoading] = useState(!!id)

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase.from('ingredients').select('*').eq('id', id).single()
    setIngredient(
      data
        ? {
            ...data,
            stock_qty: Number(data.stock_qty),
            low_stock_threshold: Number(data.low_stock_threshold),
            cost_per_unit: Number(data.cost_per_unit),
          }
        : null
    )
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return { ingredient, loading, reload: load }
}
