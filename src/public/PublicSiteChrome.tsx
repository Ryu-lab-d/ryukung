import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { productImageUrl } from '../products/ProductCard'
import { formatBaht } from '../lib/money'

export type SiteTab = 'menu' | 'about'

/** พื้นหลังลายกระดาษคราฟท์จางๆ ของเว็บไซต์ลูกค้าทุกหน้า (แทนอิโมจิลอยกระจายพื้นหลังแบบเดิมที่ดูเหมือน mockup
 * ไม่ใช่เว็บไซต์จริง) — ดูรายละเอียดลายที่ .bg-paper-texture ใน src/index.css มีแสงครีม/ทองอ่อนเคลื่อนไหวช้าๆ
 * วนลูปทับอยู่ด้วย (.animate-cream-shine) ให้พื้นหลังทั้งเว็บมีลูกเล่นไม่ใช่แค่ hero สีน้ำตาลเข้มเท่านั้น */
export function PageTexture() {
  return (
    <div className="fixed inset-0 -z-10 bg-paper-texture overflow-hidden" aria-hidden="true">
      <div className="absolute inset-[-20%] opacity-60 bg-cream-shine animate-cream-shine" />
    </div>
  )
}

/** เส้นขีดใต้แบบลายมือ (ไม่ใช่เส้นตรงแข็งๆ) ใช้เน้นหัวข้อสำคัญให้มีความรู้สึก "งานฝีมือ" ใส่สี currentColor
 * ผ่าน class text-* ของ Tailwind ได้เลย (เช่น text-stone-300) */
export function SquiggleUnderline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path
        d="M2 7 Q 12 2, 22 7 T 42 7 T 62 7 T 82 7 T 102 7 T 122 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** ขอบคลื่นสีครีม (stone-50) ตัดจากพื้นหลังไล่สีน้ำตาลของ hero ลงมาเจอเนื้อหาด้านล่าง — แก้ปัญหาสีน้ำตาลตัดกับ
 * ครีมแบบพรวดเดียวเป็นเส้นตรงแข็งๆ ให้เป็นแนวคลื่นนุ่มๆ แทน วางเป็น element สุดท้ายใน container ของ hero เสมอ */
export function WaveDivider({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 54"
      preserveAspectRatio="none"
      className={'block w-full h-8 sm:h-12 -mb-px ' + className}
      aria-hidden="true"
    >
      <path d="M0,30 C240,58 480,2 720,18 C960,34 1200,58 1440,28 L1440,54 L0,54 Z" fill="var(--color-stone-50)" />
    </svg>
  )
}

/** จุดไล่แสงอุ่นๆ 2 ดวงคนละสี เคลื่อนไหวคนละจังหวะตลอดเวลาเหนือพื้นหลัง .bg-brand-shader ของ hero — เป็นลูกเล่น
 * เสริมให้เห็นชัดเจนจริงๆ (ไม่ subtle จนสังเกตไม่ออก) ต้องวางใน container ที่มี `relative overflow-hidden` เสมอ
 * กันแสงล้นออกนอก hero */
export function AmbientGlow() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-[-25%] opacity-40 animate-ambient-shine"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgb(255 205 130 / 0.6), transparent 50%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-[-25%] opacity-30 animate-ambient-shine"
        style={{
          background: 'radial-gradient(circle at 70% 65%, rgb(120 50 20 / 0.7), transparent 45%)',
          animationDirection: 'reverse',
          animationDuration: '18s',
        }}
        aria-hidden="true"
      />
    </>
  )
}

/** ตรวจว่า element เข้ามาอยู่ในจอจริงๆ หรือยัง (IntersectionObserver) — เป็นฐานของระบบ "โผล่ตอน scroll เข้ามาเห็น"
 * ต่างจาก animate-form-in เดิมที่เล่นครั้งเดียวตอน mount โดยไม่สนว่าผู้ใช้เลื่อนมาเห็นหรือยัง ทำให้ section
 * ที่อยู่ใต้จอตอนโหลดเล่นอนิเมชันจบไปเงียบๆ ก่อนเห็นด้วยซ้ำ — เล่นครั้งเดียวแล้วเลิกสังเกต (ไม่เล่นซ้ำตอนเลื่อนกลับ) */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, visible }
}

