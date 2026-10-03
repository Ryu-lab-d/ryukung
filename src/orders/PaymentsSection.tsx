import { useState } from 'react'
import { recordPayment } from './api'
import { uploadToBucket } from '../lib/imageUpload'
import { formatBaht } from '../lib/money'
import { SuccessOverlay } from '../lib/SuccessOverlay'
import { NumericKeypad } from '../lib/NumericKeypad'

const METHOD_ICONS: Record<string, string> = { transfer: '🏦', promptpay: '📱', cash: '💵', cod: '📦', other: '💬' }

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
        className="bg-white rounded-3xl max-w-sm w-full max-h-[92vh] overflow-y-auto shadow-2xl animate-toast-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-t-3xl bg-gradient-to-r from-green-600 to-emerald-700 text-white px-5 py-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-white/20 grid place-items-center text-xl">💳</span>
          <div>
            <h2 className="text-lg font-semibold leading-tight">บันทึกการชำระเงิน</h2>
            {balanceDue > 0 && <p className="text-xs text-white/85">ยอดคงเหลือ {formatBaht(balanceDue)} บาท</p>}
          </div>
        </div>
        <div className="p-5 space-y-3">

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
              'w-full rounded-2xl font-semibold py-3 text-sm transition-all active:scale-95 ' +
              (amount === String(balanceDue) ? 'bg-green-600 text-white shadow-lg' : 'border-2 border-green-600 text-green-700 bg-green-50')
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
            className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-sm"
          >
            {Object.entries(METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{METHOD_ICONS[v]} {l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-3">
          <label className="text-sm text-stone-600">📎 แนบสลิป (ไม่บังคับ)</label>
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
          <button type="button" onClick={onClose} className="flex-1 rounded-full bg-stone-100 text-stone-700 py-3 font-medium active:scale-95">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="flex-[1.4] rounded-full bg-gradient-to-r from-green-600 to-emerald-700 text-white py-3 font-semibold shadow-[0_10px_20px_-10px_rgb(5_122_85_/_0.8)] active:scale-95 disabled:opacity-50"
          >
            {busy ? 'กำลังบันทึก...' : 'บันทึกการชำระเงิน'}
          </button>
        </div>
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
    <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-4 pt-5 space-y-3 shadow-[0_10px_26px_-14px_rgb(51_32_14_/_0.4)]">
      <div className={'absolute inset-x-0 top-0 h-1.5 ' + (balanceDue <= 0 ? 'bg-gradient-to-r from-green-400 to-emerald-600' : paymentClaimedAt ? 'bg-gradient-to-r from-green-300 via-green-600 to-green-300' : 'bg-gradient-to-r from-red-300 via-red-500 to-red-300')} aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-green-50 border border-green-100 grid place-items-center text-base shrink-0">💳</span>
          การชำระเงิน
        </h2>
        <span className={'text-xs font-semibold rounded-full px-2.5 py-1 ' + (balanceDue <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
          {balanceDue <= 0 ? '✓ ชำระครบแล้ว' : `ค้าง ${formatBaht(balanceDue)} บาท`}
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden" aria-hidden="true">
        <div
          className={'h-full rounded-full transition-all duration-700 ' + (balanceDue <= 0 ? 'bg-gradient-to-r from-green-400 to-emerald-600' : 'bg-gradient-to-r from-amber-400 to-amber-600')}
          style={{ width: `${Math.min(100, Math.max(0, (payments.reduce((s, p) => s + Number(p.amount), 0) / Math.max(1, payments.reduce((s, p) => s + Number(p.amount), 0) + Math.max(0, balanceDue))) * 100))}%` }}
        />
      </div>

      {payments.length === 0 && <p className="text-xs text-stone-400">ยังไม่มีการชำระเงินที่บันทึกไว้</p>}
      {payments.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 rounded-2xl bg-stone-50 border border-stone-100 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-white border border-stone-200 grid place-items-center">{METHOD_ICONS[p.method] ?? '💬'}</span>
            <span>
              {METHOD_LABELS[p.method]}
              <span className="block text-[11px] text-stone-400">{new Date(p.paid_at).toLocaleDateString('th-TH')}</span>
            </span>
          </span>
          <span className="font-bold tabular-nums text-green-700">{formatBaht(p.amount)}</span>
        </div>
      ))}

      <button
        type="button"
        onClick={openModal}
        className={
          'w-full flex items-center justify-center gap-1.5 rounded-full font-semibold py-3 text-sm shadow-[0_12px_24px_-12px_rgb(0_0_0_/_0.6)] transition-all active:scale-95 ' +
          (paymentClaimedAt ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-white animate-pulse' : 'bg-gradient-to-r from-stone-800 to-stone-900 text-white')
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
