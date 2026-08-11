export type ContentPlatform = 'instagram' | 'tiktok' | 'facebook'
export type ContentStatus = 'idea' | 'script' | 'shooting' | 'editing' | 'ready' | 'posted'

export const PLATFORMS: { value: ContentPlatform; label: string; icon: string }[] = [
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'facebook', label: 'Facebook', icon: '👍' },
]

export const PLATFORM_ICON: Record<string, string> = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.icon]))
export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]))

/** ลำดับขั้นความคืบหน้าของคอนเทนต์ 1 ชิ้น ตั้งแต่ยังเป็นไอเดียจนถึงโพสต์จริง */
export const CONTENT_STAGES: { status: ContentStatus; label: string; icon: string }[] = [
  { status: 'idea', label: 'ไอเดีย', icon: '💡' },
  { status: 'script', label: 'เขียนบท/แคปชั่น', icon: '✍️' },
  { status: 'shooting', label: 'ถ่ายทำ', icon: '🎬' },
  { status: 'editing', label: 'ตัดต่อ', icon: '✂️' },
  { status: 'ready', label: 'พร้อมโพสต์', icon: '✅' },
  { status: 'posted', label: 'โพสต์แล้ว', icon: '📤' },
]

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(CONTENT_STAGES.map((s) => [s.status, s.label]))
export const STATUS_ICON: Record<string, string> = Object.fromEntries(CONTENT_STAGES.map((s) => [s.status, s.icon]))

export const STATUS_COLOR: Record<string, string> = {
  idea: 'bg-stone-100 text-stone-700 border-stone-200',
  script: 'bg-amber-100 text-amber-700 border-amber-200',
  shooting: 'bg-blue-100 text-blue-700 border-blue-200',
  editing: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ready: 'bg-green-100 text-green-700 border-green-200',
  posted: 'bg-stone-800 text-white border-stone-800',
}

export function nextContentStatus(current: string): ContentStatus | null {
  const idx = CONTENT_STAGES.findIndex((s) => s.status === current)
  if (idx === -1 || idx === CONTENT_STAGES.length - 1) return null
  return CONTENT_STAGES[idx + 1].status
}
