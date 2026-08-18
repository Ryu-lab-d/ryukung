import { supabase } from '../lib/supabase'

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

  return { id: withdrawal.id as string, error: null }
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
  return { error: error ? { message: error.message } : null }
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
