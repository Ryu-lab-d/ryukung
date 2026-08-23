import { useState } from 'react'
import { formatBaht } from '../lib/money'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import type { CartItem } from './CartPanel'

export type HeldSale = { id: string; items: CartItem[]; heldAt: string }

/** แถบบิลที่พักไว้ — ลูกค้าขอเวลา/มีคิวรอ พนักงานพักตะกร้าไว้ก่อนแล้วขายคนถัดไปได้เลย ค่อยเรียกคืนทีหลัง */
export function HeldSalesPanel({
  heldSales,
  canResume,
  onResume,
  onDiscard,
}: {
  heldSales: HeldSale[]
  canResume: boolean
  onResume: (id: string) => void
  onDiscard: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null)
  if (heldSales.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <p className="text-sm font-semibold text-amber-800">⏸ บิลที่พักไว้ ({heldSales.length})</p>
        <span className="text-amber-600 text-sm">{expanded ? '▲ ซ่อน' : '▼ ดูรายการ'}</span>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {heldSales.map((h) => {
            const total = h.items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
            return (
              <div key={h.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-stone-800">
                    {h.items.length} รายการ · {formatBaht(total)} บาท
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(h.heldAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onResume(h.id)}
                    disabled={!canResume}
                    className="rounded-lg bg-stone-900 text-white text-xs font-medium px-3 py-1.5 disabled:opacity-40"
                  >
                    เรียกคืน
                  </button>
                  <button type="button" onClick={() => setConfirmDiscardId(h.id)} className="text-red-600 text-xs">
                    ลบ
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmDiscardId && (
        <ConfirmDialog
          title="ลบบิลที่พักไว้นี้?"
          message="ลบแล้วกู้คืนไม่ได้ รายการสินค้าที่พักไว้จะหายไปทั้งหมด"
          confirmLabel="ลบเลย"
          onConfirm={() => {
            onDiscard(confirmDiscardId)
            setConfirmDiscardId(null)
          }}
          onCancel={() => setConfirmDiscardId(null)}
        />
      )}
    </div>
  )
}
