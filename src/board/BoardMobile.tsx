import { useState } from 'react'
import { OrderCard } from './OrderCard'
import { Toast } from '../lib/Toast'
import { isToday } from '../lib/dates'
import { nextStatus, stageLabel } from '../orders/workStatus'
import type { BoardOrder } from './useOrderBoard'

const TABS: { status: string; label: string; icon: string }[] = [
  { status: 'draft', label: 'ร่าง', icon: '📝' },
  { status: 'to_bake', label: 'รออบ', icon: '📝' },
  { status: 'baking', label: 'กำลังทำ', icon: '🧑‍🍳' },
  { status: 'ready', label: 'พร้อมส่ง', icon: '🎁' },
  { status: 'delivered', label: 'ส่งแล้ว', icon: '✅' },
]
// สถานะย่อยของขนส่งบริษัท/ไรเดอร์ (รอเข้ารับ/รับแล้ว/ระหว่างทาง) นับรวมอยู่ในแท็บ "พร้อมส่ง"
const READY_GROUP = ['ready', 'waiting_courier', 'picked_up', 'in_transit']

export type MobileQuickFilter = 'bake' | 'unpaid' | null

function inTab(o: BoardOrder, tab: string) {
  return tab === 'draft'
    ? o.is_draft
    : !o.is_draft && (tab === 'ready' ? READY_GROUP.includes(o.work_status) : o.work_status === tab)
}

export function BoardMobile({
  orders,
  tab,
  onTabChange,
  quick,
  onClearQuick,
  onChangeStatus,
}: {
  orders: BoardOrder[]
  tab: string
  onTabChange: (tab: string) => void
  quick: MobileQuickFilter
  onClearQuick: () => void
  onChangeStatus: (orderId: string, status: string) => Promise<{ error: { message: string } | null }>
}) {
  const [error, setError] = useState<string | null>(null)

  // แผงสรุปด้านบนกรองข้ามแท็บ: "อบวันนี้"/"ค้างเงิน" โชว์ทุกออเดอร์ที่เข้าเงื่อนไขไม่ว่าอยู่ขั้นไหน
  const visible = quick
    ? orders.filter((o) =>
        quick === 'bake'
          ? isToday(o.bake_date) && o.work_status !== 'delivered' && !o.is_draft
          : o.payment_status !== 'paid' && !o.is_draft
      )
    : orders.filter((o) => inTab(o, tab))

  async function handleAdvance(orderId: string, status: string) {
    const { error } = await onChangeStatus(orderId, status)
    if (error) setError(error.message)
  }

  return (
    <div className="lg:hidden px-4 pt-3 pb-4 space-y-3">
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-stone-50/90 backdrop-blur">
        <div className="grid grid-cols-5 gap-1.5">
          {TABS.map((t) => {
            const count = orders.filter((o) => inTab(o, t.status)).length
            const active = !quick && tab === t.status
            const attention = t.status === 'draft' && count > 0
            return (
              <button
                key={t.status}
                type="button"
                onClick={() => {
                  onClearQuick()
                  onTabChange(t.status)
                }}
                className={
                  'relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium transition-all duration-200 active:scale-95 ' +
                  (active
                    ? 'bg-gradient-to-b from-stone-800 to-stone-900 text-white shadow-[0_8px_16px_-8px_rgb(51_32_14_/_0.8)]'
                    : 'bg-white border border-stone-200 text-stone-600')
                }
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
                <span
                  className={
                    'absolute -top-1.5 -right-1 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold grid place-items-center tabular-nums shadow ' +
                    (attention ? 'bg-indigo-600 text-white animate-pulse' : active ? 'bg-amber-400 text-stone-900' : 'bg-stone-200 text-stone-600')
                  }
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        {quick && (
          <button
            type="button"
            onClick={onClearQuick}
            className="mt-2 w-full rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold py-1.5"
          >
            กำลังกรอง: {quick === 'bake' ? '🔥 อบวันนี้' : '💸 ค้างเงิน'} · แตะเพื่อดูทั้งหมด ✕
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visible.map((o) => {
          const next = !o.is_draft ? nextStatus(o.fulfillment_type, o.work_status) : null
          return (
            <div key={o.id} className="space-y-1.5 animate-form-in">
              <OrderCard order={o} />
              {next && (
                <button
                  type="button"
                  onClick={() => void handleAdvance(o.id, next)}
                  className="w-full rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-white text-sm font-semibold py-2.5 shadow-[0_10px_20px_-10px_rgb(146_82_12_/_0.8)] active:scale-95"
                >
                  ย้ายไปขั้น "{stageLabel(o.fulfillment_type, next)}" →
                </button>
              )}
              {o.is_draft && <p className="text-center text-xs text-stone-400">แตะการ์ดเพื่อเปิดดูและยืนยันออเดอร์</p>}
            </div>
          )
        })}
        {visible.length === 0 && (
          <div className="rounded-3xl bg-white border border-stone-200 p-10 text-center">
            <p className="text-4xl mb-2">📭</p>
            <p className="text-sm text-stone-400">ไม่มีออเดอร์ในช่องนี้</p>
          </div>
        )}
      </div>

      {error && <Toast variant="error" message={error} onDone={() => setError(null)} />}
    </div>
  )
}
