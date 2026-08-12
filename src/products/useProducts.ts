import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Product = {
  id: string
  name: string
  sku: string | null
  category_id: string | null
  price: number
  cost: number
  unit: string
  image_path: string | null
  is_active: boolean
  note: string | null
  created_at: string
  updated_at: string
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const save = useCallback(
    async (id: string | null, patch: Partial<Product>) => {
      const { data, error } = id
        ? await supabase.from('products').update(patch).eq('id', id).select().single()
        : await supabase.from('products').insert(patch).select().single()
      if (!error) await load()
      return { id: (data?.id as string | undefined) ?? null, error: error ? { message: error.message } : null }
    },
    [load]
  )

  const remove = useCallback(
    async (id: string) => {
      const { count } = await supabase
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id)
      if ((count ?? 0) > 0) {
        return { error: { message: 'สินค้านี้เคยถูกใช้ในออเดอร์แล้ว ลบไม่ได้ ให้ปิดขายแทน' } }
      }
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  return { products, loading, save, remove, reload: load }
}
