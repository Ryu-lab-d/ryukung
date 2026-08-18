import { useState } from 'react'
import type { RecipeUsageRow } from './api'

/**
 * เปลี่ยนหน่วยวัตถุดิบที่ถูกใช้ในสูตรอยู่แล้ว — ระบบไม่รู้ตัวแปลงหน่วย (ไม่รู้ว่า 1 หน่วยใหม่เท่ากับหน่วยเดิมกี่หน่วย)
 * จึงให้เจ้าของร้านกรอกจำนวนที่ใช้จริงใหม่ (ตามหน่วยใหม่) เองต่อสินค้าแต่ละตัวตรงนี้เลย แล้วบันทึกพร้อมกันทีเดียว
 * แทนที่จะแค่เตือนแล้วปล่อยให้ไปหาแก้เองทีละหน้า
 */
export function UnitChangeFixModal({
  newUnit,
  rows,
  onCancel,
  onConfirm,
}: {
  newUnit: string
  rows: RecipeUsageRow[]
  onCancel: () => void
  onConfirm: (updated: { id: string; qty_per_unit: number }[]) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.id, String(r.qtyPerUnit)]))
  )
  const allValid = rows.every((r) => Number(values[r.id]) > 0)

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop max-h-[85vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold">⚠️ แก้จำนวนที่ใช้ให้ตรงหน่วยใหม่</h2>
          <p className="text-sm text-stone-500">
            วัตถุดิบนี้ถูกใช้ใน {rows.length} สูตรแล้ว ระบบไม่แปลงจำนวนให้อัตโนมัติ (ไม่รู้ว่า 1 {newUnit} เท่ากับหน่วยเดิมเท่าไหร่)
            กรุณากรอกจำนวนที่ใช้จริงต่อสินค้า (หน่วย: {newUnit}) ให้ครบก่อนบันทึก
          </p>
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-stone-700 truncate">{r.productName}</span>
              <input
                type="number"
                step="0.001"
                min="0"
                inputMode="decimal"
                aria-label={`จำนวนที่ใช้ใหม่สำหรับ ${r.productName}`}
                value={values[r.id]}
                onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                className="w-24 shrink-0 rounded-lg border border-stone-300 px-2 py-2 text-sm"
              />
              <span className="text-xs text-stone-500 w-8 shrink-0">{newUnit}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(rows.map((r) => ({ id: r.id, qty_per_unit: Number(values[r.id]) })))}
            disabled={!allValid}
            className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
          >
            บันทึกทั้งหมด
          </button>
        </div>
      </div>
    </div>
  )
}