/** ห่อ section ใดๆ ให้ "โผล่ขึ้นพร้อมจาง" (fade+slide up) จริงๆ ตอนผู้ใช้เลื่อนมาเห็นเข้าจอ ใช้แทนการใส่
 * animate-form-in + animationDelay ตรงๆ กับ section ที่อยู่ใต้จอตอนโหลดหน้า (เช่น section ท้ายๆ ของหน้ายาวๆ)
 * ก่อนเลื่อนมาถึง section จะโปร่งใสสนิทรออยู่ก่อนเสมอ ไม่โผล่มาทื่อๆ ทันที */
export function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
  id,
  style,
}: {
  children: ReactNode
  className?: string
  delay?: number
  /** เปลี่ยน tag ที่ห่อจริง (เช่น 'section') เผื่ออยากได้ความหมาย semantic ถูกต้อง — ดีฟอลต์เป็น 'div' */
  as?: 'div' | 'section'
  id?: string
  style?: CSSProperties
}) {
  const { ref, visible } = useInView<HTMLDivElement>()
  return (
    <Tag
      ref={ref}
      id={id}
      className={className + ' ' + (visible ? 'animate-reveal-up' : 'opacity-0')}
      style={visible ? { ...style, animationDelay: `${delay}s`, animationFillMode: 'backwards' } : style}
    >
      {children}
    </Tag>
  )
}

const TABS: { key: SiteTab; label: string }[] = [
  { key: 'menu', label: 'เมนู' },
  { key: 'about', label: 'เกี่ยวกับร้าน' },
]

/** แถบนำทางของเว็บไซต์ลูกค้า (sticky บนสุด) — เป็นหน้าเดียวกันทั้งเว็บ (เมนู/เกี่ยวกับร้าน) สลับด้วยแท็บล้วนๆ
 * ไม่มีการเปลี่ยนหน้าจริง (ไม่ remount ไม่กระพริบ) ปุ่ม 💡 ขวาสุดเปิดป็อปอัพวิธีสั่งซื้อ */
export function PublicNav({
  shopName,
  logoPath,
  activeTab,
  onTabChange,
  onHowToClick,
}: {
  shopName: string
  logoPath: string | null
  activeTab: SiteTab
  onTabChange: (tab: SiteTab) => void
  onHowToClick: () => void
}) {
  return (
    <nav className="sticky top-0 z-40 bg-stone-50/90 backdrop-blur border-b border-stone-200 pt-[env(safe-area-inset-top)]">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onTabChange('menu')} className="flex items-center gap-2.5 min-w-0 text-stone-900">
          {logoPath ? (
            <img src={productImageUrl(logoPath)} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-white shadow-sm" />
          ) : (
            <span className="text-xl shrink-0">🥐</span>
          )}
          <span className="hidden sm:inline truncate font-display font-semibold text-base tracking-tight">{shopName}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center bg-stone-200/60 rounded-full p-1 w-[190px] sm:w-[220px]">
            <div
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-stone-900 transition-transform duration-300 ease-out"
              style={{ transform: activeTab === 'about' ? 'translateX(100%)' : 'translateX(0)' }}
              aria-hidden="true"
            />
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onTabChange(t.key)}
                className={
                  'relative z-10 flex-1 text-center rounded-full py-1.5 text-xs sm:text-sm font-medium transition-colors ' +
                  (activeTab === t.key ? 'text-white' : 'text-stone-600')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onHowToClick}
            className="grid place-items-center w-9 h-9 rounded-full border border-stone-300 text-stone-600 hover:bg-stone-100 shrink-0"
            aria-label="วิธีสั่งซื้อ"
            title="วิธีสั่งซื้อ"
          >
            💡
          </button>
        </div>
      </div>
    </nav>
  )
}

