import { describe, it, expect } from 'vitest'
import { editingStyleCounts, platformCounts, monthCounts } from './contentStats'
import type { PostedContentItem } from './contentStats'

describe('editingStyleCounts', () => {
  it('นับจำนวนคอนเทนต์แยกตามแนวการตัดต่อ เรียงจากมากไปน้อย', () => {
    const items: PostedContentItem[] = [
      { platforms: [], editing_style: 'ตลก', post_date: null },
      { platforms: [], editing_style: 'ตลก', post_date: null },
      { platforms: [], editing_style: 'ให้ความรู้', post_date: null },
    ]
    expect(editingStyleCounts(items)).toEqual([
      { label: 'ตลก', count: 2 },
      { label: 'ให้ความรู้', count: 1 },
    ])
  })

  it('ไม่ได้กรอกแนวตัดต่อไว้ นับรวมเป็น "ไม่ระบุ"', () => {
    const items: PostedContentItem[] = [
      { platforms: [], editing_style: null, post_date: null },
      { platforms: [], editing_style: '  ', post_date: null },
    ]
    expect(editingStyleCounts(items)).toEqual([{ label: 'ไม่ระบุ', count: 2 }])
  })
})

describe('platformCounts', () => {
  it('คอนเทนต์ 1 ชิ้นที่ลงหลายแพลตฟอร์ม นับเพิ่มให้ทุกแพลตฟอร์มที่เลือกไว้', () => {
    const items: PostedContentItem[] = [
      { platforms: ['instagram', 'tiktok'], editing_style: null, post_date: null },
      { platforms: ['instagram'], editing_style: null, post_date: null },
    ]
    const result = platformCounts(items)
    expect(result.find((r) => r.platform === 'instagram')?.count).toBe(2)
    expect(result.find((r) => r.platform === 'tiktok')?.count).toBe(1)
    expect(result.find((r) => r.platform === 'facebook')?.count).toBe(0)
  })
})

describe('monthCounts', () => {
  it('นับตามเดือนของ post_date เรียงเก่าไปใหม่ และข้ามรายการที่ไม่มีวันที่', () => {
    const items: PostedContentItem[] = [
      { platforms: [], editing_style: null, post_date: '2026-08-05' },
      { platforms: [], editing_style: null, post_date: '2026-08-20' },
      { platforms: [], editing_style: null, post_date: '2026-07-01' },
      { platforms: [], editing_style: null, post_date: null },
    ]
    const result = monthCounts(items)
    expect(result.map((r) => r.monthKey)).toEqual(['2026-07', '2026-08'])
    expect(result.find((r) => r.monthKey === '2026-08')?.count).toBe(2)
  })
})
