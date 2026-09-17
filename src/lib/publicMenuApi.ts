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
  fulfillmentType: 'pickup' | 'shipping'
  neededDate: string
  pickupPlace: string | null
  pickupTime: string | null
  shipRecipientName: string | null
  shipRecipientPhone: string | null
  shipAddressText: string | null
  note: string | null
  items: { product_id: string; qty: number }[]
}

/** ลูกค้ากดส่งคำสั่งซื้อจากหน้าเมนู — ครั้งเดียวจบ (สร้างลูกค้า+ออเดอร์+รายการ+ตั้งว่าจ่ายเงินแล้ว) ออเดอร์ยัง
 * ไม่เข้าคิวอบจนกว่าร้านจะกดยืนยัน (ดู submit_customer_order ใน migration) */
export async function submitCustomerOrder(
  input: SubmitCustomerOrderInput
): Promise<{ orderId: string | null; publicToken: string | null; grandTotal: number; error: string | null }> {
  const { data, error } = await supabase.rpc('submit_customer_order', {
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_fulfillment_type: input.fulfillmentType,
    p_needed_date: input.neededDate,
    p_pickup_place: input.pickupPlace,
    p_pickup_time: input.pickupTime,
    p_ship_recipient_name: input.shipRecipientName,
    p_ship_recipient_phone: input.shipRecipientPhone,
    p_ship_address_text: input.shipAddressText,
    p_note: input.note,
    p_items: input.items,
  })
  if (error) return { orderId: null, publicToken: null, grandTotal: 0, error: error.message }
  const result = data as { order_id: string; public_token: string; grand_total: number }
  return { orderId: result.order_id, publicToken: result.public_token, grandTotal: Number(result.grand_total), error: null }
}

/** แจ้งเจ้าของร้านทางอีเมลว่ามีออเดอร์ใหม่รอยืนยัน — best-effort ไม่บล็อกอะไรถ้าส่งไม่สำเร็จ */
export async function notifyCustomerOrder(orderId: string): Promise<void> {
  await supabase.functions.invoke('notify-customer-order', { body: { order_id: orderId } })
}
