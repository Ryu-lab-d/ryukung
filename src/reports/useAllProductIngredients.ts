import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ProductIngredientLink = { product_id: string; ingredient_id: string; qty_per_unit: number }

/** โหลดสูตรของสินค้าทุกชิ้นมาทีเดียว (ตารางเล็ก ไม่ต้อง filter รายสินค้า) ใช้คำนวณต้นทุนจริงในหน้ารายงาน */
export function useAllProductIngredients() {
  const [links, setLinks] = useState<ProductIngredientLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void supabase
      .from('product_ingredients')
      .select('product_id, ingredient_id, qty_per_unit')
      .then(({ data }) => {
        setLinks((data ?? []).map((r: any) => ({ ...r, qty_per_unit: Number(r.qty_per_unit) })))
        setLoading(false)
      })
  }, [])

  return { links, loading }
}
