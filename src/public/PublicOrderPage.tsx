import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import * as htmlToImage from 'html-to-image'
import { saveImage } from '../lib/saveImage'
import { supabase } from '../lib/supabase'
import { formatBaht } from '../lib/money'
import { InlineError } from '../lib/InlineError'
import { SuccessOverlay } from '../lib/SuccessOverlay'
import { Linkify } from '../lib/Linkify'
import { ChatBot } from './ChatBot'
import { PromptPayQR } from './PromptPayQR'
import { claimPayment } from '../lib/paymentClaim'
import { AddToCalendarButton } from './AddToCalendarButton'
import { ShareOrderButton } from './ShareOrderButton'
import { productImageUrl } from '../products/ProductCard'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { AmbientGlow, PageTexture, Reveal, SquiggleUnderline } from './PublicSiteChrome'

/** จำนวนวันจากวันนี้ถึงวันที่ (YYYY-MM-DD) ตามเวลาเครื่องลูกค้า — ติดลบ = เลยกำหนดแล้ว */
function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000)
}

/** สไตล์การ์ดมาตรฐานของเว็บไซต์ลูกค้า (เข้าชุดกับ /menu) — เงาอุ่นมีมิติแทน shadow-sm เทาแบนๆ */
const CARD = 'bg-white rounded-3xl border border-stone-200/70 shadow-[0_10px_28px_-14px_rgb(51_32_14_/_0.4)]'

// type นี้ตั้งใจไม่มีฟิลด์ต้นทุนอยู่เลย ตรงกับสิ่งที่ get_public_order คืนมาจริง
type PublicOrderView = {
  shop_name: string
  logo_path: string | null
  payment_instructions: string | null
  promptpay: string | null
  balance_due: number
  payment_claimed_at: string | null
  faqs: { keywords: string[]; answer: string }[]
  line_url: string | null
  order_no: string | null
  pending_confirmation: boolean
  customer_name: string | null
  customer_phone: string | null
  needed_date: string | null
  fulfillment_type: string
  pickup_place: string | null
  pickup_time: string | null
  ship_recipient_name: string | null
  ship_recipient_phone: string | null
  ship_address_text: string | null
  work_status: string
  payment_status: string
  cancelled_reason: string | null
  refund_status: 'none' | 'pending' | 'refunded'
  previous_needed_date: string | null
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

function workStagesFor(fulfillmentType: string, pending: boolean) {
  const base = fulfillmentType === 'shipping' || fulfillmentType === 'rider' ? COURIER_WORK_STAGES : SIMPLE_WORK_STAGES
  // ออเดอร์ที่ลูกค้าส่งเองยังไม่ผ่านการยืนยันจากร้าน (is_draft=true) — work_status ในฐานข้อมูลเป็นค่าเริ่มต้น
  // 'to_bake' ไปพลางๆ เท่านั้น ยังไม่ได้แปลว่าร้าน "รับออเดอร์แล้ว" จริง จึงต้องแทรกขั้น "รอร้านยืนยัน" นำหน้า
  // เสมอ และบังคับให้เป็นขั้นปัจจุบันเสมอ (ดู currentIndex ใน StatusTimeline) ไม่ใช่ปล่อยให้ไปจับคู่กับ work_status ตรงๆ
  if (!pending) return base
  return [{ key: 'pending', label: 'รอร้านตรวจสอบและยืนยันออเดอร์' }, ...base]
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

/** เทียบเบอร์โทรทนรูปแบบที่ต่างกัน — ตัดอักขระที่ไม่ใช่ตัวเลขทิ้งหมด (ช่องว่าง/ขีด/วงเล็บ) แล้วแปลงเบอร์
 * รูปแบบ +66/66 นำหน้าให้เป็น 0 นำหน้าแบบไทยปกติ จะได้เทียบตรงกับที่ผู้ใช้กรอกแบบ 0812345678 ได้ */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('66') && digits.length === 11) return '0' + digits.slice(2)
  return digits
}

/** ไอคอน+ข้อความสั้นๆ ของแต่ละขั้นสถานะ ใช้ในการ์ดสถานะสดด้านบนสุดของหน้า (ข้อความอิงชื่อขั้นจริงเท่านั้น ไม่เพิ่มข้อมูลใหม่) */
const STAGE_VISUAL: Record<string, { icon: string; text: string }> = {
  pending: { icon: '🕐', text: 'ร้านกำลังตรวจสอบออเดอร์ของคุณ' },
  to_bake: { icon: '📝', text: 'ร้านรับออเดอร์แล้ว' },
  baking: { icon: '🧑‍🍳', text: 'ขนมของคุณกำลังถูกทำ' },
  ready: { icon: '🎁', text: 'แพ็คของเรียบร้อยแล้ว' },
  waiting_courier: { icon: '🛵', text: 'รอขนส่งเข้ารับพัสดุ' },
  picked_up: { icon: '📦', text: 'ขนส่งเข้ารับพัสดุแล้ว' },
  in_transit: { icon: '🚚', text: 'พัสดุกำลังเดินทางไปหาคุณ' },
  delivered: { icon: '🎉', text: 'ขอบคุณที่อุดหนุนนะคะ' },
}

