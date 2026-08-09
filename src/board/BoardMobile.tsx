import { useState } from 'react'
import { OrderCard } from './OrderCard'
import { Toast } from '../lib/Toast'
import { nextStatus, stageLabel } from '../orders/workStatus'
import type { BoardOrder } from './useOrderBoard'

const FILTER_LABELS: Record<string, string> = {
  draft: 'ร่าง', to_bake: 'รออบ', baking: 'กำลังทำ', ready: 'แพ็คแล้ว/กำลังส่ง', delivered: 'ส่งมอบแล้ว',
}
// สถานะย่อยของขนส่งบริษัท/ไรเดอร์ (รอเข้ารับ/รับแล้ว/ระหว่างทาง) นับรวมอยู่ในแท็บ "แพ็คแล้ว/กำลังส่ง"
const READY_GROUP = ['ready', 'waiting_courier', 'picked_up', 'in_transit']

export function BoardMobile({
  orders,
  filter,
  onChangeStatus,
}: {
  orders: BoardOrder[]
  filter: string
  onChangeStatus: (orderId: string, status: string) => Promise<{ error: { message: string } | null }>
}) {
  const [activeFilter, setActiveFilter] = useState(filter)
  const [error, setError] = useState<string | null>(null)
  const visible = orders.filter((o) =>
    activeFilter === 'draft'
      ? o.is_draft
      : !o.is_draft && (activeFilter === 'ready' ? READY_GROUP.includes(o.work_status) : o.work_status === activeFilter)
  )

  async function handleAdvance(orderId: string, status: string) {
    const { error } = await onChangeStatus(orderId, status)
    if (error) setError(error.message)
  }

  return (
    <div className="lg:hidden p-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.entries(FILTER_LABELS).map(([status, label]) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveFilter(status)}
            className={'shrink-0 rounded-full px-3 py-1.5 text-sm ' + (activeFilter === status ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((o) => {
          const next = !o.is_draft ? nextStatus(o.fulfillment_type, o.work_status) : null
          return (
            <div key={o.id} className="space-y-1">
              <OrderCard order={o} />
              {next && (
                <button
                  type="button"
                  onClick={() => void handleAdvance(o.id, next)}
                  className="w-full rounded-lg bg-stone-900 text-white text-sm py-2"
                >
                  ย้ายไปขั้น "{stageLabel(o.fulfillment_type, next)}"
                </button>
              )}
            </div>
          )
        })}
        {visible.length === 0 && <p className="text-sm text-stone-400">ไม่มีออเดอร์ในช่องนี้</p>}
      </div>

      {error && <Toast variant="error" message={error} onDone={() => setError(null)} />}
    </div>
  )
}
