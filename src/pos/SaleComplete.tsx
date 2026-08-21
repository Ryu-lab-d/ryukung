import { useEffect } from 'react'
import { formatBaht } from '../lib/money'
import type { SaleResult } from './PaymentStep'

/** หน้าขายสำเร็จ — ใช้ลุคเดียวกับ SuccessOverlay (วงกลม+เครื่องหมายถูก) แต่ไม่ auto-dismiss เพราะมีปุ่มกดต่อ */
export function SaleComplete({
  result,
  grandTotal,
  onNextSale,
}: {
  result: SaleResult
  grandTotal: number
  onNextSale: () => void
}) {
  // ประกาศเสียงบอกเงินทอนตอนขายสำเร็จ (จ่ายเงินสดเท่านั้น) — กันพนักงานทอนผิดตอนมัวยุ่งกับลูกค้าคนถัดไป
  // ไม่รองรับก็แค่ไม่มีเสียง ไม่ทำให้หน้าพัง (เบราว์เซอร์บางตัว/บางเครื่องไม่มี Web Speech API)
  useEffect(() => {
    if (result.method !== 'cash' || result.change === null || result.change <= 0) return
    try {
      const utterance = new SpeechSynthesisUtterance(`เงินทอน ${Math.round(result.change)} บาท`)
      utterance.lang = 'th-TH'
      window.speechSynthesis?.speak(utterance)
    } catch {
      // เบราว์เซอร์ไม่รองรับ Web Speech API — ข้ามไปเงียบๆ
    }
  }, [result.method, result.change])

  return (
    <div className="text-center space-y-4 py-6">
      <svg width="72" height="72" viewBox="0 0 64 64" className="mx-auto">
        <circle cx="32" cy="32" r="29" fill="none" stroke="#16a34a" strokeWidth="4" className="animate-circle-pop" />
        <path
          d="M18 33 L27 42 L46 22"
          fill="none"
          stroke="#16a34a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-check-draw"
        />
      </svg>

      <div>
        <p className="text-xl font-bold text-stone-900">ขายสำเร็จ! 🎉</p>
        <p className="text-sm text-stone-500">ยอดขาย {formatBaht(grandTotal)} บาท</p>
      </div>

      {result.method === 'cash' && result.change !== null && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mx-auto max-w-xs">
          <p className="text-sm text-amber-700">เงินทอน</p>
          <p className="text-3xl font-bold text-amber-900">{formatBaht(Math.max(result.change, 0))} บาท</p>
        </div>
      )}

      {!result.receiptIssued && (
        <p className="text-sm text-red-600">ออกใบเสร็จอัตโนมัติไม่สำเร็จ กดปุ่มด้านล่างเพื่อออกเองอีกครั้งได้</p>
      )}

      <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
        <a
          href={`/receipts/${result.orderId}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border-2 border-stone-300 text-stone-700 font-medium py-3"
        >
          🧾 ดูใบเสร็จ
        </a>
        <button
          type="button"
          onClick={onNextSale}
          className="rounded-xl bg-stone-900 text-white font-semibold py-3.5 text-lg"
        >
          ขายรายการต่อไป
        </button>
      </div>
    </div>
  )
}
