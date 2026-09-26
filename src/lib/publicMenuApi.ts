import { supabase } from './supabase'

export type PublicMenuProduct = {
  id: string
  name: string
  price: number
  unit: string
  image_path: string | null
  category_id: string | null
}
export type PublicMenuCategory = { id: string; name: string }
export type PublicMenu = {
  shop_name: string
  logo_path: string | null
  promptpay: string | null
  line_url: string | null
  phone: string | null
  address: string | null
  faqs: { keywords: string[]; answer: string }[]
  shipping_lead_days: number
  categories: PublicMenuCategory[]
  products: PublicMenuProduct[]
}

export async function getPublicMenu(): Promise<{ menu: PublicMenu | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_public_menu')
  if (error) return { menu: null, error: error.message }
  return { menu: data as PublicMenu, error: null }
}

export type SubmitCustomerOrderInput = {
  customerName: string
  customerPhone: string
  customerEmail: string
  fulfillmentType: 'pickup' | 'shipping'
  neededDate: string
  pickupPlace: string | null
  pickupTime: string | null
  shipRecipientName: string | null
  shipRecipientPhone: string | null
  shipAddressText: string | null
  note: string | null
  items: { product_id: string; qty: number }[]
  /** ผลยืนยัน Cloudflare Turnstile จากฟอร์ม (ดู TurnstileWidget.tsx) — บังคับเสมอ ไม่งั้น Edge Function ปฏิเสธ */
  turnstileToken: string
}

/** ลูกค้ากดส่งคำสั่งซื้อจากหน้าเมนู — ครั้งเดียวจบ (สร้างลูกค้า+ออเดอร์+รายการ+ตั้งว่าจ่ายเงินแล้ว) ออเดอร์ยัง
 * ไม่เข้าคิวอบจนกว่าร้านจะกดยืนยัน — เรียกผ่าน Edge Function submit-customer-order เท่านั้น (ไม่ใช่ .rpc() ตรงๆ
 * แบบเดิม) เพราะ RPC ถูกล็อกให้ anon เรียกตรงไม่ได้แล้ว (ดู migration 20260926090500) ต้องผ่านการตรวจ
 * Turnstile ที่ Edge Function ก่อนเสมอ กันบอทข้าม CAPTCHA ไปเรียก RPC ตรงๆ */
export async function submitCustomerOrder(
  input: SubmitCustomerOrderInput
): Promise<{ orderId: string | null; publicToken: string | null; grandTotal: number; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('submit-customer-order', {
    body: {
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      fulfillment_type: input.fulfillmentType,
      needed_date: input.neededDate,
      pickup_place: input.pickupPlace,
      pickup_time: input.pickupTime,
      ship_recipient_name: input.shipRecipientName,
      ship_recipient_phone: input.shipRecipientPhone,
      ship_address_text: input.shipAddressText,
      note: input.note,
      items: input.items,
      turnstile_token: input.turnstileToken,
    },
  })
  if (error || data?.error) return { orderId: null, publicToken: null, grandTotal: 0, error: data?.error ?? error!.message }
  const result = data as { order_id: string; public_token: string; grand_total: number }
  return { orderId: result.order_id, publicToken: result.public_token, grandTotal: Number(result.grand_total), error: null }
}

/** แจ้งเจ้าของร้านทางอีเมลว่ามีออเดอร์ใหม่รอยืนยัน — best-effort ไม่บล็อกอะไรถ้าส่งไม่สำเร็จ */
export async function notifyCustomerOrder(orderId: string): Promise<void> {
  await supabase.functions.invoke('notify-customer-order', { body: { order_id: orderId } })
}
