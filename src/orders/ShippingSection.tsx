import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function ShippingSection({ order, onSaved }: { order: any; onSaved: () => void }) {
  const [carrier, setCarrier] = useState(order.carrier ?? '')
  const [trackingNo, setTrackingNo] = useState(order.tracking_no ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (order.fulfillment_type !== 'shipping') return null

  async function handleSave() {
    setBusy(true)
    const { error } = await supabase
      .from('orders')
      .update({ carrier: carrier.trim() || null, tracking_no: trackingNo.trim() || null, shipped_at: new Date().toISOString() })
      .eq('id', order.id)
    setBusy(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg border border-stone-200 p-3 space-y-2">
      <h2 className="text-sm font-semibold">ขนส่ง</h2>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="ชื่อขนส่ง" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        <input placeholder="เลขพัสดุ" value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" disabled={busy} onClick={handleSave} className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-50">
        บันทึกและตั้งเป็นส่งแล้ว
      </button>
    </div>
  )
}
