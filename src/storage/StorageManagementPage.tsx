import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStorageCleanup } from './useStorageCleanup'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { Toast } from '../lib/Toast'
import { formatBaht } from '../lib/money'

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง',
}

export function StorageManagementPage() {
  const { orders, loading, deleteMany } = useStorageCleanup()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmTarget, setConfirmTarget] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))))
  }

  async function handleConfirmedDelete() {
    const ids = confirmTarget === 'all' ? orders.map((o) => o.id) : Array.from(selected)
    setConfirmTarget(null)
    setDeleting(true)
    const { errors } = await deleteMany(ids)
    setDeleting(false)
    setSelected(new Set())
    setMessage(errors.length > 0 ? `ลบไม่สำเร็จ ${errors.length} รายการ` : `ลบเรียบร้อย ${ids.length} รายการ`)
  }

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">← กลับหน้าออเดอร์</Link>
        <h1 className="text-lg font-semibold mt-1">จัดการพื้นที่จัดเก็บ</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          ออเดอร์ที่จัดส่ง/ส่งมอบสำเร็จมาแล้วเกิน 1 วัน — ลบได้เพื่อประหยัดพื้นที่ Supabase
          (ลบแล้วกู้คืนไม่ได้ ใบเสร็จที่เคยออกไปแล้วของออเดอร์นั้นจะถูกลบไปด้วย)
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-stone-400 rounded-lg border border-stone-200 p-4 text-center">
          ยังไม่มีออเดอร์ที่ครบกำหนดลบตอนนี้ 🎉
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-stone-50 border border-stone-200 px-3 py-2.5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.size === orders.length} onChange={toggleAll} />
              เลือกทั้งหมด ({orders.length} รายการ)
            </label>
            <button
              type="button"
              disabled={selected.size === 0 || deleting}
              onClick={() => setConfirmTarget('selected')}
              className="rounded-lg bg-red-600 text-white text-sm px-3 py-1.5 font-medium disabled:opacity-40"
            >
              🗑️ ลบที่เลือก ({selected.size})
            </button>
          </div>

          <div className="space-y-2">
            {orders.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 cursor-pointer"
              >
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{o.order_no ?? 'ร่าง'} · {o.customer_name ?? 'ไม่มีชื่อลูกค้า'}</p>
                    <p className="text-sm text-stone-500 shrink-0">{formatBaht(o.grand_total)}</p>
                  </div>
                  <p className="text-xs text-stone-400">
                    {FULFILLMENT_LABELS[o.fulfillment_type] ?? o.fulfillment_type} · ส่งสำเร็จเมื่อ {new Date(o.delivered_at).toLocaleString('th-TH')}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmTarget('all')}
            className="w-full rounded-lg border-2 border-red-300 text-red-700 font-medium py-2.5 disabled:opacity-40"
          >
            🗑️ ลบทั้งหมดที่ครบกำหนด ({orders.length} รายการ)
          </button>
        </>
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="แน่ใจนะว่าจะลบ?"
          message={`ลบแล้วกู้คืนไม่ได้ รวมถึงใบเสร็จที่เคยออกไปแล้วของออเดอร์เหล่านี้ด้วย (${confirmTarget === 'all' ? orders.length : selected.size} รายการ)`}
          confirmLabel="ลบถาวร"
          cancelLabel="ไม่ลบ"
          busy={deleting}
          onConfirm={handleConfirmedDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {message && <Toast message={message} onDone={() => setMessage(null)} />}
    </div>
  )
}
