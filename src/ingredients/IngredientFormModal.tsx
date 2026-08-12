import { useState } from 'react'
import { saveIngredient } from './api'
import { SuccessOverlay } from '../lib/SuccessOverlay'

const UNIT_SUGGESTIONS = ['กรัม', 'กิโลกรัม', 'มิลลิลิตร', 'ลิตร', 'ชิ้น', 'ฟอง', 'ถุง']

/** ป็อปอัพเพิ่มวัตถุดิบแบบเร็ว กรอกแค่ชื่อ+หน่วย+เกณฑ์เตือนสต็อกใกล้หมด (ไม่บังคับ) รายละเอียดอื่น (หมายเหตุ) ค่อยเติมทีหลังในหน้ารายละเอียด */
export function IngredientFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('กรัม')
  const [lowStockThreshold, setLowStockThreshold] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      setError('กรุณาใส่ชื่อวัตถุดิบ')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await saveIngredient(null, {
      name: name.trim(),
      unit: unit.trim() || 'กรัม',
      low_stock_threshold: Number(lowStockThreshold) || 0,
      note: null,
      is_active: true,
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
          <h2 className="text-lg font-semibold">+ เพิ่มวัตถุดิบ</h2>

          <div className="space-y-1">
            <label htmlFor="ingredient-name" className="text-sm text-stone-600">ชื่อวัตถุดิบ</label>
            <input
              id="ingredient-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น แป้งสาลี"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ingredient-unit" className="text-sm text-stone-600">หน่วย</label>
            <input
              id="ingredient-unit"
              type="text"
              list="ingredient-unit-suggestions"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <datalist id="ingredient-unit-suggestions">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1">
            <label htmlFor="ingredient-threshold" className="text-sm text-stone-600">เตือนเมื่อสต็อกเหลือไม่เกิน (ไม่บังคับ)</label>
            <input
              id="ingredient-threshold"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <p className="text-xs text-stone-400">ใส่จำนวนสต็อกเริ่มต้นได้ทีหลังจากปุ่ม "เติมสต็อก" ในหน้ารายละเอียด</p>

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
        </div>
      </div>

      {showSuccess && (
        <SuccessOverlay
          message="บันทึกวัตถุดิบแล้ว"
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
