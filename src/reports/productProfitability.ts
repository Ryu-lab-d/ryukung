import type { SalesOrder } from './useSalesSummary'
import type { ProductIngredientLink } from './useAllProductIngredients'

export type ProductProfit = {
  productId: string | null
  name: string
  qty: number
  revenue: number
  cost: number
  costSource: 'recipe' | 'historical'
  profit: number
  marginPercent: number
}

/**
 * กำไรจริงต่อสินค้าในช่วงที่เลือก — ใช้ต้นทุนจากสูตร+ราคาวัตถุดิบ "ปัจจุบัน" ถ้าสินค้านั้นผูกสูตรไว้แล้ว
 * (ไม่ใช้ราคา ณ ตอนขาย เพราะคำถามคือ "ควรทำเมนูนี้ต่อไหม" ต้องดูต้นทุนตอนนี้ ไม่ใช่ตอนนั้น)
 * สินค้าที่ยังไม่มีสูตรผูกไว้ ใช้ต้นทุนสะสมจาก unit_cost ที่บันทึกไว้ตอนขายแทน (ยังเป็นค่าประมาณการเหมือนเดิม)
 */
export function computeProductProfitability(
  orders: SalesOrder[],
  productIngredients: ProductIngredientLink[],
  ingredientCostById: Map<string, number>
): ProductProfit[] {
  type Group = { productId: string | null; name: string; qty: number; revenue: number; historicalCost: number }
  const groups = new Map<string, Group>()

  for (const o of orders) {
    for (const it of o.order_items ?? []) {
      const key = it.product_id ?? `name:${it.product_name}`
      const g = groups.get(key) ?? { productId: it.product_id, name: it.product_name, qty: 0, revenue: 0, historicalCost: 0 }
      g.qty += Number(it.qty)
      g.revenue += Number(it.line_total)
      g.historicalCost += Number(it.unit_cost) * Number(it.qty)
      groups.set(key, g)
    }
  }

  const recipeByProduct = new Map<string, ProductIngredientLink[]>()
  for (const link of productIngredients) {
    const list = recipeByProduct.get(link.product_id) ?? []
    list.push(link)
    recipeByProduct.set(link.product_id, list)
  }

  const results: ProductProfit[] = []
  for (const g of groups.values()) {
    const recipeRows = g.productId ? recipeByProduct.get(g.productId) : undefined
    let cost: number
    let costSource: 'recipe' | 'historical'
    if (recipeRows && recipeRows.length > 0) {
      const costPerUnit = recipeRows.reduce((sum, r) => sum + r.qty_per_unit * (ingredientCostById.get(r.ingredient_id) ?? 0), 0)
      cost = costPerUnit * g.qty
      costSource = 'recipe'
    } else {
      cost = g.historicalCost
      costSource = 'historical'
    }
    const profit = g.revenue - cost
    const marginPercent = g.revenue > 0 ? (profit / g.revenue) * 100 : 0
    results.push({ productId: g.productId, name: g.name, qty: g.qty, revenue: g.revenue, cost, costSource, profit, marginPercent })
  }

  return results.sort((a, b) => b.profit - a.profit)
}
