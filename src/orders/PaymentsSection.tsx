import { useState } from 'react'
import { recordPayment } from './api'
import { uploadToBucket } from '../lib/imageUpload'
import { formatBaht } from '../lib/money'

const METHOD_LABELS: Record<string, string> = {
  transfer: 'โอนเงิน', promptpay: 'พร้อมเพย์', cash: 'เงินสด', cod: 'เก็บเงินปลายทาง', other: 'อื่นๆ',
}

export function PaymentsSection({
  orderId,
  payments,
  onRecorded,
}: {
  orderId: string
  payments: any[]
  onRecorded: () => void
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('transfer')
  const [slipPath, setSlipPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSlipChange(file: File) {
    setUploading(true)
    const { path, error } = await uploadToBucket('slips', orderId, file)
    setUploading(false)
    if (error) { setError('อัปโหลดสลิปไม่สำเร็จ: ' + error.message); return }
    setSlipPath(path)
  }

  async function handleAdd() {
    const n = Number(amount)
    if (!n || n <= 0) { setError('กรุณาใส่จำนวนเงินที่ถูกต้อง'); return }
    setBusy(true)
    const { error } = await recordPayment(orderId, {
      amount: n, method, paid_at: new Date().toISOString(), slip_path: slipPath, note: null,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setAmount(''); setSlipPath(null); setError(null)
    onRecorded()
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

      <div className="space-y-2 pt-2">
        <div className="flex gap-2">
          <input
            type="number" step="0.01" min="0" inputMode="decimal"
            placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
            {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSlipChange(f) }} />
        {uploading && <p className="text-xs text-stone-500">กำลังอัปโหลดสลิป...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" disabled={busy} onClick={handleAdd} className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-50">
          บันทึกการชำระเงิน
        </button>
      </div>
    </div>
  )
}
