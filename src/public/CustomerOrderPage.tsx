import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPublicMenu, submitCustomerOrder, notifyCustomerOrder, type PublicMenu } from '../lib/publicMenuApi'
import { productImageUrl } from '../products/ProductCard'
import { formatBaht } from '../lib/money'
import { addDays } from '../lib/dates'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { playAddSound, playPaymentSound } from '../lib/uiSound'
import { SuccessOverlay } from '../lib/SuccessOverlay'
import { PromptPayQR } from './PromptPayQR'
import {
  AmbientGlow,
  CartFab,
  PageTexture,
  PublicNav,
  PublicFooter,
  Reveal,
  SquiggleUnderline,
  WaveDivider,
  flyToCart,
  type SiteTab,
} from './PublicSiteChrome'
import { AboutTabContent } from './AboutTabContent'
import { TurnstileWidget } from './TurnstileWidget'

type Step = 'menu' | 'review' | 'checkout' | 'payment'

type CartItem = { product_id: string; product_name: string; unit_price: number; unit: string; qty: number }

type CheckoutForm = {
  customerName: string
  customerPhone: string
  customerEmail: string
  fulfillmentType: 'pickup' | 'shipping'
  neededDate: string
  pickupPlace: string
  pickupTime: string
  shipAddressText: string
  note: string
}

const CART_DRAFT_KEY = 'public-menu-cart'
const CHECKOUT_DRAFT_KEY = 'public-menu-checkout'

const emptyCheckout: CheckoutForm = {
  customerName: '', customerPhone: '', customerEmail: '', fulfillmentType: 'pickup', neededDate: '',
  pickupPlace: '', pickupTime: '', shipAddressText: '', note: '',
}

function todayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** หน่วงปิดสั้นๆ ให้ป็อปอัพมีจังหวะเฟดออกก่อนถูก unmount จริง แทนที่จะหายวับไปทันที — ก็อปมาจาก PublicOrderPage.tsx */
function useClosingTransition(onClose: () => void, durationMs = 200) {
  const [closing, setClosing] = useState(false)
  function requestClose() {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, durationMs)
  }
  return { closing, requestClose }
}

/** ปุ่ม "ย้อนกลับ" มาตรฐานของทุกขั้นตอนสั่งซื้อ (ทวนรายการ/กรอกที่อยู่/ชำระเงิน) — ต้องเป็นปุ่มจริงมีขอบเสมอ
 * ห้ามเป็นแค่ตัวหนังสือขีดเส้นใต้ลอยๆ เด็ดขาด (ดูกฎถาวรใน CLAUDE.md เรื่องปุ่มย้อนกลับ) */
function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white text-stone-700 font-medium px-4 py-2 text-sm w-fit"
    >
      {children}
    </button>
  )
}

/** ป็อปอัพเตือนหลังกรอกที่อยู่เสร็จ ก่อนไปหน้าชำระเงินเสมอ — บังคับให้ลูกค้าติ๊กยืนยันว่าจำชื่อผู้รับ/ผู้สั่งซื้อ
 * ได้แล้วก่อนถึงจะกดต่อได้ (ปุ่มเป็นสีเทาจนกว่าจะติ๊ก) เพราะชื่อ/เบอร์นี้คือสิ่งเดียวที่ใช้ยืนยันตัวตนตอนเข้าดู
 * สถานะออเดอร์ทีหลังใน /o/:token — ลูกค้าลืมบ่อยมากถ้าไม่เตือนย้ำตรงนี้ */
function RememberNamePopup({ onConfirm }: { onConfirm: () => void }) {
  const [checked, setChecked] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 animate-overlay-fade">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 text-center animate-toast-pop">
        <div className="text-4xl animate-icon-pop">📝</div>
        <h2 className="text-lg font-display font-semibold text-stone-900">อย่าลืมจำไว้!</h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          โปรดจำ <strong>ชื่อผู้รับ/ชื่อผู้สั่งซื้อ</strong> ที่กรอกไว้ให้ดี ต้องใช้กรอกยืนยันตัวตนตอนเข้าดู
          สถานะออเดอร์ภายหลังด้วย
        </p>
        <label className="flex items-center justify-center gap-2 text-sm text-stone-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="w-4 h-4 accent-stone-900"
          />
          ฉันจำได้แล้ว
        </label>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!checked}
          className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm disabled:bg-stone-200 disabled:text-stone-400"
        >
          รับทราบ ไปหน้าชำระเงิน →
        </button>
      </div>
    </div>
  )
}

