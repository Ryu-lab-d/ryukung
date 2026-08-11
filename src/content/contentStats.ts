import { PLATFORMS, type ContentPlatform } from './contentMeta'

export type PostedContentItem = {
  platforms: ContentPlatform[]
  editing_style: string | null
  post_date: string | null
}

/** นับจำนวนคอนเทนต์ที่โพสต์แล้วแยกตามแนวการตัดต่อ (เป็น free text ที่พนักงานพิมพ์เอง จึง group ตามข้อความที่ตรงกันเป๊ะเท่านั้น) */
export function editingStyleCounts(items: PostedContentItem[]): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const it of items) {
    const label = it.editing_style?.trim() || 'ไม่ระบุ'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}

/** นับตามแพลตฟอร์ม — คอนเทนต์ 1 ชิ้นลงได้หลายแพลตฟอร์มพร้อมกัน จึงนับซ้ำได้ในแต่ละแพลตฟอร์มที่เลือกไว้ */
export function platformCounts(items: PostedContentItem[]): { platform: ContentPlatform; label: string; icon: string; count: number }[] {
  const counts = new Map<ContentPlatform, number>()
  for (const it of items) {
    for (const p of it.platforms) {
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
  }
  return PLATFORMS.map((p) => ({ platform: p.value, label: p.label, icon: p.icon, count: counts.get(p.value) ?? 0 }))
}

/** นับตามเดือนที่โพสต์ (จาก post_date) เรียงเก่า→ใหม่ เอาเฉพาะเดือนที่มีข้อมูลจริง */
export function monthCounts(items: PostedContentItem[]): { monthKey: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const it of items) {
    if (!it.post_date) continue
    const key = it.post_date.slice(0, 7)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, count]) => ({
      monthKey,
      label: new Date(monthKey + '-01T00:00:00').toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      count,
    }))
}
