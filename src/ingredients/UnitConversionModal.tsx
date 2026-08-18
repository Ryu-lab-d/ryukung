import { useState } from 'react'
import { autoConversionFactor } from './unitConversion'
import { convertIngredientUnit, type RecipeUsageRow } from './api'
import { SuccessOverlay } from '../lib/SuccessOverlay'

/**
 * แปลงหน่วยวัตถุดิบที่ถูกใช้ในสูตรอยู่แล้วให้อัตโนมัติ — ถ้าหน่วยเดิม/ใหม่อยู่ในหมวดเดียวกัน (น้ำหนัก, ปริมาตร,
 * หน่วยนับชิ้นเดี่ยว) คำนวณตัวคูณเองได้ชัวร์ ข้ามไปหน้าตรวจสอบเลย — ถ้าข้ามหมวดหรือไม่รู้จักหน่วย (รวมหน่วย
 * บรรจุภัณฑ์ที่ขนาดไม่คงที่) ต้องถามเจ้าของร้านครั้งเดียวว่า 1 หน่วยใหม่เท่ากับกี่หน่วยเดิม แล้วคำนวณให้ทุกอย่าง
 * อัตโนมัติจากคำตอบนั้น (จำนวนที่ใช้ในทุกสูตร + สต็อกคงเหลือ + ต้นทุนเฉลี่ย) ไม่ต้องพิมพ์ทีละสูตรเอง
 */
export function UnitConversionModal({
  ingredientId,
  oldUnit,
  newUnit,
  rows,
  stockQty,
  costPerUnit,
  onCancel,
  onConfirmed,
}: {
  ingredientId: string
  oldUnit: string
  newUnit: string
  rows: RecipeUsageRow[]
  stockQty: number
  costPerUnit: number
  onCancel: () => void
  onConfirmed: () => void
}) {
  const autoFactor = autoConversionFactor(oldUnit, newUnit)
  const [manualAnswer, setManualAnswer] = useState('')
  const [step, setStep] = useState<'ask' | 'review'>(autoFactor !== null ? 'review' : 'ask')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const manualAnswerNum = Number(manualAnswer)
  const factor = autoFactor ?? (manualAnswerNum > 0 ? 1 / manualAnswerNum : null)

  async function handleConfirm() {
    if (!factor) return
    setSaving(true)
    setError(null)
    const { error: convertError } = await convertIngredientUnit(ingredientId, newUnit, factor)
    setSaving(false)
    if (convertError) {
      setError(convertError.message)
      return
    }
    setSaved(true)
  }

  if (saved) return <SuccessOverlay message="แปลงหน่วยเรียบร้อยแล้ว" onDone={onConfirmed} />

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop max-h-[85vh] overflow-y-auto">
        {step === 'ask' ? (
          <>
            <div>
              <h2 className="text-lg font-semibold">แปลงหน่วยอัตโนมัติ</h2>
              <p className="text-sm text-stone-500">
                หน่วยเดิม ({oldUnit}) กับหน่วยใหม่ ({newUnit}) เป็นคนละประเภทกัน ระบบเดาอัตราส่วนเองไม่ได้
                (เช่นไม่รู้ว่า 1 {newUnit} หนักหรือมีปริมาณเท่ากับ {oldUnit} กี่หน่วย) ตอบครั้งเดียวตรงนี้
                ระบบจะคำนวณให้ทุกสูตร + สต็อก + ต้นทุนอัตโนมัติทันที
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="manual-conversion-answer" className="text-sm text-stone-600">
                1 {newUnit} เท่ากับกี่ {oldUnit}?
              </label>
              <input
                id="manual-conversion-answer"
                type="number"
                step="0.0001"
                min="0"
                inputMode="decimal"
                value={manualAnswer}
                onChange={(e) => setManualAnswer(e.target.value)}
                placeholder={`เช่น 1 ${newUnit} = 55 ${oldUnit}`}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onCancel} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => setStep('review')}
                disabled={!(manualAnswerNum > 0)}
                className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
              >
                ถัดไป
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold">ตรวจสอบก่อนแปลงหน่วย</h2>
              <p className="text-sm text-stone-500">
                จาก {oldUnit} เป็น {newUnit} — ระบบจะแปลงให้อัตโนมัติทั้งหมดตามนี้ ไม่ต้องแก้อะไรเพิ่มเอง
              </p>
            </div>

            <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">สต็อกคงเหลือ</span>
                <span className="font-medium">
                  {stockQty.toLocaleString('th-TH')} {oldUnit} → {(stockQty * (factor ?? 0)).toLocaleString('th-TH')} {newUnit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">ต้นทุนเฉลี่ย</span>
                <span className="font-medium">
                  ฿{costPerUnit.toFixed(2)}/{oldUnit} → ฿{(costPerUnit / (factor ?? 1)).toFixed(2)}/{newUnit}
                </span>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-stone-700">จำนวนที่ใช้ในสูตร ({rows.length} สินค้า)</p>
                {rows.map((r) => (
                  <div key={r.id} className="flex justify-between text-sm">
                    <span className="text-stone-600 truncate">{r.productName}</span>
                    <span className="font-medium shrink-0">
                      {r.qtyPerUnit} {oldUnit} → {(r.qtyPerUnit * (factor ?? 0)).toLocaleString('th-TH', { maximumFractionDigits: 4 })} {newUnit}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => (autoFactor !== null ? onCancel() : setStep('ask'))}
                className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium"
              >
                {autoFactor !== null ? 'ยกเลิก' : 'ย้อนกลับ'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={saving || !factor}
                className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
              >
                {saving ? 'กำลังแปลง...' : 'ยืนยัน แปลงให้อัตโนมัติ'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
