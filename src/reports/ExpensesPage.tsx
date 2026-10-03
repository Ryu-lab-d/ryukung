import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { rangeToDates, type RangeKey } from './dateRange'
import { useExpenses, type Expense } from './useExpenses'
import { deleteExpense } from './expensesApi'
import { EXPENSE_CATEGORY_LABEL } from './expenseMeta'
import { ExpenseFormModal } from './ExpenseFormModal'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { formatBaht } from '../lib/money'
import { AmbientGlow, CountUp } from '../public/PublicSiteChrome'

const RANGE_LABELS: Record<RangeKey, string> = { today: 'วันนี้', '7d': '7 วัน', '30d': '30 วัน', custom: 'กำหนดเอง' }

const EXPENSE_ICON: Record<string, string> = {
  rent_utilities: '🏠', packaging: '📦', marketing: '📣', transport: '🛵', equipment: '🔧', ingredients_other: '🧂', other: '💸',
}

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
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-8">
        <Link
          to="/summary"
          className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
        >
          ← กลับหน้าสรุปยอด
        </Link>

        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">💸 รายจ่าย</h1>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-stone-900 text-white text-sm font-medium px-3.5 py-2 shadow-[0_6px_16px_-4px_rgb(0_0_0_/_0.3)] shrink-0"
          >
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
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
                (rangeKey === key ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600')
              }
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
        </div>

        {rangeKey === 'custom' && (
          <div className="flex gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
          </div>
        )}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-800 via-red-700 to-rose-600 text-white p-5 space-y-0.5 shadow-[0_18px_36px_-16px_rgb(127_29_29_/_0.7)]">
          <AmbientGlow />
          <p className="relative z-10 text-xs uppercase tracking-wide text-white/80">รายจ่ายรวมในช่วงนี้</p>
          <p className="relative z-10 text-4xl font-display font-bold"><CountUp value={total} format={formatBaht} duration={900} /></p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2.5 py-8 text-stone-400">
            <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
            กำลังโหลด...
          </div>
        ) : expenses.length === 0 ? (
          <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
            <p className="text-3xl mb-1.5">💸</p>
            <p className="text-sm text-stone-400">ยังไม่มีรายจ่ายในช่วงนี้ ลองกด "+ บันทึกรายจ่าย" เพื่อเริ่มบันทึก</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {expenses.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditing(e)}
                className="relative overflow-hidden w-full flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white pl-5 pr-3.5 py-3 text-left shadow-[0_6px_18px_-12px_rgb(51_32_14_/_0.45)]"
              >
                <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-red-400 to-rose-600" aria-hidden="true" />
                <span className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 grid place-items-center text-xl shrink-0" aria-hidden="true">
                  {EXPENSE_ICON[e.category] ?? '💸'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900">{EXPENSE_CATEGORY_LABEL[e.category] ?? e.category}</p>
                  <p className="text-xs text-stone-500">
                    {new Date(e.expense_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {e.note && ` · ${e.note}`}
                  </p>
                </div>
                <span className="font-bold tabular-nums shrink-0 text-red-700">{formatBaht(e.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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
