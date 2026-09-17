import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicMenu, submitCustomerOrder, notifyCustomerOrder, type PublicMenu } from '../lib/publicMenuApi'
import { productImageUrl } from '../products/ProductCard'
import { formatBaht } from '../lib/money'
import { addDays } from '../lib/dates'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { playAddSound, playPaymentSound } from '../lib/uiSound'
import { SuccessOverlay } from '../lib/SuccessOverlay'
import { PromptPayQR } from './PromptPayQR'

type Step = 'menu' | 'checkout' | 'payment'

type CartItem = { product_id: string; product_name: string; unit_price: number; unit: string; qty: number }

type CheckoutForm = {
  customerName: string
  customerPhone: string
  fulfillmentType: 'pickup' | 'shipping'
  neededDate: string
  pickupPlace: string
  pickupTime: string
  shipRecipientName: string
  shipRecipientPhone: string
  shipAddressText: string
  note: string
}

const CART_DRAFT_KEY = 'public-menu-cart'
const CHECKOUT_DRAFT_KEY = 'public-menu-checkout'

const emptyCheckout: CheckoutForm = {
  customerName: '', customerPhone: '', fulfillmentType: 'pickup', neededDate: '',
  pickupPlace: '', pickupTime: '', shipRecipientName: '', shipRecipientPhone: '', shipAddressText: '', note: '',
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

/** ของตกแต่งลอยเบาๆ อยู่หลังเนื้อหาทั้งหมด (aria-hidden, ไม่กันคลิก) — เหมือนหน้าติดตามออเดอร์ (/o/:token) */
function FloatingDecor() {
  const items: { icon: string; style: CSSProperties }[] = [
    { icon: '🥐', style: { top: '8%', left: '6%' } },
    { icon: '🧁', style: { top: '18%', right: '8%', animationDelay: '1.5s' } },
    { icon: '🍪', style: { bottom: '18%', left: '10%', animationDelay: '3s' } },
    { icon: '✨', style: { bottom: '32%', right: '12%', animationDelay: '0.8s' } },
  ]
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {items.map((it, i) => (
        <span key={i} className="absolute text-4xl opacity-10 animate-float-slow" style={it.style}>
          {it.icon}
        </span>
      ))}
    </div>
  )
}

/** ป็อปอัพแนะนำร้าน โชว์ก่อนอันอื่นเสมอตอนเข้าหน้านี้ครั้งแรก — เนื้อหาเดียวกับหน้าติดตามออเดอร์ (/o/:token) */
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
            สั่งของจากหน้านี้ได้เลย เลือกสินค้าที่ชอบ กรอกข้อมูลรับของ แล้วโอนเงินผ่าน QR พร้อมเพย์ ร้านจะตรวจสอบและยืนยันออเดอร์ให้เร็วที่สุด
          </p>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={requestClose}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm"
          >
            เริ่มเลือกเมนูกันเลย
          </button>
        </div>
      </div>
    </div>
  )
}

