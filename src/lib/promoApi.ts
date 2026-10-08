import { supabase } from './supabase'

export type PublicPromo = {
  id: string
  name: string
  description: string | null
  kind: 'percent' | 'amount'
  value: number
  min_subtotal: number
  max_discount: number | null
  ends_at: string | null
  /** มีเฉพาะโค้ดที่ลูกค้ากรอก */
  code?: string
}

/** ส่วนลดของโปรที่ยอดสินค้า subtotal — สูตรเดียวกับ promo_discount ในฐานข้อมูล (ใช้พรีวิวเท่านั้น ตอนสั่งจริงเซิร์ฟเวอร์คิดซ้ำ) */
export function computeDiscount(promo: PublicPromo | null, subtotal: number): number {
  if (!promo || subtotal <= 0 || subtotal < Number(promo.min_subtotal)) return 0
  let d = promo.kind === 'percent' ? Math.round(subtotal * Number(promo.value)) / 100 : Number(promo.value)
  if (promo.kind === 'percent' && promo.max_discount != null) d = Math.min(d, Number(promo.max_discount))
  return Math.min(subtotal, Math.round(d * 100) / 100)
}

/** โปรอัตโนมัติที่ลดมากสุดที่ยอดนี้ (ไม่มีอันที่ใช้ได้ = null) */
export function bestPromo(promos: PublicPromo[], subtotal: number): PublicPromo | null {
  let best: PublicPromo | null = null
  let bestD = 0
  for (const p of promos) {
    const d = computeDiscount(p, subtotal)
    if (d > bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

export function promoSummary(p: PublicPromo): string {
  const off = p.kind === 'percent' ? `ลด ${Number(p.value)}%` : `ลด ${Number(p.value)} บาท`
  const cap = p.kind === 'percent' && p.max_discount != null ? ` (สูงสุด ${Number(p.max_discount)} บาท)` : ''
  const min = Number(p.min_subtotal) > 0 ? ` เมื่อซื้อครบ ${Number(p.min_subtotal)} บาท` : ''
  return off + cap + min
}

export async function getPublicPromotions(): Promise<PublicPromo[]> {
  try {
    const { data, error } = await supabase.rpc('get_public_promotions')
    if (error || !Array.isArray(data)) return []
    return data as PublicPromo[]
  } catch {
    return []
  }
}

export async function checkPromoCode(code: string): Promise<{ promo: PublicPromo | null; message: string | null }> {
  const { data, error } = await supabase.rpc('check_promo_code', { p_code: code })
  if (error) return { promo: null, message: 'ตรวจโค้ดไม่ได้ ลองใหม่อีกครั้ง' }
  const r = data as { valid: boolean; message?: string; promotion?: PublicPromo }
  return r.valid && r.promotion ? { promo: r.promotion, message: null } : { promo: null, message: r.message ?? 'โค้ดส่วนลดไม่ถูกต้อง' }
}

/** สร้างโค้ดสุ่มอ่านง่ายสำหรับหน้าจัดการโปรโมชั่น เช่น RYU-7K3Q9 */
export function generatePromoCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return 'RYU-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
