import { describe, it, expect } from 'vitest'
import { bestPromo, computeDiscount, generatePromoCode, promoSummary, type PublicPromo } from './promoApi'

const p = (over: Partial<PublicPromo>): PublicPromo => ({
  id: 'x', name: 'โปร', description: null, kind: 'percent', value: 10, min_subtotal: 0, max_discount: null, ends_at: null, ...over,
})

describe('computeDiscount', () => {
  it('เปอร์เซ็นต์ / เพดาน / บาท / ขั้นต่ำ / ไม่เกินยอดสินค้า', () => {
    expect(computeDiscount(p({ value: 10 }), 300)).toBe(30)
    expect(computeDiscount(p({ value: 10, max_discount: 25 }), 300)).toBe(25)
    expect(computeDiscount(p({ kind: 'amount', value: 50 }), 300)).toBe(50)
    expect(computeDiscount(p({ kind: 'amount', value: 50 }), 30)).toBe(30)
    expect(computeDiscount(p({ min_subtotal: 200 }), 199)).toBe(0)
    expect(computeDiscount(p({ min_subtotal: 200 }), 200)).toBe(20)
    expect(computeDiscount(null, 300)).toBe(0)
  })
})

describe('bestPromo / promoSummary / generatePromoCode', () => {
  it('เลือกโปรที่ลดมากสุด และข้ามโปรที่ยังไม่ถึงขั้นต่ำ', () => {
    const a = p({ id: 'a', value: 5 })
    const b = p({ id: 'b', kind: 'amount', value: 40 })
    const c = p({ id: 'c', value: 50, min_subtotal: 1000 })
    expect(bestPromo([a, b, c], 300)?.id).toBe('b')
    expect(bestPromo([a, b, c], 2000)?.id).toBe('c')
    expect(bestPromo([c], 300)).toBeNull()
  })
  it('สรุปข้อความโปร', () => {
    expect(promoSummary(p({ value: 10, max_discount: 50, min_subtotal: 300 }))).toBe('ลด 10% (สูงสุด 50 บาท) เมื่อซื้อครบ 300 บาท')
    expect(promoSummary(p({ kind: 'amount', value: 20 }))).toBe('ลด 20 บาท')
  })
  it('โค้ดสุ่มรูปแบบ RYU-XXXXX', () => {
    expect(generatePromoCode()).toMatch(/^RYU-[A-Z2-9]{5}$/)
  })
})