/** ป็อปอัพสอนวิธีใช้งานหน้านี้ โชว์ต่อจากป็อปอัพแนะนำร้านเสมอ เปิดซ้ำเองได้ทุกเมื่อ */
function HowToUsePopup({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: '🛒', text: 'เลือกสินค้าที่ต้องการ ปรับจำนวนแล้วกด "สั่งเลย" ด้านล่างได้ทันที' },
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
        <h2 className="text-lg font-bold text-stone-900">วิธีสั่งซื้อจากหน้านี้</h2>
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
  const [aboutPopupDismissed, setAboutPopupDismissed] = useState(false)
  const [howToPopupDismissed, setHowToPopupDismissed] = useState(false)
  const [manualHowTo, setManualHowTo] = useState(false)

  useFormDraft(CART_DRAFT_KEY, items)
  useFormDraft(CHECKOUT_DRAFT_KEY, form)

  useEffect(() => {
    getPublicMenu().then(({ menu, error }) => setMenu(error ? null : menu))
  }, [])

  const filtered = useMemo(() => {
    if (!menu) return []
    const q = search.toLowerCase()
    return menu.products.filter((p) => p.name.toLowerCase().includes(q) && (!categoryId || p.category_id === categoryId))
  }, [menu, search, categoryId])

  const grandTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  // นัดรับเองไม่ควรบังคับรอนานเท่าส่งขนส่ง (shipping_lead_days คือเวลาเตรียมของ+เผื่อขนส่งเฉพาะเคสส่งพัสดุ) —
  // ระบบเดิม (ก่อนแก้) ใช้ shipping_lead_days บังคับกับ "นัดรับเอง" ด้วย ทำให้ลูกค้ามารับหน้าร้านต้องรอนานเกินจำเป็น
  // ต่างจากฝั่งพนักงาน (Step3Fulfillment.tsx) ที่ใช้ lead time เฉพาะตอนส่งขนส่งเท่านั้น จึงปรับให้ตรงกัน
  const minNeededDate = menu
    ? addDays(todayStr(), form.fulfillmentType === 'shipping' ? menu.shipping_lead_days : 1)
    : todayStr()

  function addProduct(p: PublicMenu['products'][number]) {
    // เล่นเสียงเป็นบรรทัดแรกสุดเสมอ ก่อน setState ใดๆ — iOS Safari ต้องมี user gesture อยู่ใน call stack
    // เดียวกันตอนสร้าง AudioContext ครั้งแรก (เหมือน POSPage.tsx)
    playAddSound()
    setJustAddedId(p.id)
    setTimeout(() => setJustAddedId((cur) => (cur === p.id ? null : cur)), 300)

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
      fulfillmentType: form.fulfillmentType,
      neededDate: form.neededDate,
      pickupPlace: form.fulfillmentType === 'pickup' ? form.pickupPlace || null : null,
      pickupTime: form.fulfillmentType === 'pickup' ? form.pickupTime || null : null,
      shipRecipientName: form.fulfillmentType === 'shipping' ? form.shipRecipientName || null : null,
      shipRecipientPhone: form.fulfillmentType === 'shipping' ? form.shipRecipientPhone || null : null,
      shipAddressText: form.fulfillmentType === 'shipping' ? form.shipAddressText || null : null,
      note: form.note || null,
      items: items.map((it) => ({ product_id: it.product_id, qty: it.qty })),
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

  if (menu === undefined) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center space-y-3">
        <div className="text-4xl animate-icon-pop">🧁</div>
        <p className="text-stone-500">กำลังโหลดเมนู...</p>
      </div>
    )
  }
  if (menu === null) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center">
        <p className="text-stone-500">โหลดเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
      </div>
    )
  }

  // ป็อปอัพวิธีใช้งานโผล่เองครั้งแรกตามลำดับ onboarding (ต่อจากป็อปอัพแนะนำร้าน) หรือเปิดซ้ำเองได้ทุกเมื่อ
  // จากปุ่ม "วิธีสั่งซื้อจากหน้านี้" — ปิดแล้วต้องเคลียร์ทั้งสองทางเสมอ กันเปิดค้างจากอีกทางนึงโดยไม่ตั้งใจ
  const showHowTo = (aboutPopupDismissed && !howToPopupDismissed) || manualHowTo
  function closeHowTo() {
    setManualHowTo(false)
    if (!howToPopupDismissed) setHowToPopupDismissed(true)
  }

  const onboardingPopups = (
    <>
      {!aboutPopupDismissed ? (
        <AboutShopPopup shopName={menu.shop_name} logoPath={menu.logo_path} onClose={() => setAboutPopupDismissed(true)} />
      ) : (
        showHowTo && <HowToUsePopup onClose={closeHowTo} />
      )}
    </>
  )

  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-stone-50 p-4 animate-page-in">
        <div className="max-w-md mx-auto space-y-4">
          <button type="button" onClick={() => setStep('menu')} className="text-sm text-stone-600 underline">
            ← กลับไปแก้ตะกร้า
          </button>
          <h1 className="text-lg font-bold">กรอกข้อมูลรับของ</h1>
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

            {menu.promptpay ? (
              <button type="submit" className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3">
                ไปหน้าชำระเงิน →
              </button>
            ) : (
              <p className="text-sm text-red-600 text-center">ร้านยังไม่เปิดรับสั่งซื้อออนไลน์ตอนนี้ กรุณาติดต่อร้านโดยตรง</p>
            )}
          </form>
          <LineContactButton lineUrl={menu.line_url} />
        </div>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-stone-50 p-4 animate-page-in">
        <div className="max-w-md mx-auto space-y-4">
          <button type="button" onClick={() => setStep('checkout')} className="text-sm text-stone-600 underline">
            ← กลับไปแก้ข้อมูล
          </button>
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
    <div className="min-h-screen bg-stone-50 p-4 pb-28 animate-page-in">
      <FloatingDecor />
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="text-center pt-2 space-y-1">
          {menu.logo_path && (
            <img src={productImageUrl(menu.logo_path)} alt="" className="w-16 h-16 rounded-full object-cover mx-auto border border-stone-200" />
          )}
          <h1 className="text-xl font-bold">{menu.shop_name}</h1>
          <p className="text-sm text-stone-500">เลือกสินค้าแล้วกดสั่งได้เลย</p>
          <button
            type="button"
            onClick={() => setManualHowTo(true)}
            className="text-xs text-stone-500 underline underline-offset-2 mt-1"
          >
            💡 วิธีสั่งซื้อจากหน้านี้
          </button>
        </div>

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
                className={'rounded-xl border border-stone-200 bg-white overflow-hidden' + (p.id === justAddedId ? ' animate-cart-bump' : '')}
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
                      type="button" onClick={() => addProduct(p)}
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
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 p-3">
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <div>
              <p className="text-xs text-stone-500">ยอดรวม ({items.length} รายการ)</p>
              <p className="text-xl font-bold text-stone-900">{formatBaht(grandTotal)} บาท</p>
            </div>
            <button
              type="button" onClick={() => setStep('checkout')}
              className="rounded-xl bg-stone-900 text-white font-semibold px-6 py-3"
            >
              สั่งเลย →
            </button>
          </div>
        </div>
      )}

      {onboardingPopups}
    </div>
  )
}
