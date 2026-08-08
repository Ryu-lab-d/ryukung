import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { OrderCard } from './OrderCard'
import type { BoardOrder } from './useOrderBoard'

const COLUMNS: { status: string; label: string }[] = [
  { status: 'to_bake', label: 'รออบ' },
  { status: 'baking', label: 'กำลังทำ' },
  { status: 'ready', label: 'แพ็คแล้วรอส่ง' },
  { status: 'delivered', label: 'ส่งมอบแล้ว' },
]

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
  onChangeStatus: (orderId: string, status: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const confirmed = orders.filter((o) => !o.is_draft)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    onChangeStatus(String(active.id), String(over.id))
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="hidden md:flex gap-3 p-4 overflow-x-auto">
        {COLUMNS.map((col) => (
          <Column key={col.status} status={col.status} label={col.label} orders={confirmed.filter((o) => o.work_status === col.status)} />
        ))}
      </div>
    </DndContext>
  )
}
