import { describe, it, expect } from 'vitest'
import { computeWithdrawalTotals } from './withdrawalMath'

describe('computeWithdrawalTotals', () => {
  it('ยังไม่ปิดรอบ (qty_sold/amount_collected เป็น null ทั้งคู่) นับเป็น 0 ไม่ error', () => {
    const totals = computeWithdrawalTotals([{ qty_out: 20, qty_sold: null, amount_collected: null, unit_cost: 15 }])
    expect(totals.qtyOut).toBe(20)
    expect(totals.qtySold).toBe(0)
    expect(totals.revenue).toBe(0)
    expect(totals.cost).toBe(300)
    expect(totals.profit).toBe(-300)
    expect(totals.sellThroughPercent).toBe(0)
  })

  it('ปิดรอบแล้ว ขายได้ไม่หมด คำนวณกำไรและ % ขายได้ถูกต้อง', () => {
    // เบิกคุกกี้ไป 20 ชิ้น ต้นทุนชิ้นละ 15 = 300, ขายได้ 18 ชิ้น ได้เงินมา 720 บาท
    const totals = computeWithdrawalTotals([{ qty_out: 20, qty_sold: 18, amount_collected: 720, unit_cost: 15 }])
    expect(totals.cost).toBe(300)
    expect(totals.revenue).toBe(720)
    expect(totals.profit).toBe(420)
    expect(totals.sellThroughPercent).toBe(90)
  })

  it('ต้นทุนคิดจาก qty_out เสมอ แม้ขายไม่หมด ไม่ใช่คิดจาก qty_sold', () => {
    const totals = computeWithdrawalTotals([{ qty_out: 10, qty_sold: 2, amount_collected: 80, unit_cost: 15 }])
    expect(totals.cost).toBe(150) // 10 * 15 ไม่ใช่ 2 * 15
  })

  it('รวมหลายรายการสินค้าในเบิกครั้งเดียวกัน', () => {
    const totals = computeWithdrawalTotals([
      { qty_out: 20, qty_sold: 20, amount_collected: 800, unit_cost: 15 },
      { qty_out: 10, qty_sold: 5, amount_collected: 150, unit_cost: 20 },
    ])
    expect(totals.qtyOut).toBe(30)
    expect(totals.qtySold).toBe(25)
    expect(totals.revenue).toBe(950)
    expect(totals.cost).toBe(500) // 20*15 + 10*20
    expect(totals.profit).toBe(450)
    expect(totals.sellThroughPercent).toBeCloseTo((25 / 30) * 100)
  })

  it('ไม่มีรายการเลย คืนค่า 0 ทั้งหมด ไม่หารด้วยศูนย์', () => {
    const totals = computeWithdrawalTotals([])
    expect(totals).toEqual({ qtyOut: 0, qtySold: 0, revenue: 0, cost: 0, profit: 0, sellThroughPercent: 0 })
  })
})
