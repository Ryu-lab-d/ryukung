import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPublicMenu, submitCustomerOrder, notifyCustomerOrder, type PublicMenu } from '../lib/publicMenuApi'
import { productImageUrl } from '../products/ProductCard'
import { formatBaht } from '../lib/money'
import { addDays } from '../lib/dates'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { playAddSound, playPaymentSound } from '../lib/uiSound'
import { PromptPayQR } from './PromptPayQR'
import {
  AmbientGlow,
  CartFab,
  FadeImage,
  Marquee,
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
import { FloodAlertBanner } from './FloodAlertBanner'
import { DatePicker } from './DatePicker'
import { CheckoutHero, FormSection, IconInput, OrderTicket, StepHero } from './CheckoutParts'

type Step = 'menu' | 'review' | 'checkout' | 'terms' | 'payment'

type CartItem = { product_id: string; product_name: string; unit_price: number; unit: string; qty: number; imagePath: string | null }

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
      className="flex items-center gap-1.5 rounded-full border border-stone-300 bg-white text-stone-700 font-medium px-4 py-2 text-sm w-fit shadow-sm transition-all duration-200 hover:-translate-x-0.5 hover:border-stone-400 active:scale-95"
    >
      {children}
    </button>
  )
}

const CHECKOUT_STEPS = [
  { key: 'review', label: 'ทวนรายการ', icon: '🧺' },
  { key: 'checkout', label: 'ที่อยู่', icon: '📝' },
  { key: 'terms', label: 'เงื่อนไข', icon: '📋' },
  { key: 'payment', label: 'ชำระเงิน', icon: '💳' },
] as const

/** แถบบอกขั้นตอนสั่งซื้อ (ทวนรายการ → ที่อยู่ → เงื่อนไข → ชำระเงิน) ให้ลูกค้ารู้ตลอดว่าอยู่ตรงไหนและเหลืออีกกี่ขั้น
 * เส้นเชื่อมค่อยๆ ไหลเต็มไปถึงขั้นปัจจุบันตอนเปลี่ยนหน้า ขั้นที่ผ่านแล้วเป็นเครื่องหมายถูก ขั้นปัจจุบันมีวงแสงเรือง */
