import type { ReactNode } from 'react'
import { AmbientGlow, Reveal } from './PublicSiteChrome'
import { productImageUrl } from '../products/ProductCard'
import { formatBaht } from '../lib/money'

export type TicketItem = {
  product_id: string
  product_name: string
  unit_price: number
  unit: string
  qty: number
  imagePath: string | null
}

/** การ์ดหัวหน้ากรอกข้อมูลรับของ — พื้นหลังสีแบรนด์ที่ขยับตลอด (bg-brand-shader + AmbientGlow) ไอคอนเด้งเข้า
 * พร้อมชิปสรุปจำนวนรายการ/ยอดรวม ให้ลูกค้ารู้ทันทีว่ากำลังสั่งอะไรอยู่เท่าไหร่ ตั้งแต่เห็นหน้าแรก */
export function CheckoutHero({ count, total }: { count: number; total: number }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-5 shadow-[0_16px_40px_-16px_rgb(51_32_14_/_0.6)] animate-form-in">
      <AmbientGlow />
      <div className="relative z-10 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur grid place-items-center text-3xl shrink-0 animate-icon-pop">
          📝
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold leading-tight">กรอกข้อมูลรับของ</h1>
          <p className="text-sm text-white/80 mt-0.5">กรอกให้ครบเพื่อความรวดเร็วในการจัดส่ง</p>
        </div>
      </div>
      <div className="relative z-10 mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-white/15 backdrop-blur px-3 py-1">🧺 {count} รายการ</span>
        <span className="rounded-full bg-white/15 backdrop-blur px-3 py-1 tabular-nums">💰 {formatBaht(total)} บาท</span>
      </div>
    </div>
  )
}

/** หัวหน้าทั่วไปของขั้นตอนสั่งซื้อ (ทวนรายการ/เงื่อนไข/ชำระเงิน) หน้าตาเดียวกับ CheckoutHero — การ์ดสีแบรนด์ขยับได้
 * ไอคอนเด้งเข้า ใช้ร่วมกันให้ทุกขั้นตอนดูเป็นชุดเดียวกัน */
export function StepHero({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-5 shadow-[0_16px_40px_-16px_rgb(51_32_14_/_0.6)] animate-form-in">
      <AmbientGlow />
      <div className="relative z-10 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur grid place-items-center text-3xl shrink-0 animate-icon-pop">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-display font-bold leading-tight">{title}</h1>
          <p className="text-sm text-white/80 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

/** สรุปรายการสั่งแบบ "ตั๋ว/ใบเสร็จ" — รูปสินค้ามีป้ายจำนวน เส้นประแบ่งตรงกลางพร้อมรอยปรุสองข้าง ยอดรวมตัวใหญ่ท้ายใบ */
export function OrderTicket({ items, grandTotal, delay = 0 }: { items: TicketItem[]; grandTotal: number; delay?: number }) {
  return (
    <Reveal
      delay={delay}
      className="relative bg-white rounded-3xl border border-stone-200/70 shadow-[0_10px_28px_-14px_rgb(51_32_14_/_0.4)]"
    >
      <div className="p-5 pb-4 space-y-3">
        <h2 className="text-sm font-display font-semibold text-stone-700">🧺 รายการที่สั่ง ({items.length})</h2>
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.product_id} className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl bg-stone-100 overflow-hidden shrink-0 grid place-items-center text-lg">
                {it.imagePath ? (
                  <img src={productImageUrl(it.imagePath)} alt={it.product_name} className="w-full h-full object-cover" />
                ) : (
                  '🧁'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-800 truncate">{it.product_name}</p>
                <p className="text-xs text-stone-400">
                  x{it.qty} {it.unit} · {formatBaht(it.unit_price)} บาท
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-stone-900">{formatBaht(it.unit_price * it.qty)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative" aria-hidden="true">
        <div className="border-t-2 border-dashed border-stone-200 mx-5" />
        <span className="absolute -left-2.5 -top-2.5 w-5 h-5 rounded-full bg-stone-50" />
        <span className="absolute -right-2.5 -top-2.5 w-5 h-5 rounded-full bg-stone-50" />
      </div>

      <div className="flex items-end justify-between px-5 pt-3.5 pb-5">
        <span className="text-sm text-stone-500">ยอดรวม</span>
        <span className="text-2xl font-bold tabular-nums text-stone-900">
          {formatBaht(grandTotal)} <span className="text-sm font-medium text-stone-500">บาท</span>
        </span>
      </div>
    </Reveal>
  )
}

/** การ์ดหมวดของฟอร์ม มีเลขลำดับ แถบสีอำพันด้านข้าง และเรืองขอบเมื่อกำลังกรอกอยู่ภายใน (focus-within) */
export function FormSection({
  no,
  icon,
  title,
  subtitle,
  delay = 0,
  children,
}: {
  no: number
  icon: string
  title: string
  subtitle?: string
  delay?: number
  children: ReactNode
}) {
  return (
    <Reveal
      delay={delay}
      className="relative overflow-hidden bg-white rounded-3xl border border-stone-200/70 shadow-[0_10px_28px_-14px_rgb(51_32_14_/_0.4)] p-5 pl-6 transition-all duration-300 focus-within:shadow-[0_12px_32px_-12px_rgb(51_32_14_/_0.4)] focus-within:border-amber-300/80"
    >
      <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-700" aria-hidden="true" />
      <div className="flex items-center gap-3 mb-4">
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-50 to-stone-100 border border-amber-100 grid place-items-center text-xl">
            {icon}
          </div>
          <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-stone-900 text-white text-[11px] font-bold grid place-items-center">
            {no}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-stone-900">{title}</h2>
          {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Reveal>
  )
}

/** ช่องกรอกมีไอคอนนำหน้า และเครื่องหมายถูกสีเขียวเด้งขึ้นเมื่อกรอกถูกรูปแบบแล้ว (ฟีดแบ็กทันทีว่าผ่าน) */
export function IconInput({
  id,
  label,
  icon,
  hint,
  valid = false,
  type = 'text',
  value,
  onChange,
  required,
  placeholder,
  inputMode,
}: {
  id: string
  label: string
  icon: string
  hint?: string
  valid?: boolean
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric'
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-500">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base opacity-70" aria-hidden="true">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          required={required}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            'w-full rounded-xl border bg-white pl-10 pr-10 py-2.5 text-stone-900 placeholder:text-stone-400 shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-600/60 ' +
            (valid ? 'border-emerald-300' : 'border-stone-300')
          }
        />
        {valid && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" aria-hidden="true">
            <span className="animate-qty-pop w-5 h-5 rounded-full bg-emerald-500 text-white text-xs leading-5 text-center">✓</span>
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  )
}
