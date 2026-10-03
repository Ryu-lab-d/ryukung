import { Link } from 'react-router-dom'
import { daysFromToday } from '../lib/dates'
import { formatBaht } from '../lib/money'
import type { BoardOrder } from './useOrderBoard'

const PAYMENT_COLOR: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
}
const PAYMENT_LABEL: Record<string, string> = { unpaid: 'ยังไม่จ่าย', partial: 'มัดจำแล้ว', paid: 'จ่ายครบ' }
const FULFILLMENT: Record<string, { icon: string; label: string }> = {
  pickup: { icon: '🏠', label: 'นัดรับ' },
  shipping: { icon: '📦', label: 'ส่งพัสดุ' },
  rider: { icon: '🛵', label: 'ไรเดอร์' },
  self_deliver: { icon: '🚲', label: 'ส่งเอง' },
}

/** ป้ายความเร่งด่วนจากวันที่ลูกค้าต้องการ — เกินกำหนด/วันนี้ เด่นเป็นสีแดง/ส้ม ให้กวาดตาเจอก่อน */
function dueBadge(order: BoardOrder): { text: string; cls: string; bar: string } | null {
  if (!order.needed_date || order.work_status === 'delivered') return null
  const n = daysFromToday(order.needed_date)
  if (n < 0) return { text: `เลยกำหนด ${-n} วัน`, cls: 'bg-red-600 text-white', bar: 'bg-red-500' }
  if (n === 0) return { text: 'วันนี้!', cls: 'bg-orange-500 text-white', bar: 'bg-orange-500' }
  if (n === 1) return { text: 'พรุ่งนี้', cls: 'bg-amber-200 text-amber-900', bar: 'bg-amber-400' }
  return { text: `อีก ${n} วัน`, cls: 'bg-stone-100 text-stone-600', bar: 'bg-stone-300' }
}

export function OrderCard({ order }: { order: BoardOrder }) {
  const due = dueBadge(order)
  const ful = FULFILLMENT[order.fulfillment_type] ?? { icon: '📦', label: order.fulfillment_type }
  const where = order.fulfillment_type === 'pickup' ? order.pickup_place : null
  return (
    <Link
      to={`/orders/${order.id}`}
      className={
        'relative block overflow-hidden rounded-2xl bg-white border p-3.5 pl-4 space-y-2 shadow-[0_6px_18px_-12px_rgb(51_32_14_/_0.5)] hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-14px_rgb(51_32_14_/_0.55)] transition-all duration-200 ' +
        (order.address_edited_at
          ? 'border-blue-300 ring-2 ring-blue-100'
          : order.payment_claimed_at
            ? 'border-green-300 ring-2 ring-green-100'
            : 'border-stone-200')
      }
    >
      <span className={'absolute left-0 top-0 bottom-0 w-1.5 ' + (due?.bar ?? 'bg-stone-200')} aria-hidden="true" />

      {order.is_draft && order.order_source === 'customer' && (
        <p className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1">🛒 ลูกค้าสั่งเอง · รอคุณยืนยัน</p>
      )}
      {order.is_draft && order.order_source !== 'customer' && (
        <p className="text-xs font-semibold text-stone-600 bg-stone-100 rounded-lg px-2 py-1">📝 ร่างที่ยังไม่เสร็จ · ยังไม่ยืนยัน</p>
      )}
      {order.address_edited_at && (
        <p className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-2 py-1">📮 ลูกค้าแก้ที่อยู่ใหม่</p>
      )}
      {order.payment_claimed_at && (
        <p className="text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-2 py-1">💰 ลูกค้าแจ้งชำระเงินแล้ว — ตรวจสลิป</p>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-stone-900 truncate">{order.customer_name ?? 'ไม่มีชื่อลูกค้า'}</p>
          {order.order_no && <p className="text-[11px] text-stone-400 font-mono">{order.order_no}</p>}
        </div>
        {due && <span className={'shrink-0 text-xs font-bold rounded-full px-2.5 py-1 ' + due.cls}>{due.text}</span>}
      </div>

      <p className="text-sm text-stone-600 line-clamp-2">{order.items_summary || 'ยังไม่มีสินค้า'}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        <span>{ful.icon} {ful.label}{order.needed_date ? ` · ${order.needed_date}` : ''}</span>
        {order.pickup_time && order.fulfillment_type === 'pickup' && <span>🕐 {order.pickup_time}</span>}
      </div>
      {where && <p className="text-xs text-stone-600 truncate">📍 {where}</p>}

      <div className="flex items-center justify-between pt-0.5">
        <span className="text-base font-bold tabular-nums text-stone-900">
          {formatBaht(order.grand_total)} <span className="text-xs font-normal text-stone-400">บาท</span>
        </span>
        {!order.is_draft && (
          <span className={'text-xs font-semibold rounded-full px-2.5 py-1 ' + PAYMENT_COLOR[order.payment_status]}>
            {PAYMENT_LABEL[order.payment_status]}
          </span>
        )}
      </div>
      {order.assignee_name && <p className="text-xs text-stone-500 truncate">👤 {order.assignee_name}</p>}
    </Link>
  )
}
