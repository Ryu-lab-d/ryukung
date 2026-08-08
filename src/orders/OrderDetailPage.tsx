import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useOrder } from './useOrder'
import { changeWorkStatus } from './api'
import { CancelOrderDialog } from './CancelOrderDialog'
import { PaymentsSection } from './PaymentsSection'
import { ShippingSection } from './ShippingSection'
import { CopyPublicLinkButton } from './CopyPublicLinkButton'
import { formatBaht } from '../lib/money'

const WORK_STATUS_LABELS: Record<string, string> = {
  to_bake: 'รออบ', baking: 'กำลังทำ', ready: 'แพ็คแล้วรอส่ง', delivered: 'ส่งมอบแล้ว',
}

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง',
}

export function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { order, items, payments, loading, reload } = useOrder(id ?? null)
  const [showCancel, setShowCancel] = useState(false)

  if (loading || !order) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  const paid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
  const balanceDue = Number(order.grand_total) - paid

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {order.customers?.note && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {order.customers.note}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{order.order_no ?? 'ร่าง'}</h1>
          <p className="text-sm text-stone-500">
            {order.customers?.name ?? 'ไม่มีชื่อลูกค้า'}
            {order.customers?.phone && (
              <> · <a href={`tel:${order.customers.phone}`} className="underline">{order.customers.phone}</a></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/orders/${order.id}/receipt`} className="text-sm text-stone-600 underline">ใบเสร็จ</Link>
          <Link to={`/orders/${order.id}/edit`} className="text-sm text-stone-600 underline">แก้ไข</Link>
        </div>
      </div>

      {!order.is_draft && <CopyPublicLinkButton token={order.public_token} />}

      <div className="rounded-lg border border-stone-200 p-3 space-y-1.5">
        <h2 className="text-sm font-semibold">การส่งของ</h2>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">วิธีรับของ</span>
          <span>{FULFILLMENT_LABELS[order.fulfillment_type] ?? order.fulfillment_type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">วันที่ต้องได้ของ</span>
          <span>{order.needed_date ?? '-'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">วันที่ต้องอบ</span>
          <span>{order.bake_date ?? '-'}</span>
        </div>
        {order.fulfillment_type === 'pickup' ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">จุดนัดรับ</span>
              <span>{order.pickup_place ?? '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">เวลานัดรับ</span>
              <span>{order.pickup_time ?? '-'}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">ผู้รับ</span>
              <span>
                {order.ship_recipient_name ?? '-'}
                {order.ship_recipient_phone && (
                  <> · <a href={`tel:${order.ship_recipient_phone}`} className="underline">{order.ship_recipient_phone}</a></>
                )}
              </span>
            </div>
            {order.ship_address_text && (
              <div className="text-sm">
                <span className="text-stone-500">ที่อยู่: </span>
                <span>{order.ship_address_text}</span>
              </div>
            )}
            {order.tracking_no && (
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">เลขพัสดุ</span>
                <span>{order.tracking_no} {order.carrier && `(${order.carrier})`}</span>
              </div>
            )}
          </>
        )}
        {order.note && (
          <div className="text-sm">
            <span className="text-stone-500">หมายเหตุออเดอร์: </span>
            <span>{order.note}</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-stone-200 p-3 space-y-2">
        <h2 className="text-sm font-semibold">รายการสินค้า</h2>
        {items.map((it: any) => (
          <div key={it.id} className="flex justify-between text-sm">
            <span>{it.product_name} x{it.qty}</span>
            <span>{formatBaht(it.line_total)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2">
          <span>ยอดรวม</span><span>{formatBaht(order.grand_total)}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-500">
          <span>จ่ายแล้ว {formatBaht(paid)}</span><span>คงเหลือ {formatBaht(balanceDue)}</span>
        </div>
      </div>

      {order.work_status !== 'cancelled' && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(WORK_STATUS_LABELS).map(([status, label]) => (
            <button
              key={status}
              type="button"
              disabled={order.work_status === status}
              onClick={async () => { await changeWorkStatus(order.id, status); await reload() }}
              className={'rounded-full px-3 py-1.5 text-sm ' + (order.work_status === status ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <PaymentsSection orderId={order.id} payments={payments} onRecorded={reload} />
      <ShippingSection order={order} onSaved={reload} />

      {order.work_status === 'cancelled' ? (
        <p className="text-sm text-stone-500">ออเดอร์นี้ถูกยกเลิกแล้ว · สถานะคืนเงิน: {order.refund_status}</p>
      ) : (
        <button type="button" onClick={() => setShowCancel(true)} className="text-sm text-red-600 underline">
          ยกเลิกออเดอร์
        </button>
      )}

      {showCancel && (
        <CancelOrderDialog
          orderId={order.id}
          hasPayments={payments.length > 0}
          onClose={() => setShowCancel(false)}
          onDone={() => { setShowCancel(false); navigate('/') }}
        />
      )}
    </div>
  )
}
