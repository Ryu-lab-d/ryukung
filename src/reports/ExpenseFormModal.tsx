import { useState } from 'react'
import { saveExpense } from './expensesApi'
import { EXPENSE_CATEGORIES } from './expenseMeta'
import type { ExpenseCategory } from './expenseMeta'
import type { Expense } from './useExpenses'
import { SuccessOverlay } from '../lib/SuccessOverlay'

function todayDateInputValue(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** ป็อปอัพบันทึกรายจ่าย ใช้ทั้งเพิ่มใหม่ (expense=null) และแก้ไขของเดิม (ส่ง expense เข้ามา) */
export function ExpenseFormModal({
  expense,
  onClose,
  onSaved,
  onDelete,
}: {
  expense: Expense | null
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}) {
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date ?? todayDateInputValue())
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'other')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  async function handleSave() {
    const n = Number(amount)
    if (!n || n <= 0) {
      setError('กรุณาใส่จำนวนเงินให้ถูกต้อง')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await saveExpense(expense?.id ?? null, {
      expense_date: expenseDate,
      category,
      amount: n,
      note: note.trim() || null,
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setShowSuccess(true)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade" onClick={onClose}>
        <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold">{expense ? 'แก้ไขรายจ่าย' : '+ บันทึกรายจ่าย'}</h2>

          <div className="space-y-1">
            <label htmlFor="expense-date" className="text-sm text-stone-600">วันที่</label>
            <input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="expense-category" className="text-sm text-stone-600">หมวดหมู่</label>
            <select
              id="expense-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="expense-amount" className="text-sm text-stone-600">จำนวนเงิน (บาท)</label>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="expense-note" className="text-sm text-stone-600">หมายเหตุ (ไม่บังคับ)</label>
            <input
              id="expense-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>

          {expense && onDelete && (
            <button type="button" onClick={onDelete} className="w-full text-red-600 text-sm py-1">
              🗑️ ลบรายจ่ายนี้
            </button>
          )}
        </div>
      </div>

      {showSuccess && (
        <SuccessOverlay
          message="บันทึกรายจ่ายแล้ว"
          durationMs={1200}
          onDone={() => {
            setShowSuccess(false)
            onSaved()
          }}
        />
      )}
    </>
  )
}
