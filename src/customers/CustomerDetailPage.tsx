import { Link, useParams } from 'react-router-dom'
import { useCustomers } from './useCustomers'
import { useAddresses } from './useAddresses'
import { useCustomerOrders } from './useCustomerOrders'
import { formatBaht } from '../lib/money'

const WORK_STATUS_LABELS: Record<string, string> = {
  to_bake: 'รออบ', baking: 'กำลังทำ', ready: 'แพ็คแล้วรอส่ง', delivered: 'ส่งมอบแล้ว', cancelled: 'ยกเลิกแล้ว',
}
const PAYMENT_COLOR: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
}
const PAYMENT_LABEL: Record<string, string> = { unpaid: 'ยังไม่จ่าย', partial: 'มัดจำแล้ว', paid: 'จ่ายครบ' }

export function CustomerDetailPage() {
  const { id } = useParams()
  const { customers } = useCustomers()
  const { addresses } = useAddresses(id ?? null)
  const { orders } = useCustomerOrders(id ?? null)
  const customer = customers.find((c) => c.id === id)

  if (!customer) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าลูกค้า
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{customer.name}</h1>
          <p className="text-sm text-stone-500">
            {customer.phone}
            {customer.channel && ` · ${customer.channel} (${customer.channel_handle ?? '-'})`}
          </p>
        </div>
        <Link to={`/customers/${customer.id}/edit`} className="text-sm text-stone-600 underline shrink-0">แก้ไข</Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">จำนวนออเดอร์</p>
          <p className="text-xl font-semibold">{customer.order_count}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">ยอดซื้อรวม</p>
          <p className="text-xl font-semibold">{formatBaht(customer.total_spend)}</p>
        </div>
      </div>

      {customer.note && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {customer.note}
        </div>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">ที่อยู่จัดส่ง</h2>
          <Link to={`/customers/${customer.id}/addresses/new`} className="text-xs text-stone-500 underline">
            + เพิ่มที่อยู่
          </Link>
        </div>
        {addresses.map((a) => (
          <div key={a.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {a.label} {a.is_default && <span className="text-xs text-stone-500">(ที่อยู่หลัก)</span>}
              </p>
              {(a.recipient_name || a.recipient_phone) && (
                <p className="text-stone-600">{a.recipient_name} {a.recipient_phone}</p>
              )}
              <p className="text-stone-600">{a.address_text}</p>
            </div>
            <Link
              to={`/customers/${customer.id}/addresses/${a.id}/edit`}
              className="text-xs text-stone-500 underline shrink-0"
            >
              แก้ไข
            </Link>
          </div>
        ))}
        {addresses.length === 0 && <p className="text-sm text-stone-400">ยังไม่มีที่อยู่</p>}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-3 space-y-1">
        <h2 className="text-sm font-semibold mb-1">ประวัติการซื้อ</h2>
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="flex items-center justify-between text-sm py-2 border-b border-stone-100 last:border-0"
          >
            <div>
              <p className="font-medium">{o.order_no}</p>
              <p className="text-xs text-stone-500">{o.needed_date ?? '-'}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">{formatBaht(o.grand_total)}</p>
              <span className={'text-xs rounded-full px-2 py-0.5 ' + (PAYMENT_COLOR[o.payment_status] ?? 'bg-stone-100 text-stone-600')}>
                {PAYMENT_LABEL[o.payment_status] ?? WORK_STATUS_LABELS[o.work_status] ?? o.work_status}
              </span>
            </div>
          </Link>
        ))}
        {orders.length === 0 && <p className="text-sm text-stone-400">ยังไม่เคยสั่งซื้อ</p>}
      </section>
    </div>
  )
}
