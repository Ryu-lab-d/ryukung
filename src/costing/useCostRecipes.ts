import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type CostRecipeListItem = {
  id: string
  name: string
  yield_qty: number
  waste_overhead_percent: number
  profit_percent: number
  updated_at: string
  ingredients: { purchase_qty: number; purchase_price: number; qty_used: number }[]
  labor: { amount: number }[]
}

export function useCostRecipes() {
  const [recipes, setRecipes] = useState<CostRecipeListItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cost_recipes')
      .select(
        'id, name, yield_qty, waste_overhead_percent, profit_percent, updated_at, cost_recipe_ingredients(purchase_qty, purchase_price, qty_used), cost_recipe_labor(amount)'
      )
      .order('updated_at', { ascending: false })

    setRecipes(
      (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        yield_qty: Number(r.yield_qty),
        waste_overhead_percent: Number(r.waste_overhead_percent),
        profit_percent: Number(r.profit_percent),
        updated_at: r.updated_at,
        ingredients: (r.cost_recipe_ingredients ?? []).map((it: any) => ({
          purchase_qty: Number(it.purchase_qty),
          purchase_price: Number(it.purchase_price),
          qty_used: Number(it.qty_used),
        })),
        labor: (r.cost_recipe_labor ?? []).map((l: any) => ({ amount: Number(l.amount) })),
      }))
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { recipes, loading, reload: load }
}
