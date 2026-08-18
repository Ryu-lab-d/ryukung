export type WithdrawalItemTotals = {
  qty_out: number
  qty_sold: number | null
  amount_collected: number | null
  unit_cost: number
  is_wage: boolean
}

export type WithdrawalTotals = {
  qtyOut: number
  qtySold: number
  revenue: number
  cost: number
  profit: number
  sellThroughPercent: number
}

/**
 * ต้นทุนคิดจาก qty_out เสมอ (สิ่งที่เบิกไป) ไม่ใช่ qty_sold เพราะของถูกทำ/เอาไปแล้วมีต้นทุนเกิดขึ้นจริง
 * ไม่ว่าสุดท้ายจะขายหมดหรือไม่ก็ตาม — ต่างจากรายรับที่นับเฉพาะที่ขายได้จริง (amount_collected)
 * แถวที่จ่ายเป็นค่าจ้าง (is_wage) ไม่ใช่ของที่ "ขาย" จึงกันออกจาก qtyOut/qtySold/revenue/sellThrough
 * แต่ยังนับต้นทุนของมันด้วย เพราะวัตถุดิบถูกใช้จริงไม่ว่าจะขายหรือให้เป็นค่าจ้าง
 */
export function computeWithdrawalTotals(items: WithdrawalItemTotals[]): WithdrawalTotals {
  const saleItems = items.filter((it) => !it.is_wage)
  const qtyOut = saleItems.reduce((sum, it) => sum + it.qty_out, 0)
  const qtySold = saleItems.reduce((sum, it) => sum + (it.qty_sold ?? 0), 0)
  const revenue = saleItems.reduce((sum, it) => sum + (it.amount_collected ?? 0), 0)
  const cost = items.reduce((sum, it) => sum + it.unit_cost * it.qty_out, 0)
  const profit = revenue - cost
  const sellThroughPercent = qtyOut > 0 ? (qtySold / qtyOut) * 100 : 0

  return { qtyOut, qtySold, revenue, cost, profit, sellThroughPercent }
}
