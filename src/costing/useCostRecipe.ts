import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type CostRecipe = {
  id: string
  name: string
  waste_overhead_percent: number
  profit_percent: number
  yield_qty: number
  note: string | null
}

export type CostIngredient = {
  id: string
  name: string
  purchase_qty: number
  purchase_unit: string
  purchase_price: number
  qty_used: number
}

export type CostLabor = {
  id: string
  label: string
  amount: number
}

export function useCostRecipe(id: string | null) {
  const [recipe, setRecipe] = useState<CostRecipe | null>(null)
  const [ingredients, setIngredients] = useState<CostIngredient[]>([])
  const [labor, setLabor] = useState<CostLabor[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: r }, { data: ing }, { data: lab }] = await Promise.all([
      supabase.from('cost_recipes').select('*').eq('id', id).single(),
      supabase.from('cost_recipe_ingredients').select('*').eq('recipe_id', id).order('sort_order'),
      supabase.from('cost_recipe_labor').select('*').eq('recipe_id', id).order('sort_order'),
    ])
    setRecipe(r as CostRecipe | null)
    setIngredients((ing ?? []) as CostIngredient[])
    setLabor((lab ?? []) as CostLabor[])
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return { recipe, ingredients, labor, loading, reload: load }
}
