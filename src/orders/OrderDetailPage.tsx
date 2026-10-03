import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useOrder } from './useOrder'
import { changeWorkStatus, deleteOrder, assignOrder, reorderFromOrder } from './api'
import { CancelOrderDialog } from './CancelOrderDialog'
import { RejectCustomerOrderDialog } from './RejectCustomerOrderDialog'
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
import { paymentReceivedEmail } from '../lib/emailTemplates'
import { productImageUrl } from '../products/ProductCard'
import { ComposeEmailModal } from './ComposeEmailModal'
import { AmbientGlow } from '../public/PublicSiteChrome'
import { daysFromToday } from '../lib/dates'

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง',
}

const FULFILLMENT_ICON: Record<string, string> = { pickup: '🏠', shipping: '📦', rider: '🛵', self_deliver: '🚲' }

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
  const [showReject, setShowReject] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusChange, setStatusChange] = useState<{ status: string; label: string } | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [showComposeEmail, setShowComposeEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)

  if (loading || !order) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด...
        </div>
      </div>
    )
  }

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

  async function handleAcknowledgePaymentClaim() {
    await supabase.from('orders').update({ payment_claimed_at: null }).eq('id', order.id)
    await reload()
  }

  async function handlePaymentRecorded(amount: number) {
    if (order.payment_claimed_at) {
      await supabase.from('orders').update({ payment_claimed_at: null }).eq('id', order.id)
    }
    await reload()
    if (order.customers?.email && settings) {
      const newBalanceDue = balanceDue - amount
      const { subject, html } = paymentReceivedEmail({
        shopName: settings.shop_name,
        logoUrl: settings.logo_path ? productImageUrl(settings.logo_path) : null,
        orderNo: order.order_no ?? '-',
        customerName: order.customers.name,
        amount,
        balanceDue: newBalanceDue,
        publicUrl: `${window.location.origin}/o/${order.public_token}`,
      })
      void sendCustomerEmail(order.customers.email, subject, html)
    }
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
  const dueDays = order.needed_date && order.work_status !== 'delivered' && order.work_status !== 'cancelled' ? daysFromToday(order.needed_date) : null
  const due =
    dueDays === null
      ? null
      : dueDays < 0
        ? { text: `เลยกำหนด ${-dueDays} วัน`, cls: 'bg-red-600 text-white' }
        : dueDays === 0
          ? { text: 'ต้องส่งวันนี้!', cls: 'bg-orange-500 text-white' }
          : dueDays === 1
            ? { text: 'พรุ่งนี้', cls: 'bg-amber-200 text-amber-900' }
            : { text: `อีก ${dueDays} วัน`, cls: 'bg-white/90 text-stone-700' }

  return (
    <div className="bg-stone-50 min-h-screen">
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
      >
        ← กลับหน้าออเดอร์
      </Link>

      {order.is_draft && order.order_source === 'customer' && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-3.5 space-y-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
          <p className="text-sm font-medium text-indigo-800">🛒 ลูกค้าส่งออเดอร์นี้มาเองจากหน้าเมนูออนไลน์ — รอร้านตรวจสอบและยืนยัน</p>
          <div className="flex gap-2">
            <Link
              to={`/orders/${order.id}/edit`}
              className="flex-1 text-center rounded-xl bg-stone-900 text-white text-sm font-medium py-2.5"
            >
              ตรวจสอบ & ยืนยันออเดอร์
            </Link>
            <button
              type="button"
              onClick={() => setShowReject(true)}
              className="flex-1 rounded-xl border-2 border-red-300 bg-white text-red-700 text-sm font-medium py-2.5"
            >
              ปฏิเสธออเดอร์
            </button>
          </div>
        </div>
      )}

      {order.customers?.note && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-sm text-amber-800">
          {order.customers.note}
        </div>
      )}

      {order.address_edited_at && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 px-3.5 py-2.5 text-sm text-blue-800 flex items-center justify-between gap-2">
          <span>📮 ลูกค้าเพิ่งแก้ไขที่อยู่จัดส่งเอง เมื่อ {new Date(order.address_edited_at).toLocaleString('th-TH')}</span>
          <button type="button" onClick={handleAcknowledgeAddressEdit} className="shrink-0 rounded-full bg-blue-600 text-white text-xs px-3 py-1.5 font-medium">
            รับทราบแล้ว
          </button>
        </div>
      )}

      {order.payment_claimed_at && (
        <div className="rounded-2xl bg-green-50 border border-green-200 px-3.5 py-2.5 text-sm text-green-800 flex items-center justify-between gap-2">
          <span>💰 ลูกค้าแจ้งชำระเงินแล้ว เมื่อ {new Date(order.payment_claimed_at).toLocaleString('th-TH')}</span>
          <button type="button" onClick={handleAcknowledgePaymentClaim} className="shrink-0 rounded-full bg-green-600 text-white text-xs px-3 py-1.5 font-medium">
            รับทราบแล้ว
          </button>
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-5 shadow-[0_18px_36px_-16px_rgb(51_32_14_/_0.7)]">
        <AmbientGlow />
        <div className="relative z-10 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-white/70">เลขออเดอร์</p>
              <h1 className="text-2xl font-bold leading-tight">{order.order_no ?? 'ร่าง'}</h1>
              <p className="text-base mt-0.5 truncate">{order.customers?.name ?? 'ไม่มีชื่อลูกค้า'}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={'text-xs font-semibold rounded-full px-3 py-1 border bg-white ' + PAYMENT_COLOR[order.payment_status]}>
                💰 {PAYMENT_LABEL[order.payment_status]}
              </span>
              {due && <span className={'text-xs font-bold rounded-full px-3 py-1 ' + due.cls}>{due.text}</span>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/15 backdrop-blur px-2 py-2">
              <p className="text-[11px] text-white/70">ยอดรวม</p>
              <p className="text-base font-bold tabular-nums">{formatBaht(order.grand_total)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur px-2 py-2">
              <p className="text-[11px] text-white/70">จ่ายแล้ว</p>
              <p className="text-base font-bold tabular-nums">{formatBaht(paid)}</p>
            </div>
            <div className={'rounded-2xl px-2 py-2 ' + (balanceDue > 0 ? 'bg-red-500/80' : 'bg-green-500/70')}>
              <p className="text-[11px] text-white/80">คงเหลือ</p>
              <p className="text-base font-bold tabular-nums">{formatBaht(balanceDue)}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-black/15 px-3.5 py-2.5 text-sm space-y-1">
            <p>
              {FULFILLMENT_ICON[order.fulfillment_type] ?? '📦'} {FULFILLMENT_LABELS[order.fulfillment_type] ?? order.fulfillment_type}
              {order.needed_date ? ` · ${order.needed_date}` : ''}
              {order.fulfillment_type === 'pickup' && order.pickup_time ? ` · 🕐 ${order.pickup_time}` : ''}
            </p>
            {order.fulfillment_type === 'pickup' && order.pickup_place && <p>📍 {order.pickup_place}</p>}
            {order.fulfillment_type !== 'pickup' && order.ship_address_text && <p className="line-clamp-2">📍 {order.ship_address_text}</p>}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {order.customers?.phone ? (
              <a href={`tel:${order.customers.phone}`} className="rounded-2xl bg-green-500 text-white text-xs font-semibold py-2.5 text-center shadow-md">
                <span className="block text-lg leading-none mb-0.5">📞</span>โทร
              </a>
            ) : (
              <span className="rounded-2xl bg-white/10 text-white/50 text-xs font-semibold py-2.5 text-center">
                <span className="block text-lg leading-none mb-0.5">📞</span>ไม่มีเบอร์
              </span>
            )}
            <Link to={`/orders/${order.id}/edit`} className="rounded-2xl bg-white text-stone-900 text-xs font-semibold py-2.5 text-center shadow-md">
              <span className="block text-lg leading-none mb-0.5">✏️</span>แก้ไข
            </Link>
            <Link to={`/orders/${order.id}/receipt`} className="rounded-2xl bg-white text-stone-900 text-xs font-semibold py-2.5 text-center shadow-md">
              <span className="block text-lg leading-none mb-0.5">🧾</span>ใบเสร็จ
            </Link>
            <button
              type="button"
              onClick={() => void handleReorder()}
              disabled={reordering}
              className="rounded-2xl bg-white text-stone-900 text-xs font-semibold py-2.5 text-center shadow-md disabled:opacity-50"
            >
              <span className="block text-lg leading-none mb-0.5">🔁</span>{reordering ? 'รอ...' : 'สั่งซ้ำ'}
            </button>
          </div>
        </div>
      </div>
      {reorderError && <p className="text-sm text-red-600">{reorderError}</p>}

      {order.work_status !== 'cancelled' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">สถานะงาน</h2>
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

      <PaymentsSection
        orderId={order.id}
        payments={payments}
        balanceDue={balanceDue}
        paymentClaimedAt={order.payment_claimed_at}
        onRecorded={handlePaymentRecorded}
      />

      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-1.5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)]">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-stone-100 grid place-items-center text-sm shrink-0">🚚</span>
          การส่งของ
        </h2>
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

      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)]">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-amber-50 grid place-items-center text-sm shrink-0">🧁</span>
          รายการสินค้า
        </h2>
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

      <details className="rounded-3xl border border-stone-200 bg-white shadow-[0_8px_22px_-14px_rgb(51_32_14_/_0.4)] group">
        <summary className="cursor-pointer select-none list-none flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-stone-700">
          <span>🛠️ เครื่องมือเพิ่มเติม <span className="text-xs font-normal text-stone-400">(ลิงก์ลูกค้า · ผู้ดูแล · อีเมล · ขนส่ง)</span></span>
          <span className="text-stone-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="p-4 pt-0 space-y-3">
      {!order.is_draft && <CopyPublicLinkButton token={order.public_token} />}

      <AssigneeSection
        assignedTo={order.assigned_to}
        assigneeName={order.staff_members?.display_name ?? order.staff_members?.email ?? null}
        onAssign={handleAssign}
      />

      {order.work_status !== 'cancelled' && (
        order.customers?.email ? (
          <button
            type="button"
            onClick={() => setShowComposeEmail(true)}
            className="w-full rounded-xl border-2 border-amber-300 bg-white text-amber-700 font-medium py-2.5"
          >
            ✉️ ส่งอีเมลลูกค้า
          </button>
        ) : (
          <p className="text-xs text-stone-400 text-center">ลูกค้าคนนี้ยังไม่มีอีเมล ส่งอีเมลไม่ได้</p>
        )
      )}

      <ShippingSection order={order} onSaved={reload} />

        </div>
      </details>
      <details className="rounded-3xl border border-red-200 bg-red-50/40 group">
        <summary className="cursor-pointer select-none list-none flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-red-700">
          <span>⚠️ ยกเลิก / ลบออเดอร์</span>
          <span className="text-red-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="p-4 pt-0 space-y-3">
      {order.work_status === 'cancelled' ? (
        <p className="text-sm text-stone-500">ออเดอร์นี้ถูกยกเลิกแล้ว · สถานะคืนเงิน: {order.refund_status}</p>
      ) : (
        <button
          type="button"
          onClick={() => setShowCancel(true)}
          className="w-full rounded-full border-2 border-red-300 bg-white text-red-700 font-semibold py-3 active:scale-95"
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
          className="w-full rounded-full bg-gradient-to-r from-red-600 to-rose-700 text-white font-semibold py-3 disabled:opacity-50 active:scale-95"
        >
          {deleting ? 'กำลังลบ...' : '🗑️ ลบออเดอร์ถาวร (ประหยัดพื้นที่)'}
        </button>
      </div>

        </div>
      </details>

      {showCancel && (
        <CancelOrderDialog
          orderId={order.id}
          hasPayments={payments.length > 0}
          onClose={() => setShowCancel(false)}
          onDone={() => { setShowCancel(false); navigate('/') }}
        />
      )}

      {showReject && (
        <RejectCustomerOrderDialog
          orderId={order.id}
          hasPaid={!!order.payment_claimed_at}
          onClose={() => setShowReject(false)}
          onDone={() => { setShowReject(false); navigate('/') }}
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

      {showComposeEmail && order.customers?.email && settings && (
        <ComposeEmailModal
          shopName={settings.shop_name}
          logoUrl={settings.logo_path ? productImageUrl(settings.logo_path) : null}
          orderNo={order.order_no ?? '-'}
          customerName={order.customers.name}
          customerEmail={order.customers.email}
          grandTotal={Number(order.grand_total)}
          balanceDue={balanceDue}
          fulfillmentType={order.fulfillment_type}
          workStatus={order.work_status}
          paymentInstructions={settings.payment_instructions}
          publicUrl={`${window.location.origin}/o/${order.public_token}`}
          onClose={() => setShowComposeEmail(false)}
          onSent={(message) => { setShowComposeEmail(false); setEmailMessage(message) }}
        />
      )}

      {statusChange && (
        <StatusChangeToast status={statusChange.status} label={statusChange.label} onDone={() => setStatusChange(null)} />
      )}
      {statusError && <Toast variant="error" message={statusError} onDone={() => setStatusError(null)} />}
      {emailMessage && <Toast message={emailMessage} onDone={() => setEmailMessage(null)} />}
    </div>
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
        'rounded-2xl border px-3.5 py-3 text-sm space-y-1.5 ' +
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
          <button type="button" onClick={onDeleteNow} className="rounded-full bg-orange-600 text-white text-xs px-3 py-1.5 font-medium">
            ลบตอนนี้
          </button>
        )}
        <Link
          to="/storage"
          className="rounded-full bg-white border border-stone-300 text-stone-700 text-xs font-medium px-3 py-1.5 shadow-sm"
        >
          ดูรายการที่ครบกำหนดลบทั้งหมด
        </Link>
      </div>
    </div>
  )
}
