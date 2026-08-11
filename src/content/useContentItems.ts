import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ContentPlatform, ContentStatus } from './contentMeta'

export type ContentItem = {
  id: string
  title: string
  platforms: ContentPlatform[]
  status: ContentStatus
  idea: string | null
  caption: string | null
  hashtags: string | null
  editing_style: string | null
  reference_url: string | null
  note: string | null
  post_date: string | null
  created_at: string
  updated_at: string
}

export function useContentItems() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .order('post_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    setItems((data ?? []) as ContentItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { items, loading, reload: load }
}

export function useContentItem(id: string | null) {
  const [item, setItem] = useState<ContentItem | null>(null)
  const [loading, setLoading] = useState(!!id)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    void supabase
      .from('content_items')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setItem((data ?? null) as ContentItem | null)
        setLoading(false)
      })
  }, [id])

  return { item, loading }
}
