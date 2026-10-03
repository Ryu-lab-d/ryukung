import { useState } from 'react'
import { cancelOrder } from './api'
import { InlineError } from '../lib/InlineError'

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
    <div className="fixed inset-0 bg-black/55 grid place-items-center p-4 z-50 animate-overlay-fade">
      <div className="bg-white rounded-3xl max-w-sm w-full max-h-[92vh] overflow-y-auto shadow-2xl animate-toast-pop">
        <div className="rounded-t-3xl bg-gradient-to-br from-red-700 via-red-600 to-rose-600 text-white px-5 py-5 text-center space-y-1.5">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/20 grid place-items-center text-3xl animate-icon-pop">⚠️</div>
          <h2 className="text-lg font-semibold leading-snug">แน่ใจนะว่าจะยกเลิกออเดอร์นี้?</h2>
          <p className="text-xs text-white/85">ลูกค้าจะเห็นสถานะ "ยกเลิกแล้ว" ในหน้าติดตามออเดอร์ทันที</p>
        </div>
        <div className="p-5 space-y-3">
        {hasPayments && (
          <div className="space-y-1">
            <label htmlFor="refund_status" className="text-sm text-stone-600">สถานะการคืนเงิน</label>
            <select
              id="refund_status"
              value={refundStatus}
              onChange={(e) => setRefundStatus(e.target.value as typeof refundStatus)}
              className="w-full rounded-2xl border border-stone-300 px-3 py-2.5"
            >
              <option value="none">ยังไม่เลือก</option>
              <option value="pending">รอคืนเงิน</option>
              <option value="refunded">คืนเงินแล้ว</option>
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="reason" className="text-sm text-stone-600">เหตุผล (ถ้ามี)</label>
          <div className="flex flex-wrap gap-1.5">
            {['ลูกค้าขอยกเลิก', 'ลูกค้าไม่ได้ชำระเงิน', 'สินค้าหมด', 'ติดต่อลูกค้าไม่ได้'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={'rounded-full border px-3 py-1 text-xs transition-all active:scale-95 ' + (reason === r ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-stone-300 text-stone-600')}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-2xl border border-stone-300 px-3 py-2" />
        </div>
        <InlineError message={error} />
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-full bg-stone-100 text-stone-700 py-3 font-medium active:scale-95">ไม่ยกเลิก</button>
          <button type="button" disabled={busy} onClick={handleConfirm} className="flex-1 rounded-full bg-gradient-to-r from-red-600 to-rose-700 text-white py-3 font-semibold shadow-[0_10px_20px_-10px_rgb(190_18_60_/_0.8)] active:scale-95 disabled:opacity-50">
            {busy ? 'กำลังยกเลิก...' : 'ยกเลิก'}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
