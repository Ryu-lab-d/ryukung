import { supabase } from '../lib/supabase'

export type WithdrawalItemInput = {
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty_out: number
}

export async function createWithdrawal(params: {
  withdrawnAt: string
  location: string | null
  note: string | null
  withdrawnBy: string | null
  items: WithdrawalItemInput[]
}): Promise<{ id: string | null; error: { message: string } | null }> {
  const { data: withdrawal, error } = await supabase
    .from('stock_withdrawals')
    .insert({ withdrawn_at: params.withdrawnAt, location: params.location, note: params.note, withdrawn_by: params.withdrawnBy })
    .select()
    .single()
  if (error || !withdrawal) return { id: null, error: { message: error?.message ?? 'บันทึกไม่สำเร็จ' } }

  const rows = params.items.map((it, i) => ({ ...it, withdrawal_id: withdrawal.id, sort_order: i }))
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
