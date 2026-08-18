import { supabase } from '../lib/supabase'

export type IngredientInput = {
  name: string
  unit: string
  low_stock_threshold: number
  note: string | null
  is_active: boolean
}

export async function saveIngredient(id: string | null, input: IngredientInput): Promise<{ id: string | null; error: { message: string } | null }> {
  if (id) {
    const { error } = await supabase.from('ingredients').update(input).eq('id', id)
    return { id: error ? null : id, error: error ? { message: error.message } : null }
  }
  const { data, error } = await supabase.from('ingredients').insert(input).select().single()
  if (error || !data) return { id: null, error: { message: error?.message ?? 'บันทึกไม่สำเร็จ' } }
  return { id: data.id as string, error: null }
}

export type RecipeUsageRow = { id: string; productName: string; qtyPerUnit: number }

/**
 * หาว่าสูตรสินค้าไหนใช้วัตถุดิบนี้อยู่บ้าง พร้อมจำนวนที่ใช้ปัจจุบัน — ใช้เตือน+แก้ไขให้ตรงกัน ก่อนเปลี่ยน "หน่วย"
 * ของวัตถุดิบที่ถูกใช้ในสูตรแล้ว เพราะ qty_per_unit ในสูตรเดิมถูกกรอกมาตามหน่วยเก่า เปลี่ยนหน่วยแล้วตัวเลขนั้น
 * จะไม่ถูกแปลงตามให้อัตโนมัติ (ระบบไม่มีการแปลงหน่วยใดๆ เลย เช่นไม่รู้ว่า 1 ฟองหนักกี่กรัม คำนวณต้นทุน/ตัดสต็อก
 * จากตัวเลขดิบตรงๆ) จึงให้เจ้าของร้านกรอกจำนวนใหม่ (ตามหน่วยใหม่) เองต่อสินค้าแต่ละตัวตรงนี้เลย แล้วบันทึกพร้อมกันทีเดียว
 */
export async function getRecipeUsageForIngredient(id: string): Promise<{ rows: RecipeUsageRow[] }> {
  const { data } = await supabase.from('product_ingredients').select('id, qty_per_unit, products(name)').eq('ingredient_id', id)
  const rows = (data ?? [])
    .map((row: any) => ({ id: row.id as string, productName: row.products?.name as string | undefined, qtyPerUnit: Number(row.qty_per_unit) }))
    .filter((row): row is RecipeUsageRow => Boolean(row.productName))
  return { rows }
}

/** บันทึกจำนวนที่ใช้ใหม่ (qty_per_unit) ของหลายสูตรพร้อมกัน — ใช้ตอนแก้สูตรให้ตรงกับหน่วยใหม่ของวัตถุดิบ */
export async function updateRecipeQuantities(rows: { id: string; qty_per_unit: number }[]): Promise<{ error: { message: string } | null }> {
  for (const row of rows) {
    const { error } = await supabase.from('product_ingredients').update({ qty_per_unit: row.qty_per_unit }).eq('id', row.id)
    if (error) return { error: { message: error.message } }
  }
  return { error: null }
}

/** กันลบวัตถุดิบที่ถูกใช้ในสูตรสินค้าอยู่แล้ว (เช็กฝั่ง client ก่อน ให้ error อ่านง่ายกว่าปล่อยให้ FK constraint เด้ง) */
export async function deleteIngredient(id: string): Promise<{ error: { message: string } | null }> {
  const { count } = await supabase
    .from('product_ingredients')
    .select('id', { count: 'exact', head: true })
    .eq('ingredient_id', id)
  if ((count ?? 0) > 0) {
    return { error: { message: 'วัตถุดิบนี้ถูกใช้ในสูตรสินค้าแล้ว ลบไม่ได้ ให้ปิดใช้งานแทน' } }
  }
  const { error } = await supabase.from('ingredients').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}

export async function restockIngredient(
  id: string,
  qty: number,
  pricePerUnit: number | null,
  note: string | null
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('restock_ingredient', {
    p_ingredient_id: id,
    p_qty: qty,
    p_price_per_unit: pricePerUnit,
    p_note: note,
  })
  return { error: error ? { message: error.message } : null }
}

export async function adjustIngredientStock(
  id: string,
  qtyDelta: number,
  note: string | null
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('adjust_ingredient_stock', {
    p_ingredient_id: id,
    p_qty_delta: qtyDelta,
    p_note: note,
  })
  return { error: error ? { message: error.message } : null }
}
