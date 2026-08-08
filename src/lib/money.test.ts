import { describe, it, expect } from 'vitest'
import { formatBaht } from './money'

describe('formatBaht', () => {
  it('ใส่คอมมาและทศนิยมสองตำแหน่ง', () => {
    expect(formatBaht(1208)).toBe('1,208.00')
  })

  it('ปัดเศษทศนิยมให้เหลือสองตำแหน่ง', () => {
    expect(formatBaht(18.456)).toBe('18.46')
  })

  it('ศูนย์แสดงเป็น 0.00', () => {
    expect(formatBaht(0)).toBe('0.00')
  })

  it('รับ null หรือ undefined แล้วคืน 0.00 แทนที่จะพัง', () => {
    expect(formatBaht(null)).toBe('0.00')
    expect(formatBaht(undefined)).toBe('0.00')
  })

  it('รับ string ที่เป็นตัวเลขได้ เพราะ Postgres numeric ส่งกลับมาเป็น string', () => {
    expect(formatBaht('149.5')).toBe('149.50')
  })
})
