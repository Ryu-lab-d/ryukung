import { describe, it, expect } from 'vitest'
import { computeProductProfitability } from './productProfitability'
import type { SalesOrder } from './useSalesSummary'
import type { ProductIngredientLink } from './useAllProductIngredients'

function order(items: SalesOrder['order_items']): SalesOrder {
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

describe('computeProductProfitability', () => {
  it('สินค้าที่มีสูตรผูกไว้ ใช้ต้นทุนจากสูตร+ราคาวัตถุดิบปัจจุบัน ไม่ใช่ unit_cost ตอนขาย', () => {
    const orders = [
      order([{ product_id: 'p1', product_name: 'คุกกี้', qty: 10, line_total: 400, unit_cost: 999 }]), // unit_cost เก่ามั่วๆ ไม่ควรถูกใช้
    ]
    const productIngredients: ProductIngredientLink[] = [{ product_id: 'p1', ingredient_id: 'ing1', qty_per_unit: 20 }]
    const ingredientCostById = new Map([['ing1', 0.5]]) // แป้ง 0.5 บาท/กรัม
    const result = computeProductProfitability(orders, productIngredients, ingredientCostById)

    // ต้นทุนต่อชิ้น = 20*0.5 = 10 บาท, 10 ชิ้น = 100 บาท
    expect(result).toEqual([
      { productId: 'p1', name: 'คุกกี้', qty: 10, revenue: 400, cost: 100, costSource: 'recipe', profit: 300, marginPercent: 75 },
    ])
  })

  it('สินค้าที่ยังไม่มีสูตรผูกไว้ ใช้ต้นทุนสะสมจาก unit_cost ตอนขาย', () => {
    const orders = [order([{ product_id: 'p2', product_name: 'บราวนี่', qty: 5, line_total: 300, unit_cost: 20 }])]
    const result = computeProductProfitability(orders, [], new Map())
    expect(result).toEqual([
      { productId: 'p2', name: 'บราวนี่', qty: 5, revenue: 300, cost: 100, costSource: 'historical', profit: 200, marginPercent: (200 / 300) * 100 },
    ])
  })

  it('รวมยอดของสินค้าเดียวกันจากหลายออเดอร์เข้าด้วยกัน', () => {
    const orders = [
      order([{ product_id: 'p1', product_name: 'คุกกี้', qty: 5, line_total: 200, unit_cost: 15 }]),
      order([{ product_id: 'p1', product_name: 'คุกกี้', qty: 3, line_total: 120, unit_cost: 15 }]),
    ]
    const result = computeProductProfitability(orders, [], new Map())
    expect(result).toHaveLength(1)
    expect(result[0].qty).toBe(8)
    expect(result[0].revenue).toBe(320)
  })

  it('เรียงจากกำไรมากไปน้อย ไม่ใช่เรียงตามจำนวนชิ้น', () => {
    const orders = [
      order([
        { product_id: 'p1', product_name: 'ขายเยอะกำไรน้อย', qty: 100, line_total: 1000, unit_cost: 9.5 }, // กำไร 50
        { product_id: 'p2', product_name: 'ขายน้อยกำไรเยอะ', qty: 2, line_total: 400, unit_cost: 50 }, // กำไร 300
      ]),
    ]
    const result = computeProductProfitability(orders, [], new Map())
    expect(result.map((r) => r.name)).toEqual(['ขายน้อยกำไรเยอะ', 'ขายเยอะกำไรน้อย'])
  })

  it('ไม่มีออเดอร์เลย คืนอาร์เรย์ว่าง', () => {
    expect(computeProductProfitability([], [], new Map())).toEqual([])
  })

  it('ยอดขายเป็น 0 ไม่หารด้วยศูนย์ (marginPercent เป็น 0)', () => {
    const orders = [order([{ product_id: 'p1', product_name: 'แจกฟรี', qty: 1, line_total: 0, unit_cost: 5 }])]
    const result = computeProductProfitability(orders, [], new Map())
    expect(result[0].marginPercent).toBe(0)
  })
})
