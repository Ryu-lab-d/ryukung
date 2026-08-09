import { describe, it, expect } from 'vitest'
import { computeTopProducts, type SalesOrder } from './useSalesSummary'

function order(items: { product_name: string; qty: number; line_total: number }[]): SalesOrder {
  return {
    id: crypto.randomUUID(),
    order_no: 'RYB-000001',
    created_at: '2026-08-09T00:00:00Z',
    items_total: 0,
    items_cost_total: 0,
    grand_total: 0,
    order_items: items,
  }
}

describe('computeTopProducts', () => {
  it('รวมจำนวนและยอดขายของสินค้าชื่อเดียวกันจากหลายออเดอร์เข้าด้วยกัน', () => {
    const orders = [
      order([{ product_name: 'คุกกี้', qty: 2, line_total: 80 }]),
      order([{ product_name: 'คุกกี้', qty: 3, line_total: 120 }]),
    ]
    const top = computeTopProducts(orders)
    expect(top).toEqual([{ name: 'คุกกี้', qty: 5, revenue: 200 }])
  })

  it('เรียงจากขายดีสุด (จำนวนชิ้นมากสุด) ไปน้อยสุด', () => {
    const orders = [
      order([
        { product_name: 'บราวนี่', qty: 1, line_total: 50 },
        { product_name: 'มัฟฟิน', qty: 10, line_total: 300 },
      ]),
    ]
    const top = computeTopProducts(orders)
    expect(top.map((p) => p.name)).toEqual(['มัฟฟิน', 'บราวนี่'])
  })

  it('ไม่มีออเดอร์เลย คืนอาร์เรย์ว่าง', () => {
    expect(computeTopProducts([])).toEqual([])
  })
})
