import { useState } from 'react'
import { cancelOrder } from './api'

export function CancelOrderDialog({
  orderId,
  hasPayments,
  onDone,
  onClose,
}: {
  orderId: string
  hasPayments: boolean
  onDone: () => void
  onClose: () => void
}) {
  const [refundStatus, setRefundStatus] = useState<'none' | 'pending' | 'refunded'>('none')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (hasPayments && refundStatus === 'none') {
      setError('ออเดอร์นี้มีการจ่ายเงินแล้ว กรุณาเลือกสถานะการคืนเงินก่อนยกเลิก')
      return
    }
    setBusy(true)
    const { error } = await cancelOrder(orderId, refundStatus, reason.trim() || null)
    setBusy(false)
    if (error) { setError(error.message); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-lg">
        <h2 className="text-lg font-semibold text-center">แน่ใจนะว่าจะยกเลิกออเดอร์นี้?</h2>
        {hasPayments && (
          <div className="space-y-1">
            <label htmlFor="refund_status" className="text-sm text-stone-600">สถานะการคืนเงิน</label>
            <select
              id="refund_status"
              value={refundStatus}
              onChange={(e) => setRefundStatus(e.target.value as typeof refundStatus)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            >
              <option value="none">ยังไม่เลือก</option>
              <option value="pending">รอคืนเงิน</option>
              <option value="refunded">คืนเงินแล้ว</option>
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="reason" className="text-sm text-stone-600">เหตุผล (ถ้ามี)</label>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">ไม่ยกเลิก</button>
          <button type="button" disabled={busy} onClick={handleConfirm} className="flex-1 rounded-lg bg-red-600 text-white py-2.5 font-medium disabled:opacity-50">
            {busy ? 'กำลังยกเลิก...' : 'ยกเลิก'}
          </button>
        </div>
      </div>
    </div>
  )
}
