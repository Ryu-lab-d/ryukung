import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatBaht } from '../lib/money'
import { Toast } from '../lib/Toast'
import { Linkify } from '../lib/Linkify'
import { ChatBot } from './ChatBot'
import { PromptPayQR } from './PromptPayQR'

// type นี้ตั้งใจไม่มีฟิลด์ต้นทุนอยู่เลย ตรงกับสิ่งที่ get_public_order คืนมาจริง
type PublicOrderView = {
  shop_name: string
  payment_instructions: string | null
  promptpay: string | null
  balance_due: number
  faqs: { keywords: string[]; answer: string }[]
  line_url: string | null
  order_no: string
  customer_name: string | null
  needed_date: string | null
  fulfillment_type: string
  pickup_place: string | null
  pickup_time: string | null
  ship_recipient_name: string | null
  ship_recipient_phone: string | null
  ship_address_text: string | null
  work_status: string
  payment_status: string
  items_total: number
  discount_amount: number
  shipping_fee: number
  grand_total: number
  carrier: string | null
  tracking_no: string | null
  note: string | null
  address_editable: boolean
  items: { product_name: string; unit_price: number; qty: number; line_total: number; note: string | null }[]
}

const SIMPLE_WORK_STAGES = [
  { key: 'to_bake', label: 'รับออเดอร์แล้ว' },
  { key: 'baking', label: 'กำลังทำ' },
  { key: 'ready', label: 'แพ็คของแล้ว' },
  { key: 'delivered', label: 'ส่งมอบแล้ว' },
] as const

const COURIER_WORK_STAGES = [
  { key: 'to_bake', label: 'รับออเดอร์แล้ว' },
  { key: 'baking', label: 'กำลังทำ' },
  { key: 'ready', label: 'แพ็คของแล้ว' },
  { key: 'waiting_courier', label: 'รอขนส่งเข้ารับพัสดุ' },
  { key: 'picked_up', label: 'ขนส่งเข้ารับพัสดุแล้ว' },
  { key: 'in_transit', label: 'พัสดุอยู่ระหว่างจัดส่ง' },
  { key: 'delivered', label: 'จัดส่งสำเร็จ' },
] as const

function workStagesFor(fulfillmentType: string) {
  return fulfillmentType === 'shipping' || fulfillmentType === 'rider' ? COURIER_WORK_STAGES : SIMPLE_WORK_STAGES
}

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ร้านไปส่งเอง',
}

/**
 * เทียบชื่อแบบทนต่อสิ่งที่คีย์บอร์ดมือถือทำโดยที่ผู้ใช้ไม่รู้ตัว — ตัวพิมพ์ใหญ่/เล็กที่ iOS/Android
 * auto-capitalize ให้อัตโนมัติ, ช่องว่างซ้อนที่ระบบคำแนะนำคำแทรกให้, หรืออักขระ Unicode ที่ต่างรูปแบบ
 * แต่หน้าตาเหมือนกันทุกประการ (NFC normalize) — ยังคงเข้มงวดเรื่องตัวสะกดจริงเหมือนเดิม แค่ไม่ให้พฤติกรรม
 * ของแป้นพิมพ์แต่ละเครื่องมาตัดสินผลแทนตัวสะกดจริงของผู้ใช้
 */
function normalizeName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

const PAYMENT_STAGE: Record<string, { label: string; icon: string; color: string; done: boolean }> = {
  unpaid: { label: 'ยังไม่ชำระเงิน', icon: '!', color: 'bg-red-500', done: false },
  partial: { label: 'มัดจำแล้ว', icon: '½', color: 'bg-amber-500', done: false },
  paid: { label: 'ชำระเงินแล้ว', icon: '✓', color: 'bg-green-600', done: true },
}

