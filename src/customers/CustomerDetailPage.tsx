import { Link, useParams } from 'react-router-dom'
import { useCustomers } from './useCustomers'
import { useAddresses } from './useAddresses'
import { useCustomerOrders } from './useCustomerOrders'
import { formatBaht } from '../lib/money'

export function CustomerDetailPage() {
  const { id } = useParams()
  const { customers } = useCustomers()
  const { addresses } = useAddresses(id ?? null)
  const { orders } = useCustomerOrders(id ?? null)
  const customer = customers.find((c) => c.id === id)

  if (!customer) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{customer.name}</h1>
        <Link to={`/customers/${customer.id}/edit`} className="text-sm text-stone-600 underline">แก้ไข</Link>
      </div>
      <p className="text-sm text-stone-500">
        {customer.phone} {customer.channel && `· ${customer.channel} (${customer.channel_handle ?? '-'})`}
      </p>

      {customer.note && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {customer.note}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">ที่อยู่จัดส่ง</h2>
          <Link to={`/customers/${customer.id}/addresses/new`} className="text-xs text-stone-500 underline">
            + เพิ่มที่อยู่
          </Link>
        </div>
        {addresses.map((a) => (
          <div key={a.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <p className="font-medium">
              {a.label} {a.is_default && <span className="text-xs text-stone-500">(ที่อยู่หลัก)</span>}
            </p>
            {(a.recipient_name || a.recipient_phone) && (
              <p className="text-stone-600">{a.recipient_name} {a.recipient_phone}</p>
            )}
            <p className="text-stone-600">{a.address_text}</p>
          </div>
        ))}
        {addresses.length === 0 && <p className="text-sm text-stone-400">ยังไม่มีที่อยู่</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">ประวัติการซื้อ</h2>
        {orders.map((o) => (
          <div key={o.id} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
            <span>{o.order_no}</span>
            <span>{formatBaht(o.grand_total)} บาท</span>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-stone-400">ยังไม่เคยสั่งซื้อ</p>}
      </section>
    </div>
  )
}