function CheckoutProgress({ current }: { current: (typeof CHECKOUT_STEPS)[number]['key'] }) {
  const idx = CHECKOUT_STEPS.findIndex((s) => s.key === current)
  const ratio = idx / (CHECKOUT_STEPS.length - 1)
  return (
    <div className="px-1 animate-page-in" role="group" aria-label={`ขั้นตอนที่ ${idx + 1} จาก ${CHECKOUT_STEPS.length}`}>
      <div className="relative flex justify-between">
        <div className="absolute left-8 right-8 top-4 h-0.5 rounded-full bg-stone-200" aria-hidden="true" />
        <div
          className="absolute left-8 top-4 h-0.5 rounded-full bg-stone-900 transition-all duration-700 ease-out"
          style={{ width: `calc((100% - 4rem) * ${ratio})` }}
          aria-hidden="true"
        />
        {CHECKOUT_STEPS.map((s, i) => (
          <div key={s.key} className="relative z-10 flex flex-col items-center gap-1 w-16">
            <span
              className={
                'w-8 h-8 rounded-full grid place-items-center text-sm transition-all duration-500 ' +
                (i < idx
                  ? 'bg-stone-900 text-white'
                  : i === idx
                    ? 'bg-brand-shader text-white ring-4 ring-amber-200 animate-node-ping'
                    : 'bg-white border-2 border-stone-200 text-stone-400')
              }
            >
              {i < idx ? '✓' : s.icon}
            </span>
            <span className={'text-[11px] ' + (i === idx ? 'font-semibold text-stone-900' : 'text-stone-400')}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** กล่องติ๊กยอมรับเงื่อนไข + ปุ่ม "รับทราบ" ท้ายหน้าเงื่อนไขการสั่งซื้อ (step 'terms') — ปุ่มเป็นสีเทากดไม่ได้
 * จนกว่าจะติ๊กยอมรับก่อนเสมอ ถึงจะเปลี่ยนเป็นสีน้ำตาลแล้วไปหน้าชำระเงินได้ */
function TermsAcceptBox({ onConfirm }: { onConfirm: () => void }) {
  const [checked, setChecked] = useState(false)
  return (
    <div className="space-y-3">
      <label
        className={
          'flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-sm cursor-pointer select-none transition-all duration-300 ' +
          (checked ? 'border-amber-400 bg-amber-50 text-stone-900' : 'border-stone-200 bg-white text-stone-700')
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="w-5 h-5 accent-stone-900 shrink-0"
        />
        ฉันอ่านและยอมรับเงื่อนไขการสั่งซื้อข้างต้นแล้ว
      </label>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!checked}
        className={
          'w-full rounded-xl font-semibold py-3 text-sm transition-all duration-300 active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 ' +
          (checked ? 'btn-shimmer bg-stone-900 text-white shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)]' : 'bg-stone-200 text-stone-400')
        }
      >
        รับทราบ ไปหน้าชำระเงิน →
      </button>
    </div>
  )
}

/** การ์ดหัวข้อย่อยหนึ่งอันของหน้าเงื่อนไขการสั่งซื้อ (step 'terms') — ไอคอนวงกลม+หัวข้อ+เนื้อหา เข้าชุดกับ
 * การ์ด highlight ของแท็บเกี่ยวกับร้าน (AboutTabContent.tsx) แทนย่อหน้าเปลือยๆ ไม่มีจุดสังเกตให้สแกนอ่านง่าย */
function TermsSection({ icon, title, delay = 0, children }: { icon: string; title: string; delay?: number; children: ReactNode }) {
  return (
    <Reveal
      delay={delay}
      className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5 transition-shadow duration-300 hover:shadow-[0_8px_24px_-8px_rgb(51_32_14_/_0.3)]"
    >
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-50 to-stone-100 border border-amber-100 grid place-items-center text-lg shrink-0">
          {icon}
        </div>
        <h2 className="font-display font-semibold text-stone-900">{title}</h2>
      </div>
      <div className="space-y-1.5 text-sm text-stone-600 leading-relaxed">{children}</div>
    </Reveal>
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
        <div className="relative w-16 h-16 mx-auto">
          <span className="absolute inset-0 rounded-full bg-amber-300/60 animate-fab-ring" aria-hidden="true" />
          <div className="relative w-16 h-16 rounded-full bg-amber-100 grid place-items-center text-3xl animate-icon-pop">💡</div>
        </div>
        <h2 className="text-lg font-display font-semibold text-stone-900">วิธีสั่งซื้อจากหน้านี้</h2>
        <div className="space-y-2 text-left">
          {items.map((it, i) => (
            <div
              key={i}
              className="animate-timeline-in flex items-start gap-3 text-sm text-stone-600 rounded-xl bg-stone-50 border border-stone-200/70 px-3 py-2.5"
              style={{ animationDelay: `${0.12 + i * 0.09}s` }}
            >
              <span className="relative shrink-0 w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-bold grid place-items-center">{i + 1}</span>
              <span className="flex-1">
                {it.icon} {it.text}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={requestClose}
          className="btn-shimmer w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-transform active:scale-95"
        >
          เข้าใจแล้ว เริ่มเลือกเมนู
        </button>
      </div>
    </div>
  )
}

/** ป็อปอัพหลังลูกค้ากด "แจ้งชำระเงิน" — ต้องไม่สื่อว่า "สั่งซื้อเสร็จสมบูรณ์" เพราะร้านยังต้องตรวจสอบการชำระเงินและกด
 * ยืนยันออเดอร์ก่อน (ยังไม่เข้าคิวอบ) จึงเป็นนาฬิกาทรายสีอำพันบอกให้ "รอร้านตรวจสอบ" ไม่ใช่เครื่องหมายถูกสีเขียว
 * ปิดเองเมื่อแถบเวลาหมด หรือกด "รับทราบ" เพื่อไปต่อทันที (onDone เรียกครั้งเดียวเสมอ) */
function PaymentPendingPopup({ total, onDone, durationMs = 6000 }: { total: number; onDone: () => void; durationMs?: number }) {
  const [closing, setClosing] = useState(false)
  const doneRef = useRef(false)

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    setClosing(true)
    setTimeout(onDone, 200)
  }

  useEffect(() => {
    const t = setTimeout(finish, durationMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={'fixed inset-0 bg-black/60 grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}>
      <div
        role="alertdialog"
        aria-labelledby="payment-pending-title"
        className={
          'relative overflow-hidden bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-3 ' +
          (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')
        }
      >
        <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-200 grid place-items-center text-4xl mx-auto animate-icon-pop">
          <span className="animate-hourglass">⏳</span>
        </div>
        <h2 id="payment-pending-title" className="text-lg font-display font-bold text-stone-900">
          กรุณารอร้านตรวจสอบการชำระเงิน
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          ร้านได้รับการแจ้งชำระเงินยอด <strong className="text-stone-900">{formatBaht(total)} บาท</strong> แล้ว
          กำลังตรวจสอบและจะยืนยันออเดอร์ให้เร็วที่สุด
        </p>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          ออเดอร์ยังไม่เข้าคิวอบจนกว่าร้านจะตรวจสอบและยืนยัน — ติดตามสถานะได้ที่หน้าถัดไป
        </p>
        <button
          type="button"
          onClick={finish}
          className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm transition-transform active:scale-95"
        >
          รับทราบ
        </button>
        <div
          className="absolute left-0 bottom-0 h-1 w-full bg-gradient-to-r from-amber-400 to-amber-600 animate-countdown-bar"
          style={{ animationDuration: `${durationMs}ms` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

/** ไลต์บ็อกซ์ดูรูปสินค้าภาพใหญ่ — ลูกค้าแตะรูปในการ์ดสินค้าแล้วขยายขึ้นมาพร้อมชื่อ/ราคา/ปุ่มเพิ่มลงตะกร้า
 * ปิดได้ด้วยปุ่ม ✕ แตะพื้นหลัง หรือกด Esc (ใช้ useClosingTransition ให้เฟดออกนุ่มๆ เหมือนป็อปอัพอื่น) */
function ProductLightbox({
  product,
  onAdd,
  onClose,
}: {
  product: PublicMenu['products'][number]
  onAdd: (sourceEl: HTMLElement) => void
  onClose: () => void
}) {
  const { closing, requestClose } = useClosingTransition(onClose)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      className={'fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-4 z-50 ' + (closing ? 'animate-overlay-fade-out' : 'animate-overlay-fade')}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-label={product.name}
        className={'relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden ' + (closing ? 'animate-toast-pop-out' : 'animate-toast-pop')}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 text-stone-600 grid place-items-center text-lg font-bold shadow-md transition-transform active:scale-90"
        >
          ✕
        </button>
        <div className="relative aspect-square bg-stone-100 overflow-hidden">
          {product.image_path && (
            <FadeImage src={productImageUrl(product.image_path)} alt={product.name} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="p-5 space-y-3 text-center">
          <h2 className="text-xl font-display font-bold text-stone-900">{product.name}</h2>
          <p className="text-lg font-semibold text-stone-900">
            {formatBaht(product.price)} บาท <span className="text-sm font-normal text-stone-400">/{product.unit}</span>
          </p>
          <button
            type="button"
            onClick={(e) => {
              onAdd(e.currentTarget)
              requestClose()
            }}
            className="btn-shimmer w-full rounded-xl bg-stone-900 text-white font-semibold py-3 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-transform active:scale-95"
          >
            🛒 เพิ่มลงตะกร้า
          </button>
        </div>
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
        <div className="relative w-20 h-20 mx-auto">
          <span className="absolute inset-0 rounded-full bg-green-300/60 animate-fab-ring" aria-hidden="true" />
          <div className="relative w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 grid place-items-center text-4xl animate-icon-pop">📣</div>
        </div>
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
            className="btn-shimmer flex items-center justify-center gap-2 w-full rounded-xl bg-[#06C755] text-white font-semibold py-3 text-sm shadow-[0_10px_24px_-10px_rgb(6_199_85_/_0.6)] transition-transform active:scale-95"
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
/** สรุปตะกร้าแบบอ่านอย่างเดียว (ไม่มีรูป/ปรับจำนวน ต่างจากการ์ดในหน้าทวนรายการ) ใช้ซ้ำในหน้ากรอกข้อมูล+หน้า
 * ชำระเงิน — ห่อ Reveal+เงาอุ่นในตัวเองเลย ไม่ต้องให้หน้าที่เรียกใช้มาห่อซ้ำเอง กันสไตล์เพี้ยนไปคนละแบบ */
function CartSummaryList({ items, grandTotal, delay = 0 }: { items: CartItem[]; grandTotal: number; delay?: number }) {
  return (
    <Reveal delay={delay} className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5 space-y-2.5">
      <h2 className="text-sm font-display font-semibold text-stone-700">🧺 รายการที่สั่ง ({items.length})</h2>
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
      <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2.5">
        <span>ยอดรวม</span>
        <span className="tabular-nums">{formatBaht(grandTotal)} บาท</span>
      </div>
    </Reveal>
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
  const [splashActive, setSplashActive] = useState(true)
  const [dateError, setDateError] = useState<string | null>(null)
  const [zoomProduct, setZoomProduct] = useState<PublicMenu['products'][number] | null>(null)
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
  // ต้องสั่งล่วงหน้าอย่างน้อย 1 วันเสมอ (วันนี้เลือกไม่ได้ทั้งนัดรับและส่งขนส่ง) — ส่งขนส่งใช้ shipping_lead_days
  // ถ้ามากกว่า 1 วัน ฝั่งเซิร์ฟเวอร์ (Edge Function submit-customer-order) ตรวจขั้นต่ำ "พรุ่งนี้" ซ้ำอีกชั้นเสมอ
  const leadDays = form.fulfillmentType === 'shipping' ? Math.max(1, menu?.shipping_lead_days ?? 1) : 1
  const minNeededDate = addDays(todayStr(), leadDays)

  // ร่างที่ค้างไว้จากวันก่อนๆ อาจมีวันที่ที่เลือกไม่ได้แล้ว (เช่นเป็นวันนี้/ผ่านมาแล้ว หรือสลับเป็นส่งขนส่งที่ต้อง
  // ล่วงหน้านานกว่า) — เคลียร์ทิ้งให้ลูกค้าเลือกใหม่ ไม่ปล่อยให้ส่งวันที่ผิดไปโดยไม่รู้ตัว
  useEffect(() => {
    if (form.neededDate && form.neededDate < minNeededDate) {
      setForm((f) => ({ ...f, neededDate: '' }))
    }
  }, [form.neededDate, minNeededDate])

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
    setItems((rows) => [...rows, { product_id: p.id, product_name: p.name, unit_price: p.price, unit: p.unit, qty: 1, imagePath: p.image_path }])
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
    if (!form.neededDate || form.neededDate < minNeededDate) {
      setDateError(`กรุณาเลือกวันรับของ — ต้องสั่งล่วงหน้าอย่างน้อย ${leadDays} วัน (วันนี้เลือกไม่ได้)`)
      document.getElementById('neededDate')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    // ยังไม่ไปหน้าชำระเงินทันที — ต้องผ่านหน้าเงื่อนไขการสั่งซื้อ (step 'terms') ก่อนเสมอ
    setStep('terms')
  }

  function handleTermsConfirmed() {
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
      <div className="min-h-screen grid place-items-center p-4 text-center bg-brand-shader font-warm">
        <div>
          <div className="w-20 h-20 rounded-full bg-white/15 grid place-items-center mx-auto text-4xl animate-icon-pop">🧁</div>
          <p className="text-white/90 font-medium mt-4">กำลังโหลดเมนู...</p>
          <div className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
            <div className="h-full w-1/3 rounded-full bg-amber-200 animate-indeterminate" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2.5" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-loading-dot" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-loading-dot" style={{ animationDelay: '0.15s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-loading-dot" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    )
  }
  if (menu === null) {
    return (
      <div className="min-h-screen grid place-items-center p-4 text-center font-warm">
        <PageTexture />
        <div className="max-w-xs">
          <p className="text-4xl">😵</p>
          <p className="text-stone-600 font-medium mt-3">โหลดเมนูไม่สำเร็จ</p>
          <p className="text-sm text-stone-400 mt-1">อาจเป็นเพราะสัญญาณอินเทอร์เน็ตไม่เสถียร ลองใหม่อีกครั้งได้เลย</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-stone-900 text-white font-semibold px-6 py-2.5 text-sm shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)]"
          >
            🔄 ลองใหม่
          </button>
        </div>
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="min-h-screen pb-10 font-warm">
        <PageTexture />
        <div key="step-review" className="animate-page-in max-w-md mx-auto px-4 pt-4 space-y-4">
          <BackButton onClick={() => setStep('menu')}>← แก้ไขตะกร้า</BackButton>
          <CheckoutProgress current="review" />

          <StepHero icon="🧺" title="ทวนรายการที่สั่ง" subtitle="เช็คสินค้า+จำนวนให้ครบก่อนไปขั้นตอนถัดไป" />

          {items.length === 0 ? (
            <Reveal className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-8 text-center text-sm text-stone-500 space-y-2">
              <p className="text-5xl animate-loading-bounce" aria-hidden="true">🧺</p>
              <p>ตะกร้าว่างเปล่า กลับไปเลือกสินค้ากันก่อนนะ</p>
            </Reveal>
          ) : (
            <Reveal className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-4 space-y-3">
              {items.map((it, i) => (
                <div
                  key={it.product_id}
                  className="animate-product-in flex items-center justify-between gap-3 pb-3 border-b border-stone-100 last:border-0 last:pb-0"
                  style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}
                >
                  <div className="relative w-14 h-14 rounded-xl bg-stone-100 overflow-hidden shrink-0 grid place-items-center text-stone-300 text-[10px] shadow-sm">
                    {it.imagePath ? (
                      <FadeImage src={productImageUrl(it.imagePath)} alt={it.product_name} className="w-full h-full object-cover" />
                    ) : (
                      'ไม่มีรูป'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{it.product_name}</p>
                    <p className="text-xs text-stone-400">{formatBaht(it.unit_price)} บาท/{it.unit}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button" onClick={() => updateQty(i, it.qty - 1)}
                      className="w-8 h-8 rounded-full bg-stone-100 font-semibold transition-transform active:scale-90"
                    >
                      −
                    </button>
                    <span key={it.qty} className="text-sm font-medium tabular-nums w-4 text-center animate-qty-pop">{it.qty}</span>
                    <button
                      type="button" onClick={() => updateQty(i, it.qty + 1)}
                      className="w-8 h-8 rounded-full bg-stone-900 text-white font-semibold transition-transform active:scale-90"
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
            </Reveal>
          )}

          <Reveal delay={0.08}>
            <button
              type="button"
              onClick={() => setStep('checkout')}
              disabled={items.length === 0}
              className={
                'w-full rounded-xl bg-stone-900 text-white font-semibold py-3.5 shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:shadow-none' +
                (items.length > 0 ? ' btn-shimmer' : '')
              }
            >
              ยืนยันรายการ ไปกรอกที่อยู่ →
            </button>
          </Reveal>
        </div>
      </div>
    )
  }

  if (step === 'checkout') {
    const inputClass =
      'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder:text-stone-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-600/60'
    const nameOk = form.customerName.trim().length >= 2
    const phoneOk = form.customerPhone.replace(/\D/g, '').length >= 9
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())
    return (
      <div className="min-h-screen pb-10 font-warm">
        <PageTexture />
        <div key="step-checkout" className="animate-page-in max-w-md mx-auto px-4 pt-4 space-y-4">
          <BackButton onClick={() => setStep('review')}>← กลับไปทวนรายการ</BackButton>
          <CheckoutProgress current="checkout" />

          <CheckoutHero count={items.length} total={grandTotal} />
          <OrderTicket items={items} grandTotal={grandTotal} />

          <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
            <FormSection no={1} icon="👤" title="ข้อมูลผู้สั่งซื้อ" subtitle="ใช้ติดต่อและยืนยันตัวตนตอนติดตามออเดอร์" delay={0.04}>
              <div className="space-y-3.5 text-stone-700">
                <IconInput
                  id="customerName" label="ชื่อผู้สั่งซื้อ" icon="🙂" required valid={nameOk} value={form.customerName}
                  onChange={(v) => setForm((f) => ({ ...f, customerName: v }))}
                />
                <IconInput
                  id="customerPhone" label="เบอร์โทรศัพท์" icon="📞" type="tel" inputMode="tel" required valid={phoneOk}
                  value={form.customerPhone} onChange={(v) => setForm((f) => ({ ...f, customerPhone: v }))}
                />
                <IconInput
                  id="customerEmail" label="อีเมล (ใช้แจ้งรับออเดอร์/แจ้งชำระเงิน)" icon="✉️" type="email" inputMode="email"
                  required valid={emailOk} value={form.customerEmail}
                  onChange={(v) => setForm((f) => ({ ...f, customerEmail: v }))}
                />
              </div>
            </FormSection>

            <FormSection
              no={2}
              icon={form.fulfillmentType === 'pickup' ? '🏠' : '📦'}
              title="วิธีรับของ"
              subtitle="เลือกวิธีรับและวันที่สะดวก"
              delay={0.1}
            >
              <div className="space-y-3.5 text-stone-700">
                <div className="space-y-1">
                  <span id="fulfillmentTypeLabel" className="text-xs font-medium text-stone-500">วิธีรับของ</span>
                  <div
                    role="radiogroup"
                    aria-labelledby="fulfillmentTypeLabel"
                    className="relative grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1"
                  >
                    <div
                      className="absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] rounded-xl bg-stone-900 shadow-md transition-transform duration-300 ease-out"
                      style={{ transform: form.fulfillmentType === 'shipping' ? 'translateX(calc(100% + 4px))' : 'translateX(0)' }}
                      aria-hidden="true"
                    />
                    {([
                      ['pickup', '🏠', 'นัดรับเอง'],
                      ['shipping', '📦', 'ส่งไปรษณีย์/ขนส่ง'],
                    ] as const).map(([value, icon, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={form.fulfillmentType === value}
                        onClick={() => setForm((f) => ({ ...f, fulfillmentType: value }))}
                        className={
                          'relative z-10 rounded-xl py-2.5 text-sm font-medium transition-colors duration-300 active:scale-95 ' +
                          (form.fulfillmentType === value ? 'text-white' : 'text-stone-600')
                        }
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="neededDate" className="text-xs font-medium text-stone-500">
                    {form.fulfillmentType === 'pickup' ? 'วันที่สะดวกนัดรับ' : 'วันที่ต้องการให้จัดส่ง'}
                  </label>
                  <DatePicker
                    id="neededDate"
                    value={form.neededDate}
                    min={minNeededDate}
                    today={todayStr()}
                    error={dateError}
                    onChange={(d) => {
                      setDateError(null)
                      setForm((f) => ({ ...f, neededDate: d }))
                    }}
                  />
                  <p className="text-xs text-stone-400">สั่งล่วงหน้าอย่างน้อย {leadDays} วัน — วันนี้เลือกไม่ได้</p>
                </div>

                {form.fulfillmentType === 'pickup' ? (
                  <div key="pickup" className="animate-form-in">
                    <IconInput
                      id="pickupTime" label="เวลาที่สะดวกมารับ (ถ้ามี)" icon="🕐" placeholder="เช่น 10:00"
                      value={form.pickupTime} onChange={(v) => setForm((f) => ({ ...f, pickupTime: v }))}
                    />
                  </div>
                ) : (
                  <div key="shipping" className="space-y-3.5 animate-form-in">
                    <div className="space-y-1">
                      <label htmlFor="shipAddressText" className="text-xs font-medium text-stone-500">ที่อยู่จัดส่ง</label>
                      <textarea
                        id="shipAddressText" required value={form.shipAddressText}
                        onChange={(e) => setForm((f) => ({ ...f, shipAddressText: e.target.value }))}
                        className={inputClass} rows={3}
                      />
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 text-xs text-amber-800 space-y-1.5">
                      <p>💰 ตอนนี้จ่ายแค่ค่าสินค้าก่อน ค่าส่งจริงร้านจะแจ้งแยกให้ทราบภายหลัง</p>
                      <p>
                        📦 การจัดส่งทางไปรษณีย์ปกติใช้เวลาประมาณ 1-3 วัน ตามช่วงเวลาและเทศกาล เมื่อจัดส่งเรียบร้อย
                        ร้านจะแจ้งเลขพัสดุให้ทราบทางไลน์ — โปรดแอดไลน์ร้านไว้ก่อน
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection no={3} icon="💬" title="หมายเหตุ (ถ้ามี)" subtitle="บอกรายละเอียดเพิ่มเติมให้ร้านทราบ" delay={0.16}>
              <textarea
                id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className={inputClass} rows={2} placeholder="เช่น ไม่ใส่ถั่ว, ห่อของขวัญ"
              />
            </FormSection>

            <Reveal delay={0.2} className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5 space-y-3">
              <TurnstileWidget onToken={setTurnstileToken} />
              {!menu.promptpay ? (
                <p className="text-sm text-red-600 text-center">ร้านยังไม่เปิดรับสั่งซื้อออนไลน์ตอนนี้ กรุณาติดต่อร้านโดยตรง</p>
              ) : (
                <>
                  <div className="flex items-end justify-between border-t border-dashed border-stone-200 pt-3">
                    <span className="text-sm text-stone-500">ยอดรวม</span>
                    <span className="text-xl font-bold tabular-nums text-stone-900">
                      {formatBaht(grandTotal)} <span className="text-sm font-medium text-stone-500">บาท</span>
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={!turnstileToken}
                    className={
                      'w-full rounded-xl bg-stone-900 text-white font-semibold py-3.5 shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:shadow-none' +
                      (turnstileToken ? ' btn-shimmer' : '')
                    }
                  >
                    {turnstileToken ? 'ไปหน้าชำระเงิน →' : 'รอยืนยันตัวตนสักครู่...'}
                  </button>
                </>
              )}
            </Reveal>
          </form>
          <LineContactButton lineUrl={menu.line_url} />
        </div>
      </div>
    )
  }

  if (step === 'terms') {
    const isShipping = form.fulfillmentType === 'shipping'
    return (
      <div className="min-h-screen pb-10 font-warm">
        <PageTexture />
        <div key="step-terms" className="animate-page-in max-w-md mx-auto px-4 pt-4 space-y-4">
          <BackButton onClick={() => setStep('checkout')}>← กลับไปแก้ข้อมูล</BackButton>
          <CheckoutProgress current="terms" />

          <StepHero icon="📋" title="เงื่อนไขการสั่งซื้อ" subtitle="อ่านให้ครบก่อนไปหน้าชำระเงินนะ" />

          <TermsSection icon="💳" title="การชำระเงิน">
            <p>ต้องชำระเงินก่อนเสมอผ่าน QR พร้อมเพย์ในหน้าถัดไป จากนั้นร้านจะตรวจสอบและยืนยันออเดอร์ให้เร็วที่สุด</p>
            <p>
              หากขอยกเลิกออเดอร์ <strong className="text-stone-900">ก่อน</strong>ร้านเริ่มทำ จะได้รับเงินคืนเต็มจำนวน
              แต่ถ้าร้านเริ่มทำแล้ว ขออนุญาตไม่คืนเงิน เนื่องจากเป็นขนมที่ทำสดใหม่ตามคำสั่งซื้อของท่านโดยเฉพาะ
            </p>
          </TermsSection>

          {isShipping ? (
            <TermsSection icon="📦" title="การจัดส่ง" delay={0.08}>
              <p>ค่าส่งจริงร้านจะแจ้งแยกให้ทราบภายหลัง การจัดส่งทางไปรษณีย์ปกติใช้เวลาประมาณ 1-3 วัน ตามช่วงเวลาและเทศกาล</p>
              <p>หากพัสดุสูญหายหรือเสียหายระหว่างขนส่ง ทางร้านจะช่วยประสานงานเคลมกับบริษัทขนส่งให้</p>
            </TermsSection>
          ) : (
            <TermsSection icon="🏠" title="การนัดรับ" delay={0.08}>
              <p>กรุณามารับตามวัน-เวลาที่นัดไว้</p>
              <p>
                หากไม่มารับตามนัดโดยไม่แจ้งล่วงหน้า ร้านขอสงวนสิทธิ์ไม่คืนเงิน เนื่องจากเป็นขนมที่ทำสดใหม่ตาม
                คำสั่งซื้อของท่านแล้ว
              </p>
            </TermsSection>
          )}

          <TermsSection icon="🔒" title="ข้อมูลส่วนตัว" delay={0.16}>
            <p>ชื่อ เบอร์โทร อีเมล และที่อยู่ที่กรอกไว้ ใช้เพื่อจัดส่ง/ติดต่อ/แจ้งสถานะออเดอร์เท่านั้น</p>
            <p>
              โปรดจำ <strong className="text-stone-900">ชื่อผู้รับ/ชื่อผู้สั่งซื้อ</strong> ที่กรอกไว้ให้ดี
              ต้องใช้กรอกยืนยันตัวตนตอนเข้าดูสถานะออเดอร์ภายหลังด้วย
            </p>
          </TermsSection>

          <Reveal
            delay={0.22}
            className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5"
          >
            <TermsAcceptBox onConfirm={handleTermsConfirmed} />
          </Reveal>
        </div>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen pb-10 font-warm">
        <PageTexture />
        <div key="step-payment" className="animate-page-in max-w-md mx-auto px-4 pt-4 space-y-4">
          <BackButton onClick={() => setStep('terms')}>← กลับไปดูเงื่อนไข</BackButton>
          <CheckoutProgress current="payment" />

          <StepHero icon="💳" title="ชำระเงิน" subtitle="สแกนจ่ายเงินก่อน แล้วกดแจ้งชำระเงินด้านล่าง ร้านจะตรวจสอบให้" />

          <Reveal className="relative overflow-hidden rounded-2xl bg-stone-900 text-white p-5 text-center shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.5)]">
            <AmbientGlow />
            <div className="relative z-10">
              <p className="text-sm text-stone-300">ยอดที่ต้องชำระ</p>
              <p className="text-4xl font-bold tabular-nums">{formatBaht(grandTotal)}</p>
              <p className="text-sm text-stone-300">บาท</p>
            </div>
          </Reveal>

          <Reveal delay={0.06} className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5 space-y-3">
            <h2 className="text-sm font-display font-semibold text-stone-700">📷 สแกน QR เพื่อชำระเงิน</h2>
            {menu.promptpay && (
              <div className="relative overflow-hidden rounded-xl">
                <PromptPayQR promptpayId={menu.promptpay} amount={grandTotal} />
                <span className="qr-scan" aria-hidden="true" />
              </div>
            )}
            <p className="text-xs text-stone-400 text-center leading-relaxed">
              ร้านจะตรวจสอบและยืนยันออเดอร์ให้เร็วที่สุดหลังจากกดยืนยันด้านล่าง
            </p>
          </Reveal>

          <CartSummaryList items={items} grandTotal={grandTotal} delay={0.12} />

          <Reveal delay={0.18} className="space-y-3">
            <button
              type="button"
              onClick={() => void handleConfirmPayment()}
              disabled={submitting || paymentSuccessVisible || showLineReminder}
              className={
                'w-full rounded-xl bg-stone-900 text-white font-semibold py-3.5 shadow-[0_10px_28px_-10px_rgb(0_0_0_/_0.4)] transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:shadow-none' +
                (submitting ? '' : ' btn-shimmer')
              }
            >
              {submitting ? 'กำลังแจ้งชำระเงิน...' : '✅ ฉันโอนเงินแล้ว แจ้งชำระเงิน'}
            </button>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </Reveal>

          <LineContactButton lineUrl={menu.line_url} />
        </div>

        {paymentSuccessVisible && (
          <PaymentPendingPopup total={submittedTotal} onDone={handlePaymentSuccessDone} />
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
      {menu.disaster_mode_enabled && <FloodAlertBanner />}

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
        {[
          ['10%', '20%', '0s'],
          ['84%', '16%', '0.9s'],
          ['72%', '68%', '1.7s'],
          ['18%', '74%', '2.3s'],
          ['48%', '8%', '1.3s'],
        ].map(([left, top, delay], i) => (
          <span
            key={i}
            className="pointer-events-none absolute z-[5] text-amber-200 animate-twinkle"
            style={{ left, top, animationDelay: delay }}
            aria-hidden="true"
          >
            ✦
          </span>
        ))}
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
            <h1
              className="text-3xl md:text-5xl font-display font-bold text-white mt-4 leading-tight animate-hero-text"
              style={{ animationDelay: '0.15s' }}
            >
              <span className="text-shine">{menu.shop_name}</span>
            </h1>
            <div className="animate-hero-text" style={{ animationDelay: '0.28s' }}>
              <SquiggleUnderline className="w-20 h-2.5 mx-auto md:mx-0 mt-1.5 text-white/40" />
            </div>
            <p
              className="text-sm md:text-base mt-2.5 max-w-md mx-auto md:mx-0 animate-hero-text"
              style={{ color: 'rgba(255,255,255,0.85)', animationDelay: '0.4s' }}
            >
              หวานน้อย อร่อยแน่ ไม่เหมือนใคร — ทำมือทุกชิ้นโดยเด็กอายุ 13 ปี
            </p>

            <div className="mt-6 animate-hero-text" style={{ animationDelay: '0.55s' }}>
              {tab === 'about' ? (
                <button
                  type="button"
                  onClick={goToMenuAndScroll}
                  className="btn-shimmer inline-block rounded-2xl bg-stone-900 text-white font-semibold px-8 py-3.5 text-base shadow-[0_10px_28px_-8px_rgb(0_0_0_/_0.5)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
                >
                  🛒 ดูเมนู สั่งเลย
                </button>
              ) : (
                <a
                  href="#menu-section"
                  className="btn-shimmer inline-block rounded-2xl bg-stone-900 text-white font-semibold px-8 py-3.5 text-base shadow-[0_10px_28px_-8px_rgb(0_0_0_/_0.5)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
                >
                  🛒 ดูเมนู สั่งเลย
                </a>
              )}
            </div>

            <div
              className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4 animate-hero-text"
              style={{ animationDelay: '0.7s' }}
            >
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
            <div className="hidden md:block md:flex-1 animate-hero-text" style={{ animationDelay: '0.35s' }}>
              <div className="animate-hero-float">
                <div className="max-w-xs ml-auto rounded-3xl overflow-hidden border-4 border-white/20 shadow-[0_24px_60px_-16px_rgb(0_0_0_/_0.55)] rotate-3 transition-transform hover:rotate-0 duration-500">
                  <img src={heroProductImage} alt="" className="w-full aspect-square object-cover" />
                </div>
              </div>
            </div>
          )}
        </div>
        <WaveDivider />
      </div>

      {/* แถบจุดขายของร้านวิ่งต่อเนื่องใต้ hero — ข้อความทั้งหมดมาจากข้อมูลจริงที่เจ้าของร้านให้ไว้ในหน้า "เกี่ยวกับร้าน" */}
      <Marquee
        items={['🥐 ทำสดใหม่ทุกออเดอร์', '🍬 หวานน้อย อร่อยแน่ ไม่เหมือนใคร', '👐 ทำเองทุกขั้นตอน', '📦 Pre-order ผลิตพอดีกับที่สั่ง']}
        className="border-y border-amber-200/70 bg-amber-50/70 py-2.5 text-sm font-medium text-amber-900"
      />

      {/* สลับเนื้อหาด้วยแท็บล้วนๆ ไม่เปลี่ยนหน้าเว็บจริง (ไม่ remount ทั้งหน้า ไม่กระพริบ) key={tab} ทำให้เล่น
          อนิเมชัน crossfade ใหม่ทุกครั้งที่สลับแท็บ */}
      {tab === 'menu' ? (
        <div key="menu" className="max-w-5xl mx-auto px-4 mt-6 space-y-6 animate-form-in">
          <Reveal as="section" id="menu-section" className="space-y-4 scroll-mt-24">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-amber-700/40" aria-hidden="true" />
                <h2 className="text-2xl font-display font-bold text-stone-900">🍪 เมนูสินค้า</h2>
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-amber-700/40" aria-hidden="true" />
              </div>
              <SquiggleUnderline className="w-20 h-2.5 mx-auto mt-1 text-amber-700/50" />
              <p className="mt-2 inline-block rounded-full bg-white/70 border border-stone-200 px-3 py-0.5 text-xs text-stone-500">{filtered.length} เมนู · อบสดใหม่ทุกออเดอร์</p>
            </div>

            <LineContactButton lineUrl={menu.line_url} />

            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm opacity-60" aria-hidden="true">🔍</span>
              <input
                placeholder="ค้นหาสินค้า" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white/90 pl-10 pr-3.5 py-2.5 text-sm shadow-[0_2px_10px_-6px_rgb(51_32_14_/_0.18)] transition-shadow focus:outline-none focus:ring-2 focus:ring-stone-900/15 focus:border-stone-400"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
              <button
                type="button" onClick={() => setCategoryId(null)}
                className={
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ' +
                  (!categoryId
                    ? 'bg-stone-900 text-white shadow-[0_6px_14px_-6px_rgb(0_0_0_/_0.5)]'
                    : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-400')
                }
              >
                ทั้งหมด
              </button>
              {menu.categories.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => setCategoryId(c.id)}
                  className={
                    'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ' +
                    (categoryId === c.id
                      ? 'bg-stone-900 text-white shadow-[0_6px_14px_-6px_rgb(0_0_0_/_0.5)]'
                      : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-400')
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {filtered.map((p, idx) => {
                const inCart = items.find((it) => it.product_id === p.id)
                return (
                  <Reveal key={p.id} delay={(idx % 3) * 0.08} className="h-full">
                    <div
                      className={
                        'group h-full rounded-3xl border bg-white overflow-hidden transition-all duration-300 md:hover:-translate-y-1.5 md:hover:shadow-[0_22px_36px_-14px_rgb(51_32_14_/_0.45)] ' +
                        (inCart
                          ? 'border-amber-600 ring-2 ring-amber-400/40 shadow-[0_10px_24px_-10px_rgb(193_130_61_/_0.7)]'
                          : 'border-stone-200/70 shadow-[0_2px_10px_-6px_rgb(51_32_14_/_0.18)]') +
                        (p.id === justAddedId ? ' animate-cart-bump' : '')
                      }
                    >
                      <div
                        className={'relative aspect-square bg-stone-100 grid place-items-center text-stone-300 text-xs overflow-hidden' + (p.image_path ? ' cursor-zoom-in' : '')}
                        onClick={() => p.image_path && setZoomProduct(p)}
                      >
                        {p.image_path ? (
                          <FadeImage
                            src={productImageUrl(p.image_path)}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-110"
                          />
                        ) : 'ไม่มีรูป'}
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" aria-hidden="true" />
                        <span className="absolute left-2 bottom-2 rounded-full bg-white/95 backdrop-blur px-2.5 py-1 text-sm font-bold text-stone-900 shadow-md">
                          {formatBaht(p.price)} <span className="text-[10px] font-medium text-stone-500">฿/{p.unit}</span>
                        </span>
                        {p.image_path && (
                          <span className="absolute right-2 bottom-2 w-7 h-7 rounded-full bg-black/35 text-white text-xs grid place-items-center opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity" aria-hidden="true">🔍</span>
                        )}
                        {inCart && (
                          <span
                            key={inCart.qty}
                            className="absolute top-2 right-2 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-white text-white text-white text-xs font-bold min-w-6 h-6 px-1.5 grid place-items-center shadow-md animate-qty-pop"
                          >
                            {inCart.qty}
                          </span>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-[15px] font-display font-medium leading-snug text-stone-900 line-clamp-2 min-h-[2.6em]">{p.name}</p>
                        {inCart ? (
                          <div className="flex items-center justify-between rounded-full bg-stone-100 p-0.5">
                            <button
                              type="button" onClick={() => updateQty(items.indexOf(inCart), inCart.qty - 1)}
                              className="w-8 h-8 rounded-full bg-white shadow-sm font-semibold transition-transform active:scale-90"
                            >
                              −
                            </button>
                            <span key={inCart.qty} className="text-sm font-semibold tabular-nums animate-qty-pop">{inCart.qty}</span>
                            <button
                              type="button" onClick={() => updateQty(items.indexOf(inCart), inCart.qty + 1)}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm font-semibold transition-transform active:scale-90"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button" onClick={(e) => addProduct(p, e.currentTarget)}
                            className="w-full rounded-full bg-gradient-to-r from-stone-800 to-stone-900 text-white text-sm font-semibold py-2.5 shadow-[0_8px_16px_-8px_rgb(51_32_14_/_0.7)] transition-all duration-200 hover:from-amber-700 hover:to-amber-800 active:scale-95"
                          >
                            🛒 เพิ่มลงตะกร้า
                          </button>
                        )}
                      </div>
                    </div>
                  </Reveal>
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
      {zoomProduct && (
        <ProductLightbox
          product={zoomProduct}
          onAdd={(el) => addProduct(zoomProduct, el)}
          onClose={() => setZoomProduct(null)}
        />
      )}
    </div>
  )
}
