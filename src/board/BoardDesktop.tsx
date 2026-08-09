import { useState } from 'react'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { OrderCard } from './OrderCard'
import { Toast } from '../lib/Toast'
import type { BoardOrder } from './useOrderBoard'

const COLUMNS: { status: string; label: string }[] = [
  { status: 'to_bake', label: 'รออบ' },
  { status: 'baking', label: 'กำลังทำ' },
  { status: 'ready', label: 'แพ็คแล้ว/กำลังส่ง' },
  { status: 'delivered', label: 'ส่งมอบแล้ว' },
]

// สถานะย่อยของขนส่งบริษัท/ไรเดอร์ (รอเข้ารับ/รับแล้ว/ระหว่างทาง) ยุบรวมแสดงในคอลัมน์ "แพ็คแล้ว/กำลังส่ง"
// เดียวกัน — ลากไปคอลัมน์ถัดไปได้เสมอ ถ้าลากข้ามหลายขั้นจริงๆ ฐานข้อมูลจะปฏิเสธเองและมีข้อความแจ้งเตือน
const READY_GROUP = ['ready', 'waiting_courier', 'picked_up', 'in_transit']

function DraggableCard({ order }: { order: BoardOrder }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: order.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10, position: 'relative' } : undefined}
    >
      <OrderCard order={order} />
    </div>
  )
}

function Column({ status, label, orders }: { status: string; label: string; orders: BoardOrder[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={'flex-1 min-w-64 rounded-xl p-2 space-y-2 ' + (isOver ? 'bg-stone-100' : 'bg-stone-50')}>
      <h2 className="text-sm font-semibold px-1">{label} ({orders.length})</h2>
      {orders.map((o) => <DraggableCard key={o.id} order={o} />)}
    </div>
  )
}

export function BoardDesktop({
  orders,
  onChangeStatus,
}: {
  orders: BoardOrder[]
  onChangeStatus: (orderId: string, status: string) => Promise<{ error: { message: string } | null }>
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const confirmed = orders.filter((o) => !o.is_draft)
  const [error, setError] = useState<string | null>(null)

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const { error } = await onChangeStatus(String(active.id), String(over.id))
    if (error) setError(error.message)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
      <div className="hidden lg:flex gap-3 p-4 overflow-x-auto">
        {COLUMNS.map((col) => (
          <Column
            key={col.status}
            status={col.status}
            label={col.label}
            orders={confirmed.filter((o) => (col.status === 'ready' ? READY_GROUP.includes(o.work_status) : o.work_status === col.status))}
          />
        ))}
      </div>
      {error && <Toast variant="error" message={error} onDone={() => setError(null)} />}
    </DndContext>
  )
}
