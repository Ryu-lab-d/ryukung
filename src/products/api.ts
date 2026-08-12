import { supabase } from '../lib/supabase'

export type ProductIngredientInput = { ingredient_id: string; qty_per_unit: number }

/** บันทึกสูตรของสินค้า 1 ชิ้น — ลบของเก่าทิ้งแล้วใส่ใหม่ทั้งหมดเสมอ (เหมือน saveCostRecipe ในหน้าต้นทุน) ง่ายกว่า diff รายบรรทัด */
export async function saveProductIngredients(
  productId: string,
  rows: ProductIngredientInput[]
): Promise<{ error: { message: string } | null }> {
  const { error: delErr } = await supabase.from('product_ingredients').delete().eq('product_id', productId)
  if (delErr) return { error: { message: delErr.message } }

  if (rows.length === 0) return { error: null }

  const { error } = await supabase.from('product_ingredients').insert(
    rows.map((r, i) => ({ product_id: productId, ingredient_id: r.ingredient_id, qty_per_unit: r.qty_per_unit, sort_order: i }))
  )
  return { error: error ? { message: error.message } : null }
}
