import { supabase } from '../lib/supabase'
import type { ContentPlatform, ContentStatus } from './contentMeta'

export type ContentItemInput = {
  title: string
  platforms: ContentPlatform[]
  status: ContentStatus
  idea: string | null
  hook: string | null
  goal: string | null
  caption: string | null
  hashtags: string | null
  editing_style: string | null
  reference_url: string | null
  note: string | null
  post_date: string | null
}

export async function saveContentItem(id: string | null, input: ContentItemInput): Promise<{ id: string | null; error: { message: string } | null }> {
  if (id) {
    const { error } = await supabase.from('content_items').update(input).eq('id', id)
    return { id: error ? null : id, error: error ? { message: error.message } : null }
  }
  const { data, error } = await supabase.from('content_items').insert(input).select().single()
  if (error || !data) return { id: null, error: { message: error?.message ?? 'บันทึกไม่สำเร็จ' } }
  return { id: data.id as string, error: null }
}

export async function deleteContentItem(id: string): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('content_items').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}

export async function updateContentStatus(id: string, status: ContentStatus): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('content_items').update({ status }).eq('id', id)
  return { error: error ? { message: error.message } : null }
}
