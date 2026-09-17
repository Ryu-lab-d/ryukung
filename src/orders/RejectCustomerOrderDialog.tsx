import { useState } from 'react'
import { rejectCustomerOrder } from './api'
import { InlineError } from '../lib/InlineError'

export function RejectCustomerOrderDialog({
  orderId,
  hasPaid,
  onDone,
  onClose,
}: {
  orderId: string
  hasPaid: boolean
  onDone: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลที่ปฏิเสธออเดอร์นี้ (ลูกค้าจะเห็นเหตุผลนี้ด้วย)')
      return
    }
    setBusy(true)
    const { error } = await rejectCustomerOrder(orderId, reason.trim())
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-lg animate-toast-pop">
        <h2 className="text-lg font-semibold text-center">ปฏิเสธออเดอร์นี้?</h2>
        <p className="text-sm text-stone-500 text-center">
          ออเดอร์นี้ลูกค้าส่งเข้ามาเองจากหน้าเมนูออนไลน์ ยังไม่เข้าคิวอบ ปฏิเสธแล้วจะออกเลขที่ให้เป็นหลักฐาน
          {hasPaid && ' และตั้งสถานะรอคืนเงินให้อัตโนมัติ (คืนเงินจริงต้องทำเองนอกระบบ)'}
        </p>
        <div className="space-y-1">
          <label htmlFor="reject_reason" className="text-sm text-stone-600">เหตุผล (จำเป็น)</label>
          <textarea
            id="reject_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น คิวอบเต็มวันนั้น"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <InlineError message={error} />
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">ไม่ปฏิเสธ</button>
          <button type="button" disabled={busy} onClick={handleConfirm} className="flex-1 rounded-lg bg-red-600 text-white py-2.5 font-medium disabled:opacity-50">
            {busy ? 'กำลังปฏิเสธ...' : 'ปฏิเสธออเดอร์'}
          </button>
        </div>
      </div>
    </div>
  )
}
