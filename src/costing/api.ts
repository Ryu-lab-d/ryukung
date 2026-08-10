import { supabase } from '../lib/supabase'

export type CostIngredientInput = {
  name: string
  purchase_qty: number
  purchase_unit: string
  purchase_price: number
  qty_used: number
}

export type CostLaborInput = {
  label: string
  amount: number
}

export type CostRecipeInput = {
  name: string
  waste_overhead_percent: number
  profit_percent: number
  yield_qty: number
  note: string | null
  ingredients: CostIngredientInput[]
  labor: CostLaborInput[]
}

/** สร้างหรืออัปเดตสูตร แล้วแทนที่วัตถุดิบ/ค่าแรงทั้งชุดด้วยรายการปัจจุบันเสมอ (ลบของเก่าทิ้งแล้วใส่ใหม่ทั้งหมด ง่ายกว่า diff รายบรรทัด) */
export async function saveCostRecipe(id: string | null, input: CostRecipeInput): Promise<{ id: string | null; error: { message: string } | null }> {
  const recipePatch = {
    name: input.name,
    waste_overhead_percent: input.waste_overhead_percent,
    profit_percent: input.profit_percent,
    yield_qty: input.yield_qty,
    note: input.note,
  }

  let recipeId = id
  if (recipeId) {
    const { error } = await supabase.from('cost_recipes').update(recipePatch).eq('id', recipeId)
    if (error) return { id: null, error: { message: error.message } }
  } else {
    const { data, error } = await supabase.from('cost_recipes').insert(recipePatch).select().single()
    if (error || !data) return { id: null, error: { message: error?.message ?? 'บันทึกไม่สำเร็จ' } }
    recipeId = data.id as string
  }

  const [{ error: delIngErr }, { error: delLaborErr }] = await Promise.all([
    supabase.from('cost_recipe_ingredients').delete().eq('recipe_id', recipeId),
    supabase.from('cost_recipe_labor').delete().eq('recipe_id', recipeId),
  ])
  if (delIngErr || delLaborErr) return { id: null, error: { message: (delIngErr ?? delLaborErr)!.message } }

  const ingredientRows = input.ingredients.map((it, i) => ({ ...it, recipe_id: recipeId, sort_order: i }))
  const laborRows = input.labor.map((it, i) => ({ ...it, recipe_id: recipeId, sort_order: i }))

  if (ingredientRows.length > 0) {
    const { error } = await supabase.from('cost_recipe_ingredients').insert(ingredientRows)
    if (error) return { id: null, error: { message: error.message } }
  }
  if (laborRows.length > 0) {
    const { error } = await supabase.from('cost_recipe_labor').insert(laborRows)
    if (error) return { id: null, error: { message: error.message } }
  }

  return { id: recipeId, error: null }
}

export async function deleteCostRecipe(id: string): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('cost_recipes').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}
