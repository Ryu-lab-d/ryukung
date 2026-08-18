import { supabase } from '../lib/supabase'
import { logWithdrawalToSheets } from '../lib/sheetsArchive'
import { computeWithdrawalTotals } from './withdrawalMath'

export type WithdrawalItemInput = {
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty_out: number
  is_wage?: boolean
}

export type WithdrawalWageInput =
  | { type: 'cash'; amount: number }
  | { type: 'product'; productId: string; productName: string; unitCost: number; qty: number }

export async function createWithdrawal(params: {
  withdrawnAt: string
  location: string | null
  note: string | null
  withdrawnBy: string | null
  wage: WithdrawalWageInput | null
  items: WithdrawalItemInput[]
}): Promise<{ id: string | null; error: { message: string } | null }> {
  const { data: withdrawal, error } = await supabase
    .from('stock_withdrawals')
    .insert({
      withdrawn_at: params.withdrawnAt,
      location: params.location,
      note: params.note,
      withdrawn_by: params.withdrawnBy,
      wage_type: params.wage?.type ?? null,
      wage_cash_amount: params.wage?.type === 'cash' ? params.wage.amount : null,
    })
    .select()
    .single()
  if (error || !withdrawal) return { id: null, error: { message: error?.message ?? 'บันทึกไม่สำเร็จ' } }

  const items = [...params.items]
  if (params.wage?.type === 'product') {
    items.push({
      product_id: params.wage.productId,
      product_name: params.wage.productName,
      unit_price: 0,
      unit_cost: params.wage.unitCost,
      qty_out: params.wage.qty,
      is_wage: true,
    })
  }

  const rows = items.map((it, i) => ({ ...it, withdrawal_id: withdrawal.id, sort_order: i }))
  const { error: itemsError } = await supabase.from('stock_withdrawal_items').insert(rows)
  if (itemsError) return { id: null, error: { message: itemsError.message } }

  let withdrawnByName: string | null = null
  if (params.withdrawnBy) {
    const { data: staff } = await supabase
      .from('staff_members')
      .select('display_name, email')
      .eq('id', params.withdrawnBy)
      .maybeSingle()
    withdrawnByName = staff?.display_name ?? staff?.email ?? null
  }

  // บันทึกลง Google Sheets แบบไม่บล็อกการเบิก — ถ้าไม่สำเร็จ (หรือไม่ได้ตั้งค่า webhook ไว้) ยังเบิกของได้ตามปกติ
  await logWithdrawalToSheets({
    event: 'created',
    withdrawal_id: withdrawal.id as string,
    withdrawn_at: params.withdrawnAt,
    location: params.location,
    withdrawn_by: withdrawnByName,
    items_summary: items.map((it) => `${it.product_name} x${it.qty_out}${it.is_wage ? ' (ค่าจ้าง)' : ''}`).join(', '),
    qty_out_total: items.reduce((sum, it) => sum + it.qty_out, 0),
    qty_sold_total: null,
    revenue: null,
    cost: items.reduce((sum, it) => sum + it.unit_cost * it.qty_out, 0),
    profit: null,
    wage_summary: wageSummaryFromInput(params.wage),
    wage_paid: false,
    status: 'open',
  })

  return { id: withdrawal.id as string, error: null }
}

function wageSummaryFromInput(wage: WithdrawalWageInput | null): string | null {
  if (!wage) return null
  return wage.type === 'cash' ? `เงินสด ${wage.amount} บาท` : `${wage.productName} x${wage.qty}`
}

export async function settleWithdrawal(
  withdrawalId: string,
  items: { id: string; qty_sold: number; amount_collected: number }[]
): Promise<{ error: { message: string } | null }> {
  for (const it of items) {
    const { error } = await supabase
      .from('stock_withdrawal_items')
      .update({ qty_sold: it.qty_sold, amount_collected: it.amount_collected })
      .eq('id', it.id)
    if (error) return { error: { message: error.message } }
  }
  const { error } = await supabase
    .from('stock_withdrawals')
    .update({ status: 'settled', settled_at: new Date().toISOString() })
    .eq('id', withdrawalId)
  if (error) return { error: { message: error.message } }

  await logSettledWithdrawalToSheets(withdrawalId)
  return { error: null }
}

/** ดึงข้อมูลฉบับเต็มหลังปิดรอบสำเร็จมาบันทึกลง Google Sheets แบบไม่บล็อกการปิดรอบ — พลาดแค่ไม่มีข้อมูลชุดนี้ใน Sheets เฉยๆ */
async function logSettledWithdrawalToSheets(withdrawalId: string): Promise<void> {
  const [{ data: withdrawal }, { data: items }] = await Promise.all([
    supabase.from('stock_withdrawals').select('*, staff_members(display_name, email)').eq('id', withdrawalId).single(),
    supabase.from('stock_withdrawal_items').select('*').eq('withdrawal_id', withdrawalId),
  ])
  if (!withdrawal || !items) return

  const totals = computeWithdrawalTotals(
    items.map((it) => ({
      qty_out: Number(it.qty_out),
      qty_sold: it.qty_sold === null ? null : Number(it.qty_sold),
      amount_collected: it.amount_collected === null ? null : Number(it.amount_collected),
      unit_cost: Number(it.unit_cost),
      is_wage: it.is_wage,
    }))
  )

  const wageItem = items.find((it) => it.is_wage)
  const wageSummary =
    withdrawal.wage_type === 'cash'
      ? `เงินสด ${withdrawal.wage_cash_amount} บาท`
      : withdrawal.wage_type === 'product' && wageItem
        ? `${wageItem.product_name} x${wageItem.qty_out}`
        : null

  await logWithdrawalToSheets({
    event: 'settled',
    withdrawal_id: withdrawalId,
    withdrawn_at: withdrawal.withdrawn_at,
    location: withdrawal.location,
    withdrawn_by: withdrawal.staff_members?.display_name ?? withdrawal.staff_members?.email ?? null,
    items_summary: items
      .map((it) => `${it.product_name} x${it.qty_out}${it.is_wage ? ' (ค่าจ้าง)' : ''}`)
      .join(', '),
    qty_out_total: totals.qtyOut,
    qty_sold_total: totals.qtySold,
    revenue: totals.revenue,
    cost: totals.cost,
    profit: totals.profit,
    wage_summary: wageSummary,
    wage_paid: withdrawal.wage_paid,
    status: 'settled',
  })
}

export async function reopenWithdrawal(withdrawalId: string): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from('stock_withdrawals')
    .update({ status: 'open', settled_at: null })
    .eq('id', withdrawalId)
  return { error: error ? { message: error.message } : null }
}

export async function deleteWithdrawal(withdrawalId: string): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('stock_withdrawals').delete().eq('id', withdrawalId)
  return { error: error ? { message: error.message } : null }
}

export async function markWagePaid(withdrawalId: string, paid: boolean): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from('stock_withdrawals')
    .update({ wage_paid: paid, wage_paid_at: paid ? new Date().toISOString() : null })
    .eq('id', withdrawalId)
  return { error: error ? { message: error.message } : null }
}

export async function markProceedsReceived(
  withdrawalId: string,
  received: boolean
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase
    .from('stock_withdrawals')
    .update({ proceeds_received: received, proceeds_received_at: received ? new Date().toISOString() : null })
    .eq('id', withdrawalId)
  return { error: error ? { message: error.message } : null }
}
