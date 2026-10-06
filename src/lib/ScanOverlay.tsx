import { Barcode128 } from '../receipts/Barcode128'

/**
 * หน้าจอ "สแกนสำเร็จ" ใช้ร่วมกันทุกจุดที่ยิงบาร์โค้ด (หน้า Invoice, กระดานออเดอร์) — เส้นเลเซอร์สีแดงวิ่งผ่านบาร์โค้ด
 * เครื่องหมายถูกวงกลมเขียววาดเอง เลขออเดอร์/ชื่อ/ยอด และแถบความคืบหน้า (ผู้เรียกเป็นคนตั้งเวลาเปลี่ยนหน้าเอง)
 */
export function ScanOverlay({
  orderNo,
  line1,
  line2,
  caption = 'กำลังเปิด...',
  title = 'สแกนสำเร็จ',
}: {
  orderNo: string
  line1?: string
  line2?: string
  caption?: string
  title?: string
}) {
  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-black/75 backdrop-blur-sm p-4 animate-overlay-fade" role="status" aria-live="polite">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl animate-toast-pop">
        <div className="relative mx-auto w-fit px-1">
          <Barcode128 value={orderNo} height={64} />
          <span className="scan-laser" aria-hidden="true" />
        </div>
        <div className="scan-check-wrap mx-auto mt-4 w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 grid place-items-center shadow-[0_10px_24px_-8px_rgb(5_150_105_/_0.7)]">
          <svg viewBox="0 0 32 32" className="w-10 h-10" aria-hidden="true">
            <path d="M8 16.5 L14 22 L24 10.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className="check-path" style={{ animationDelay: '0.55s' }} />
          </svg>
        </div>
        <p className="mt-3 text-lg font-display font-bold text-stone-900">{title}</p>
        <p className="font-mono text-xl font-bold tracking-wide text-stone-900">{orderNo}</p>
        {line1 && <p className="text-sm text-stone-500">{line1}</p>}
        {line2 && <p className="mt-1 text-sm font-semibold text-amber-800">{line2}</p>}
        <div className="mt-4 h-2 rounded-full bg-stone-200 overflow-hidden">
          <div className="scan-progress h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-700" />
        </div>
        <p className="mt-1.5 text-xs text-stone-400">{caption}</p>
      </div>
    </div>
  )
}
