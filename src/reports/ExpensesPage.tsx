import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { rangeToDates, type RangeKey } from './dateRange'
import { useExpenses, type Expense } from './useExpenses'
import { deleteExpense } from './expensesApi'
import { EXPENSE_CATEGORY_LABEL } from './expenseMeta'
import { ExpenseFormModal } from './ExpenseFormModal'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { formatBaht } from '../lib/money'

const RANGE_LABELS: Record<RangeKey, string> = { today: 'วันนี้', '7d': '7 วัน', '30d': '30 วัน', custom: 'กำหนดเอง' }

export function ExpensesPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { from, to } = useMemo(() => rangeToDates(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo])
  const { expenses, loading, reload } = useExpenses(from, to)

  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteExpense(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    void reload()
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <Link to="/summary" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าสรุปยอด
      </Link>

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">💸 รายจ่าย</h1>
        <button type="button" onClick={() => setShowAdd(true)} className="rounded-lg bg-stone-900 text-white text-sm font-medium px-3.5 py-2">
          + บันทึกรายจ่าย
        </button>
      </div>

      <div className="inline-flex rounded-full bg-stone-100 p-1 gap-1">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRangeKey(key)}
            className={
              'rounded-full px-3 py-1.5 text-sm font-medium ' +
              (rangeKey === key ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600')
            }
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {rangeKey === 'custom' && (
        <div className="flex gap-2">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </div>
      )}

      <div className="rounded-2xl bg-stone-900 text-white p-4 space-y-0.5">
        <p className="text-xs uppercase tracking-wide text-stone-300">รายจ่ายรวมในช่วงนี้</p>
        <p className="text-3xl font-bold">{formatBaht(total)}</p>
      </div>

      {loading ? (
        <p className="text-stone-500">กำลังโหลด...</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-stone-400">ยังไม่มีรายจ่ายในช่วงนี้ ลองกด "+ บันทึกรายจ่าย" เพื่อเริ่มบันทึก</p>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
          {expenses.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEditing(e)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left hover:bg-stone-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{EXPENSE_CATEGORY_LABEL[e.category] ?? e.category}</p>
                <p className="text-xs text-stone-500">
                  {new Date(e.expense_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {e.note && ` · ${e.note}`}
                </p>
              </div>
              <span className="font-semibold tabular-nums shrink-0">{formatBaht(e.amount)}</span>
            </button>
          ))}
        </div>
      )}

      {(showAdd || editing) && (
        <ExpenseFormModal
          expense={editing}
          onClose={() => {
            setShowAdd(false)
            setEditing(null)
          }}
          onSaved={() => {
            setShowAdd(false)
            setEditing(null)
            void reload()
          }}
          onDelete={
            editing
              ? () => {
                  setDeleteTarget(editing)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="ลบรายจ่ายนี้?"
          message="ลบแล้วกู้คืนไม่ได้"
          confirmLabel="ลบ"
          cancelLabel="ไม่ลบ"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
