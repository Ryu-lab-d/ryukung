import { Link } from 'react-router-dom'
import { formatBaht } from '../lib/money'
import type { SaleResult } from './PaymentStep'

/** หน้าขายสำเร็จ — ใช้ลุคเดียวกับ SuccessOverlay (วงกลม+เครื่องหมายถูก) แต่ไม่ auto-dismiss เพราะมีปุ่มกดต่อ
 * เสียงประกาศเงินทอน/รับมาพอดี พูดไปแล้วตั้งแต่ตอนกดยืนยันใน PaymentStep.tsx (ต้องพูดแบบ synchronous ใน
 * click handler ไม่งั้นมือถือบางเครื่องจะเงียบเสียงทิ้ง — ดูคอมเมนต์ที่ finalizeSale) ไม่ต้องพูดซ้ำที่นี่ */
export function SaleComplete({
  result,
  grandTotal,
  onNextSale,
}: {
  result: SaleResult
  grandTotal: number
  onNextSale: () => void
}) {
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
        result.change > 0 ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mx-auto max-w-xs">
            <p className="text-sm text-amber-700">เงินทอน</p>
            <p className="text-3xl font-bold text-amber-900">{formatBaht(result.change)} บาท</p>
          </div>
        ) : (
          <p className="text-lg font-semibold text-green-700">✅ รับมาพอดี ไม่ต้องทอน</p>
        )
      )}

      {!result.receiptIssued && (
        <p className="text-sm text-red-600">ออกใบเสร็จอัตโนมัติไม่สำเร็จ กดปุ่มด้านล่างเพื่อออกเองอีกครั้งได้</p>
      )}

      <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
        <Link
          to={`/orders/${result.orderId}/receipt`}
          className="rounded-xl border-2 border-stone-300 text-stone-700 font-medium py-3"
        >
          🧾 ดูใบเสร็จ
        </Link>
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