/** ไทม์ไลน์เดียวที่รวมทั้งสถานะชำระเงินและสถานะงาน ให้ลูกค้าเห็นภาพรวมในที่เดียว ไม่ต้องแยกอ่านสองที่ */
function StatusTimeline({
  workStatus,
  paymentStatus,
  fulfillmentType,
}: {
  workStatus: string
  paymentStatus: string
  fulfillmentType: string
}) {
  const WORK_STAGES = workStagesFor(fulfillmentType)
  const currentIndex = WORK_STAGES.findIndex((s) => s.key === workStatus)
  const payment = PAYMENT_STAGE[paymentStatus] ?? PAYMENT_STAGE.unpaid

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className={'w-7 h-7 rounded-full grid place-items-center text-sm shrink-0 text-white ' + payment.color}>
            {payment.icon}
          </div>
          <div className={'w-0.5 flex-1 min-h-8 ' + (payment.done ? 'bg-stone-900' : 'bg-stone-200')} />
        </div>
        <div className="pb-8 -mt-0.5">
          <p className="font-semibold text-stone-900">{payment.label}</p>
          <p className="text-xs text-stone-500 mt-0.5">การชำระเงิน</p>
        </div>
      </div>

      {WORK_STAGES.map((stage, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        return (
          <div key={stage.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={
                  'w-7 h-7 rounded-full grid place-items-center text-sm shrink-0 ' +
                  (isDone
                    ? 'bg-stone-900 text-white'
                    : isCurrent
                      ? 'bg-stone-900 text-white ring-4 ring-stone-200 animate-pulse'
                      : 'bg-white text-stone-400 border-2 border-stone-200')
                }
              >
                {isDone ? '✓' : i + 1}
              </div>
              {i < WORK_STAGES.length - 1 && (
                <div className={'w-0.5 flex-1 min-h-8 ' + (isDone ? 'bg-stone-900' : 'bg-stone-200')} />
              )}
            </div>
            <div className={'pb-8 -mt-0.5 ' + (isCurrent ? 'text-stone-900' : isDone ? 'text-stone-600' : 'text-stone-400')}>
              <p className={isCurrent ? 'font-semibold' : 'font-medium'}>{stage.label}</p>
              {isCurrent && <p className="text-xs text-stone-500 mt-0.5">สถานะตอนนี้</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AddressEditForm({
  token,
  order,
  onSaved,
  onCancel,
}: {
  token: string
  order: PublicOrderView
  onSaved: () => void
  onCancel: () => void
}) {
  const [recipientName, setRecipientName] = useState(order.ship_recipient_name ?? '')
  const [recipientPhone, setRecipientPhone] = useState(order.ship_recipient_phone ?? '')
  const [addressText, setAddressText] = useState(order.ship_address_text ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!addressText.trim()) { setError('กรุณากรอกที่อยู่'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('update_public_order_address', {
      p_token: token,
      p_recipient_name: recipientName.trim() || null,
      p_recipient_phone: recipientPhone.trim() || null,
      p_address_text: addressText.trim(),
    })
    setBusy(false)
    if (error || !data) {
      setError(error?.message ?? 'แก้ไขไม่สำเร็จ ออเดอร์นี้อาจเลยขั้นตอนที่แก้ที่อยู่ได้แล้ว')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3">
        <h2 className="text-lg font-semibold">แก้ไขที่อยู่จัดส่ง</h2>
        <div className="space-y-1">
          <label htmlFor="pub-recipient-name" className="text-sm text-stone-600">ชื่อผู้รับ</label>
          <input
            id="pub-recipient-name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="pub-recipient-phone" className="text-sm text-stone-600">เบอร์ผู้รับ</label>
          <input
            id="pub-recipient-phone"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="pub-address-text" className="text-sm text-stone-600">ที่อยู่เต็ม</label>
          <textarea
            id="pub-address-text"
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
            ยกเลิก
          </button>
          <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50">
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** เอฟเฟกต์ยืนยันสำเร็จแบบวาดเครื่องหมายถูก ใช้เฉพาะตอนบันทึกที่อยู่ใหม่สำเร็จ ให้รู้สึกหนักแน่นกว่า Toast ทั่วไป */
function AddressSavedOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 text-center space-y-2 max-w-xs animate-toast-pop">
        <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto">
          <circle cx="32" cy="32" r="29" fill="none" stroke="#16a34a" strokeWidth="4" className="animate-circle-pop" />
          <path
            d="M18 33 L27 42 L46 22"
            fill="none"
            stroke="#16a34a"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-check-draw"
          />
        </svg>
        <p className="font-semibold text-stone-900">บันทึกที่อยู่ใหม่เรียบร้อยแล้ว!</p>
        <p className="text-sm text-stone-500">ทางร้านจะเห็นที่อยู่ใหม่นี้ทันที</p>
      </div>
    </div>
  )
}

export function PublicOrderPage() {
  const { token } = useParams()
  const [order, setOrder] = useState<PublicOrderView | null | undefined>(undefined)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [revealing, setRevealing] = useState(false)
  const [shake, setShake] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [noNameOnFile, setNoNameOnFile] = useState(false)
  const [showPaymentInfo, setShowPaymentInfo] = useState(false)
  const [showAddressEdit, setShowAddressEdit] = useState(false)
  const [addressSaved, setAddressSaved] = useState(false)

  const fetchOrder = useCallback(() => {
    if (!token) return
    supabase.rpc('get_public_order', { p_token: token }).then(({ data }) => {
      setOrder((data as PublicOrderView | null) ?? null)
    })
  }, [token])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  function handleConfirmName(e: FormEvent) {
    e.preventDefault()
    const typed = nameInput.trim()
    if (!typed || order === undefined) return

    if (order === null) {
      // token ผิดตั้งแต่ต้น ไม่มีออเดอร์ให้เทียบชื่อเลย ปล่อยผ่านไปโชว์หน้า "ไม่พบออเดอร์" ตามจริง
      // ไม่มีข้อมูลอะไรให้หลุดอยู่แล้วเพราะ order เป็น null
      setCustomerName(typed)
      setRevealing(true)
      setTimeout(() => setRevealing(false), 700)
      return
    }

    if (!order.customer_name) {
      // มีออเดอร์จริง แต่ไม่มีชื่อลูกค้าผูกไว้เลย — ไม่มีอะไรให้เทียบ ต้องกันไว้ ห้ามปล่อยผ่านให้ใครพิมพ์อะไรก็เข้าได้
      setNoNameOnFile(true)
      return
    }

    // ต้องสะกดตรงกับชื่อลูกค้าจริงที่บันทึกไว้ กันคนอื่นเดาชื่อสุ่มๆ แล้วเข้าดูออเดอร์คนอื่นได้
    // เทียบแบบ normalize แล้ว (ดูฟังก์ชัน normalizeName ด้านบน) ไม่ใช่เทียบสตริงดิบ เพราะแป้นพิมพ์มือถือ
    // มักแก้ตัวอักษรแรกเป็นตัวใหญ่หรือแทรกช่องว่างเกินให้เองโดยผู้ใช้ไม่รู้ตัว ถ้าเทียบดิบๆ จะพังเฉพาะบนมือถือ
    if (normalizeName(typed) !== normalizeName(order.customer_name)) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setNameError(true)
      return
    }

    setCustomerName(typed)
    setRevealing(true)
    // หน่วงสั้นๆ ให้รู้สึกเหมือนระบบกำลังเปิดออเดอร์ให้ ข้อมูลจริงโหลดเสร็จรอไว้อยู่แล้วเบื้องหลัง
    setTimeout(() => setRevealing(false), 700)
  }

  // ออเดอร์นี้มีจริง แต่ไม่มีชื่อลูกค้าผูกไว้ในระบบเลย ไม่มีทางตรวจสอบตัวตนได้ ต้องหยุดตรงนี้เสมอ ไม่ปล่อยให้ใครพิมพ์อะไรก็เข้าได้
  if (noNameOnFile) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center">
        <div className="max-w-sm">
          <p className="text-4xl mb-2">🔒</p>
          <p className="text-stone-700 font-medium">ออเดอร์นี้ไม่มีชื่อลูกค้าผูกไว้ในระบบ</p>
          <p className="text-sm text-stone-500 mt-1">ไม่สามารถยืนยันตัวตนอัตโนมัติได้ กรุณาติดต่อร้านโดยตรงเพื่อตรวจสอบออเดอร์</p>
        </div>
      </div>
    )
  }

  // ขั้นที่ 1: ยืนยันชื่อก่อนเสมอ — ปุ่มกดไม่ได้จนกว่าจะรู้ผลจริงจากฐานข้อมูลแล้วว่าชื่อคืออะไร
  if (customerName === null) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4">
        <form
          onSubmit={handleConfirmName}
          className={'w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center' + (shake ? ' animate-shake' : '')}
        >
          <div className="text-4xl">🥐</div>
          <h1 className="text-lg font-semibold">ตรวจสอบออเดอร์ของคุณ</h1>
          <p className="text-sm text-stone-500">กรุณากรอกชื่อผู้สั่งซื้อให้ตรงกับที่แจ้งไว้ในแชทเพื่อยืนยันตัวตน</p>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="ชื่อผู้สั่งซื้อ"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-center"
          />
          <button
            type="submit"
            disabled={!nameInput.trim() || order === undefined}
            className="w-full rounded-lg bg-stone-900 text-white py-2.5 font-semibold disabled:opacity-40"
          >
            {order === undefined ? 'กำลังโหลดข้อมูล...' : 'ดูรายละเอียดออเดอร์'}
          </button>
        </form>

        {nameError && (
          <Toast
            variant="error"
            message="ชื่อไม่ตรงกับที่แจ้งไว้ กรุณาสะกดให้ตรงเป๊ะตามที่คุยในแชท"
            onDone={() => setNameError(false)}
          />
        )}
      </div>
    )
  }

  // ขั้นที่ 2: เอฟเฟกต์โหลดกลางจอสั้นๆ
  if (revealing) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-500">กำลังเปิดออเดอร์ของคุณ...</p>
        </div>
      </div>
    )
  }

  if (order === null || order === undefined) {
    // order === undefined ในจุดนี้แทบไม่เกิดจริง เพราะปุ่มยืนยันชื่อกดไม่ได้จนกว่าจะโหลดเสร็จ
    // แต่เขียนดักไว้ให้ TypeScript แน่ใจว่าตั้งแต่บรรทัดนี้ลงไป order ไม่มีทาง undefined อีกแล้ว
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center">
        <div>
          <p className="text-4xl mb-2">🔍</p>
          <p className="text-stone-500">ไม่พบออเดอร์นี้ ลิงก์อาจไม่ถูกต้อง</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center pt-2">
          <p className="text-sm text-stone-500">สวัสดีคุณ{customerName} 👋</p>
          <h1 className="text-xl font-bold mt-1">{order.shop_name}</h1>
          <p className="text-sm text-stone-500">ออเดอร์ {order.order_no}</p>
        </div>

        {order.line_url && (
          <a
            href={order.line_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#06C755] text-white font-semibold py-3 text-sm shadow-sm"
          >
            💬 ติดต่อพนักงาน (แอดไลน์)
          </a>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-stone-500 mb-3">สถานะออเดอร์</h2>
          <StatusTimeline workStatus={order.work_status} paymentStatus={order.payment_status} fulfillmentType={order.fulfillment_type} />

          {order.work_status === 'delivered' && order.line_url && (
            <a
              href={order.line_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-medium py-2.5 px-3.5 text-sm mb-2"
            >
              <span>📦 ไม่ได้รับของ? ติดต่อที่นี่</span>
              <span>→</span>
            </a>
          )}

          {order.payment_status !== 'paid' && (
            <button
              type="button"
              onClick={() => setShowPaymentInfo((v) => !v)}
              className="w-full rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium py-2.5 text-sm"
            >
              💳 ยังไม่ได้ชำระเงิน · ดูวิธีชำระเงิน
            </button>
          )}
          {showPaymentInfo && order.promptpay && order.balance_due > 0 && (
            <div className="mt-2 rounded-xl bg-stone-50 border border-stone-200 p-3">
              <PromptPayQR promptpayId={order.promptpay} amount={order.balance_due} />
            </div>
          )}
          {showPaymentInfo && order.payment_instructions && (
            <div className="mt-2 rounded-xl bg-stone-50 border border-stone-200 p-3 text-sm text-stone-700 whitespace-pre-line">
              <Linkify text={order.payment_instructions} />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">กำหนดการจัดส่ง</h2>
            {order.address_editable && (
              <button type="button" onClick={() => setShowAddressEdit(true)} className="text-xs text-stone-600 underline">
                แก้ไขที่อยู่
              </button>
            )}
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-stone-500">วิธีรับของ</span><span>{FULFILLMENT_LABELS[order.fulfillment_type] ?? order.fulfillment_type}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">วันที่ต้องได้ของ</span><span>{order.needed_date ?? '-'}</span></div>
            {order.fulfillment_type === 'pickup' ? (
              <>
                <div className="flex justify-between"><span className="text-stone-500">จุดนัดรับ</span><span>{order.pickup_place ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">เวลานัดรับ</span><span>{order.pickup_time ?? '-'}</span></div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-stone-500">ผู้รับ</span>
                  <span>{order.ship_recipient_name ?? '-'} {order.ship_recipient_phone && `· ${order.ship_recipient_phone}`}</span>
                </div>
                {order.ship_address_text && (
                  <div>
                    <span className="text-stone-500">ที่อยู่: </span>
                    <span>{order.ship_address_text}</span>
                  </div>
                )}
                {order.tracking_no && (
                  <div className="flex justify-between"><span className="text-stone-500">เลขพัสดุ</span><span>{order.tracking_no} ({order.carrier})</span></div>
                )}
              </>
            )}
          </div>
          {!order.address_editable && order.fulfillment_type !== 'pickup' && (
            <p className="text-xs text-stone-400 pt-1">แพ็คของแล้ว แก้ไขที่อยู่เองไม่ได้แล้ว ติดต่อร้านโดยตรงถ้าจำเป็น</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <div className="space-y-1">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{it.product_name} x{it.qty}</span>
                <span>{formatBaht(it.line_total)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-stone-100 pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span>รวมสินค้า</span><span>{formatBaht(order.items_total)}</span></div>
            <div className="flex justify-between"><span>ส่วนลด</span><span>-{formatBaht(order.discount_amount)}</span></div>
            <div className="flex justify-between"><span>ค่าส่ง</span><span>{formatBaht(order.shipping_fee)}</span></div>
            <div className="flex justify-between font-semibold text-base"><span>ยอดรวม</span><span>{formatBaht(order.grand_total)}</span></div>
          </div>
        </div>
      </div>

      {showAddressEdit && token && (
        <AddressEditForm
          token={token}
          order={order}
          onCancel={() => setShowAddressEdit(false)}
          onSaved={() => {
            setShowAddressEdit(false)
            setAddressSaved(true)
            fetchOrder()
          }}
        />
      )}

      {addressSaved && <AddressSavedOverlay onDone={() => setAddressSaved(false)} />}

      <ChatBot shopName={order.shop_name} faqs={order.faqs} lineUrl={order.line_url} />
    </div>
  )
}
