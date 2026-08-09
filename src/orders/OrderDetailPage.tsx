import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useOrder } from './useOrder'
import { changeWorkStatus, deleteOrder, assignOrder, reorderFromOrder } from './api'
import { CancelOrderDialog } from './CancelOrderDialog'
import { PaymentsSection } from './PaymentsSection'
import { ShippingSection } from './ShippingSection'
import { CopyPublicLinkButton } from './CopyPublicLinkButton'
import { WorkStatusStepper } from './WorkStatusStepper'
import { StatusChangeToast } from './StatusChangeToast'
import { AssigneeSection } from './AssigneeSection'
import { stageLabel } from './workStatus'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { Toast } from '../lib/Toast'
import { formatBaht } from '../lib/money'
import { supabase } from '../lib/supabase'
import { useSettings } from '../settings/useSettings'
import { sendCustomerEmail } from '../lib/customerEmail'
import { paymentReceivedEmail, paymentReminderEmail } from '../lib/emailTemplates'

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง',
}

const PAYMENT_LABEL: Record<string, string> = { unpaid: 'ยังไม่ชำระ', partial: 'มัดจำแล้ว', paid: 'จ่ายครบแล้ว' }
const PAYMENT_COLOR: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
}

export function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { order, items, payments, loading, reload } = useOrder(id ?? null)
  const { settings } = useSettings()
  const [showCancel, setShowCancel] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusChange, setStatusChange] = useState<{ status: string; label: string } | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)

  if (loading || !order) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  async function handleAdvanceStatus(newStatus: string) {
    const { error } = await changeWorkStatus(order.id, newStatus)
    if (error) { setStatusError(error.message); return }
    await reload()
    setStatusChange({ status: newStatus, label: stageLabel(order.fulfillment_type, newStatus) })
  }

  async function handleAssign(staffId: string | null) {
    await assignOrder(order.id, staffId)
    await reload()
  }

  async function handleAcknowledgeAddressEdit() {
    await supabase.from('orders').update({ address_edited_at: null }).eq('id', order.id)
    await reload()
  }

  async function handlePaymentRecorded(amount: number) {
    await reload()
    if (order.customers?.email && settings) {
      const newBalanceDue = balanceDue - amount
      const { subject, html } = paymentReceivedEmail({
        shopName: settings.shop_name,
        orderNo: order.order_no ?? '-',
        customerName: order.customers.name,
        amount,
        balanceDue: newBalanceDue,
        publicUrl: `${window.location.origin}/o/${order.public_token}`,
      })
      void sendCustomerEmail(order.customers.email, subject, html)
    }
  }

  async function handleSendReminder() {
    if (!order.customers?.email || !settings) return
    setSendingReminder(true)
    const { subject, html } = paymentReminderEmail({
      shopName: settings.shop_name,
      orderNo: order.order_no ?? '-',
      customerName: order.customers.name,
      grandTotal: Number(order.grand_total),
      paymentInstructions: settings.payment_instructions,
      publicUrl: `${window.location.origin}/o/${order.public_token}`,
    })
    const { error } = await sendCustomerEmail(order.customers.email, subject, html)
    setSendingReminder(false)
    setEmailMessage(error ? 'ส่งอีเมลไม่สำเร็จ: ' + error : `ส่งอีเมลเตือนชำระเงินไปที่ ${order.customers.email} แล้ว`)
  }

  async function handleReorder() {
    setReordering(true)
    const { id: newId, error } = await reorderFromOrder(order.id)
    setReordering(false)
    if (error) { setReorderError(error.message); return }
    navigate(`/orders/${newId}/edit`)
  }

  async function handleDelete() {
    setShowDeleteConfirm(false)
    setDeleting(true)
    const { error } = await deleteOrder(order.id)
    setDeleting(false)
    if (error) { setDeleteError(error.message); return }
    navigate('/')
  }

  const paid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)
  const balanceDue = Number(order.grand_total) - paid

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าออเดอร์
      </Link>

      {order.customers?.note && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {order.customers.note}
        </div>
      )}

      {order.address_edited_at && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-sm text-blue-800 flex items-center justify-between gap-2">
          <span>📮 ลูกค้าเพิ่งแก้ไขที่อยู่จัดส่งเอง เมื่อ {new Date(order.address_edited_at).toLocaleString('th-TH')}</span>
          <button type="button" onClick={handleAcknowledgeAddressEdit} className="shrink-0 rounded-lg bg-blue-600 text-white text-xs px-2.5 py-1.5 font-medium">
            รับทราบแล้ว
          </button>
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
          <button type="button" onClick={() => void handleReorder()} disabled={reordering} className="text-sm text-stone-600 underline disabled:opacity-50">
            {reordering ? 'กำลังสร้าง...' : '🔁 สั่งซ้ำ'}
          </button>
          <Link to={`/orders/${order.id}/receipt`} className="text-sm text-stone-600 underline">ใบเสร็จ</Link>
          <Link to={`/orders/${order.id}/edit`} className="text-sm text-stone-600 underline">แก้ไข</Link>
        </div>
      </div>
      {reorderError && <p className="text-sm text-red-600">{reorderError}</p>}

      {!order.is_draft && <CopyPublicLinkButton token={order.public_token} />}

      <AssigneeSection
        assignedTo={order.assigned_to}
        assigneeName={order.staff_members?.display_name ?? order.staff_members?.email ?? null}
        onAssign={handleAssign}
      />

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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">สถานะงาน</h2>
            <span className={'text-xs font-medium rounded-full px-2.5 py-1 border ' + PAYMENT_COLOR[order.payment_status]}>
              💰 {PAYMENT_LABEL[order.payment_status]}
            </span>
          </div>
          <WorkStatusStepper
            fulfillmentType={order.fulfillment_type}
            workStatus={order.work_status}
            paymentStatus={order.payment_status}
            onAdvance={handleAdvanceStatus}
          />
        </div>
      )}

      {order.work_status === 'delivered' && order.delivered_at && (
        <DeliveredCleanupBanner deliveredAt={order.delivered_at} onDeleteNow={() => setShowDeleteConfirm(true)} />
      )}

      <PaymentsSection orderId={order.id} payments={payments} onRecorded={handlePaymentRecorded} />

      {order.work_status !== 'cancelled' && order.payment_status !== 'paid' && (
        order.customers?.email ? (
          <button
            type="button"
            onClick={() => void handleSendReminder()}
            disabled={sendingReminder}
            className="w-full rounded-lg border-2 border-amber-300 text-amber-700 font-medium py-2.5 disabled:opacity-50"
          >
            {sendingReminder ? 'กำลังส่งอีเมล...' : '📧 ส่งอีเมลเตือนลูกค้าว่ายังไม่ได้ชำระเงิน'}
          </button>
        ) : (
          <p className="text-xs text-stone-400 text-center">ลูกค้าคนนี้ยังไม่มีอีเมล ส่งอีเมลเตือนชำระเงินไม่ได้</p>
        )
      )}

      <ShippingSection order={order} onSaved={reload} />

      {order.work_status === 'cancelled' ? (
        <p className="text-sm text-stone-500">ออเดอร์นี้ถูกยกเลิกแล้ว · สถานะคืนเงิน: {order.refund_status}</p>
      ) : (
        <button
          type="button"
          onClick={() => setShowCancel(true)}
          className="w-full rounded-lg border-2 border-red-300 text-red-700 font-medium py-2.5"
        >
          ยกเลิกออเดอร์
        </button>
      )}

      <div className="border-t border-stone-100 pt-3">
        {deleteError && <p className="text-sm text-red-600 mb-2">{deleteError}</p>}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="w-full rounded-lg bg-red-600 text-white font-medium py-2.5 disabled:opacity-50"
        >
          {deleting ? 'กำลังลบ...' : '🗑️ ลบออเดอร์ถาวร (ประหยัดพื้นที่)'}
        </button>
      </div>

      {showCancel && (
        <CancelOrderDialog
          orderId={order.id}
          hasPayments={payments.length > 0}
          onClose={() => setShowCancel(false)}
          onDone={() => { setShowCancel(false); navigate('/') }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="แน่ใจนะว่าจะลบออเดอร์นี้?"
          message="ลบแล้วกู้คืนไม่ได้ รวมถึงใบเสร็จที่เคยออกไปแล้วของออเดอร์นี้ด้วย (ถ้ามี)"
          confirmLabel="ลบถาวร"
          cancelLabel="ไม่ลบ"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {statusChange && (
        <StatusChangeToast status={statusChange.status} label={statusChange.label} onDone={() => setStatusChange(null)} />
      )}
      {statusError && <Toast variant="error" message={statusError} onDone={() => setStatusError(null)} />}
      {emailMessage && <Toast message={emailMessage} onDone={() => setEmailMessage(null)} />}
    </div>
  )
}

function DeliveredCleanupBanner({ deliveredAt, onDeleteNow }: { deliveredAt: string; onDeleteNow: () => void }) {
  const deliveredDate = new Date(deliveredAt)
  const hoursSince = (Date.now() - deliveredDate.getTime()) / 3_600_000
  const dueForCleanup = hoursSince >= 24

  return (
    <div
      className={
        'rounded-lg border px-3 py-2.5 text-sm space-y-1.5 ' +
        (dueForCleanup ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-stone-50 border-stone-200 text-stone-600')
      }
    >
      <p className="flex items-center gap-2">
        {dueForCleanup ? (
          <>🗑️ <span>ครบกำหนดลบแล้ว — ออเดอร์นี้จัดส่ง/ส่งมอบสำเร็จมาเกิน 1 วัน ลบได้เพื่อประหยัดพื้นที่ Supabase</span></>
        ) : (
          <>📦 <span>จัดส่ง/ส่งมอบสำเร็จเมื่อ {deliveredDate.toLocaleString('th-TH')} — ระบบจะเตือนให้ลบเพื่อประหยัดพื้นที่ เมื่อครบ 1 วันหลังจัดส่งสำเร็จ</span></>
        )}
      </p>
      <div className="flex items-center gap-3">
        {dueForCleanup && (
          <button type="button" onClick={onDeleteNow} className="rounded-lg bg-orange-600 text-white text-xs px-2.5 py-1.5 font-medium">
            ลบตอนนี้
          </button>
        )}
        <Link to="/storage" className="text-xs underline">ดูรายการที่ครบกำหนดลบทั้งหมด</Link>
      </div>
    </div>
  )
}
