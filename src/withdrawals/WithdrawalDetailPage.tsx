import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWithdrawal } from './useWithdrawal'
import { settleWithdrawal, reopenWithdrawal, deleteWithdrawal } from './api'
import { computeWithdrawalTotals } from './withdrawalMath'
import { formatBaht } from '../lib/money'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

type SettleRow = { qty_sold: string; amount_collected: string; amountTouched: boolean }

export function WithdrawalDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { withdrawal, items, loading, reload } = useWithdrawal(id ?? null)
  const draftKey = id ? `withdrawal-detail:${id}` : null
  const [draft] = useState(() => (draftKey ? loadFormDraft<{ rows: SettleRow[] }>(draftKey) : null))
  const [rows, setRows] = useState<SettleRow[]>(draft?.rows ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const skippedInitialSync = useRef(false)

  useEffect(() => {
    // ถ้ามีร่างที่กู้คืนมา ให้ข้ามการเซ็ตค่าจาก items ครั้งแรกครั้งเดียว (ไม่งั้นข้อมูลที่พิมพ์ค้างไว้จะถูกทับ)
    // ครั้งต่อๆ ไป (เช่น หลังปิดรอบ/แก้ไขผลขายแล้ว items เปลี่ยนจริง) ให้ sync จาก items ตามปกติ
    if (draft && !skippedInitialSync.current) {
      skippedInitialSync.current = true
      return
    }
    setRows(
      items.map((it) => ({
        qty_sold: it.qty_sold === null ? '' : String(it.qty_sold),
        amount_collected: it.amount_collected === null ? '' : String(it.amount_collected),
        amountTouched: it.amount_collected !== null,
      }))
    )
  }, [items, draft])

  useFormDraft(draftKey, { rows })

  function updateQtySold(index: number, value: string) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        if (r.amountTouched) return { ...r, qty_sold: value }
        const suggested = (Number(value) || 0) * items[index].unit_price
        return { ...r, qty_sold: value, amount_collected: suggested > 0 ? String(suggested) : '' }
      })
    )
  }

  function updateAmount(index: number, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, amount_collected: value, amountTouched: true } : r)))
  }

  async function handleSettle() {
    if (!withdrawal) return
    setSaving(true)
    const { error: settleError } = await settleWithdrawal(
      withdrawal.id,
      items.map((it, i) => ({
        id: it.id,
        qty_sold: Number(rows[i]?.qty_sold) || 0,
        amount_collected: Number(rows[i]?.amount_collected) || 0,
      }))
    )
    setSaving(false)
    if (settleError) {
      setError(settleError.message)
      return
    }
    if (draftKey) clearFormDraft(draftKey)
    await reload()
  }

  async function handleReopen() {
    if (!withdrawal) return
    await reopenWithdrawal(withdrawal.id)
    await reload()
  }

  async function handleDelete() {
    if (!withdrawal) return
    setShowDeleteConfirm(false)
    await deleteWithdrawal(withdrawal.id)
    navigate('/withdrawals')
  }

  if (loading || !withdrawal) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  const totals = computeWithdrawalTotals(items)
  const isSettled = withdrawal.status === 'settled'

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
      <Link to="/withdrawals" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าเบิกของ
      </Link>

      <div>
        <h1 className="text-lg font-semibold">
          {new Date(withdrawal.withdrawn_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          {withdrawal.location && ` · ${withdrawal.location}`}
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          👤 ผู้เบิก: {withdrawal.staff_members?.display_name ?? withdrawal.staff_members?.email ?? 'ไม่ระบุ'}
        </p>
        {withdrawal.note && <p className="text-sm text-stone-500 mt-0.5">{withdrawal.note}</p>}
      </div>

      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={it.id} className="rounded-lg border border-stone-200 p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{it.product_name}</span>
              <span className="text-stone-500">เบิกไป {it.qty_out} ชิ้น</span>
            </div>
            {isSettled ? (
              <div className="flex justify-between text-sm text-stone-600">
                <span>ขายได้ {it.qty_sold ?? 0} ชิ้น · เหลือ {it.qty_out - (it.qty_sold ?? 0)} ชิ้น</span>
                <span className="font-medium text-stone-900">{formatBaht(it.amount_collected ?? 0)} บาท</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label htmlFor={`qty-sold-${it.id}`} className="text-xs text-stone-500">ขายได้กี่ชิ้น</label>
                  <input
                    id={`qty-sold-${it.id}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={it.qty_out}
                    value={rows[i]?.qty_sold ?? ''}
                    onChange={(e) => updateQtySold(i, e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                  />
                </div>
                <div className="space-y-0.5">
                  <label htmlFor={`amount-collected-${it.id}`} className="text-xs text-stone-500">ได้เงินเท่าไหร่ (บาท)</label>
                  <input
                    id={`amount-collected-${it.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={rows[i]?.amount_collected ?? ''}
                    onChange={(e) => updateAmount(i, e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isSettled && (
        <div className="rounded-2xl bg-stone-900 text-white p-5 space-y-2">
          <div className="flex justify-between text-sm text-stone-300">
            <span>ขายได้ {totals.qtySold}/{totals.qtyOut} ชิ้น</span>
            <span>{totals.sellThroughPercent.toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-sm text-stone-300"><span>รายรับ</span><span>{formatBaht(totals.revenue)}</span></div>
          <div className="flex justify-between text-sm text-stone-300"><span>ต้นทุน</span><span>{formatBaht(totals.cost)}</span></div>
          <div className="flex justify-between text-xl font-bold border-t border-stone-700 pt-2">
            <span>กำไร</span>
            <span className={totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatBaht(totals.profit)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        {isSettled ? (
          <button
            type="button"
            onClick={() => void handleReopen()}
            className="flex-1 rounded-xl border-2 border-stone-300 text-stone-700 font-medium py-3"
          >
            แก้ไขผลขาย
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSettle()}
            disabled={saving}
            className="flex-1 rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'ปิดรอบ / บันทึกผลขาย'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-xl border-2 border-red-300 text-red-700 font-medium px-4"
        >
          ลบ
        </button>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="แน่ใจนะว่าจะลบรายการเบิกของนี้?"
          message="ลบแล้วกู้คืนไม่ได้"
          confirmLabel="ลบ"
          cancelLabel="ไม่ลบ"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
