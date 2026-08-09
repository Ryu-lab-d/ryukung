import { Link } from 'react-router-dom'
import type { BoardOrder } from './useOrderBoard'

const PAYMENT_COLOR: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
}
const PAYMENT_LABEL: Record<string, string> = { unpaid: 'ยังไม่จ่าย', partial: 'มัดจำแล้ว', paid: 'จ่ายครบ' }
const FULFILLMENT_ICON: Record<string, string> = { pickup: '🏠', shipping: '📦', rider: '🛵', self_deliver: '🚲' }

export function OrderCard({ order }: { order: BoardOrder }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className={
        'block rounded-lg bg-white border p-2.5 space-y-1 shadow-sm ' +
        (order.address_edited_at ? 'border-blue-300 ring-2 ring-blue-100' : 'border-stone-200')
      }
    >
      {order.address_edited_at && (
        <p className="text-xs font-medium text-blue-700 flex items-center gap-1">📮 ลูกค้าแก้ที่อยู่ใหม่</p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium truncate">{order.customer_name ?? 'ไม่มีชื่อลูกค้า'}</p>
        <span>{FULFILLMENT_ICON[order.fulfillment_type]}</span>
      </div>
      <p className="text-xs text-stone-500 truncate">{order.items_summary || 'ยังไม่มีสินค้า'}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-500">{order.needed_date ?? '-'}</span>
        {!order.is_draft && (
          <span className={'text-xs rounded-full px-2 py-0.5 ' + PAYMENT_COLOR[order.payment_status]}>
            {PAYMENT_LABEL[order.payment_status]}
          </span>
        )}
      </div>
      {order.assignee_name && (
        <p className="text-xs text-stone-500 truncate">👤 {order.assignee_name}</p>
      )}
    </Link>
  )
}
