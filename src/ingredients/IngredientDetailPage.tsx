import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useIngredient } from './useIngredients'
import { useIngredientMovements } from './useIngredientMovements'
import { saveIngredient, deleteIngredient } from './api'
import { RestockModal } from './RestockModal'
import { AdjustStockModal } from './AdjustStockModal'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { SuccessOverlay } from '../lib/SuccessOverlay'

const REASON_LABELS: Record<string, string> = {
  order_confirm: 'ยืนยันออเดอร์',
  order_edit_reverse: 'แก้ไขออเดอร์ (คืนของเดิม)',
  order_cancel_restore: 'ยกเลิกออเดอร์ (คืนสต็อก)',
  withdrawal_deduct: 'เบิกไปขายนอกร้าน',
  withdrawal_restore: 'ยกเลิกรายการเบิก (คืนสต็อก)',
  purchase_in: 'เติมสต็อก',
  manual_adjustment: 'ปรับสต็อกเอง',
}

export function IngredientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ingredient, loading, reload } = useIngredient(id ?? null)
  const { movements, loading: movementsLoading, reload: reloadMovements } = useIngredientMovements(id ?? null)

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('0')
  const [note, setNote] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showRestock, setShowRestock] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!ingredient) return
    setName(ingredient.name)
    setUnit(ingredient.unit)
    setLowStockThreshold(String(ingredient.low_stock_threshold))
    setNote(ingredient.note ?? '')
    setIsActive(ingredient.is_active)
  }, [ingredient])

  async function handleSave() {
    if (!id) return
    if (!name.trim()) {
      setError('กรุณาใส่ชื่อวัตถุดิบ')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await saveIngredient(id, {
      name: name.trim(),
      unit: unit.trim() || 'กรัม',
      low_stock_threshold: Number(lowStockThreshold) || 0,
      note: note.trim() || null,
      is_active: isActive,
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setShowSuccess(true)
  }

  async function handleDelete() {
    if (!id) return
    setShowDeleteConfirm(false)
    setDeleting(true)
    const { error: deleteError } = await deleteIngredient(id)
    setDeleting(false)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    navigate('/ingredients')
  }

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>
  if (!ingredient) return <div className="p-4 text-stone-500">ไม่พบวัตถุดิบนี้</div>

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">
      <Link to="/ingredients" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าวัตถุดิบ
      </Link>

      <div className="rounded-2xl bg-stone-900 text-white p-4 space-y-1">
        <p className="text-xs uppercase tracking-wide text-stone-300">สต็อกคงเหลือ</p>
        <p className="text-4xl font-bold tabular-nums">
          {ingredient.stock_qty.toLocaleString('th-TH')} <span className="text-lg font-normal text-stone-300">{ingredient.unit}</span>
        </p>
        <p className="text-sm text-stone-300">ต้นทุนเฉลี่ย ฿{ingredient.cost_per_unit.toFixed(2)} / {ingredient.unit}</p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setShowRestock(true)} className="flex-1 rounded-lg border-2 border-green-300 text-green-700 font-medium py-2.5">
          ➕ เติมสต็อก
        </button>
        <button type="button" onClick={() => setShowAdjust(true)} className="flex-1 rounded-lg border-2 border-stone-200 text-stone-700 font-medium py-2.5">
          ⚖️ ปรับสต็อก
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-3">
        <h2 className="text-sm font-semibold">แก้ไขข้อมูล</h2>

        <div className="space-y-1">
          <label htmlFor="ingredient-detail-name" className="text-sm text-stone-600">ชื่อวัตถุดิบ</label>
          <input
            id="ingredient-detail-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="ingredient-detail-unit" className="text-sm text-stone-600">หน่วย</label>
            <input
              id="ingredient-detail-unit"
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ingredient-detail-threshold" className="text-sm text-stone-600">เตือนเมื่อเหลือไม่เกิน</label>
            <input
              id="ingredient-detail-threshold"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="ingredient-detail-note" className="text-sm text-stone-600">หมายเหตุ (ไม่บังคับ)</label>
          <textarea
            id="ingredient-detail-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          เปิดใช้งาน
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="w-full rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-stone-500">ประวัติเข้า-ออกสต็อก</h2>
        {movementsLoading ? (
          <p className="text-sm text-stone-500">กำลังโหลด...</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-stone-400">ยังไม่มีประวัติ</p>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="text-stone-700">{REASON_LABELS[m.reason] ?? m.reason}</p>
                  <p className="text-xs text-stone-400">
                    {new Date(m.created_at).toLocaleString('th-TH')}
                    {m.note && ` · ${m.note}`}
                  </p>
                </div>
                <span className={'font-semibold tabular-nums shrink-0 ' + (m.qty_delta >= 0 ? 'text-green-700' : 'text-red-700')}>
                  {m.qty_delta >= 0 ? '+' : ''}
                  {m.qty_delta.toLocaleString('th-TH')} {ingredient.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full rounded-lg border-2 border-red-300 text-red-700 font-medium py-2.5"
      >
        🗑️ ลบวัตถุดิบนี้
      </button>

      {showRestock && (
        <RestockModal
          ingredientId={ingredient.id}
          ingredientName={ingredient.name}
          unit={ingredient.unit}
          onClose={() => setShowRestock(false)}
          onSaved={() => {
            setShowRestock(false)
            void reload()
            void reloadMovements()
          }}
        />
      )}

      {showAdjust && (
        <AdjustStockModal
          ingredientId={ingredient.id}
          ingredientName={ingredient.name}
          unit={ingredient.unit}
          onClose={() => setShowAdjust(false)}
          onSaved={() => {
            setShowAdjust(false)
            void reload()
            void reloadMovements()
          }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="แน่ใจนะว่าจะลบวัตถุดิบนี้?"
          message="ลบแล้วกู้คืนไม่ได้"
          confirmLabel="ลบถาวร"
          cancelLabel="ไม่ลบ"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showSuccess && <SuccessOverlay message="บันทึกแล้ว" durationMs={1200} onDone={() => setShowSuccess(false)} />}
    </div>
  )
}
