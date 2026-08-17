import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExpenseCategory } from './expenseMeta'

export type Expense = {
  id: string
  expense_date: string
  category: ExpenseCategory
  amount: number
  note: string | null
  created_at: string
  updated_at: string
}

/** from/to เป็น ISO timestamp แบบเดียวกับ rangeToDates ใช้ทั่วหน้ารายงาน — ตัดเหลือ YYYY-MM-DD เพราะ expense_date เป็นคอลัมน์ date ล้วน */
export function useExpenses(from?: string, to?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    if (from) query = query.gte('expense_date', from.slice(0, 10))
    if (to) query = query.lte('expense_date', to.slice(0, 10))
    const { data } = await query
    setExpenses((data ?? []).map((e: any) => ({ ...e, amount: Number(e.amount) })))
    setLoading(false)
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  return { expenses, loading, reload: load }
}
