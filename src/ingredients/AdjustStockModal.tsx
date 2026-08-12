import { useState } from 'react'
import { adjustIngredientStock } from './api'
import { SuccessOverlay } from '../lib/SuccessOverlay'

/** ปรับสต็อกเอง เช่น นับสต็อกจริงแล้วไม่ตรง ของเสียหาย — ใส่ค่าบวกเพื่อเพิ่ม ใส่ค่าลบเพื่อลด ไม่กระทบต้นทุนเฉลี่ยต่อหน่วย */
export function AdjustStockModal({
  ingredientId,
  ingredientName,
  unit,
  onClose,
  onSaved,
}: {
  ingredientId: string
  ingredientName: string
  unit: string
  onClose: () => void
  onSaved: () => void
}) {
  const [qtyDelta, setQtyDelta] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  async function handleSave() {
    const n = Number(qtyDelta)
    if (!n) {
      setError('กรุณาใส่จำนวนที่ต้องการปรับ (ห้ามเป็น 0)')
      return
    }
    if (!note.trim()) {
      setError('กรุณาระบุเหตุผลที่ปรับสต็อก')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await adjustIngredientStock(ingredientId, n, note.trim())
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
          <h2 className="text-lg font-semibold">⚖️ ปรับสต็อก: {ingredientName}</h2>
          <p className="text-xs text-stone-500">ใส่ค่าบวกเพื่อเพิ่ม ใส่ค่าลบเพื่อลด (เช่น -50 ถ้านับสต็อกจริงแล้วขาดไป 50 {unit})</p>

          <div className="space-y-1">
            <label htmlFor="adjust-qty" className="text-sm text-stone-600">จำนวนที่ปรับ ({unit})</label>
            <input
              id="adjust-qty"
              type="number"
              step="0.001"
              inputMode="decimal"
              autoFocus
              value={qtyDelta}
              onChange={(e) => setQtyDelta(e.target.value)}
              placeholder="เช่น -50 หรือ 20"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="adjust-note" className="text-sm text-stone-600">เหตุผล</label>
            <input
              id="adjust-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น นับสต็อกจริงแล้วไม่ตรง, ของเสียหาย"
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
              {saving ? 'กำลังบันทึก...' : 'ปรับสต็อก'}
            </button>
          </div>
        </div>
      </div>

      {showSuccess && (
        <SuccessOverlay
          message="ปรับสต็อกแล้ว"
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