/** ป็อปอัพสอนวิธีใช้งานหน้านี้ เปิดจากปุ่ม 💡 มุมขวาบนของแถบนำทาง เปิดซ้ำเองได้ทุกเมื่อ */
function HowToUsePopup({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: '🛒', text: 'เลือกสินค้าที่ต้องการ ปรับจำนวนแล้วกดปุ่มตะกร้ามุมขวาล่างได้ทันที' },
    { icon: '📝', text: 'กรอกชื่อ เบอร์โทร และวันที่ต้องการรับของให้ครบ' },
    { icon: '💳', text: 'สแกน QR พร้อมเพย์จ่ายเงินก่อน แล้วกดยืนยันว่าโอนแล้ว' },
    { icon: '⏳', text: 'ร้านจะตรวจสอบและยืนยันออเดอร์ให้เร็วที่สุด (ยังไม่เข้าคิวอบจนกว่าร้านจะยืนยัน)' },
    { icon: '💬', text: 'มีปัญหาหรือข้อสงสัยระหว่างสั่ง ทักไลน์ร้านได้ทันทีจากปุ่มด้านบน' },
  ]
  const { closing, requestClose } = useClosingTransition(onClose)
  return (
    <div className={'fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}>
      <div className={'bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 text-center ' + (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')}>
        <p className="text-4xl">💡</p>
        <h2 className="text-lg font-display font-semibold text-stone-900">วิธีสั่งซื้อจากหน้านี้</h2>
        <div className="space-y-2.5 text-left">
          {items.map((it, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-stone-600">
              <span className="text-lg shrink-0">{it.icon}</span>
              <span>{it.text}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={requestClose} className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm">
          เข้าใจแล้ว เริ่มเลือกเมนู
        </button>
      </div>
    </div>
  )
}

/** ปุ่มติดต่อไลน์ร้าน — โชว์ทุกขั้นตอนของการสั่งซื้อ เผื่อลูกค้าติดปัญหาระหว่างทาง */
function LineContactButton({ lineUrl }: { lineUrl: string | null }) {
  if (!lineUrl) return null
  return (
    <a
      href={lineUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full rounded-xl border border-[#06C755] text-[#06C755] font-medium py-2.5 text-sm bg-white"
    >
      💬 พบปัญหา? ติดต่อที่นี่
    </a>
  )
}

/** ป็อปอัพเตือนแอดไลน์ก่อนพาไปหน้าติดตามออเดอร์ — สำคัญมาก เพราะร้านแจ้งเลขที่ออเดอร์/อัปเดตสถานะ/เลขพัสดุ
 * ผ่านไลน์เป็นหลัก (ลูกค้าสั่งเองไม่ได้กรอกอีเมลไว้เลย ไม่มีช่องทางอื่นให้ติดต่อกลับ) ตั้งใจไม่ให้มีปุ่มปิดเลยใน
 * ช่วงแรก บังคับรอครบ 7 วินาทีก่อนถึงจะกดปิดได้ กันลูกค้ากดปิดข้ามเร็วเกินไปโดยไม่ทันอ่าน */
function AddLineReminderPopup({ lineUrl, onClose }: { lineUrl: string | null; onClose: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(7)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft])

  return (
    <div className="fixed inset-0 bg-black/70 grid place-items-center p-4 z-50 animate-overlay-fade">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-toast-pop">
        <div className="text-5xl animate-icon-pop">📣</div>
        <h2 className="text-lg font-bold text-stone-900">สำคัญมาก! กรุณาแอดไลน์ร้าน</h2>
        <p className="text-sm text-stone-600">
          ร้านจะแจ้งเลขที่ออเดอร์ อัปเดตสถานะงาน และ (ถ้าเลือกส่งขนส่ง) เลขพัสดุให้ทราบผ่านไลน์เป็นหลัก
          กรุณาแอดไลน์ร้านไว้ก่อน ไม่งั้นอาจพลาดข้อมูลสำคัญของออเดอร์นี้
        </p>
        {lineUrl ? (
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#06C755] text-white font-semibold py-3 text-sm"
          >
            💬 แอดไลน์ร้านตอนนี้เลย
          </a>
        ) : (
          <p className="text-sm text-red-600">ร้านยังไม่ได้ตั้งค่าลิงก์ไลน์ไว้ ติดต่อร้านโดยตรงแทนได้เลย</p>
        )}
        {secondsLeft > 0 ? (
          <p className="text-xs text-stone-400">ปุ่มปิดจะขึ้นใน {secondsLeft} วินาที...</p>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-stone-300 text-stone-600 py-2.5 text-sm font-medium"
          >
            ปิด แล้วไปหน้าติดตามออเดอร์
          </button>
        )}
      </div>
    </div>
  )
}

/** สรุปรายการที่สั่งแบบละเอียด (ชื่อ/จำนวน/ราคาต่อชิ้น/รวม) — ใช้ทั้งหน้ากรอกข้อมูลรับของและหน้าชำระเงิน
 * กันลูกค้ากดสั่งไปโดยไม่เคยเห็นรายการที่เลือกไว้ครบๆ เลยสักครั้ง (หน้าตะกร้าเดิมเห็นทีละชิ้นปนอยู่ในกริดสินค้า) */
function CartSummaryList({ items, grandTotal }: { items: CartItem[]; grandTotal: number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
      <h2 className="text-sm font-semibold text-stone-600">รายการที่สั่ง ({items.length})</h2>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.product_id} className="flex justify-between text-sm">
            <span className="text-stone-700">
              {it.product_name} <span className="text-stone-400">x{it.qty} {it.unit}</span>
            </span>
            <span className="tabular-nums">{formatBaht(it.unit_price * it.qty)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2">
        <span>ยอดรวม</span>
        <span className="tabular-nums">{formatBaht(grandTotal)} บาท</span>
      </div>
    </div>
  )
}

export function CustomerOrderPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: SiteTab = searchParams.get('tab') === 'about' ? 'about' : 'menu'
  const [menu, setMenu] = useState<PublicMenu | null | undefined>(undefined)
  const [step, setStep] = useState<Step>('menu')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>(() => loadFormDraft<CartItem[]>(CART_DRAFT_KEY) ?? [])
  const [form, setForm] = useState<CheckoutForm>(() => loadFormDraft<CheckoutForm>(CHECKOUT_DRAFT_KEY) ?? emptyCheckout)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedTotal, setSubmittedTotal] = useState(0)
  const [paymentSuccessVisible, setPaymentSuccessVisible] = useState(false)
  const [showLineReminder, setShowLineReminder] = useState(false)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [cartBumping, setCartBumping] = useState(false)
  const [manualHowTo, setManualHowTo] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [showRememberPopup, setShowRememberPopup] = useState(false)
  const [splashActive, setSplashActive] = useState(true)
  const cartFabRef = useRef<HTMLButtonElement>(null)

  function setTab(next: SiteTab) {
    setSearchParams(next === 'menu' ? {} : { tab: 'about' }, { replace: true })
  }

  useFormDraft(CART_DRAFT_KEY, items)
  useFormDraft(CHECKOUT_DRAFT_KEY, form)

  useEffect(() => {
    getPublicMenu().then(({ menu, error }) => setMenu(error ? null : menu))
  }, [])

  // โลโก้เต็มจอตอนเปิดหน้าครั้งแรก ค้างไว้สั้นๆ แล้วหดเล็กจางหายไป (ดู .animate-splash-shrink ใน index.css)
  // เผยหน้าเว็บที่เตรียมพร้อมอยู่แล้วด้านหลัง (hero เล่นอนิเมชันของตัวเองคู่ขนานอยู่แล้วใต้โลโก้)
  useEffect(() => {
    if (!menu || !splashActive) return
    const t = setTimeout(() => setSplashActive(false), 1100)
    return () => clearTimeout(t)
  }, [menu, splashActive])

  const filtered = useMemo(() => {
    if (!menu) return []
    const q = search.toLowerCase()
    return menu.products.filter((p) => p.name.toLowerCase().includes(q) && (!categoryId || p.category_id === categoryId))
  }, [menu, search, categoryId])

  // รูปสินค้าจริงชิ้นแรกที่มีรูป ใช้เป็นการ์ดลอยตกแต่ง hero (แทนที่จะมีแต่โลโก้กลมเล็กๆ ลอยเดี่ยวๆ) — ไม่โชว์เลย
  // ถ้าร้านยังไม่มีรูปสินค้าเลยสักชิ้น กันพังไม่มีอะไรให้โชว์
  const heroProductImage = useMemo(() => {
    const withImage = menu?.products.find((p) => p.image_path)
    return withImage ? productImageUrl(withImage.image_path!) : null
  }, [menu])

  const grandTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  // นัดรับเองไม่ควรบังคับรอนานเท่าส่งขนส่ง (shipping_lead_days คือเวลาเตรียมของ+เผื่อขนส่งเฉพาะเคสส่งพัสดุ) —
  // ระบบเดิม (ก่อนแก้) ใช้ shipping_lead_days บังคับกับ "นัดรับเอง" ด้วย ทำให้ลูกค้ามารับหน้าร้านต้องรอนานเกินจำเป็น
  // ต่างจากฝั่งพนักงาน (Step3Fulfillment.tsx) ที่ใช้ lead time เฉพาะตอนส่งขนส่งเท่านั้น จึงปรับให้ตรงกัน
  const minNeededDate = menu
    ? addDays(todayStr(), form.fulfillmentType === 'shipping' ? menu.shipping_lead_days : 1)
    : todayStr()

  function addProduct(p: PublicMenu['products'][number], sourceEl: HTMLElement | null) {
    // เล่นเสียงเป็นบรรทัดแรกสุดเสมอ ก่อน setState ใดๆ — iOS Safari ต้องมี user gesture อยู่ใน call stack
    // เดียวกันตอนสร้าง AudioContext ครั้งแรก (เหมือน POSPage.tsx)
    playAddSound()
    setJustAddedId(p.id)
    setTimeout(() => setJustAddedId((cur) => (cur === p.id ? null : cur)), 300)

    // อนิเมชันสินค้าบินโค้งเข้าตะกร้าจริงๆ แทนที่จะมีอะไรโผล่ตรงกลางจอ — ดู flyToCart ใน PublicSiteChrome.tsx
    if (sourceEl && cartFabRef.current) {
      flyToCart(sourceEl, cartFabRef.current, p.image_path ? '🧁' : '🧁')
      setTimeout(() => {
        setCartBumping(true)
        setTimeout(() => setCartBumping(false), 300)
      }, 550)
    }

    const existingIndex = items.findIndex((it) => it.product_id === p.id)
    if (existingIndex >= 0) {
      setItems((rows) => rows.map((r, i) => (i === existingIndex ? { ...r, qty: r.qty + 1 } : r)))
      return
    }
    setItems((rows) => [...rows, { product_id: p.id, product_name: p.name, unit_price: p.price, unit: p.unit, qty: 1 }])
  }

  function updateQty(index: number, qty: number) {
    if (qty <= 0) {
      setItems((rows) => rows.filter((_, i) => i !== index))
      return
    }
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, qty } : r)))
  }

  function handleCheckoutSubmit(e: FormEvent) {
    e.preventDefault()
    // ยังไม่ไปหน้าชำระเงินทันที — บังคับเตือนให้จำชื่อผู้รับ/ผู้สั่งซื้อก่อนเสมอ (ดู RememberNamePopup)
    // เพราะเป็นสิ่งเดียวที่ใช้ยืนยันตัวตนตอนเข้าดูสถานะออเดอร์ทีหลัง
    setShowRememberPopup(true)
  }

  function handleRememberConfirmed() {
    setShowRememberPopup(false)
    setStep('payment')
  }

  async function handleConfirmPayment() {
    // เล่นเสียงเป็นบรรทัดแรกสุดเสมอ ก่อน await ใดๆ — เหตุผลเดียวกับ playAddSound ด้านบน
    playPaymentSound()
    setSubmitting(true)
    setError(null)
    const { orderId, publicToken, error: submitError } = await submitCustomerOrder({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      fulfillmentType: form.fulfillmentType,
      neededDate: form.neededDate,
      pickupPlace: form.fulfillmentType === 'pickup' ? form.pickupPlace || null : null,
      pickupTime: form.fulfillmentType === 'pickup' ? form.pickupTime || null : null,
      // ผู้รับของคือคนสั่งซื้อเอง (ระบบสั่งเองไม่มีช่องแยกกรอกชื่อ/เบอร์ผู้รับต่างหาก) — ซิงค์จากข้อมูล
      // ผู้สั่งซื้อโดยตรงเสมอ กันเคสเดิมที่ค่านี้ไม่เคยถูกตั้งเลยเพราะไม่มี input ให้กรอก
      shipRecipientName: form.fulfillmentType === 'shipping' ? form.customerName : null,
      shipRecipientPhone: form.fulfillmentType === 'shipping' ? form.customerPhone : null,
      shipAddressText: form.fulfillmentType === 'shipping' ? form.shipAddressText || null : null,
      note: form.note || null,
      items: items.map((it) => ({ product_id: it.product_id, qty: it.qty })),
      turnstileToken: turnstileToken!,
    })
    if (submitError || !orderId || !publicToken) {
      setSubmitting(false)
      setError(submitError ?? 'ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่')
      return
    }
    void notifyCustomerOrder(orderId)
    // ออเดอร์ที่ลูกค้าส่งเองยังเป็น is_draft=true อยู่จนกว่าร้านจะกดยืนยัน — get_public_order เปิดช่องพิเศษให้
    // ออเดอร์ order_source='customer' ดูได้แม้ยังไม่ยืนยัน (แสดงเป็นสถานะ "รอร้านตรวจสอบและยืนยัน") จึงพาไปหน้า
    // ติดตามออเดอร์จริงได้เลยหลังปิดป็อปอัพเตือนแอดไลน์ ไม่ต้องรอร้านยืนยันก่อนเหมือนที่เคยเป็น
    setSubmittedTotal(grandTotal)
    setPendingToken(publicToken)
    clearFormDraft(CART_DRAFT_KEY)
    clearFormDraft(CHECKOUT_DRAFT_KEY)
    setItems([])
    setForm(emptyCheckout)
    setSubmitting(false)
    setPaymentSuccessVisible(true)
  }

  function handlePaymentSuccessDone() {
    setPaymentSuccessVisible(false)
    if (menu?.line_url) {
      setShowLineReminder(true)
    } else if (pendingToken) {
      navigate(`/o/${pendingToken}`)
    }
  }

  function handleLineReminderClose() {
    setShowLineReminder(false)
    if (pendingToken) navigate(`/o/${pendingToken}`)
  }

  function goToMenuAndScroll() {
    setTab('menu')
    requestAnimationFrame(() => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' }))
  }

  if (menu === undefined) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center space-y-3 font-warm">
        <div className="text-4xl animate-icon-pop">🧁</div>
        <p className="text-stone-500">กำลังโหลดเมนู...</p>
      </div>
    )
  }
  if (menu === null) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center font-warm">
        <p className="text-stone-500">โหลดเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="min-h-screen bg-stone-50 p-4 animate-page-in font-warm">
        <div className="max-w-md mx-auto space-y-4">
          <BackButton onClick={() => setStep('menu')}>← แก้ไขตะกร้า</BackButton>
          <h1 className="text-lg font-display font-semibold">ทวนรายการที่สั่ง</h1>

          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-6 text-center text-sm text-stone-500 animate-form-in">
              ตะกร้าว่างเปล่า กลับไปเลือกสินค้ากันก่อนนะ
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-4 space-y-3 animate-form-in">
              {items.map((it, i) => (
                <div
                  key={it.product_id}
                  className="flex items-center justify-between gap-3 pb-3 border-b border-stone-100 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{it.product_name}</p>
                    <p className="text-xs text-stone-400">{formatBaht(it.unit_price)} บาท/{it.unit}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button" onClick={() => updateQty(i, it.qty - 1)}
                      className="w-7 h-7 rounded-full bg-stone-100 font-semibold"
                    >
                      −
                    </button>
                    <span className="text-sm font-medium tabular-nums w-4 text-center">{it.qty}</span>
                    <button
                      type="button" onClick={() => updateQty(i, it.qty + 1)}
                      className="w-7 h-7 rounded-full bg-stone-100 font-semibold"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm font-semibold tabular-nums w-16 text-right shrink-0">
                    {formatBaht(it.unit_price * it.qty)}
                  </p>
                </div>
              ))}
              <div className="flex justify-between text-base font-bold pt-1">
                <span>ยอดรวม</span>
                <span className="tabular-nums">{formatBaht(grandTotal)} บาท</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep('checkout')}
            disabled={items.length === 0}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-40"
          >
            ยืนยันรายการ ไปกรอกที่อยู่ →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-stone-50 p-4 animate-page-in font-warm">
        <div className="max-w-md mx-auto space-y-4">
          <BackButton onClick={() => setStep('review')}>← กลับไปทวนรายการ</BackButton>
          <h1 className="text-lg font-display font-semibold">กรอกข้อมูลรับของ</h1>
          <CartSummaryList items={items} grandTotal={grandTotal} />
          <form onSubmit={handleCheckoutSubmit} className="space-y-4 bg-white rounded-2xl shadow-sm p-5 animate-form-in">
            <div className="space-y-1">
              <label htmlFor="customerName" className="text-sm text-stone-600">ชื่อผู้สั่งซื้อ</label>
              <input
                id="customerName" required value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="customerPhone" className="text-sm text-stone-600">เบอร์โทรศัพท์</label>
              <input
                id="customerPhone" required type="tel" value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="customerEmail" className="text-sm text-stone-600">อีเมล (ใช้แจ้งรับออเดอร์/แจ้งชำระเงิน)</label>
              <input
                id="customerEmail" required type="email" value={form.customerEmail}
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="fulfillmentType" className="text-sm text-stone-600">วิธีรับของ</label>
              <select
                id="fulfillmentType" value={form.fulfillmentType}
                onChange={(e) => setForm((f) => ({ ...f, fulfillmentType: e.target.value as 'pickup' | 'shipping' }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              >
                <option value="pickup">นัดรับเอง</option>
                <option value="shipping">ส่งไปรษณีย์/ขนส่ง</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="neededDate" className="text-sm text-stone-600">วันที่สะดวกนัดรับ</label>
              <input
                id="neededDate" required type="date" min={minNeededDate} value={form.neededDate}
                onChange={(e) => setForm((f) => ({ ...f, neededDate: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              />
              <p className="text-xs text-stone-400">สั่งล่วงหน้าอย่างน้อย {menu.shipping_lead_days} วัน</p>
            </div>

            {form.fulfillmentType === 'pickup' ? (
              <div className="space-y-1">
                <label htmlFor="pickupTime" className="text-sm text-stone-600">เวลาที่สะดวกมารับ (ถ้ามี)</label>
                <input
                  id="pickupTime" value={form.pickupTime}
                  onChange={(e) => setForm((f) => ({ ...f, pickupTime: e.target.value }))}
                  placeholder="เช่น 10:00" className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="shipAddressText" className="text-sm text-stone-600">ที่อยู่จัดส่ง</label>
                  <textarea
                    id="shipAddressText" required value={form.shipAddressText}
                    onChange={(e) => setForm((f) => ({ ...f, shipAddressText: e.target.value }))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2.5" rows={3}
                  />
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 space-y-1.5">
                  <p>💰 ตอนนี้จ่ายแค่ค่าสินค้าก่อน ค่าส่งจริงร้านจะแจ้งแยกให้ทราบภายหลัง</p>
                  <p>
                    📦 การจัดส่งทางไปรษณีย์ปกติใช้เวลาประมาณ 1-3 วัน ตามช่วงเวลาและเทศกาล เมื่อจัดส่งเรียบร้อย
                    ร้านจะแจ้งเลขพัสดุให้ทราบทางไลน์ — โปรดแอดไลน์ร้านไว้ก่อน
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="note" className="text-sm text-stone-600">หมายเหตุ (ถ้ามี)</label>
              <textarea
                id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5" rows={2}
              />
            </div>

            <TurnstileWidget onToken={setTurnstileToken} />

            {menu.promptpay ? (
              <button
                type="submit"
                disabled={!turnstileToken}
                className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-40"
              >
                ไปหน้าชำระเงิน →
              </button>
            ) : (
              <p className="text-sm text-red-600 text-center">ร้านยังไม่เปิดรับสั่งซื้อออนไลน์ตอนนี้ กรุณาติดต่อร้านโดยตรง</p>
            )}
          </form>
          <LineContactButton lineUrl={menu.line_url} />
        </div>

        {showRememberPopup && <RememberNamePopup onConfirm={handleRememberConfirmed} />}
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-stone-50 p-4 animate-page-in font-warm">
        <div className="max-w-md mx-auto space-y-4">
          <BackButton onClick={() => setStep('checkout')}>← กลับไปแก้ข้อมูล</BackButton>
          <div className="rounded-2xl bg-stone-900 text-white p-5 text-center">
            <p className="text-sm text-stone-300">ยอดที่ต้องชำระ</p>
            <p className="text-4xl font-bold tabular-nums">{formatBaht(grandTotal)}</p>
            <p className="text-sm text-stone-300">บาท</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            {menu.promptpay && <PromptPayQR promptpayId={menu.promptpay} amount={grandTotal} />}
          </div>
          <p className="text-xs text-stone-500 text-center">
            สแกนจ่ายเงินก่อน แล้วกดปุ่มด้านล่างเพื่อส่งคำสั่งซื้อ — ร้านจะตรวจสอบและยืนยันออเดอร์ให้เร็วที่สุด
          </p>
          <CartSummaryList items={items} grandTotal={grandTotal} />
          <button
            type="button"
            onClick={() => void handleConfirmPayment()}
            disabled={submitting || paymentSuccessVisible || showLineReminder}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-40"
          >
            {submitting ? 'กำลังส่งคำสั่งซื้อ...' : '✅ ฉันโอนเงินแล้ว ส่งคำสั่งซื้อ'}
          </button>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <LineContactButton lineUrl={menu.line_url} />
        </div>

        {paymentSuccessVisible && (
          <SuccessOverlay
            message="ยืนยันการชำระเงินเสร็จสิ้น ✅"
            submessage={`ส่งคำสั่งซื้อยอด ${formatBaht(submittedTotal)} บาท เรียบร้อยแล้ว`}
            onDone={handlePaymentSuccessDone}
            durationMs={1800}
          />
        )}
        {showLineReminder && <AddLineReminderPopup lineUrl={menu.line_url} onClose={handleLineReminderClose} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16 font-warm">
      <PageTexture />
      <PublicNav
        shopName={menu.shop_name}
        logoPath={menu.logo_path}
        activeTab={tab}
        onTabChange={setTab}
        onHowToClick={() => setManualHowTo(true)}
      />

      {splashActive && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-brand-shader" aria-hidden="true">
          {menu.logo_path ? (
            <img
              src={productImageUrl(menu.logo_path)}
              alt=""
              className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover border-4 animate-splash-shrink"
              style={{ borderColor: 'rgba(255,255,255,0.4)' }}
            />
          ) : (
            <div className="text-8xl animate-splash-shrink">🧁</div>
          )}
        </div>
      )}

      {/* Hero — คงอยู่เหนือทั้ง 2 แท็บเสมอ (แบรนด์หลักของหน้า) ไล่สีเข้ากับเนื้อหาด้านล่างด้วยขอบคลื่น (WaveDivider)
          แทนตัดพรวดเป็นเส้นตรง + มีแสงอุ่นเคลื่อนไหวช้าๆ ตลอดเวลา (AmbientGlow) ให้ดูมีชีวิตกว่า gradient นิ่งๆ
          เลย์เอาต์แบบ 2 คอลัมน์บนจอกว้าง (ข้อความ+ปุ่ม ซ้าย / การ์ดรูปสินค้าลอยเอียงเล็กน้อย ขวา) แทนแบบ
          จัดกลางเรียงต่อกันทื่อๆ (ดู Linktree) ให้ความรู้สึกเว็บไซต์แบรนด์จริงจังกว่า — ปุ่ม "ดูเมนู สั่งเลย"
          เป็น CTA หลักตัวเดียวที่เด่นที่สุดในหน้า (bg-stone-900 ใหญ่กว่า) ส่วนไลน์/โทรเป็นแค่ทางเลือกรอง */}
      <div className="relative overflow-hidden animate-form-in bg-brand-shader">
        <AmbientGlow />
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 pb-10 md:py-20 md:flex md:items-center md:gap-12">
          <div className="text-center md:text-left md:flex-1">
            {menu.logo_path && (
              <img
                src={productImageUrl(menu.logo_path)}
                alt=""
                className="w-24 h-24 rounded-full object-cover mx-auto md:mx-0 border-2 animate-icon-pop"
                style={{ borderColor: 'rgba(255,255,255,0.4)' }}
              />
            )}
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white mt-4 leading-tight">{menu.shop_name}</h1>
            <SquiggleUnderline className="w-20 h-2.5 mx-auto md:mx-0 mt-1.5 text-white/40" />
            <p className="text-sm md:text-base mt-2.5 max-w-md mx-auto md:mx-0" style={{ color: 'rgba(255,255,255,0.85)' }}>
              หวานน้อย อร่อยแน่ ไม่เหมือนใคร — ทำมือทุกชิ้นโดยเด็กอายุ 13 ปี
            </p>

            <div className="mt-6">
              {tab === 'about' ? (
                <button
                  type="button"
                  onClick={goToMenuAndScroll}
                  className="inline-block rounded-2xl bg-stone-900 text-white font-semibold px-8 py-3.5 text-base shadow-[0_10px_28px_-8px_rgb(0_0_0_/_0.5)]"
                >
                  🛒 ดูเมนู สั่งเลย
                </button>
              ) : (
                <a
                  href="#menu-section"
                  className="inline-block rounded-2xl bg-stone-900 text-white font-semibold px-8 py-3.5 text-base shadow-[0_10px_28px_-8px_rgb(0_0_0_/_0.5)]"
                >
                  🛒 ดูเมนู สั่งเลย
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4">
              {menu.line_url && (
                <a
                  href={menu.line_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  💬 แอดไลน์ร้าน
                </a>
              )}
              {menu.phone && (
                <a
                  href={`tel:${menu.phone}`}
                  className="flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  📞 {menu.phone}
                </a>
              )}
            </div>
          </div>

          {heroProductImage && (
            <div className="hidden md:block md:flex-1">
              <div className="max-w-xs ml-auto rounded-3xl overflow-hidden border-4 border-white/20 shadow-[0_24px_60px_-16px_rgb(0_0_0_/_0.55)] rotate-3 transition-transform hover:rotate-0 duration-500">
                <img src={heroProductImage} alt="" className="w-full aspect-square object-cover" />
              </div>
            </div>
          )}
        </div>
        <WaveDivider />
      </div>

      {/* สลับเนื้อหาด้วยแท็บล้วนๆ ไม่เปลี่ยนหน้าเว็บจริง (ไม่ remount ทั้งหน้า ไม่กระพริบ) key={tab} ทำให้เล่น
          อนิเมชัน crossfade ใหม่ทุกครั้งที่สลับแท็บ */}
      {tab === 'menu' ? (
        <div key="menu" className="max-w-5xl mx-auto px-4 mt-6 space-y-6 animate-form-in">
          <Reveal as="section" id="menu-section" className="space-y-4 scroll-mt-24">
            <h2 className="text-lg font-display font-semibold text-stone-900 text-center">เมนูสินค้า</h2>

            <LineContactButton lineUrl={menu.line_url} />

            <input
              placeholder="ค้นหาสินค้า" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button" onClick={() => setCategoryId(null)}
                className={'rounded-full px-3 py-1.5 text-sm ' + (!categoryId ? 'bg-stone-900 text-white' : 'bg-stone-100')}
              >
                ทั้งหมด
              </button>
              {menu.categories.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => setCategoryId(c.id)}
                  className={'rounded-full px-3 py-1.5 text-sm ' + (categoryId === c.id ? 'bg-stone-900 text-white' : 'bg-stone-100')}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((p) => {
                const inCart = items.find((it) => it.product_id === p.id)
                return (
                  <div
                    key={p.id}
                    className={'rounded-xl border border-stone-200/70 bg-white overflow-hidden shadow-[0_2px_10px_-6px_rgb(51_32_14_/_0.18)] transition-all duration-300 md:hover:-translate-y-1 md:hover:shadow-[0_16px_28px_-10px_rgb(51_32_14_/_0.35)]' + (p.id === justAddedId ? ' animate-cart-bump' : '')}
                  >
                    <div className="aspect-square bg-stone-100 grid place-items-center text-stone-300 text-xs">
                      {p.image_path ? (
                        <img src={productImageUrl(p.image_path)} alt={p.name} className="w-full h-full object-cover" />
                      ) : 'ไม่มีรูป'}
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-sm text-stone-900">{formatBaht(p.price)} บาท <span className="text-xs text-stone-400">/{p.unit}</span></p>
                      {inCart ? (
                        <div className="flex items-center justify-between">
                          <button
                            type="button" onClick={() => updateQty(items.indexOf(inCart), inCart.qty - 1)}
                            className="w-7 h-7 rounded-full bg-stone-100 font-semibold"
                          >
                            −
                          </button>
                          <span className="text-sm font-medium tabular-nums">{inCart.qty}</span>
                          <button
                            type="button" onClick={() => updateQty(items.indexOf(inCart), inCart.qty + 1)}
                            className="w-7 h-7 rounded-full bg-stone-100 font-semibold"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button" onClick={(e) => addProduct(p, e.currentTarget)}
                          className="w-full rounded-lg bg-stone-900 text-white text-sm py-1.5"
                        >
                          เพิ่มลงตะกร้า
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && <p className="col-span-full text-center text-sm text-stone-400 py-8">ไม่พบสินค้า</p>}
            </div>
          </Reveal>
        </div>
      ) : (
        <div key="about" className="mt-6 animate-form-in">
          <AboutTabContent onGoToMenu={() => setTab('menu')} />
        </div>
      )}

      <PublicFooter
        shopName={menu.shop_name}
        address={menu.address}
        phone={menu.phone}
        lineUrl={menu.line_url}
        activeTab={tab}
        onTabChange={setTab}
      />

      <CartFab ref={cartFabRef} count={items.length} total={grandTotal} bumping={cartBumping} onClick={() => setStep('review')} />

      {manualHowTo && <HowToUsePopup onClose={() => setManualHowTo(false)} />}
    </div>
  )
}
