import { useState } from 'react'
import { OrderCard } from './OrderCard'
import type { BoardOrder } from './useOrderBoard'

const STATUS_LABELS: Record<string, string> = {
  draft: 'ร่าง', to_bake: 'รออบ', baking: 'กำลังทำ', ready: 'แพ็คแล้วรอส่ง', delivered: 'ส่งมอบแล้ว',
}
const NEXT_STATUS: Record<string, string | null> = {
  to_bake: 'baking', baking: 'ready', ready: 'delivered', delivered: null,
}

export function BoardMobile({
  orders,
  filter,
  onChangeStatus,
}: {
  orders: BoardOrder[]
  filter: string
  onChangeStatus: (orderId: string, status: string) => void
}) {
  const [activeFilter, setActiveFilter] = useState(filter)
  const visible = orders.filter((o) =>
    activeFilter === 'draft' ? o.is_draft : !o.is_draft && o.work_status === activeFilter
  )

  return (
    <div className="lg:hidden p-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
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
        {visible.map((o) => (
          <div key={o.id} className="space-y-1">
            <OrderCard order={o} />
            {!o.is_draft && NEXT_STATUS[o.work_status] && (
              <button
                type="button"
                onClick={() => onChangeStatus(o.id, NEXT_STATUS[o.work_status]!)}
                className="w-full rounded-lg bg-stone-900 text-white text-sm py-2"
              >
                ย้ายไปช่อง "{STATUS_LABELS[NEXT_STATUS[o.work_status]!]}"
              </button>
            )}
          </div>
        ))}
        {visible.length === 0 && <p className="text-sm text-stone-400">ไม่มีออเดอร์ในช่องนี้</p>}
      </div>
    </div>
  )
}
