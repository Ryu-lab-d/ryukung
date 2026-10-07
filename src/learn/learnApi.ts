import { supabase } from '../lib/supabase'

export type Lesson = {
  id: string
  title: string
  ingredients: string | null
  steps: string | null
  tips: string | null
  video_url: string | null
}
export type LearnCourse = { id: string; title: string; emoji: string; description: string | null; lessons: Lesson[] }
export type LearnSession = { student_name: string; courses: LearnCourse[] }

export type CourseRow = { id: string; title: string; emoji: string; description: string | null; is_published: boolean; sort_order: number }
export type LessonRow = Lesson & { course_id: string; sort_order: number }
export type AccessCodeRow = {
  id: string
  code: string
  student_name: string
  course_ids: string[]
  expires_at: string | null
  revoked: boolean
  use_count: number
  last_used_at: string | null
  created_at: string
}

/** รหัสเข้าเรียน: ตัดตัวที่สับสนง่าย (0/O, 1/I/L) ออก เช่น COOK-7F3K9Q */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function generateAccessCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
  return `COOK-${body}`
}

/** ผู้ใช้อาจพิมพ์เล็ก/เว้นวรรค/ไม่ใส่ขีด — ปรับให้เป็นรูปแบบเดียวกับที่เก็บ */
export function normalizeAccessCode(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, '')
  return /^COOK[A-Z0-9]{8}$/.test(t) ? `COOK-${t.slice(4)}` : t
}

export async function openWithCode(code: string): Promise<{ session: LearnSession | null; error: string | null }> {
  const { data, error } = await supabase.rpc('learn_open', { p_code: normalizeAccessCode(code) })
  if (error) return { session: null, error: error.message }
  return { session: (data as LearnSession | null) ?? null, error: null }
}

/** แยกส่วนผสม: "ชื่อ | ปริมาณ" ต่อบรรทัด */
export function parseIngredients(text: string | null): { name: string; qty: string }[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, ...rest] = l.split('|')
      return { name: name.trim(), qty: rest.join('|').trim() }
    })
}

export function parseSteps(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trim().replace(/^\d+[.)]\s*/, ''))
    .filter(Boolean)
}
