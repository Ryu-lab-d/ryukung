import { useState } from 'react'
import { restockIngredient } from './api'
import { SuccessOverlay } from '../lib/SuccessOverlay'

/** เติมสต็อก (ซื้อวัตถุดิบเข้ามาใหม่) — ใส่ราคาซื้อด้วยก็ได้ ระบบจะคำนวณต้นทุนเฉลี่ยต่อหน่วยให้อัตโนมัติ */
export function RestockModal({
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
  const [qty, setQty] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  async function handleSave() {
    const n = Number(qty)
    if (!n || n <= 0) {
      setError('กรุณาใส่จำนวนที่เติมให้ถูกต้อง')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await restockIngredient(
      ingredientId,
      n,
      pricePerUnit ? Number(pricePerUnit) : null,
      note.trim() || null
    )
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
          <h2 className="text-lg font-semibold">➕ เติมสต็อก: {ingredientName}</h2>

          <div className="space-y-1">
            <label htmlFor="restock-qty" className="text-sm text-stone-600">จำนวนที่เติม ({unit})</label>
            <input
              id="restock-qty"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="restock-price" className="text-sm text-stone-600">ราคาซื้อต่อ {unit} (ไม่บังคับ)</label>
            <input
              id="restock-price"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder="ใส่ไว้จะคำนวณต้นทุนเฉลี่ยให้อัตโนมัติ"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="restock-note" className="text-sm text-stone-600">หมายเหตุ (ไม่บังคับ)</label>
            <input
              id="restock-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ซื้อจากร้าน..."
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
              {saving ? 'กำลังบันทึก...' : 'เติมสต็อก'}
            </button>
          </div>
        </div>
      </div>

      {showSuccess && (
        <SuccessOverlay
          message="เติมสต็อกแล้ว"
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
