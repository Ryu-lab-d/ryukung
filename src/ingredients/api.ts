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

/**
 * หาว่าสูตรสินค้าไหนใช้วัตถุดิบนี้อยู่บ้าง — ใช้เตือนก่อนเปลี่ยน "หน่วย" ของวัตถุดิบที่ถูกใช้ในสูตรแล้ว
 * เพราะ qty_per_unit ในสูตรเดิมถูกกรอกมาตามหน่วยเก่า เปลี่ยนหน่วยแล้วตัวเลขนั้นจะไม่ถูกแปลงตามให้อัตโนมัติ
 * (ระบบไม่มีการแปลงหน่วยใดๆ เลย คำนวณต้นทุน/ตัดสต็อกจากตัวเลขดิบตรงๆ) ต้นทุน/สต็อกของสินค้านั้นจะผิดทันทีถ้าไม่ไปแก้สูตรตาม
 */
export async function getRecipeUsageForIngredient(id: string): Promise<{ productNames: string[] }> {
  const { data } = await supabase.from('product_ingredients').select('products(name)').eq('ingredient_id', id)
  const productNames = (data ?? [])
    .map((row: any) => row.products?.name as string | undefined)
    .filter((name): name is string => Boolean(name))
  return { productNames }
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
