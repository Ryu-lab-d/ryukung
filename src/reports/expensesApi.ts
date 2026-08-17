import { supabase } from '../lib/supabase'
import type { ExpenseCategory } from './expenseMeta'

export type ExpenseInput = {
  expense_date: string
  category: ExpenseCategory
  amount: number
  note: string | null
}

export async function saveExpense(id: string | null, input: ExpenseInput): Promise<{ id: string | null; error: { message: string } | null }> {
  if (id) {
    const { error } = await supabase.from('expenses').update(input).eq('id', id)
    return { id: error ? null : id, error: error ? { message: error.message } : null }
  }
  const { data, error } = await supabase.from('expenses').insert(input).select().single()
  if (error || !data) return { id: null, error: { message: error?.message ?? 'บันทึกไม่สำเร็จ' } }
  return { id: data.id as string, error: null }
}

export async function deleteExpense(id: string): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  return { error: error ? { message: error.message } : null }
}
