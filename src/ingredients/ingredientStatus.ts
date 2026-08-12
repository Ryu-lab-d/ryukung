import type { Ingredient } from './useIngredients'

/** วัตถุดิบใกล้หมดเมื่อสต็อกคงเหลือ <= เกณฑ์เตือนที่ตั้งไว้ (เกณฑ์ 0 = ไม่เตือนเลย ปิดฟีเจอร์นี้ไว้สำหรับวัตถุดิบนั้น) */
export function isLowStock(ingredient: Pick<Ingredient, 'stock_qty' | 'low_stock_threshold'>): boolean {
  return ingredient.low_stock_threshold > 0 && ingredient.stock_qty <= ingredient.low_stock_threshold
}
