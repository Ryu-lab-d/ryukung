import { supabase } from './supabase'
import { sendCustomerEmail } from './customerEmail'
import { orderStatusEmail, paymentReceivedEmail } from './emailTemplates'
import { productImageUrl } from '../products/ProductCard'

/** สถานะที่แจ้งลูกค้าทางอีเมลอัตโนมัติ (ข้ามขั้นย่อยของขนส่งที่ลูกค้าไม่จำเป็นต้องได้รับแจ้งทุกขั้น) */
const STATUS_MESSAGES: Record<string, { emoji: string; headline: string; message: string }> = {
  baking: { emoji: '🧑‍🍳', headline: 'ร้านเริ่มทำขนมของคุณแล้ว', message: 'ขนมของคุณกำลังถูกทำสดใหม่ตามที่สั่งค่ะ' },
  ready: { emoji: '🎁', headline: 'แพ็คของเรียบร้อยแล้ว', message: 'ขนมของคุณพร้อมแล้วค่ะ ร้านจะนัดรับหรือจัดส่งตามที่ตกลงไว้' },
  in_transit: { emoji: '🚚', headline: 'พัสดุกำลังเดินทางไปหาคุณ', message: 'ขนส่งรับพัสดุของคุณแล้วและกำลังเดินทางค่ะ' },
  delivered: { emoji: '🎉', headline: 'ส่งมอบเรียบร้อยแล้ว', message: 'ขอบคุณที่อุดหนุนนะคะ หวังว่าจะถูกใจขนมของเรา' },
}

type Loose = any

async function loadContext(orderId: string) {
  const [{ data: order }, { data: settings }] = await Promise.all([
    supabase.from('orders').select('order_no, public_token, grand_total, customers(name, email)').eq('id', orderId).single(),
    supabase.from('settings').select('shop_name, logo_path, auto_notify_customer').single(),
  ])
  const o = order as Loose
  const customer = o?.customers as { name: string; email: string | null } | null | undefined
  if (!o || !settings || settings.auto_notify_customer === false || !customer?.email || !o.public_token) return null
  return {
    order: o,
    customer: { name: customer.name, email: customer.email },
    shopName: settings.shop_name as string,
    logoUrl: settings.logo_path ? productImageUrl(settings.logo_path as string) : null,
    publicUrl: `${window.location.origin}/o/${o.public_token}`,
  }
}

/** แจ้งลูกค้าทางอีเมลเมื่อสถานะงานเปลี่ยน — best-effort ไม่ throw ไม่บล็อกการทำงานหลัก ปิดได้ที่หน้าตั้งค่า */
export async function notifyStatusChanged(orderId: string, status: string): Promise<void> {
  try {
    const msg = STATUS_MESSAGES[status]
    if (!msg) return
    const ctx = await loadContext(orderId)
    if (!ctx) return
    const { subject, html } = orderStatusEmail({
      shopName: ctx.shopName,
      logoUrl: ctx.logoUrl,
      orderNo: ctx.order.order_no ?? '-',
      customerName: ctx.customer.name,
      publicUrl: ctx.publicUrl,
      ...msg,
    })
    await sendCustomerEmail(ctx.customer.email, subject, html)
  } catch {
    // อีเมลเป็นส่วนเสริม ล้มเหลวเงียบๆ ได้
  }
}

/** แจ้งลูกค้าว่าได้รับชำระเงินแล้ว (ใช้กับปุ่มรับเงินบนกระดาน) — คำนวณยอดคงเหลือจากฐานข้อมูลหลังบันทึกแล้ว */
export async function notifyPaymentReceived(orderId: string, amount: number): Promise<void> {
  try {
    const ctx = await loadContext(orderId)
    if (!ctx) return
    const { data: pays } = await supabase.from('payments').select('amount').eq('order_id', orderId)
    const paid = (pays ?? []).reduce((s: number, p: Loose) => s + Number(p.amount), 0)
    const balanceDue = Math.max(0, Number(ctx.order.grand_total) - paid)
    const { subject, html } = paymentReceivedEmail({
      shopName: ctx.shopName,
      logoUrl: ctx.logoUrl,
      orderNo: ctx.order.order_no ?? '-',
      customerName: ctx.customer.name,
      amount,
      balanceDue,
      publicUrl: ctx.publicUrl,
    })
    await sendCustomerEmail(ctx.customer.email, subject, html)
  } catch {
    // ส่งไม่ได้ก็ข้าม
  }
}