/** ท้ายหน้าเว็บไซต์ลูกค้า — ชวนติดต่อแบบดึงดูดกว่าเดิม (ปุ่มจริงๆ ไม่ใช่แค่ตัวหนังสือขีดเส้นใต้เล็กๆ) */
export function PublicFooter({
  shopName,
  address,
  phone,
  lineUrl,
  activeTab,
  onTabChange,
}: {
  shopName: string
  address: string | null
  phone: string | null
  lineUrl: string | null
  activeTab: SiteTab
  onTabChange: (tab: SiteTab) => void
}) {
  return (
    <footer className="mt-10 border-t-2 border-dashed border-stone-300 bg-stone-50 px-4 pt-9 pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-center text-sm text-stone-500 space-y-4">
      <div className="space-y-1">
        <p className="font-display font-semibold text-stone-800 text-lg">{shopName}</p>
        <p className="text-xs text-stone-400">ทำสดใหม่ทุกออเดอร์ · หวานน้อย อร่อยแน่ ไม่เหมือนใคร</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {lineUrl && (
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-[#06C755] text-white font-medium px-4 py-2 text-xs"
          >
            💬 แอดไลน์ร้าน
          </a>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="flex items-center gap-1.5 rounded-full border border-stone-300 text-stone-700 font-medium px-4 py-2 text-xs">
            📞 {phone}
          </a>
        )}
        <button
          type="button"
          onClick={() => onTabChange(activeTab === 'menu' ? 'about' : 'menu')}
          className="flex items-center gap-1.5 rounded-full border border-stone-300 text-stone-700 font-medium px-4 py-2 text-xs"
        >
          {activeTab === 'menu' ? '📖 เกี่ยวกับร้าน' : '🛒 ดูเมนู'}
        </button>
      </div>

      {address && <p className="text-xs text-stone-400">📍 {address}</p>}
      <p className="text-xs text-stone-400">สั่งซื้อออนไลน์ผ่านหน้านี้ได้ตลอด 24 ชั่วโมง</p>
    </footer>
  )
}

/** ปุ่มตะกร้าลอยมุมขวาล่าง — ปุ่มเดียวจบ (ไม่ใช่แถบขาวเต็มความกว้างโผล่กลางจอแบบเดิม) แตะแล้วไปหน้ากรอกข้อมูล
 * รับของทันที ใช้ ref (forwardRef) เพื่อให้ parent เอาตำแหน่งจริงไปคำนวณจุดหมายของอนิเมชัน flyToCart ได้ */
export const CartFab = forwardRef<HTMLButtonElement, { count: number; total: number; onClick: () => void; bumping: boolean }>(
  function CartFab({ count, total, onClick, bumping }, ref) {
    if (count === 0) return null
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={
          'fixed right-5 z-40 flex items-center gap-2 rounded-full bg-stone-900 text-white pl-3 pr-4 py-3 ' +
          'shadow-[0_10px_28px_-6px_rgb(51_32_14_/_0.55)] animate-form-in' +
          (bumping ? ' animate-cart-bump' : '')
        }
        style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <span className="relative text-xl leading-none">
          🧺
          <span className="absolute -top-2.5 -right-2.5 bg-white text-stone-900 text-[11px] font-bold rounded-full min-w-5 h-5 px-1 grid place-items-center">
            {count}
          </span>
        </span>
        <span className="font-semibold text-sm tabular-nums">{formatBaht(total)} บาท</span>
      </button>
    )
  }
)

/** เล่นอนิเมชัน "สินค้าบินโค้งเข้าตะกร้า" จริงๆ (ไม่ใช่แค่ป็อปอัพขาวๆ โผล่กลางจอ) — โคลนไอคอนเล็กๆ จากตำแหน่ง
 * ปุ่มที่กด บินเป็นเส้นโค้งไปจบที่ตำแหน่งปุ่มตะกร้าจริงแล้วค่อยหาย ใช้ Web Animations API ตรงๆ ไม่พึ่ง library */
export function flyToCart(sourceEl: HTMLElement, targetEl: HTMLElement, emoji = '🧁') {
  const startRect = sourceEl.getBoundingClientRect()
  const endRect = targetEl.getBoundingClientRect()

  const clone = document.createElement('div')
  clone.textContent = emoji
  clone.setAttribute('aria-hidden', 'true')
  clone.style.cssText = [
    'position:fixed',
    `left:${startRect.left + startRect.width / 2 - 14}px`,
    `top:${startRect.top + startRect.height / 2 - 14}px`,
    'font-size:28px',
    'line-height:1',
    'z-index:100',
    'pointer-events:none',
    'will-change:transform,opacity',
  ].join(';')
  document.body.appendChild(clone)

  const dx = endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2)
  const dy = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2)
  // จุดกลางทางยกขึ้นก่อนค่อยดิ่งลง ให้เห็นเป็นเส้นโค้งจริงๆ (โยนของ) ไม่ใช่เส้นตรงบินทะลุจอ
  const midX = dx * 0.55
  const midY = Math.min(dy * 0.3, -40)

  const anim = clone.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${midX}px, ${midY}px) scale(0.85)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.15, offset: 1 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.32, 0, 0.6, 1)' }
  )
  anim.onfinish = () => clone.remove()
}
