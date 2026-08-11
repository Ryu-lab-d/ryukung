import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PostedContentItem } from './contentStats'

/** ดึงเฉพาะคอนเทนต์ที่ "โพสต์แล้ว" จริง เพราะหน้าสถิตินี้ตอบคำถามว่า "ที่ผ่านมาเราโพสต์อะไรไปบ้าง" ไม่ใช่สถานะที่ยังวางแผนอยู่ */
export function useContentStats() {
  const [items, setItems] = useState<PostedContentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void supabase
      .from('content_items')
      .select('platforms, editing_style, post_date')
      .eq('status', 'posted')
      .then(({ data }) => {
        setItems((data ?? []) as PostedContentItem[])
        setLoading(false)
      })
  }, [])

  return { items, loading }
}
