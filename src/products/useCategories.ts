import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Category = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories((data ?? []) as Category[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const save = useCallback(
    async (id: string | null, patch: Partial<Category>) => {
      const { error } = id
        ? await supabase.from('categories').update(patch).eq('id', id)
        : await supabase.from('categories').insert(patch)
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  return { categories, loading, save, reload: load }
}
