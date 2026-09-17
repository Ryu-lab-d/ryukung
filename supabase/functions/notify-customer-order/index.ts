import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function formatBaht(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * ลูกค้าสั่งของเองจากหน้าเมนู (/menu) แล้วอีเมลแจ้งเจ้าของร้านให้เข้ามาตรวจสอบ/ยืนยัน — เรียกแบบ best-effort
 * จาก frontend หลัง submit_customer_order สำเร็จเท่านั้น (เหมือนที่ OrderFormPage.tsx ยิงอีเมลแบบ best-effort
 * หลัง confirmOrder สำเร็จ) รับแค่ order_id ไม่รับเนื้อหาอีเมลจากผู้เรียกเหมือน notify-payment-claim
 */
Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { order_id } = await req.json()
    if (!order_id || typeof order_id !== 'string') {
      return new Response(JSON.stringify({ error: 'order_id ไม่ถูกต้อง' }), { status: 400, headers: cors })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: order } = await admin
      .from('orders')
      .select('id, grand_total, needed_date, fulfillment_type, note, customers(name, phone), order_items(product_name, qty)')
      .eq('id', order_id)
      .eq('order_source', 'customer')
      .maybeSingle()

    if (!order) {
      return new Response(JSON.stringify({ error: 'ไม่พบออเดอร์นี้' }), { status: 404, headers: cors })
    }

    const { data: settings } = await admin
      .from('settings')
      .select('shop_name, owner_notification_email')
      .limit(1)
      .maybeSingle()

    if (settings?.owner_notification_email) {
      const smtpUser = Deno.env.get('SMTP_USER')!
      const smtpPass = Deno.env.get('SMTP_PASS')!
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      })

      const customer = (order as { customers?: { name: string; phone: string | null } | null }).customers
      const items = (order.order_items as { product_name: string; qty: number }[])
        .map((it) => `${it.product_name} x${it.qty}`)
        .join(', ')
      const fulfillmentLabel: Record<string, string> = { pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง' }

      const html = `<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; background:#fbf1e4; padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#3d2b1f;padding:24px;text-align:center;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">🥐 ${settings.shop_name}</p>
    </div>
    <div style="padding:28px 26px;font-size:15px;line-height:1.6;color:#514234;">
      <p>มีลูกค้าสั่งของเองจากหน้าเมนูออนไลน์ 🛎️ รอการตรวจสอบ/ยืนยันจากร้าน</p>
      <div style="background:#f7ede0;border-radius:12px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 6px;"><strong>ลูกค้า:</strong> ${customer?.name ?? '-'} ${customer?.phone ? `(${customer.phone})` : ''}</p>
        <p style="margin:0 0 6px;"><strong>รายการ:</strong> ${items}</p>
        <p style="margin:0 0 6px;"><strong>ยอดรวม:</strong> ${formatBaht(Number(order.grand_total))} บาท</p>
        <p style="margin:0 0 6px;"><strong>วิธีรับของ:</strong> ${fulfillmentLabel[order.fulfillment_type] ?? order.fulfillment_type}</p>
        <p style="margin:0;"><strong>วันที่ต้องการ:</strong> ${order.needed_date ?? '-'}</p>
      </div>
      <p>เข้าไปดู/ยืนยันได้ที่หน้า "ออเดอร์รอยืนยัน" ในระบบร้านค่ะ</p>
    </div>
    <div style="padding:16px 26px;background:#f7ede0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#a1927d;">อีเมลนี้ส่งอัตโนมัติจากระบบร้าน กรุณาอย่าตอบกลับอีเมลฉบับนี้โดยตรง</p>
    </div>
  </div>
</div>`

      await transporter.sendMail({
        from: `"RYUKUNG_BAKERY(STA)" <${smtpUser}>`,
        to: settings.owner_notification_email,
        subject: `🛎️ มีออเดอร์ใหม่จากลูกค้ารอยืนยัน — ${settings.shop_name}`,
        html,
      })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
