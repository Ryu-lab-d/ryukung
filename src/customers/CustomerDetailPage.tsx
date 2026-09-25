import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCustomers } from './useCustomers'
import { useAddresses } from './useAddresses'
import { useCustomerOrders } from './useCustomerOrders'
import { formatBaht } from '../lib/money'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { reorderFromOrder } from '../orders/api'
import { avatarStyle, initials } from './avatar'

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
  const navigate = useNavigate()
  const { customers, remove } = useCustomers()
  const { addresses } = useAddresses(id ?? null)
  const { orders } = useCustomerOrders(id ?? null)
  const customer = customers.find((c) => c.id === id)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)

  if (!customer) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  async function handleReorder(orderId: string) {
    setReorderingId(orderId)
    const { id: newId, error } = await reorderFromOrder(orderId)
    setReorderingId(null)
    if (error) { setReorderError(error.message); return }
    navigate(`/orders/${newId}/edit`)
  }

  async function handleDelete() {
    setShowDeleteConfirm(false)
    setDeleting(true)
    const { error } = await remove(customer!.id)
    setDeleting(false)
    if (error) { setDeleteError(error.message); return }
    navigate('/customers')
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าลูกค้า
      </Link>

      <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div
          className={'flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold ' + avatarStyle(customer.name)}
        >
          {initials(customer.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-stone-900 truncate">{customer.name}</h1>
          <p className="text-sm text-stone-500 truncate">
            {customer.phone || 'ไม่มีเบอร์โทร'}
            {customer.channel && ` · ${customer.channel} (${customer.channel_handle ?? '-'})`}
          </p>
        </div>
        <Link
          to={`/customers/${customer.id}/edit`}
          className="shrink-0 rounded-lg border border-stone-300 text-stone-600 text-sm px-3 py-1.5 hover:bg-stone-50 transition-colors"
        >
          แก้ไข
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">📦 จำนวนออเดอร์</p>
          <p className="text-xl font-semibold text-stone-900">{customer.order_count}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <p className="text-xs text-stone-500">💰 ยอดซื้อรวม</p>
          <p className="text-xl font-semibold text-stone-900">{formatBaht(customer.total_spend)}</p>
        </div>
      </div>

      {customer.note && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {customer.note}
        </div>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900">📍 ที่อยู่จัดส่ง</h2>
          <Link
            to={`/customers/${customer.id}/addresses/new`}
            className="text-xs font-medium text-stone-600 rounded-full bg-stone-100 px-2.5 py-1 hover:bg-stone-200 transition-colors"
          >
            + เพิ่มที่อยู่
          </Link>
        </div>
        {addresses.map((a) => (
          <div key={a.id} className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-stone-900 flex items-center gap-1.5">
                {a.label}
                {a.is_default && (
                  <span className="text-[11px] font-medium rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                    ⭐ ที่อยู่หลัก
                  </span>
                )}
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
        {addresses.length === 0 && <p className="text-sm text-stone-400 py-2">ยังไม่มีที่อยู่</p>}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-3 space-y-1">
        <h2 className="text-sm font-semibold text-stone-900 mb-1">🧾 ประวัติการซื้อ</h2>
        {reorderError && <p className="text-xs text-red-600 pb-1">{reorderError}</p>}
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 text-sm py-2 border-b border-stone-100 last:border-0">
            <Link to={`/orders/${o.id}`} className="flex-1 min-w-0">
              <p className="font-medium">{o.order_no}</p>
              <p className="text-xs text-stone-500">{o.needed_date ?? '-'}</p>
            </Link>
            <div className="text-right shrink-0">
              <p className="font-medium">{formatBaht(o.grand_total)}</p>
              <span className={'text-xs rounded-full px-2 py-0.5 ' + (PAYMENT_COLOR[o.payment_status] ?? 'bg-stone-100 text-stone-600')}>
                {PAYMENT_LABEL[o.payment_status] ?? WORK_STATUS_LABELS[o.work_status] ?? o.work_status}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleReorder(o.id)}
              disabled={reorderingId === o.id}
              className="shrink-0 text-xs rounded-lg border border-stone-300 text-stone-600 px-2 py-1.5 disabled:opacity-50"
            >
              {reorderingId === o.id ? '...' : '🔁 สั่งซ้ำ'}
            </button>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-stone-400">ยังไม่เคยสั่งซื้อ</p>}
      </section>

      <div className="border-t border-stone-100 pt-3">
        {deleteError && <p className="text-sm text-red-600 mb-2">{deleteError}</p>}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="w-full rounded-lg bg-red-600 text-white font-medium py-2.5 disabled:opacity-50"
        >
          {deleting ? 'กำลังลบ...' : '🗑️ ลบลูกค้าถาวร'}
        </button>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={`ลบลูกค้า "${customer.name}" ถาวร?`}
          message="ออเดอร์เก่าจะยังอยู่ครบ แค่ไม่ผูกกับลูกค้าคนนี้แล้ว ที่อยู่ของลูกค้าคนนี้จะถูกลบไปด้วย"
          confirmLabel="ลบถาวร"
          cancelLabel="ไม่ลบ"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
