export type IngredientLine = { purchase_qty: number; purchase_price: number; qty_used: number }
export type LaborLine = { amount: number }

/** ต้นทุนของวัตถุดิบ 1 รายการที่ใช้จริงในสูตรนี้ = (ราคาที่ซื้อ ÷ จำนวนที่ซื้อ) × จำนวนที่ใช้ */
export function ingredientCost(line: IngredientLine): number {
  if (line.purchase_qty <= 0) return 0
  const unitCost = line.purchase_price / line.purchase_qty
  return unitCost * line.qty_used
}

export type RecipeCostResult = {
  ingredientTotal: number
  overhead: number
  laborTotal: number
  totalCost: number
  costPerUnit: number
  profitPerUnit: number
  suggestedPrice: number
}

/**
 * ต้นทุนรวม = วัตถุดิบทั้งหมด + waste/overhead (% ของต้นทุนวัตถุดิบ) + ค่าแรง/ค่าใช้จ่ายอื่นๆ
 * ต้นทุนต่อชิ้น = ต้นทุนรวม ÷ จำนวนที่ทำได้ทั้งหมด
 * ราคาขายแนะนำ = ต้นทุนต่อชิ้น + (ต้นทุนต่อชิ้น × % กำไรที่ต้องการ) — กำไรคิดแบบ markup จากต้นทุน ไม่ใช่ margin จากราคาขาย
 */
export function computeRecipeCost(params: {
  ingredients: IngredientLine[]
  labor: LaborLine[]
  wasteOverheadPercent: number
  yieldQty: number
  profitPercent: number
}): RecipeCostResult {
  const ingredientTotal = params.ingredients.reduce((sum, it) => sum + ingredientCost(it), 0)
  const overhead = ingredientTotal * (params.wasteOverheadPercent / 100)
  const laborTotal = params.labor.reduce((sum, l) => sum + l.amount, 0)
  const totalCost = ingredientTotal + overhead + laborTotal
  const costPerUnit = params.yieldQty > 0 ? totalCost / params.yieldQty : 0
  const profitPerUnit = costPerUnit * (params.profitPercent / 100)
  const suggestedPrice = costPerUnit + profitPerUnit

  return { ingredientTotal, overhead, laborTotal, totalCost, costPerUnit, profitPerUnit, suggestedPrice }
}
