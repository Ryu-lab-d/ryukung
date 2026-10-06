import { describe, it, expect } from 'vitest'
import { thaiBahtText } from './thaiBahtText'

describe('thaiBahtText', () => {
  it('อ่านจำนวนเงินเป็นคำไทยถูกหลักภาษา', () => {
    expect(thaiBahtText(0)).toBe('ศูนย์บาทถ้วน')
    expect(thaiBahtText(1)).toBe('หนึ่งบาทถ้วน')
    expect(thaiBahtText(11)).toBe('สิบเอ็ดบาทถ้วน')
    expect(thaiBahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน')
    expect(thaiBahtText(100)).toBe('หนึ่งร้อยบาทถ้วน')
    expect(thaiBahtText(125)).toBe('หนึ่งร้อยยี่สิบห้าบาทถ้วน')
    expect(thaiBahtText(1250)).toBe('หนึ่งพันสองร้อยห้าสิบบาทถ้วน')
    expect(thaiBahtText(1_000_000)).toBe('หนึ่งล้านบาทถ้วน')
  })

  it('มีสตางค์ต่อท้าย', () => {
    expect(thaiBahtText(125.5)).toBe('หนึ่งร้อยยี่สิบห้าบาทห้าสิบสตางค์')
    expect(thaiBahtText(0.25)).toBe('ศูนย์บาทยี่สิบห้าสตางค์')
  })
})
