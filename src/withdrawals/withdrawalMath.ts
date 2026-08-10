export type WithdrawalItemTotals = {
  qty_out: number
  qty_sold: number | null
  amount_collected: number | null
  unit_cost: number
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
 */
export function computeWithdrawalTotals(items: WithdrawalItemTotals[]): WithdrawalTotals {
  const qtyOut = items.reduce((sum, it) => sum + it.qty_out, 0)
  const qtySold = items.reduce((sum, it) => sum + (it.qty_sold ?? 0), 0)
  const revenue = items.reduce((sum, it) => sum + (it.amount_collected ?? 0), 0)
  const cost = items.reduce((sum, it) => sum + it.unit_cost * it.qty_out, 0)
  const profit = revenue - cost
  const sellThroughPercent = qtyOut > 0 ? (qtySold / qtyOut) * 100 : 0

  return { qtyOut, qtySold, revenue, cost, profit, sellThroughPercent }
}
