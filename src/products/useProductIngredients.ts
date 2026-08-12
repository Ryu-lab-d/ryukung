import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ProductIngredientRow = { ingredient_id: string; qty_per_unit: number }

/** โหลดสูตรที่บันทึกไว้แล้วของสินค้าชิ้นหนึ่ง (สำหรับตอนเปิดหน้าแก้ไขสินค้า) */
export function useProductIngredients(productId: string | null) {
  const [rows, setRows] = useState<ProductIngredientRow[]>([])
  const [loading, setLoading] = useState(!!productId)

  useEffect(() => {
    if (!productId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void supabase
      .from('product_ingredients')
      .select('ingredient_id, qty_per_unit')
      .eq('product_id', productId)
      .order('sort_order')
      .then(({ data }) => {
        setRows((data ?? []).map((r: any) => ({ ingredient_id: r.ingredient_id, qty_per_unit: Number(r.qty_per_unit) })))
        setLoading(false)
      })
  }, [productId])

  return { rows, loading }
}
