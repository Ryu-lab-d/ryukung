import { describe, it, expect } from 'vitest'
import { nextContentStatus, CONTENT_STAGES } from './contentMeta'

describe('ลำดับขั้นความคืบหน้าของคอนเทนต์', () => {
  it('มีขั้นตอนครบตามที่ออกแบบไว้ ตั้งแต่ไอเดียจนถึงโพสต์แล้ว', () => {
    expect(CONTENT_STAGES.map((s) => s.status)).toEqual(['idea', 'script', 'shooting', 'editing', 'ready', 'posted'])
  })

  it('nextContentStatus เดินไปทีละขั้นเท่านั้น', () => {
    expect(nextContentStatus('idea')).toBe('script')
    expect(nextContentStatus('script')).toBe('shooting')
    expect(nextContentStatus('shooting')).toBe('editing')
    expect(nextContentStatus('editing')).toBe('ready')
    expect(nextContentStatus('ready')).toBe('posted')
  })

  it('nextContentStatus คืน null เมื่อถึงขั้นสุดท้าย (โพสต์แล้ว)', () => {
    expect(nextContentStatus('posted')).toBeNull()
  })

  it('nextContentStatus คืน null ถ้าส่งสถานะที่ไม่รู้จัก', () => {
    expect(nextContentStatus('unknown')).toBeNull()
  })
})
