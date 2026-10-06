import { describe, it, expect } from 'vitest'
import { normalizeOrderCode } from './invoiceApi'

describe('normalizeOrderCode', () => {
  it('ตัดอักขระครอบหัวท้ายจากเครื่องสแกนทิ้ง', () => {
    expect(normalizeOrderCode('~RYB-001296^')).toBe('RYB-001296')
    expect(normalizeOrderCode('*RYB-001296*')).toBe('RYB-001296')
    expect(normalizeOrderCode('  ryb-001296\r\n')).toBe('RYB-001296')
    expect(normalizeOrderCode('\u0002RYB-001296\u0003')).toBe('RYB-001296')
  })
  it('พิมพ์เลขบางส่วนยังใช้ได้ และเลขที่ไม่มีขีดก็ได้', () => {
    expect(normalizeOrderCode('001296')).toBe('001296')
    expect(normalizeOrderCode('RYB001296')).toBe('RYB001296')
    expect(normalizeOrderCode('')).toBe('')
  })
})
