import { useState } from 'react'
import { recordPayment } from './api'
import { uploadToBucket } from '../lib/imageUpload'
import { formatBaht } from '../lib/money'
import { SuccessOverlay } from '../lib/SuccessOverlay'
import { NumericKeypad } from '../lib/NumericKeypad'

const METHOD_LABELS: Record<string, string> = {
  transfer: 'โอนเงิน', promptpay: 'พร้อมเพย์', cash: 'เงินสด', cod: 'เก็บเงินปลายทาง', other: 'อื่นๆ',
}

function PaymentModal({
  balanceDue,
  paymentClaimedAt,
  amount,
  onAmountChange,
  method,
  onMethodChange,
  onSlipChange,
  uploading,
  error,
  busy,
  onSubmit,
  onClose,
}: {
  balanceDue: number
  paymentClaimedAt: string | null
  amount: string
  onAmountChange: (v: string) => void
  method: string
  onMethodChange: (v: string) => void
  onSlipChange: (file: File) => void
  uploading: boolean
  error: string | null
  busy: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">บันทึกการชำระเงิน</h2>

        {paymentClaimedAt && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2">
            🔔 ลูกค้าแจ้งว่าชำระเงินแล้ว เมื่อ {new Date(paymentClaimedAt).toLocaleString('th-TH')}
          </p>
        )}

        {balanceDue > 0 && (
          <button
            type="button"
            onClick={() => onAmountChange(String(balanceDue))}
            className={
              'w-full rounded-lg font-semibold py-3 text-sm ' +
              (amount === String(balanceDue) ? 'bg-green-600 text-white' : 'border-2 border-green-600 text-green-700 bg-green-50')
            }
          >
            ✅ เต็มจำนวน {formatBaht(balanceDue)} บาท (กดครั้งเดียว ไม่ต้องกดตัวเลขเอง)
          </button>
        )}

        <NumericKeypad value={amount} onChange={onAmountChange} />

        <div className="space-y-1">
          <label htmlFor="payment-method" className="text-sm text-stone-600">วิธีชำระ</label>
          <select
            id="payment-method"
            value={method}
            onChange={(e) => onMethodChange(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            {Object.entries(METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-stone-600">สลิป (ไม่บังคับ)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onSlipChange(f)
            }}
          />
          {uploading && <p className="text-xs text-stone-500">กำลังอัปโหลดสลิป...</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
          >
            {busy ? 'กำลังบันทึก...' : 'บันทึกการชำระเงิน'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PaymentsSection({
  orderId,
  payments,
  balanceDue,
  paymentClaimedAt,
  onRecorded,
}: {
  orderId: string
  payments: any[]
  balanceDue: number
  paymentClaimedAt: string | null
  onRecorded: (amount: number) => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('transfer')
  const [slipPath, setSlipPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function openModal() {
    setAmount('')
    setSlipPath(null)
    setError(null)
    setShowModal(true)
  }

  async function handleSlipChange(file: File) {
    setUploading(true)
    const { path, error } = await uploadToBucket('slips', orderId, file)
    setUploading(false)
    if (error) {
      setError('อัปโหลดสลิปไม่สำเร็จ: ' + error.message)
      return
    }
    setSlipPath(path)
  }

  async function handleAdd() {
    const n = Number(amount)
    if (!n || n <= 0) {
      setError('กรุณาใส่จำนวนเงินที่ถูกต้อง')
      return
    }
    setBusy(true)
    const { error } = await recordPayment(orderId, {
      amount: n, method, paid_at: new Date().toISOString(), slip_path: slipPath, note: null,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setAmount('')
    setSlipPath(null)
    setError(null)
    setShowModal(false)
    setShowSuccess(true)
    onRecorded(n)
  }

  return (
    <div className="rounded-lg border border-stone-200 p-3 space-y-3">
      <h2 className="text-sm font-semibold">การชำระเงิน</h2>

      {payments.map((p) => (
        <div key={p.id} className="flex justify-between text-sm border-b border-stone-100 py-1">
          <span>{METHOD_LABELS[p.method]} · {new Date(p.paid_at).toLocaleDateString('th-TH')}</span>
          <span>{formatBaht(p.amount)}</span>
        </div>
      ))}

      <button
        type="button"
        onClick={openModal}
        className={
          'w-full flex items-center justify-center gap-1.5 rounded-lg font-medium py-2.5 text-sm ' +
          (paymentClaimedAt ? 'bg-green-600 text-white animate-pulse' : 'bg-stone-900 text-white')
        }
      >
        {paymentClaimedAt ? '🔔 ลูกค้าแจ้งชำระแล้ว · บันทึกการชำระเงิน' : '💳 บันทึกการชำระเงิน'}
      </button>

      {showModal && (
        <PaymentModal
          balanceDue={balanceDue}
          paymentClaimedAt={paymentClaimedAt}
          amount={amount}
          onAmountChange={setAmount}
          method={method}
          onMethodChange={setMethod}
          onSlipChange={(f) => void handleSlipChange(f)}
          uploading={uploading}
          error={error}
          busy={busy}
          onSubmit={() => void handleAdd()}
          onClose={() => setShowModal(false)}
        />
      )}

      {showSuccess && <SuccessOverlay message="ยืนยันการชำระเงินสำเร็จ" onDone={() => setShowSuccess(false)} />}
    </div>
  )
}
