import { useState } from 'react'
import { Reveal } from './PublicSiteChrome'
import { checkPromoCode, computeDiscount, promoSummary, type PublicPromo } from '../lib/promoApi'
import { formatBaht } from '../lib/money'

/** แบนเนอร์โปรอัตโนมัติที่เปิดอยู่ (หน้าเมนู) */
export function PromoBanner({ promos }: { promos: PublicPromo[] }) {
  if (promos.length === 0) return null
  return (
    <Reveal className="max-w-5xl mx-auto px-4 mt-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-800 text-white p-4 shadow-[0_16px_32px_-16px_rgb(146_82_12_/_0.8)]">
        <span className="pointer-events-none absolute -right-6 -top-6 text-8xl opacity-15 rotate-12" aria-hidden="true">🎁</span>
        <div className="relative space-y-2">
          <p className="text-xs font-bold tracking-widest text-amber-100">🎉 โปรโมชั่นตอนนี้</p>
          {promos.map((p) => (
            <div key={p.id}>
              <p className="font-display text-lg font-bold leading-tight">{p.name}</p>
              <p className="text-sm text-white/90">
                {promoSummary(p)} — ระบบลดให้อัตโนมัติ{p.ends_at ? ` · ถึง ${new Date(p.ends_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  )
}

/**
 * กล่องส่วนลดตอนทวนรายการ: โชว์โปรอัตโนมัติที่ได้ (หรือบอกว่าซื้ออีกเท่าไหร่ถึงจะได้) และช่องกรอกโค้ดส่วนลดเอง
 * โค้ดที่ใช้ได้จะใช้แทนโปรอัตโนมัติ
 */
export function PromoBox({
  subtotal,
  autoPromo,
  nextAuto,
  codePromo,
  onCodeChange,
}: {
  subtotal: number
  autoPromo: PublicPromo | null
  /** โปรอัตโนมัติที่ยังไม่ถึงขั้นต่ำ (ไว้ชวนซื้อเพิ่ม) */
  nextAuto: PublicPromo | null
  codePromo: PublicPromo | null
  onCodeChange: (p: PublicPromo | null) => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function apply() {
    if (!code.trim()) return
    setBusy(true)
    setMsg(null)
    const { promo, message } = await checkPromoCode(code)
    setBusy(false)
    if (!promo) return setMsg(message)
    if (computeDiscount(promo, subtotal) <= 0) {
      return setMsg(`โค้ดนี้ใช้ได้เมื่อซื้อครบ ${formatBaht(promo.min_subtotal)} บาท (ตอนนี้ ${formatBaht(subtotal)} บาท)`)
    }
    onCodeChange(promo)
  }

  const active = codePromo ?? autoPromo
  const discount = computeDiscount(active, subtotal)

  return (
    <Reveal delay={0.1} className="relative overflow-hidden bg-white rounded-3xl border border-amber-300 shadow-[0_10px_28px_-14px_rgb(51_32_14_/_0.4)] p-5 space-y-3">
      <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-300 via-amber-600 to-amber-300" aria-hidden="true" />
      <h2 className="text-sm font-display font-semibold text-stone-800">🎟️ ส่วนลด / โค้ดโปรโมชั่น</h2>

      {active && discount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-green-50 border border-green-200 px-3.5 py-2.5 animate-form-in">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-green-800 truncate">✓ {active.name}{codePromo ? ` (${codePromo.code})` : ' · โปรอัตโนมัติ'}</p>
            <p className="text-xs text-green-700">ลดให้ {formatBaht(discount)} บาท</p>
          </div>
          {codePromo && (
            <button type="button" onClick={() => { onCodeChange(null); setCode('') }} className="shrink-0 text-xs font-semibold text-green-800 underline">
              เอาออก
            </button>
          )}
        </div>
      )}

      {!codePromo && nextAuto && computeDiscount(nextAuto, subtotal) <= 0 && (
        <p className="rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs text-amber-900">
          💡 {nextAuto.name}: ซื้อเพิ่มอีก <b>{formatBaht(Number(nextAuto.min_subtotal) - subtotal)}</b> บาท จะได้ {promoSummary({ ...nextAuto, min_subtotal: 0 })}
        </p>
      )}

      {!codePromo && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void apply() } }}
              placeholder="มีโค้ดส่วนลด? กรอกที่นี่"
              aria-label="โค้ดส่วนลด"
              autoCapitalize="characters"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy || !code.trim()}
              className="shrink-0 rounded-xl bg-stone-900 text-white text-sm font-semibold px-4 disabled:opacity-40 active:scale-95 transition-transform"
            >
              {busy ? '…' : 'ใช้โค้ด'}
            </button>
          </div>
          {msg && <p role="alert" className="text-xs text-red-600">{msg}</p>}
        </div>
      )}
    </Reveal>
  )
}
