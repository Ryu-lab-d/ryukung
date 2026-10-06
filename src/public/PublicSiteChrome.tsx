import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { productImageUrl } from '../products/ProductCard'
import { formatBaht } from '../lib/money'
import { installPointerGlow } from '../lib/pointerGlow'

export type SiteTab = 'menu' | 'about'

/** พื้นหลังลายกระดาษคราฟท์จางๆ ของเว็บไซต์ลูกค้าทุกหน้า (แทนอิโมจิลอยกระจายพื้นหลังแบบเดิมที่ดูเหมือน mockup
 * ไม่ใช่เว็บไซต์จริง) — ดูรายละเอียดลายที่ .bg-paper-texture ใน src/index.css มีแสงครีม/ทองอ่อนเคลื่อนไหวช้าๆ
 * วนลูปทับอยู่ด้วย (.animate-cream-shine) ให้พื้นหลังทั้งเว็บมีลูกเล่นไม่ใช่แค่ hero สีน้ำตาลเข้มเท่านั้น */
export function PageTexture() {
  // การ์ดเอียง+สปอตไลต์ตามเมาส์ (เฉพาะคอม) และแถบความคืบหน้าการเลื่อนหน้า — ติดมากับพื้นหลังจึงมีครบทุกหน้าลูกค้าอัตโนมัติ
  useEffect(() => installPointerGlow(), [])
  return (
    <>
      <div className="scroll-progress" aria-hidden="true" />
      <BackToTop />
      <div className="fixed inset-0 -z-10 bg-paper-texture overflow-hidden" aria-hidden="true">
        <div className="absolute inset-[-20%] opacity-60 bg-cream-shine animate-cream-shine" />
      </div>
    </>
  )
}

/** เส้นขีดใต้แบบลายมือ (ไม่ใช่เส้นตรงแข็งๆ) ใช้เน้นหัวข้อสำคัญให้มีความรู้สึก "งานฝีมือ" ใส่สี currentColor
 * ผ่าน class text-* ของ Tailwind ได้เลย (เช่น text-stone-300) */
export function SquiggleUnderline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path
        className="squiggle-draw"
        pathLength="1"
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
const TREATS: [string, string, string, string, string][] = [
  // [emoji, left, size(px), duration(s), delay(s)]
  ['🍪', '6%', '26', '14', '0'],
  ['🥐', '22%', '20', '17', '3'],
  ['🧁', '40%', '24', '15', '7'],
  ['🍞', '58%', '22', '18', '1.5'],
  ['🍩', '74%', '26', '16', '5'],
  ['🥨', '90%', '20', '19', '9'],
]

/** ขนมลอยขึ้นช้าๆ พร้อมหมุน/โยก เป็นฉากหลังของ hero สีแบรนด์ทุกหน้า — จางมาก ไม่บังเนื้อหา ปิดเองเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว */
export function FloatingTreats() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {TREATS.map(([emoji, left, size, dur, delay]) => (
        <span
          key={emoji}
          className="treat-rise absolute select-none"
          style={{ left, fontSize: `${size}px`, animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}
        >
          {emoji}
        </span>
      ))}
    </div>
  )
}

/** ฝุ่นทองระยิบระยับ: ดาว ✦ สีทองกะพริบและลอยขึ้นช้าๆ ในการ์ดสีแบรนด์ทุกใบ (เป็นส่วนหนึ่งของ AmbientGlow) */
const GLITTER: [string, string, string, string][] = [
  // [left, top, size, delay]
  ['8%', '22%', '12', '0'], ['18%', '68%', '9', '1.1'], ['31%', '14%', '10', '2.2'], ['44%', '78%', '13', '0.6'],
  ['57%', '30%', '9', '1.7'], ['69%', '70%', '12', '2.8'], ['80%', '18%', '10', '0.9'], ['92%', '56%', '13', '2.4'],
]
export function GoldGlitter() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {GLITTER.map(([left, top, size, delay], i) => (
        <span key={i} className="gold-glint absolute select-none" style={{ left, top, fontSize: `${size}px`, animationDelay: `${delay}s` }}>
          ✦
        </span>
      ))}
    </div>
  )
}

