import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import * as htmlToImage from 'html-to-image'
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
  order_no: string
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

/** เทียบเบอร์โทรทนรูปแบบที่ต่างกัน — ตัดอักขระที่ไม่ใช่ตัวเลขทิ้งหมด (ช่องว่าง/ขีด/วงเล็บ) แล้วแปลงเบอร์
 * รูปแบบ +66/66 นำหน้าให้เป็น 0 นำหน้าแบบไทยปกติ จะได้เทียบตรงกับที่ผู้ใช้กรอกแบบ 0812345678 ได้ */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('66') && digits.length === 11) return '0' + digits.slice(2)
  return digits
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
}: {
  workStatus: string
  paymentStatus: string
  paymentClaimedAt: string | null
  fulfillmentType: string
}) {
  const WORK_STAGES = workStagesFor(fulfillmentType)
  const currentIndex = WORK_STAGES.findIndex((s) => s.key === workStatus)
  const paymentKey = paymentStatus !== 'paid' && paymentClaimedAt ? 'pending_review' : paymentStatus
  const payment = PAYMENT_STAGE[paymentKey] ?? PAYMENT_STAGE.unpaid

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div
            className={
              'w-7 h-7 rounded-full grid place-items-center text-sm shrink-0 text-white ' +
              payment.color +
              (payment.pulsing ? ' animate-pulse ring-4 ring-amber-200' : '')
            }
          >
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
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop">
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
  return (
    <div
      className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 animate-overlay-fade"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto animate-toast-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-stone-500 grid place-items-center text-lg font-bold shadow-md z-10"
        >
          ✕
        </button>

        <div className="bg-gradient-to-b from-red-50 to-white rounded-t-3xl px-6 pt-9 pb-5 text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-red-100 grid place-items-center mx-auto text-3xl">💳</div>
          <h2 className="text-xl font-bold text-red-700 leading-snug">คุณลูกค้ายังไม่ได้ชำระเงิน</h2>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {!showPaymentInfo ? (
            <button
              type="button"
              onClick={onShowPaymentInfo}
              className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-sm"
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

/** ป็อปอัพแนะนำร้าน โชว์ก่อนป็อปอัพเตือนชำระเงินเสมอ ทุกครั้งที่เข้าดูออเดอร์ */
function AboutShopPopup({ shopName, logoPath, onClose }: { shopName: string; logoPath: string | null; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 animate-overlay-fade"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-toast-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-stone-600 grid place-items-center text-lg font-bold shadow-md z-10"
        >
          ✕
        </button>

        <div
          className="rounded-t-3xl px-6 pt-10 pb-7 text-center space-y-3"
          style={{ background: 'linear-gradient(160deg, #3d2b1f, #6b4a35)' }}
        >
          {logoPath && (
            <img
              src={productImageUrl(logoPath)}
              alt=""
              className="w-20 h-20 rounded-full mx-auto object-cover border-2"
              style={{ borderColor: 'rgba(255,255,255,0.4)' }}
            />
          )}
          <p className="text-4xl">🍪</p>
          <h2 className="text-2xl font-extrabold text-white leading-snug">ร้านเบเกอรี่ของเด็กอายุ 13 ปี</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {shopName} คืออะไร?
          </p>
        </div>

        <div className="px-5 py-5 space-y-3 text-sm text-stone-700 leading-relaxed">
          <p>
            RYUKUNG_BAKERY เริ่มต้นจากความชอบในการทำขนมเล็กๆ ของเด็กอายุ 13 ปีคนหนึ่ง แล้วค่อยๆ เติบโตขึ้นมาเป็นร้านเบเกอรี่ที่รับทำขนมตามออร์เดอร์จริงจัง
            เน้นขนมที่ทำสดใหม่ เหมาะทั้งกับการซื้อกินเองและซื้อเป็นของฝากในโอกาสพิเศษ
          </p>
          <p>
            จุดเด่นของร้านคือการทำขนมแบบ Pre-order เพื่อเตรียมสินค้าให้พอดีกับจำนวนที่สั่ง และรักษาคุณภาพความสดใหม่ในทุกรอบการผลิต
            เมนูของร้านมีทั้ง Soft Cookie, S'more, Mini Cornflake และอื่นๆ อีกมากมาย รวมถึงบริการรับผลิตขนมจำนวนมากสำหรับงานสัมมนา งานเลี้ยง และ Snack Box
          </p>
          <p>
            สิ่งที่ร้านให้ความสำคัญไม่ใช่แค่รสชาติของขนม แต่ยังรวมถึงการนำเทคโนโลยีเข้ามาช่วยบริหารจัดการ ทั้งระบบสั่งซื้อ ติดตามสถานะออร์เดอร์
            ตรวจสอบการชำระเงิน และระบบ POS เพื่อให้ทุกขั้นตอนมีประสิทธิภาพมากขึ้น
          </p>
          <p>
            RYUKUNG_BAKERY จึงไม่ใช่แค่ร้านขายขนม แต่เป็นธุรกิจเล็กๆ ที่กำลังค่อยๆ เติบโตไปด้วยกัน ทั้งด้านสินค้า การบริการ และเทคโนโลยี
          </p>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm"
          >
            เริ่มดูออเดอร์ของฉัน
          </button>
        </div>
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

  async function handleDownload() {
    if (!cardRef.current) return
    setDownloading(true)
    const dataUrl = await htmlToImage.toPng(cardRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
    setDownloading(false)
    const link = document.createElement('a')
    link.download = `${order.order_no}.png`
    link.href = dataUrl
    link.click()
  }

  return (
    <div className="space-y-2">
      <div ref={cardRef} className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
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

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="w-full rounded-xl border border-stone-300 text-stone-700 font-medium py-2.5 text-sm disabled:opacity-50"
      >
        {downloading ? 'กำลังสร้างรูป...' : '📸 บันทึกสรุปออเดอร์เป็นรูปภาพ'}
      </button>
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
  const [aboutPopupDismissed, setAboutPopupDismissed] = useState(false)
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
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center">
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
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4">
        <form
          onSubmit={handleConfirmName}
          className={
            'w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center animate-form-in' +
            (shake ? ' animate-shake' : '')
          }
        >
          <div className="text-4xl">🥐</div>
          <h1 className="text-lg font-semibold">ตรวจสอบออเดอร์ของคุณ</h1>
          <p className="text-sm text-stone-500">กรุณากรอกชื่อผู้สั่งซื้อหรือเบอร์โทรศัพท์ให้ตรงกับที่แจ้งไว้ในแชทเพื่อยืนยันตัวตน</p>
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
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-center"
            />
            {nameError && (
              <InlineError message="ชื่อ/เบอร์ไม่ตรงกับที่แจ้งไว้ กรุณาลองใหม่ให้ตรงกับที่คุยในแชท" className="justify-center" />
            )}
          </div>
          <button
            type="submit"
            disabled={!nameInput.trim() || order === undefined}
            className="w-full rounded-lg bg-stone-900 text-white py-2.5 font-semibold disabled:opacity-40"
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
          <StatusTimeline
            workStatus={order.work_status}
            paymentStatus={order.payment_status}
            paymentClaimedAt={order.payment_claimed_at}
            fulfillmentType={order.fulfillment_type}
          />

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
          {showPaymentInfo && (
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

        <div className="flex gap-2">
          {order.needed_date && (
            <AddToCalendarButton
              orderNo={order.order_no}
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
          <ShareOrderButton shopName={order.shop_name} orderNo={order.order_no} />
        </div>

        <OrderSummaryCard order={order} />
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