/** กระดาษสีโปรยฉลองตอนออเดอร์ส่งมอบสำเร็จ (ดู .confetti-piece ใน index.css) */
function Confetti() {
  const colors = ['#f59e0b', '#d97706', '#fbbf24', '#a8551f', '#fcd34d', '#78350f']
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 53) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 6) * 0.18}s`,
            animationDuration: `${1.8 + (i % 5) * 0.25}s`,
          }}
        />
      ))}
    </div>
  )
}

/** ชิปเลขออเดอร์ในหัวหน้า กดแล้วคัดลอกเลขออเดอร์ลงคลิปบอร์ด (ลูกค้ามักต้องส่งเลขนี้ให้ร้านทางไลน์) มีฟีดแบ็กเปลี่ยนเป็น ✓ ชั่วครู่ */
function CopyOrderNo({ orderNo }: { orderNo: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!orderNo) {
    return <p className="text-sm text-white/85 mt-2">ออเดอร์ รอเลขที่ออเดอร์</p>
  }
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderNo!)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // เบราว์เซอร์ในแอปบางตัวไม่ให้เขียนคลิปบอร์ด — ไม่ต้องแจ้ง error ลูกค้าก็ยังเห็นเลขอยู่ในหน้านี้แล้ว
    }
  }
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={`คัดลอกเลขออเดอร์ ${orderNo}`}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur border border-white/25 px-3.5 py-1 text-sm text-white/90 transition-all duration-200 hover:bg-white/25 active:scale-95"
    >
      <span>ออเดอร์ {orderNo}</span>
      <span key={String(copied)} className="animate-qty-pop text-xs" aria-hidden="true">{copied ? '✓ คัดลอกแล้ว' : '📋'}</span>
    </button>
  )
}

/** การ์ดสถานะสดบนสุดของหน้า: ไอคอนใหญ่ของขั้นปัจจุบัน + แถบความคืบหน้าที่ไหลเต็มตามขั้น — ลูกค้าเห็นภาพรวมทันทีโดยไม่ต้องอ่าน
 * ไทม์ไลน์ละเอียดด้านล่าง (ขั้นเดียวกับ StatusTimeline ทุกประการ ใช้ workStagesFor ตัวเดียวกัน) */
function LiveStatusCard({ order }: { order: PublicOrderView }) {
  const stages = workStagesFor(order.fulfillment_type, order.pending_confirmation)
  const idx = order.pending_confirmation ? 0 : Math.max(0, stages.findIndex((s) => s.key === order.work_status))
  const stage = stages[idx]
  const pct = Math.round(((idx + 1) / stages.length) * 100)
  const [fill, setFill] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setFill(pct), 200)
    return () => clearTimeout(t)
  }, [pct])

  // ออเดอร์ที่ถูกยกเลิก: การ์ดสีแดงเด่นๆ แทนการ์ดสถานะปกติ ให้ลูกค้ารับรู้ทันทีโดยไม่ต้องพึ่งป็อปอัพอย่างเดียว (ปิดป็อปอัพแล้วก็ยังเห็น)
  if (order.work_status === 'cancelled') {
    return (
      <div
        className="relative overflow-hidden rounded-3xl border-2 border-red-300 bg-gradient-to-br from-red-50 via-white to-rose-50 shadow-lg animate-form-in animate-cancel-glow"
        style={{ animationDelay: '0.08s', animationFillMode: 'backwards' }}
      >
        <div className="h-2.5 cancel-stripes" aria-hidden="true" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-8 text-[9rem] leading-none text-red-100 select-none">✕</span>
        <div className="relative p-5 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <span className="absolute inset-0 rounded-2xl bg-red-300/50 animate-fab-ring" aria-hidden="true" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 shadow-md grid place-items-center text-3xl text-white font-bold animate-icon-pop">✕</div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-red-400">สถานะตอนนี้</p>
            <p className="text-xl font-display font-bold text-red-700 leading-tight">ออเดอร์นี้ถูกยกเลิกแล้ว</p>
            {order.cancelled_reason && (
              <p className="text-sm text-red-900/70 mt-1 rounded-lg bg-white/70 border border-red-100 px-2.5 py-1.5">เหตุผล: {order.cancelled_reason}</p>
            )}
          </div>
        </div>
        <div className="absolute top-5 right-3 rounded-md border-[3px] border-red-600/80 text-red-600/80 px-2 py-0.5 text-sm font-display font-extrabold tracking-widest bg-white/60 animate-cancel-stamp" aria-hidden="true">
          ยกเลิก
        </div>
        <div className="h-2.5 cancel-stripes" aria-hidden="true" />
      </div>
    )
  }
  if (!stage) return null
  const visual = STAGE_VISUAL[stage.key] ?? { icon: '📍', text: '' }
  const done = stage.key === 'delivered' && !order.pending_confirmation

  return (
    <div className={CARD + ' relative overflow-hidden p-5 pt-6 animate-form-in'} style={{ animationDelay: '0.08s', animationFillMode: 'backwards' }}>
      <div className={'absolute inset-x-0 top-0 h-1.5 ' + (done ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-400' : 'bg-gradient-to-r from-amber-300 via-amber-600 to-amber-300')} aria-hidden="true" />
      {done && <Confetti />}
      <div className="relative flex items-center gap-4">
        <div className="relative w-[4.5rem] h-[4.5rem] shrink-0">
          {!done && <span className="absolute inset-0 rounded-3xl bg-amber-300/40 animate-fab-ring" aria-hidden="true" />}
          <div className="relative w-[4.5rem] h-[4.5rem] rounded-3xl bg-gradient-to-br from-amber-100 to-white border-2 border-white shadow-lg grid place-items-center text-4xl animate-icon-pop">
            <span key={stage.key} className={done ? 'animate-qty-pop' : 'animate-bell-ring'}>{visual.icon}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-stone-400">สถานะตอนนี้</p>
          <p className="text-lg font-display font-bold text-stone-900 leading-tight">{stage.label}</p>
          {visual.text && <p className="text-sm text-stone-500 mt-0.5">{visual.text}</p>}
        </div>
      </div>
      <div className="relative mt-4">
        <div className="relative h-3.5 rounded-full bg-stone-100 shadow-inner overflow-hidden">
          <div
            className={'relative h-full rounded-full transition-all duration-1000 ease-out ' + (done ? 'bg-gradient-to-r from-green-400 to-emerald-600' : 'bg-gradient-to-r from-amber-400 to-amber-700')}
            style={{ width: `${fill}%` }}
          >
            <span className="absolute inset-x-1 top-0.5 h-1 rounded-full bg-white/40" aria-hidden="true" />
            <span className="progress-stripes absolute inset-0 rounded-full" aria-hidden="true" />
          </div>
        </div>
        <div className="flex justify-between px-0.5 -mt-[1.15rem] mb-2 relative" aria-hidden="true">
          {stages.map((_, i) => (
            <span key={i} className={'w-2.5 h-2.5 rounded-full border-2 border-white shadow ' + (i <= idx ? (done ? 'bg-emerald-600' : 'bg-amber-700') : 'bg-stone-300')} />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-stone-400 mt-1.5">
          <span>ขั้นที่ {idx + 1} จาก {stages.length}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      </div>
    </div>
  )
}

const PAYMENT_STAGE: Record<string, { label: string; icon: string; color: string; done: boolean; pulsing?: boolean }> = {
  unpaid: { label: 'ยังไม่ชำระเงิน', icon: '!', color: 'bg-red-500', done: false },
  partial: { label: 'มัดจำแล้ว', icon: '½', color: 'bg-amber-500', done: false },
  pending_review: { label: 'กำลังรอการตรวจสอบจากเจ้าหน้าที่', icon: '⏳', color: 'bg-amber-500', done: false, pulsing: true },
  paid: { label: 'ชำระเงินเสร็จสิ้น', icon: '✓', color: 'bg-green-600', done: true },
}

/**
 * ไทม์ไลน์เดียวที่รวมทั้งสถานะชำระเงินและสถานะงาน ให้ลูกค้าเห็นภาพรวมในที่เดียว ไม่ต้องแยกอ่านสองที่
 * ขั้นชำระเงินมี 4 สถานะจริงๆ (ไม่ใช่แค่ 3 ตาม payment_status ดิบ): ยังไม่จ่าย → กำลังรอตรวจสอบ (ลูกค้ากด
 * ยืนยันการชำระเงินแล้วแต่เจ้าหน้าที่ยังไม่ได้ตรวจ ต้องแทรกเข้ามาไม่งั้นจะดูเหมือน "ยังไม่จ่าย" ทั้งที่จ่ายไปแล้ว) → มัดจำแล้ว/จ่ายครบ
 */
function StatusTimeline({
  workStatus,
  paymentStatus,
  paymentClaimedAt,
  fulfillmentType,
  pending,
}: {
  workStatus: string
  paymentStatus: string
  paymentClaimedAt: string | null
  fulfillmentType: string
  pending: boolean
}) {
  const WORK_STAGES = workStagesFor(fulfillmentType, pending)
  // pending: บังคับขั้น "รอร้านยืนยัน" (index 0 เสมอ ดู workStagesFor) เป็นขั้นปัจจุบันเสมอ ไม่ใช้ workStatus ตัดสิน
  const currentIndex = pending ? 0 : WORK_STAGES.findIndex((s) => s.key === workStatus)
  const paymentKey = paymentStatus !== 'paid' && paymentClaimedAt ? 'pending_review' : paymentStatus
  const payment = PAYMENT_STAGE[paymentKey] ?? PAYMENT_STAGE.unpaid

  return (
    <div>
      <div className="flex gap-3 animate-timeline-in">
        <div className="flex flex-col items-center">
          <div
            className={
              'w-8 h-8 rounded-full grid place-items-center text-sm shrink-0 text-white shadow ' +
              payment.color +
              (payment.pulsing ? ' animate-node-ping ring-4 ring-amber-200' : '')
            }
          >
            {payment.icon}
          </div>
          <div className={'w-1 rounded-full flex-1 min-h-6 animate-line-grow ' + (payment.done ? 'bg-green-500' : 'bg-stone-200')} />
        </div>
        <div
          className={
            'flex-1 rounded-2xl px-3.5 py-2 mb-2 border ' +
            (payment.done ? 'bg-green-50/60 border-green-100' : payment.pulsing ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200')
          }
        >
          <p className="font-semibold text-stone-900">{payment.label}</p>
          <p className="text-xs text-stone-500 mt-0.5">การชำระเงิน</p>
        </div>
      </div>

      {WORK_STAGES.map((stage, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        return (
          <div key={stage.key} className="flex gap-3 animate-timeline-in" style={{ animationDelay: `${(i + 1) * 0.09}s` }}>
            <div className="flex flex-col items-center">
              <div
                className={
                  'w-8 h-8 rounded-full grid place-items-center text-sm shrink-0 transition-all duration-500 ' +
                  (isDone
                    ? 'bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow animate-qty-pop'
                    : isCurrent
                      ? 'bg-brand-shader text-white ring-4 ring-amber-200 animate-node-ping'
                      : 'bg-white text-stone-400 border-2 border-stone-200')
                }
                style={isDone ? { animationDelay: `${(i + 1) * 0.09 + 0.25}s`, animationFillMode: 'backwards' } : undefined}
              >
                {isDone ? '✓' : i + 1}
              </div>
              {i < WORK_STAGES.length - 1 && (
                <div
                  className={'w-1 rounded-full flex-1 min-h-6 transition-colors duration-500 animate-line-grow ' + (isDone ? 'bg-green-500' : 'bg-stone-200')}
                  style={{ animationDelay: `${(i + 1) * 0.09 + 0.15}s` }}
                />
              )}
            </div>
            <div
              className={
                'flex-1 rounded-2xl px-3.5 py-2 mb-2 border ' +
                (isCurrent
                  ? 'bg-gradient-to-r from-amber-50 to-white border-amber-300 shadow-sm text-stone-900'
                  : isDone
                    ? 'bg-green-50/60 border-green-100 text-stone-600'
                    : 'bg-stone-50/60 border-stone-100 text-stone-400')
              }
            >
              <p className={isCurrent ? 'font-semibold' : 'font-medium'}>{stage.label}</p>
              {isCurrent && <p className="text-xs text-amber-700 mt-0.5">⏳ สถานะตอนนี้</p>}
              {isDone && <p className="text-xs text-green-700 mt-0.5">เสร็จแล้ว</p>}
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
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop">
        <h2 className="text-lg font-display font-semibold">แก้ไขที่อยู่จัดส่ง</h2>
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
        <InlineError message={error} />
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

/** QR + วิธีชำระเงิน + ปุ่มยืนยันการชำระเงิน — ใช้ร่วมกันทั้งในการ์ดสถานะปกติและในป็อปอัพเตือนยังไม่ชำระเงิน กันโค้ดซ้ำ */
function PaymentInfoPanel({
  promptpay,
  balanceDue,
  paymentInstructions,
  paymentClaimedAt,
  claiming,
  claimError,
  onClaimPayment,
}: {
  promptpay: string | null
  balanceDue: number
  paymentInstructions: string | null
  paymentClaimedAt: string | null
  claiming: boolean
  claimError: string | null
  onClaimPayment: () => void
}) {
  return (
    <>
      {promptpay && balanceDue > 0 && (
        <div className="mt-2 rounded-xl bg-stone-50 border border-stone-200 p-3">
          <PromptPayQR promptpayId={promptpay} amount={balanceDue} />
        </div>
      )}
      {paymentInstructions && (
        <div className="mt-2 rounded-xl bg-stone-50 border border-stone-200 p-3 text-sm text-stone-700 whitespace-pre-line">
          <Linkify text={paymentInstructions} />
        </div>
      )}
      {paymentClaimedAt ? (
        <div className="mt-2 rounded-xl bg-green-50 border border-green-200 px-3.5 py-3 text-sm text-green-800 text-center">
          ✅ แจ้งการชำระเงินแล้ว เมื่อ {new Date(paymentClaimedAt).toLocaleString('th-TH')}
          <br />
          โปรดรอเจ้าหน้าที่ตรวจสอบภายใน 1-3 ชั่วโมง (ไม่เกิน 1 วัน)
        </div>
      ) : (
        <button
          type="button"
          onClick={onClaimPayment}
          disabled={claiming}
          className="mt-2 w-full rounded-xl bg-green-600 text-white font-semibold py-2.5 text-sm disabled:opacity-50"
        >
          {claiming ? 'กำลังส่ง...' : '✅ ยืนยันการชำระเงิน'}
        </button>
      )}
      <InlineError message={claimError} className="justify-center mt-1" />
    </>
  )
}

/** หน่วงปิดสั้นๆ ให้ overlay/การ์ดมีจังหวะเฟดออกก่อนถูก unmount จริง แทนที่จะหายวับไปทันที */
function useClosingTransition(onClose: () => void, durationMs = 200) {
  const [closing, setClosing] = useState(false)
  function requestClose() {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, durationMs)
  }
  return { closing, requestClose }
}

/**
 * ป็อปอัพเตือนใหญ่ๆ กลางจอ ขึ้นทันทีที่ลูกค้าเข้าดูออเดอร์ถ้ายังไม่จ่าย (และยังไม่เคยกดยืนยันการชำระเงินด้วย —
 * ถ้ากดยืนยันไปแล้วรอตรวจสอบอยู่ ข้อความ "ยังไม่ได้ชำระเงิน" จะไม่ตรงกับความจริงและอาจทำให้ลูกค้าสับสน/จ่ายซ้ำ)
 */
function UnpaidPaymentPopup({
  order,
  showPaymentInfo,
  onShowPaymentInfo,
  onClose,
  claiming,
  claimError,
  onClaimPayment,
}: {
  order: PublicOrderView
  showPaymentInfo: boolean
  onShowPaymentInfo: () => void
  onClose: () => void
  claiming: boolean
  claimError: string | null
  onClaimPayment: () => void
}) {
  const { closing, requestClose } = useClosingTransition(onClose)
  return (
    <div
      className={'fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}
      onClick={requestClose}
    >
      <div
        className={'relative bg-white rounded-3xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto ' + (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-stone-500 grid place-items-center text-lg font-bold shadow-md z-10"
        >
          ✕
        </button>

        <div className="bg-gradient-to-b from-red-50 to-white rounded-t-3xl px-6 pt-9 pb-5 text-center space-y-2">
          <div className="relative w-16 h-16 mx-auto">
            <span className="absolute inset-0 rounded-full bg-red-300/60 animate-fab-ring" aria-hidden="true" />
            <div className="relative w-16 h-16 rounded-full bg-red-100 grid place-items-center text-3xl animate-icon-pop">💳</div>
          </div>
          <h2 className="text-xl font-display font-bold text-red-700 leading-snug">คุณลูกค้ายังไม่ได้ชำระเงิน</h2>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {!showPaymentInfo ? (
            <button
              type="button"
              onClick={onShowPaymentInfo}
              className="btn-shimmer w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-transform active:scale-95"
            >
              ดูวิธีการชำระเงิน
            </button>
          ) : (
            <PaymentInfoPanel
              promptpay={order.promptpay}
              balanceDue={order.balance_due}
              paymentInstructions={order.payment_instructions}
              paymentClaimedAt={order.payment_claimed_at}
              claiming={claiming}
              claimError={claimError}
              onClaimPayment={onClaimPayment}
            />
          )}

          <div className="flex gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
            <span className="shrink-0">⏳</span>
            <p>หากชำระเงินไปแล้ว กรุณารอการตรวจสอบจากเจ้าหน้าที่ อาจใช้เวลา 1-3 ชั่วโมง แต่ไม่เกิน 1 วัน หากเกิน 1 วันกรุณาติดต่อเจ้าหน้าที่</p>
          </div>

          {order.line_url && (
            <a
              href={order.line_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-[#06C755] text-[#06C755] font-medium py-2.5 text-sm"
            >
              💬 พบปัญหา? ติดต่อที่นี่
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function formatOrderDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** ป็อปอัพแจ้งยกเลิกออเดอร์ — โผล่ทุกครั้งที่เข้าดูออเดอร์ตราบใดที่ work_status ยังเป็น 'cancelled' อยู่ (ไม่ใช้
 * flag "เห็นแล้ว" แบบป็อปอัพเปลี่ยนกำหนดการ เพราะสถานะยกเลิกเป็นสถานะถาวรที่มักต้องการให้ลูกค้าจำได้ โดยเฉพาะ
 * เคสที่ต้องคืนเงินผ่านไลน์แต่ลูกค้ายังไม่ได้ทักมา — ปิดได้แค่ชั่วคราว เปิดหน้าใหม่ก็โผล่อีก) */
function CancelledOrderPopup({ order, onClose }: { order: PublicOrderView; onClose: () => void }) {
  const { closing, requestClose } = useClosingTransition(onClose)
  return (
    <div
      className={'fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}
      onClick={requestClose}
    >
      <div
        className={'relative bg-white rounded-3xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto ' + (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-stone-500 grid place-items-center text-lg font-bold shadow-md z-10"
        >
          ✕
        </button>

        <div className="bg-gradient-to-b from-red-50 to-white rounded-t-3xl px-6 pt-9 pb-5 text-center space-y-2">
          <div className="relative w-16 h-16 mx-auto">
            <span className="absolute inset-0 rounded-full bg-red-300/60 animate-fab-ring" aria-hidden="true" />
            <div className="relative w-16 h-16 rounded-full bg-red-100 grid place-items-center text-3xl animate-icon-pop">😔</div>
          </div>
          <h2 className="text-xl font-display font-bold text-red-700 leading-snug">ออเดอร์นี้ถูกยกเลิกแล้ว</h2>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <p className="text-sm text-stone-600 text-center leading-relaxed">ทางร้านต้องขออภัยในความไม่สะดวกเป็นอย่างสูงค่ะ</p>

          {order.cancelled_reason && (
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-3 text-sm text-stone-600">
              <p className="text-xs font-medium text-stone-400 mb-1">เหตุผล</p>
              <p>{order.cancelled_reason}</p>
            </div>
          )}

          {order.refund_status === 'pending' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 text-sm text-amber-800 space-y-1">
              <p className="font-medium">💰 มีเงินที่ต้องคืนให้คุณลูกค้า</p>
              <p>ทางร้านจะโอนเงินคืนผ่านไลน์ กรุณาแอดไลน์ร้านและแจ้งชื่อผู้สั่งซื้อเพื่อยืนยันตัวตนก่อนโอนคืนด้วยนะคะ</p>
            </div>
          )}

          {/* ข้อความตามสถานะการชำระเงินจริงของออเดอร์ที่ถูกยกเลิก — ลูกค้าหลายคนยังไม่ได้โอนเงินเลย (ไม่มีเงินให้คืน) บางคนโอนแล้ว
              แต่ร้านยังไม่ได้บันทึก (ต้องส่งสลิปให้ตรวจ) ต้องแยกให้ชัดไม่งั้นสับสนหรือโอนเงินเข้ามาทั้งที่ออเดอร์ถูกยกเลิกแล้ว */}
          {order.refund_status === 'refunded' && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-3.5 py-3 text-sm text-green-800 space-y-1">
              <p className="font-medium">✅ ร้านโอนเงินคืนให้เรียบร้อยแล้ว</p>
              <p>หากยังไม่เห็นเงินเข้าบัญชี หรือมีข้อสงสัย ทักไลน์ร้านได้เลยนะคะ</p>
            </div>
          )}
          {order.refund_status === 'none' && (order.payment_status === 'paid' || order.payment_status === 'partial') && (
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-3 text-sm text-stone-600 space-y-1">
              <p className="font-medium text-stone-700">💳 ออเดอร์นี้มีการชำระเงินแล้ว</p>
              <p>หากต้องการสอบถามเรื่องเงินที่ชำระไว้ แอดไลน์ร้านและแจ้งชื่อผู้สั่งซื้อได้เลยนะคะ</p>
            </div>
          )}
          {order.refund_status === 'none' &&
            order.payment_status !== 'paid' &&
            order.payment_status !== 'partial' &&
            order.payment_claimed_at && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 text-sm text-amber-800 space-y-1">
                <p className="font-medium">🕐 ร้านยังไม่ได้บันทึกการชำระเงินของออเดอร์นี้</p>
                <p>
                  ถ้าคุณโอนเงินมาแล้ว กรุณาแอดไลน์ร้านพร้อมแนบสลิปและชื่อผู้สั่งซื้อ เพื่อให้ร้านตรวจสอบรายการเข้าบัญชีให้นะคะ
                </p>
              </div>
            )}
          {order.refund_status === 'none' &&
            order.payment_status !== 'paid' &&
            order.payment_status !== 'partial' &&
            !order.payment_claimed_at && (
              <div className="rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-3 text-sm text-sky-900 space-y-1">
                <p className="font-medium">ℹ️ ออเดอร์นี้ยังไม่มีการชำระเงิน จึงไม่มีเงินที่ต้องคืน</p>
                <p>
                  กรุณา <strong>ไม่ต้องโอนเงิน</strong> สำหรับออเดอร์นี้นะคะ หากมีข้อสงสัยสอบถามร้านทางไลน์ได้เลย
                </p>
              </div>
            )}

          {order.line_url && (
            <a
              href={order.line_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#06C755] text-white font-semibold py-3 text-sm shadow-sm"
            >
              💬 แอดไลน์ร้าน
            </a>
          )}

          <a
            href="/menu"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-transform active:scale-95"
          >
            🛒 สั่งขนมใหม่อีกครั้ง
          </a>

          <button
            type="button"
            onClick={requestClose}
            className="w-full rounded-xl border border-stone-300 text-stone-600 font-medium py-2.5 text-sm"
          >
            รับทราบแล้ว
          </button>
        </div>
      </div>
    </div>
  )
}

/** ป็อปอัพแจ้งเปลี่ยนแปลงกำหนดการ (needed_date) — โผล่ครั้งเดียวตอนเข้าดูออเดอร์หลังร้านเปลี่ยนวันที่ กดรับทราบแล้ว
 * บันทึกไว้ที่ฐานข้อมูลผ่าน acknowledge_needed_date_change (ไม่ใช่แค่ state ในเครื่อง) กันโผล่ซ้ำถ้าเข้าจาก
 * อุปกรณ์อื่นหรือรีเฟรชหน้าใหม่ */
function DateChangePopup({ order, onClose }: { order: PublicOrderView; onClose: () => void }) {
  const { closing, requestClose } = useClosingTransition(onClose)
  return (
    <div
      className={'fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}
      onClick={requestClose}
    >
      <div
        className={'relative bg-white rounded-3xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto ' + (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-stone-500 grid place-items-center text-lg font-bold shadow-md z-10"
        >
          ✕
        </button>

        <div className="bg-gradient-to-b from-amber-50 to-white rounded-t-3xl px-6 pt-9 pb-5 text-center space-y-2">
          <div className="relative w-16 h-16 mx-auto">
            <span className="absolute inset-0 rounded-full bg-amber-300/60 animate-fab-ring" aria-hidden="true" />
            <div className="relative w-16 h-16 rounded-full bg-amber-100 grid place-items-center text-3xl animate-icon-pop">📅</div>
          </div>
          <h2 className="text-xl font-display font-bold text-amber-700 leading-snug">มีการเปลี่ยนแปลงกำหนดการ</h2>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <p className="text-sm text-stone-600 text-center leading-relaxed">
            ทางร้านต้องขออภัยในความไม่สะดวกเป็นอย่างสูงค่ะ กำหนดการของออเดอร์นี้มีการเปลี่ยนแปลง
          </p>

          <div className="rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-3.5 flex items-center justify-center gap-2.5 text-sm">
            <span className="line-through text-stone-400">{formatOrderDate(order.previous_needed_date)}</span>
            <span className="text-stone-400">→</span>
            <span className="font-semibold text-amber-700 animate-qty-pop">{formatOrderDate(order.needed_date)}</span>
          </div>

          {order.line_url && (
            <a
              href={order.line_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-[#06C755] text-[#06C755] font-medium py-2.5 text-sm"
            >
              💬 มีคำถาม? ทักไลน์ร้าน
            </a>
          )}

          <button
            type="button"
            onClick={requestClose}
            className="btn-shimmer w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-transform active:scale-95"
          >
            รับทราบแล้ว
          </button>
        </div>
      </div>
    </div>
  )
}

/** ป็อปอัพแนะนำร้าน โชว์ก่อนป็อปอัพเตือนชำระเงินเสมอ ทุกครั้งที่เข้าดูออเดอร์ */
function AboutShopPopup({ shopName, logoPath, onClose }: { shopName: string; logoPath: string | null; onClose: () => void }) {
  const { closing, requestClose } = useClosingTransition(onClose)
  return (
    <div
      className={'fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}
      onClick={requestClose}
    >
      <div
        className={'relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto ' + (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-stone-600 grid place-items-center text-lg font-bold shadow-md z-10"
        >
          ✕
        </button>

        <div className="relative overflow-hidden rounded-t-3xl px-6 pt-10 pb-7 text-center bg-brand-shader">
          <AmbientGlow />
          <div className="relative z-10 space-y-3">
            {logoPath && (
              <img
                src={productImageUrl(logoPath)}
                alt=""
                className="w-20 h-20 rounded-full mx-auto object-cover border-2 animate-icon-pop"
                style={{ borderColor: 'rgba(255,255,255,0.4)' }}
              />
            )}
            <p className="text-4xl animate-hero-text" style={{ animationDelay: '0.2s' }}>🍪</p>
            <h2 className="text-2xl font-display font-bold text-white leading-snug animate-hero-text" style={{ animationDelay: '0.3s' }}>
              ร้านเบเกอรี่ของเด็กอายุ 13 ปี
            </h2>
            <p className="text-sm animate-hero-text" style={{ color: 'rgba(255,255,255,0.8)', animationDelay: '0.4s' }}>
              {shopName} คืออะไร?
            </p>
          </div>
        </div>

        <div className="px-5 py-5 space-y-3 text-sm text-stone-700 leading-relaxed">
          <p>
            {shopName} เป็นร้านเบเกอรี่ที่เริ่มต้นและลงมือทำเองทุกขั้นตอนโดย "ริว" เจ้าของร้านวัย 13 ปี
            หวานน้อย อร่อยแน่ ไม่เหมือนใคร รับทำตามออร์เดอร์ (Pre-order) เพื่อคุมความสดใหม่ทุกรอบผลิต
          </p>
          <p>
            สั่งของ ติดตามสถานะออเดอร์ และแจ้งชำระเงินได้ครบในหน้านี้หน้าเดียว — อยากอ่านเรื่องราวร้านแบบเต็มๆ
            แวะไปที่แท็บ "เกี่ยวกับร้าน" ในหน้าเมนูออนไลน์ได้เลย
          </p>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={requestClose}
            className="btn-shimmer w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-transform active:scale-95"
          >
            เริ่มดูออเดอร์ของฉัน
          </button>
        </div>
      </div>
    </div>
  )
}

/** ป็อปอัพสอนวิธีใช้งานหน้านี้ โชว์ต่อจากป็อปอัพแนะนำร้านเสมอ ทุกครั้งที่เข้าดูออเดอร์ (คนละอันกับ AboutShopPopup) */
function HowToUsePopup({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: '📊', text: 'เช็คสถานะออเดอร์แบบเรียลไทม์ได้ตลอดในหน้านี้' },
    { icon: '💳', text: 'ยังไม่จ่าย? กด "ดูวิธีชำระเงิน" แล้วแจ้งชำระได้เลยในหน้านี้' },
    { icon: '📸', text: 'กดบันทึกสรุปออเดอร์เป็นรูปภาพเก็บไว้ดูภายหลังได้' },
    { icon: '💬', text: 'มีปัญหาหรือข้อสงสัย ทักไลน์ร้านได้ทันทีจากปุ่มด้านบน' },
  ]
  const { closing, requestClose } = useClosingTransition(onClose)
  return (
    <div className={'fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}>
      <div className={'bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 text-center ' + (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')}>
        <p className="text-4xl">💡</p>
        <h2 className="text-lg font-display font-bold text-stone-900">วิธีใช้งานหน้านี้</h2>
        <div className="space-y-2.5 text-left">
          {items.map((it, i) => (
            <div
              key={i}
              className="animate-timeline-in flex items-start gap-3 text-sm text-stone-600 rounded-xl bg-stone-50 border border-stone-200/70 px-3 py-2.5"
              style={{ animationDelay: `${0.12 + i * 0.09}s` }}
            >
              <span className="text-xl shrink-0">{it.icon}</span>
              <span>{it.text}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={requestClose}
          className="btn-shimmer w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-transform active:scale-95"
        >
          เข้าใจแล้ว เริ่มดูออเดอร์
        </button>
      </div>
    </div>
  )
}

/**
 * รายการสินค้า + ยอดรวม พร้อมปุ่มบันทึกเป็นรูปภาพ — สร้างรูปฝั่งเบราว์เซอร์ล้วนๆ (html-to-image) ไม่มีการอัปโหลด
 * หรือเก็บอะไรใน Supabase เพิ่มเลย ลูกค้ากดแล้วได้ไฟล์ลงเครื่องตัวเองทันที ไม่กินพื้นที่จัดเก็บของร้านแม้แต่นิดเดียว
 * ตั้งใจไม่ใส่ชื่อร้าน/เลขออเดอร์/ชื่อลูกค้าซ้ำในการ์ดนี้ เพราะด้านบนสุดของหน้าโชว์ไว้แล้วทั้งหมด
 */
function OrderSummaryCard({ order }: { order: PublicOrderView }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [saveHint, setSaveHint] = useState(false)

  async function handleDownload() {
    if (!cardRef.current) return
    setDownloading(true)
    setSaveHint(false)
    try {
      const blob = await htmlToImage.toBlob(cardRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
      if (!blob) throw new Error('สร้างรูปไม่สำเร็จ')
      const result = await saveImage(blob, `${order.order_no ?? 'order'}.png`, 'สรุปออเดอร์')
      if (result === 'downloaded') setSaveHint(true)
    } catch {
      setSaveHint(true)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div ref={cardRef} className={CARD + ' p-5 space-y-3'}>
        <h2 className="text-sm font-display font-semibold text-stone-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-amber-50 border border-amber-100 grid place-items-center text-sm shrink-0">🧾</span>
          สรุปรายการสั่งซื้อ
        </h2>
        <div className="space-y-1">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{it.product_name} x{it.qty}</span>
              <span>{formatBaht(it.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="border-t-2 border-dashed border-stone-200 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span>รวมสินค้า</span><span>{formatBaht(order.items_total)}</span></div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between text-green-700"><span>ส่วนลด</span><span>-{formatBaht(order.discount_amount)}</span></div>
          )}
          {Number(order.shipping_fee) > 0 && (
            <div className="flex justify-between"><span>ค่าส่ง</span><span>{formatBaht(order.shipping_fee)}</span></div>
          )}
          <div className="flex justify-between items-end font-bold text-lg pt-1"><span>ยอดรวม</span><span className="tabular-nums">{formatBaht(order.grand_total)}</span></div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="w-full rounded-xl border border-stone-300 text-stone-700 font-medium py-2.5 text-sm disabled:opacity-50"
      >
        {downloading ? 'กำลังสร้างรูป...' : '📸 บันทึกสรุปออเดอร์เป็นรูปภาพ'}
      </button>
      {saveHint && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center animate-form-in">
          💡 ถ้าเครื่องไม่ได้บันทึกให้ ลองแคปหน้าจอส่วนสรุปออเดอร์ด้านบนแทนได้เลย
        </p>
      )}
    </div>
  )
}

export function PublicOrderPage() {
  const { token } = useParams()
  const nameDraftKey = token ? `public-order-name:${token}` : null
  const [order, setOrder] = useState<PublicOrderView | null | undefined>(undefined)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState(() => (nameDraftKey ? loadFormDraft<string>(nameDraftKey) : null) ?? '')
  const [revealing, setRevealing] = useState(false)
  const [shake, setShake] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [noNameOnFile, setNoNameOnFile] = useState(false)
  const [showPaymentInfo, setShowPaymentInfo] = useState(false)
  const [showAddressEdit, setShowAddressEdit] = useState(false)
  const [addressSaved, setAddressSaved] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [unpaidPopupDismissed, setUnpaidPopupDismissed] = useState(false)
  const [cancelledPopupDismissed, setCancelledPopupDismissed] = useState(false)
  const [dateChangePopupDismissed, setDateChangePopupDismissed] = useState(false)
  const [aboutPopupDismissed, setAboutPopupDismissed] = useState(false)
  const [howToPopupDismissed, setHowToPopupDismissed] = useState(false)
  const [manualHowTo, setManualHowTo] = useState(false)
  const [failCount, setFailCount] = useState(0)
  const [showContactPopup, setShowContactPopup] = useState(false)

  useFormDraft(nameDraftKey, nameInput)

  const fetchOrder = useCallback(() => {
    if (!token) return
    supabase.rpc('get_public_order', { p_token: token }).then(({ data }) => {
      setOrder((data as PublicOrderView | null) ?? null)
    })
  }, [token])

  useEffect(() => { fetchOrder() }, [fetchOrder])

  async function handleAcknowledgeDateChange() {
    setDateChangePopupDismissed(true)
    if (token) await supabase.rpc('acknowledge_needed_date_change', { p_token: token })
  }

  async function handleClaimPayment() {
    if (!token) return
    setClaiming(true)
    const { error } = await claimPayment(token)
    setClaiming(false)
    if (error) { setClaimError(error); return }
    fetchOrder()
  }

  function handleConfirmName(e: FormEvent) {
    e.preventDefault()
    const typed = nameInput.trim()
    if (!typed || order === undefined) return

    if (order === null) {
      // token ผิดตั้งแต่ต้น ไม่มีออเดอร์ให้เทียบชื่อเลย ปล่อยผ่านไปโชว์หน้า "ไม่พบออเดอร์" ตามจริง
      // ไม่มีข้อมูลอะไรให้หลุดอยู่แล้วเพราะ order เป็น null
      setCustomerName(typed)
      setRevealing(true)
      clearFormDraft(nameDraftKey)
      return
    }

    if (!order.customer_name && !order.customer_phone) {
      // มีออเดอร์จริง แต่ไม่มีทั้งชื่อและเบอร์ผูกไว้เลย — ไม่มีอะไรให้เทียบ ต้องกันไว้ ห้ามปล่อยผ่านให้ใครพิมพ์อะไรก็เข้าได้
      setNoNameOnFile(true)
      return
    }

    // ยอมรับได้ทั้งชื่อหรือเบอร์โทร — ต้องตรงกับที่บันทึกไว้จริงอย่างใดอย่างหนึ่ง กันคนอื่นเดาสุ่มๆ แล้วเข้าดู
    // ออเดอร์คนอื่นได้ เทียบชื่อแบบ normalize แล้ว (ดูฟังก์ชัน normalizeName ด้านบน) ไม่ใช่เทียบสตริงดิบ เพราะ
    // แป้นพิมพ์มือถือมักแก้ตัวอักษรแรกเป็นตัวใหญ่หรือแทรกช่องว่างเกินให้เองโดยผู้ใช้ไม่รู้ตัว
    const nameMatches = !!order.customer_name && normalizeName(typed) === normalizeName(order.customer_name)
    const typedDigits = normalizePhone(typed)
    const phoneMatches =
      !!order.customer_phone && typedDigits.length >= 9 && typedDigits === normalizePhone(order.customer_phone)

    if (!nameMatches && !phoneMatches) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setNameError(true)
      const nextFailCount = failCount + 1
      setFailCount(nextFailCount)
      if (nextFailCount >= 2) setShowContactPopup(true)
      return
    }

    setCustomerName(typed)
    setRevealing(true)
    clearFormDraft(nameDraftKey)
  }

  // ออเดอร์นี้มีจริง แต่ไม่มีทั้งชื่อและเบอร์ลูกค้าผูกไว้ในระบบเลย ไม่มีทางตรวจสอบตัวตนได้ ต้องหยุดตรงนี้เสมอ ไม่ปล่อยให้ใครพิมพ์อะไรก็เข้าได้
  if (noNameOnFile) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center font-warm">
        <div className="max-w-sm">
          <p className="text-4xl mb-2">🔒</p>
          <p className="text-stone-700 font-medium">ออเดอร์นี้ไม่มีชื่อหรือเบอร์ลูกค้าผูกไว้ในระบบ</p>
          <p className="text-sm text-stone-500 mt-1">ไม่สามารถยืนยันตัวตนอัตโนมัติได้ กรุณาติดต่อร้านโดยตรงเพื่อตรวจสอบออเดอร์</p>
        </div>
      </div>
    )
  }

  // ขั้นที่ 1: ยืนยันชื่อหรือเบอร์ก่อนเสมอ — ปุ่มกดไม่ได้จนกว่าจะรู้ผลจริงจากฐานข้อมูลแล้วว่าชื่อ/เบอร์คืออะไร
  if (customerName === null) {
    return (
      <div className="relative overflow-hidden min-h-screen bg-brand-shader grid place-items-center p-4 font-warm">
        <AmbientGlow />
        <form
          onSubmit={handleConfirmName}
          className={
            'relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white/95 backdrop-blur shadow-[0_24px_50px_-18px_rgb(33_21_10_/_0.7)] p-6 pt-0 space-y-4 text-center animate-form-in' +
            (shake ? ' animate-shake' : '')
          }
        >
          <div className="-mx-6 h-1.5 bg-gradient-to-r from-amber-300 via-amber-600 to-amber-300" aria-hidden="true" />
          <div className="relative w-20 h-20 mx-auto mt-6">
            <span className="absolute inset-0 rounded-full bg-amber-300/60 animate-fab-ring" aria-hidden="true" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-white shadow-lg grid place-items-center text-4xl animate-icon-pop">🥐</div>
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900">ตรวจสอบออเดอร์ของคุณ</h1>
            <SquiggleUnderline className="w-16 h-2 mx-auto mt-1 text-amber-700/50" />
          </div>
          {order && (
            <p className="inline-block rounded-full bg-stone-50 border border-stone-200 px-3 py-1 text-xs text-stone-500 font-mono tracking-wide">
              ออเดอร์ {order.order_no ?? 'รอเลขที่ออเดอร์'}
            </p>
          )}
          <p className="text-sm text-stone-500 leading-relaxed">🔒 กรุณากรอกชื่อผู้สั่งซื้อหรือเบอร์โทรศัพท์ให้ตรงกับที่แจ้งไว้ในแชท เพื่อยืนยันตัวตนก่อนดูออเดอร์</p>
          <div className="space-y-1.5 text-left">
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value)
                if (nameError) setNameError(false)
              }}
              placeholder="ชื่อผู้สั่งซื้อ หรือเบอร์โทรศัพท์"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl border-2 border-stone-200 bg-stone-50/60 px-3 py-3 text-center transition-all focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-300/30"
            />
            {nameError && (
              <InlineError message="ชื่อ/เบอร์ไม่ตรงกับที่แจ้งไว้ กรุณาลองใหม่ให้ตรงกับที่คุยในแชท" className="justify-center" />
            )}
          </div>
          <button
            type="submit"
            disabled={!nameInput.trim() || order === undefined}
            className="btn-shimmer w-full rounded-full bg-gradient-to-r from-stone-800 to-stone-900 text-white py-3 font-semibold shadow-[0_10px_20px_-10px_rgb(51_32_14_/_0.8)] transition-all active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            {order === undefined ? 'กำลังโหลดข้อมูล...' : 'ดูรายละเอียดออเดอร์'}
          </button>
        </form>

        {showContactPopup && (
          <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4 animate-overlay-fade">
            <div className="bg-white rounded-2xl p-6 text-center space-y-3 max-w-xs w-full shadow-xl animate-toast-pop relative">
              <button
                type="button"
                onClick={() => setShowContactPopup(false)}
                aria-label="ปิด"
                className="absolute top-3 right-3 text-stone-400 text-lg leading-none"
              >
                ✕
              </button>
              <div className="text-3xl">🤔</div>
              <p className="font-semibold text-stone-900">กรอกไม่ตรงหลายครั้งแล้วใช่ไหมคะ?</p>
              <p className="text-sm text-stone-500">ลองตรวจสอบชื่อ/เบอร์ที่แจ้งไว้ตอนสั่งอีกครั้ง หรือติดต่อร้านโดยตรงได้เลย</p>
              {order?.line_url ? (
                <a
                  href={order.line_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#06C755] text-white font-semibold py-2.5 text-sm"
                >
                  💬 ติดต่อพนักงาน (แอดไลน์)
                </a>
              ) : (
                <p className="text-sm text-stone-400">กรุณาติดต่อร้านโดยตรงเพื่อตรวจสอบออเดอร์</p>
              )}
              <button
                type="button"
                onClick={() => setShowContactPopup(false)}
                className="w-full rounded-lg border border-stone-300 text-stone-600 py-2 text-sm"
              >
                ลองกรอกอีกครั้ง
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ขั้นที่ 2: เอฟเฟกต์ยืนยันตัวตนสำเร็จสั้นๆ ก่อนเปิดออเดอร์จริง
  if (revealing) {
    return (
      <SuccessOverlay
        message="ยืนยันตัวตนสำเร็จ ✨"
        submessage="กำลังเปิดออเดอร์ของคุณ..."
        onDone={() => setRevealing(false)}
        durationMs={700}
      />
    )
  }

  if (order === null || order === undefined) {
    // order === undefined ในจุดนี้แทบไม่เกิดจริง เพราะปุ่มยืนยันชื่อกดไม่ได้จนกว่าจะโหลดเสร็จ
    // แต่เขียนดักไว้ให้ TypeScript แน่ใจว่าตั้งแต่บรรทัดนี้ลงไป order ไม่มีทาง undefined อีกแล้ว
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center font-warm">
        <div>
          <p className="text-4xl mb-2">🔍</p>
          <p className="text-stone-500">ไม่พบออเดอร์นี้ ลิงก์อาจไม่ถูกต้อง</p>
        </div>
      </div>
    )
  }

  // ป็อปอัพวิธีใช้งานโผล่เองครั้งแรกตามลำดับ onboarding (ต่อจากป็อปอัพแนะนำร้าน) หรือเปิดซ้ำเองได้ทุกเมื่อ
  // จากปุ่ม "วิธีใช้งานหน้านี้" — ปิดแล้วต้องเคลียร์ทั้งสองทางเสมอ กันเปิดค้างจากอีกทางนึงโดยไม่ตั้งใจ
  const showHowTo = (aboutPopupDismissed && !howToPopupDismissed) || manualHowTo
  function closeHowTo() {
    setManualHowTo(false)
    if (!howToPopupDismissed) setHowToPopupDismissed(true)
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 font-warm">
      <PageTexture />
      <div className="max-w-md mx-auto space-y-4">
        <div
          className={
            'relative overflow-hidden rounded-3xl text-white p-6 text-center shadow-[0_16px_40px_-16px_rgb(51_32_14_/_0.6)] animate-form-in ' +
            (order.work_status === 'cancelled' ? 'bg-gradient-to-br from-red-900 via-red-700 to-stone-800' : 'bg-brand-shader')
          }
        >
          <AmbientGlow />
          <div className="relative z-10">
            <p className="text-sm text-white/80 animate-hero-text">สวัสดีคุณ{customerName} 👋</p>
            <h1 className="text-2xl font-display font-bold mt-1 animate-hero-text" style={{ animationDelay: '0.1s' }}>
              {order.shop_name}
            </h1>
            <SquiggleUnderline className="w-16 h-2 mx-auto mt-1 text-white/40" />
            <div className="animate-hero-text" style={{ animationDelay: '0.2s' }}>
              <CopyOrderNo orderNo={order.order_no} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 animate-hero-text" style={{ animationDelay: '0.3s' }}>
              {order.pending_confirmation && (
                <span className="text-xs font-medium rounded-full bg-white/15 backdrop-blur border border-white/25 px-3 py-1">
                  🕐 รอร้านตรวจสอบและยืนยันออเดอร์
                </span>
              )}
              {order.work_status === 'cancelled' && (
                <span className="text-xs font-bold rounded-full bg-white text-red-700 px-3 py-1 shadow-md ring-2 ring-red-300/60 animate-icon-pop">✕ ยกเลิกแล้ว</span>
              )}
              {order.needed_date && order.work_status !== 'delivered' && order.work_status !== 'cancelled' && (() => {
                const n = daysUntil(order.needed_date)
                if (n < 0) return null
                return (
                  <span className="text-xs font-medium rounded-full bg-amber-300/90 text-stone-900 px-3 py-1 shadow-sm">
                    {n === 0 ? '📅 วันนี้ถึงวันกำหนดแล้ว' : n === 1 ? '📅 พรุ่งนี้ถึงวันกำหนด' : `📅 อีก ${n} วันถึงวันกำหนด`}
                  </span>
                )
              })()}
            </div>
            <button
              type="button"
              onClick={() => setManualHowTo(true)}
              className="mt-3 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white text-xs font-medium px-3.5 py-1.5 transition-all duration-200 hover:bg-white/25 active:scale-95"
            >
              💡 วิธีใช้งานหน้านี้
            </button>
          </div>
        </div>

        <LiveStatusCard order={order} />

        {order.line_url && (
          <a
            href={order.line_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#06C755] text-white font-semibold py-3 text-sm shadow-sm transition-transform active:scale-95 animate-form-in"
            style={{ animationDelay: '0.06s', animationFillMode: 'backwards' }}
          >
            💬 ติดต่อพนักงาน (แอดไลน์)
          </a>
        )}

        <div className={CARD + ' p-5 animate-form-in'} style={{ animationDelay: '0.12s', animationFillMode: 'backwards' }}>
          <h2 className="text-sm font-display font-semibold text-stone-700 mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-50 border border-amber-100 grid place-items-center text-sm shrink-0">📍</span>
            สถานะออเดอร์
          </h2>
          {order.work_status === 'cancelled' ? (
            <div className="flex gap-3 animate-timeline-in rounded-xl bg-red-50 border border-red-200 p-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white grid place-items-center text-sm shrink-0 shadow">✕</div>
              <div>
                <p className="font-semibold text-red-700">ยกเลิกออเดอร์แล้ว</p>
                <p className="text-xs text-red-900/60 mt-0.5">ออเดอร์นี้ไม่ดำเนินการต่อ หากมีข้อสงสัยทักไลน์ร้านได้เลยค่ะ</p>
              </div>
            </div>
          ) : (
            <StatusTimeline
              workStatus={order.work_status}
              paymentStatus={order.payment_status}
              paymentClaimedAt={order.payment_claimed_at}
              fulfillmentType={order.fulfillment_type}
              pending={order.pending_confirmation}
            />
          )}

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

          {order.payment_status !== 'paid' && order.work_status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => setShowPaymentInfo((v) => !v)}
              className="w-full rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium py-2.5 text-sm"
            >
              💳 ยังไม่ได้ชำระเงิน · ดูวิธีชำระเงิน
            </button>
          )}
          {showPaymentInfo && order.work_status !== 'cancelled' && (
            <PaymentInfoPanel
              promptpay={order.promptpay}
              balanceDue={order.balance_due}
              paymentInstructions={order.payment_instructions}
              paymentClaimedAt={order.payment_claimed_at}
              claiming={claiming}
              claimError={claimError}
              onClaimPayment={() => void handleClaimPayment()}
            />
          )}
        </div>

        <Reveal className={CARD + ' p-5 space-y-2'}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold text-stone-700 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-amber-50 border border-amber-100 grid place-items-center text-sm shrink-0">🚚</span>
              กำหนดการจัดส่ง
            </h2>
            {order.address_editable && (
              <button
                type="button"
                onClick={() => setShowAddressEdit(true)}
                className="rounded-full bg-white border border-stone-300 text-stone-700 text-xs font-medium px-3 py-1.5 shadow-sm transition-transform active:scale-95"
              >
                ✏️ แก้ไขที่อยู่
              </button>
            )}
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-stone-500">วิธีรับของ</span><span>{FULFILLMENT_LABELS[order.fulfillment_type] ?? order.fulfillment_type}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">วันที่ต้องได้ของ</span><span className="font-semibold text-stone-900">{order.needed_date ? formatOrderDate(order.needed_date) : '-'}</span></div>
            {order.fulfillment_type === 'pickup' ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-stone-500 shrink-0">จุดนัดรับ</span>
                  <span className="text-right">
                    <span className="font-semibold text-stone-900">{order.pickup_place ?? '-'}</span>
                    {order.pickup_place && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.pickup_place)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 ml-auto flex w-fit items-center gap-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-medium px-2.5 py-1 active:scale-95"
                      >
                        🗺️ เปิดแผนที่
                      </a>
                    )}
                  </span>
                </div>
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
            <p className="text-xs text-stone-400 pt-1">
              {order.pending_confirmation
                ? 'รอร้านตรวจสอบและยืนยันออเดอร์ก่อน จึงจะแก้ไขที่อยู่เองได้ — ต้องการแก้ไขตอนนี้ ทักไลน์ร้านได้เลย'
                : 'แพ็คของแล้ว แก้ไขที่อยู่เองไม่ได้แล้ว ติดต่อร้านโดยตรงถ้าจำเป็น'}
            </p>
          )}
        </Reveal>

        <Reveal delay={0.08} className="flex gap-2">
          {order.needed_date && order.work_status !== 'cancelled' && (
            <AddToCalendarButton
              orderNo={order.order_no ?? 'รอเลขที่'}
              shopName={order.shop_name}
              neededDate={order.needed_date}
              location={order.fulfillment_type === 'pickup' ? order.pickup_place : order.ship_address_text}
              description={
                order.fulfillment_type === 'pickup'
                  ? `นัดรับที่ ${order.pickup_place ?? '-'} เวลา ${order.pickup_time ?? '-'}`
                  : `${FULFILLMENT_LABELS[order.fulfillment_type] ?? order.fulfillment_type}${order.ship_address_text ? `: ${order.ship_address_text}` : ''}`
              }
            />
          )}
          <ShareOrderButton shopName={order.shop_name} orderNo={order.order_no ?? 'รอเลขที่'} />
        </Reveal>

        <Reveal delay={0.14}>
          <OrderSummaryCard order={order} />
        </Reveal>

        <Reveal delay={0.1} className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-6 text-center shadow-[0_16px_40px_-16px_rgb(51_32_14_/_0.6)]">
          <AmbientGlow />
          <div className="relative z-10 space-y-1">
            <p className="text-3xl">{order.work_status === 'cancelled' ? '🙏' : '🧡'}</p>
            <p className="font-display font-semibold">
              {order.work_status === 'cancelled'
                ? `ขออภัยในความไม่สะดวก ไว้โอกาสหน้า ${order.shop_name} ยินดีให้บริการนะคะ`
                : `ขอบคุณที่อุดหนุน ${order.shop_name} นะคะ`}
            </p>
            <p className="text-sm text-white/80">ทำสดใหม่ทุกออเดอร์ · หวานน้อย อร่อยแน่ ไม่เหมือนใคร</p>
            <a
              href="/menu"
              className="btn-shimmer inline-block mt-3 rounded-full bg-white text-stone-900 font-semibold px-6 py-2.5 text-sm shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            >
              🛒 สั่งขนมเพิ่ม
            </a>
          </div>
        </Reveal>
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

      {addressSaved && (
        <SuccessOverlay
          message="บันทึกที่อยู่ใหม่เรียบร้อยแล้ว!"
          submessage="ทางร้านจะเห็นที่อยู่ใหม่นี้ทันที"
          onDone={() => setAddressSaved(false)}
        />
      )}

      {!aboutPopupDismissed ? (
        <AboutShopPopup shopName={order.shop_name} logoPath={order.logo_path} onClose={() => setAboutPopupDismissed(true)} />
      ) : showHowTo ? (
        <HowToUsePopup onClose={closeHowTo} />
      ) : order.work_status === 'cancelled' && !cancelledPopupDismissed ? (
        <CancelledOrderPopup order={order} onClose={() => setCancelledPopupDismissed(true)} />
      ) : order.previous_needed_date && !dateChangePopupDismissed ? (
        <DateChangePopup order={order} onClose={() => void handleAcknowledgeDateChange()} />
      ) : (
        !unpaidPopupDismissed &&
        !order.payment_claimed_at &&
        order.payment_status !== 'paid' && (
          <UnpaidPaymentPopup
            order={order}
            showPaymentInfo={showPaymentInfo}
            onShowPaymentInfo={() => setShowPaymentInfo(true)}
            onClose={() => setUnpaidPopupDismissed(true)}
            claiming={claiming}
            claimError={claimError}
            onClaimPayment={() => void handleClaimPayment()}
          />
        )
      )}

      <ChatBot shopName={order.shop_name} faqs={order.faqs} lineUrl={order.line_url} />
    </div>
  )
}
