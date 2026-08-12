import { describe, it, expect } from 'vitest'
import { isLowStock } from './ingredientStatus'

describe('isLowStock', () => {
  it('สต็อกเท่ากับเกณฑ์เตือนพอดี ถือว่าใกล้หมดแล้ว', () => {
    expect(isLowStock({ stock_qty: 100, low_stock_threshold: 100 })).toBe(true)
  })

  it('สต็อกต่ำกว่าเกณฑ์เตือน ถือว่าใกล้หมด', () => {
    expect(isLowStock({ stock_qty: 50, low_stock_threshold: 100 })).toBe(true)
  })

  it('สต็อกสูงกว่าเกณฑ์เตือน ไม่ถือว่าใกล้หมด', () => {
    expect(isLowStock({ stock_qty: 150, low_stock_threshold: 100 })).toBe(false)
  })

  it('เกณฑ์เตือนเป็น 0 (ไม่ได้ตั้งไว้) ไม่เตือนเลยไม่ว่าสต็อกจะเหลือเท่าไหร่', () => {
    expect(isLowStock({ stock_qty: 0, low_stock_threshold: 0 })).toBe(false)
  })
})