export function AmbientGlow() {
  return (
    <>
      <FloatingTreats />
      <GoldGlitter />
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

/** แถบข้อความวิ่งต่อเนื่อง (ticker) — ใช้สรุปจุดขายของร้านเป็นแถบสั้นๆ ใต้ hero ข้อความซ้ำ 2 ชุดเพื่อให้วนเนียน */
export function Marquee({ items, className = '' }: { items: string[]; className?: string }) {
  const row = (suffix: string) =>
    items.map((t, i) => (
      <span key={`${suffix}${i}`} className="flex items-center gap-8 shrink-0">
        <span>{t}</span>
        <span className="text-amber-500/70" aria-hidden="true">✦</span>
      </span>
    ))
  return (
    <div className={'overflow-hidden whitespace-nowrap ' + className} aria-label={items.join(' · ')}>
      <div className="flex gap-8 animate-marquee" aria-hidden="true">
        {row('a')}
        {row('b')}
      </div>
    </div>
  )
}

/** รูปที่ค่อยๆ เฟดเข้าเมื่อโหลดเสร็จ มีพื้นโครงโหลด (skeleton) กะพริบนุ่มๆ ระหว่างรอ แทนช่องว่างเทาๆ แล้วรูปโผล่ทื่อๆ
 * ต้องวางใน container ที่เป็น relative + overflow-hidden เสมอ (พื้นโครงวางทับเต็ม container) */
export function FadeImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      <span
        className={
          'absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200/70 to-stone-100 animate-pulse transition-opacity duration-500 ' +
          (loaded ? 'opacity-0' : 'opacity-100')
        }
        aria-hidden="true"
      />
      <img
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) setLoaded(true)
        }}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={className + ' transition-[transform,opacity] duration-500 ease-out ' + (loaded ? 'opacity-100' : 'opacity-0')}
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
  // เลื่อนหน้าลงแล้วแถบมีเงาแยกจากเนื้อหา + เส้นสีอำพันใต้แถบไล่ยาวตามระยะที่เลื่อนไปของหน้า (scroll progress)
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrolled(window.scrollY > 8)
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={
        'sticky top-0 z-40 bg-stone-50/90 backdrop-blur border-b pt-[env(safe-area-inset-top)] transition-shadow duration-300 ' +
        (scrolled ? 'border-stone-200 shadow-[0_8px_24px_-12px_rgb(51_32_14_/_0.3)]' : 'border-stone-200')
      }
    >
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onTabChange('menu')} className="group flex items-center gap-2.5 min-w-0 text-stone-900">
          {logoPath ? (
            <img
              src={productImageUrl(logoPath)}
              alt=""
              className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-white shadow-sm transition-transform duration-700 group-hover:rotate-[360deg]"
            />
          ) : (
            <span className="text-xl shrink-0">🥐</span>
          )}
          <span className="hidden sm:inline truncate font-display font-semibold text-base tracking-tight">{shopName}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center bg-stone-200/60 rounded-full p-1 w-[190px] sm:w-[220px]">
            <div
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-brand-shader shadow-md transition-transform duration-300 ease-out"
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
      <div
        className="absolute left-0 bottom-0 h-0.5 w-full origin-left bg-gradient-to-r from-amber-400 to-amber-700 transition-transform duration-150"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />
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
    <footer className="relative mt-12 overflow-hidden bg-brand-shader text-center text-sm text-white/80">
      <WaveDivider className="rotate-180 absolute inset-x-0 top-0" />
      <AmbientGlow />
      <div className="relative z-10 px-4 pt-16 pb-[calc(2.5rem+env(safe-area-inset-bottom))] space-y-4">
        <div className="space-y-1">
          <p className="font-display font-bold text-white text-xl">{shopName}</p>
          <SquiggleUnderline className="w-16 h-2 mx-auto text-white/40" />
          <p className="text-xs text-white/70 pt-1">ทำสดใหม่ทุกออเดอร์ · หวานน้อย อร่อยแน่ ไม่เหมือนใคร</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {lineUrl && (
            <a
              href={lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[#06C755] text-white font-medium px-4 py-2 text-xs shadow-md transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
            >
              💬 แอดไลน์ร้าน
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white font-medium px-4 py-2 text-xs transition-all duration-200 hover:bg-white/25 hover:-translate-y-0.5 active:scale-95"
            >
              📞 {phone}
            </a>
          )}
          <button
            type="button"
            onClick={() => onTabChange(activeTab === 'menu' ? 'about' : 'menu')}
            className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white font-medium px-4 py-2 text-xs transition-all duration-200 hover:bg-white/25 hover:-translate-y-0.5 active:scale-95"
          >
            {activeTab === 'menu' ? '📖 เกี่ยวกับร้าน' : '🛒 ดูเมนู'}
          </button>
        </div>

        {address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-black/20 backdrop-blur border border-white/20 px-4 py-2.5 text-left text-xs text-white/90 transition-all duration-200 hover:bg-black/30 hover:-translate-y-0.5"
          >
            <span className="text-xl">📍</span>
            <span className="min-w-0">
              <span className="block text-[10px] tracking-widest text-white/60">ที่ตั้งร้าน · แตะเพื่อเปิดแผนที่</span>
              <span className="block leading-snug">{address}</span>
            </span>
          </a>
        )}
        <p className="text-xs text-white/60">สั่งซื้อออนไลน์ผ่านหน้านี้ได้ตลอด 24 ชั่วโมง</p>
        <p className="text-[11px] text-white/50">ขอบคุณที่อุดหนุนเด็กตัวเล็กคนหนึ่งที่ตั้งใจทำขนม <span className="inline-block animate-heart-beat">🧡</span></p>
      </div>
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
        <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-stone-900 animate-fab-ring" aria-hidden="true" />
        <span className="relative text-xl leading-none">
          🧺
          <span className="absolute -top-2.5 -right-2.5 bg-white text-stone-900 text-[11px] font-bold rounded-full min-w-5 h-5 px-1 grid place-items-center">
            <span key={count} className="animate-qty-pop">{count}</span>
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

/** ประกายแตกกระจายจากจุดที่กดเพิ่มสินค้า (ดาว ✦ + เม็ดสีทอง) — เล่นด้วย Web Animations แล้วลบตัวเอง ไม่ค้างใน DOM */
export function burstSparkles(sourceEl: HTMLElement, count = 12) {
  const rect = sourceEl.getBoundingClientRect()
  burstSparklesAt(rect.left + rect.width / 2, rect.top + rect.height / 2, count)
}

/** ประกายทองแตกกระจายจากพิกัดหน้าจอที่ระบุ (ใช้กับการแตะปุ่มหลักทั่วระบบ) */
export function burstSparklesAt(cx: number, cy: number, count = 12) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#ffffff', '#d97706']
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    const star = i % 3 === 0
    el.textContent = star ? '✦' : ''
    el.setAttribute('aria-hidden', 'true')
    const size = star ? 14 + Math.random() * 8 : 5 + Math.random() * 5
    el.style.cssText = [
      'position:fixed',
      `left:${cx - size / 2}px`,
      `top:${cy - size / 2}px`,
      `width:${size}px`,
      `height:${size}px`,
      `font-size:${size}px`,
      'line-height:1',
      'text-align:center',
      `color:${colors[i % colors.length]}`,
      star ? '' : `background:${colors[i % colors.length]};border-radius:50%`,
      'z-index:100',
      'pointer-events:none',
    ].join(';')
    document.body.appendChild(el)
    if (typeof el.animate !== 'function') {
      // เบราว์เซอร์ที่ไม่รองรับ Web Animations: ไม่เล่นเอฟเฟกต์ ลบทิ้งทันที
      el.remove()
      continue
    }
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const dist = 38 + Math.random() * 46
    const anim = el.animate(
      [
        { transform: 'translate(0,0) scale(0.2) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 14}px) scale(1.15) rotate(120deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${Math.cos(angle) * dist * 1.25}px, ${Math.sin(angle) * dist * 1.25 + 22}px) scale(0.1) rotate(220deg)`, opacity: 0 },
      ],
      { duration: 620 + Math.random() * 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )
    anim.onfinish = () => el.remove()
  }
}

/** ตัวเลขนับขึ้นจาก 0 → ค่าจริงแบบนุ่มๆ (ease-out) ใช้กับยอดเงินให้ดูมีชีวิต — เปลี่ยนค่าใหม่ก็นับต่อจากค่าเดิม */
export function CountUp({ value, format = (n: number) => String(n), duration = 800 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const instant = import.meta.env.MODE === 'test'
  const [shown, setShown] = useState(instant ? value : 0)
  const fromRef = useRef(instant ? value : 0)
  useEffect(() => {
    if (instant || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (value - from) * eased
      setShown(v)
      fromRef.current = v
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, instant])
  return <>{format(shown)}</>
}

/** กระดาษสีโปรยฝูงใหญ่เต็มการ์ด (ใช้ในป็อปอัพแจ้งชำระสำเร็จ) — ต้องวางใน container ที่ `relative overflow-hidden` */
export function ConfettiRain({ pieces = 28 }: { pieces?: number }) {
  const colors = ['#f59e0b', '#d97706', '#fbbf24', '#a8551f', '#fcd34d', '#16a34a', '#ef4444']
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: pieces }).map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 8) * 0.12}s`,
            animationDuration: `${1.6 + (i % 5) * 0.3}s`,
            animationIterationCount: 2,
          }}
        />
      ))}
    </div>
  )
}


/** ปุ่มกลับขึ้นบนสุด — โผล่มุมซ้ายล่างเมื่อเลื่อนลงมาไกลแล้ว (มุมขวาล่างเป็นของตะกร้า/แชท) */
export function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > 700)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <button
      type="button"
      aria-label="กลับขึ้นบนสุด"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={
        'fixed bottom-5 left-4 z-30 w-11 h-11 rounded-full bg-white/90 backdrop-blur border-2 border-amber-300 text-stone-800 text-lg font-bold shadow-[0_10px_22px_-10px_rgb(51_32_14_/_0.6)] transition-all duration-300 active:scale-90 ' +
        (show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none')
      }
    >
      ↑
    </button>
  )
}

const HOW_STEPS: { icon: string; title: string; text: string }[] = [
  { icon: '🛒', title: 'เลือกเมนู', text: 'เลือกขนมที่ชอบ ปรับจำนวน แล้วใส่ตะกร้า' },
  { icon: '📝', title: 'กรอกข้อมูล & จ่ายเงิน', text: 'ใส่ชื่อ วันรับของ แล้วสแกน QR พร้อมเพย์' },
  { icon: '🎁', title: 'รอรับขนมสดใหม่', text: 'ร้านอบตามที่สั่ง นัดรับเองหรือส่งขนส่ง ติดตามสถานะได้ตลอด' },
]

/** แถบ "สั่งง่ายใน 3 ขั้นตอน" ใต้แถบจุดขาย — การ์ด 3 ใบมีเลขขั้นสีทอง ไอคอนลอยเบาๆ เส้นประเชื่อมกัน โผล่ไล่ทีละใบตอนเลื่อนมาเห็น */
export function HowItWorks() {
  return (
    <section className="max-w-5xl mx-auto px-4 mt-8" aria-label="สั่งง่ายใน 3 ขั้นตอน">
      <Reveal className="text-center mb-5">
        <h2 className="text-xl font-display font-bold text-stone-900">สั่งง่ายใน 3 ขั้นตอน</h2>
        <SquiggleUnderline className="w-20 h-2.5 mx-auto mt-1 text-amber-700/50" />
      </Reveal>
      <div className="relative grid gap-4 sm:grid-cols-3">
        <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-[3.2rem] hidden sm:block border-t-2 border-dashed border-amber-400/60" aria-hidden="true" />
        {HOW_STEPS.map((st, i) => (
          <Reveal key={st.title} delay={i * 0.12}>
            <div className="glow-card relative h-full rounded-3xl border border-amber-200/80 bg-white/90 px-4 pb-5 pt-9 text-center shadow-[0_14px_30px_-18px_rgb(51_32_14_/_0.5)] transition-all duration-300 hover:-translate-y-1">
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 text-white font-display font-bold text-lg grid place-items-center ring-4 ring-amber-50 shadow-lg">
                {i + 1}
              </span>
              <div className="mx-auto mb-2 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 grid place-items-center text-4xl animate-float-slow" style={{ animationDelay: `${i * 0.5}s` }}>
                {st.icon}
              </div>
              <p className="font-display font-semibold text-stone-900">{st.title}</p>
              <p className="mt-1 text-sm text-stone-500 leading-relaxed">{st.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
