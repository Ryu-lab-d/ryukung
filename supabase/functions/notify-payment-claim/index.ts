import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

function formatBaht(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * ลูกค้า (ไม่ต้องล็อกอิน) กด "ยืนยันการชำระเงิน" หลังโอนเงินแล้ว — ฟังก์ชันนี้แค่บันทึกว่าลูกค้าแจ้งมาเมื่อไหร่
 * แล้วอีเมลแจ้งเจ้าของร้าน ไม่ได้ตัดสถานะจ่ายเงินอัตโนมัติเด็ดขาด (ต้องรอเจ้าหน้าที่ตรวจสอบยอด/สลิปจริงก่อนเสมอ)
 * รับแค่ token ของออเดอร์เท่านั้น ไม่รับ to/subject/html จากผู้เรียกเหมือน send-customer-email เพื่อกันเอาไปส่ง
 * อีเมลอะไรก็ได้ — เนื้อหาอีเมลถูกกำหนดตายตัวในนี้ทั้งหมด ส่งได้แค่ไปที่อีเมลรับแจ้งเตือนที่ร้านตั้งไว้เท่านั้น
 */
Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { token } = await req.json()
    if (!token || typeof token !== 'string' || token.length < 20) {
      return new Response(JSON.stringify({ error: 'token ไม่ถูกต้อง' }), { status: 400, headers: cors })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: order } = await admin
      .from('orders')
      .select('id, order_no, grand_total, payment_claimed_at, customers(name)')
      .eq('public_token', token)
      .eq('is_draft', false)
      .neq('work_status', 'cancelled')
      .maybeSingle()

    if (!order) {
      return new Response(JSON.stringify({ error: 'ไม่พบออเดอร์นี้' }), { status: 404, headers: cors })
    }

    if (order.payment_claimed_at) {
      // เคยแจ้งไปแล้ว ไม่ส่งอีเมลซ้ำกันสแปม แต่ตอบสำเร็จเหมือนเดิมให้ฝั่งลูกค้าเห็นสถานะปกติ
      return new Response(JSON.stringify({ ok: true, alreadyClaimed: true }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: payments } = await admin.from('payments').select('amount').eq('order_id', order.id)
    const paidTotal = (payments ?? []).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0)
    const balanceDue = Math.max(Number(order.grand_total) - paidTotal, 0)

    const claimedAt = new Date().toISOString()
    await admin.from('orders').update({ payment_claimed_at: claimedAt }).eq('id', order.id)

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

      const customerName = (order as { customers?: { name: string } | null }).customers?.name ?? 'ลูกค้า'
      const thaiTime = new Date(claimedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
      const html = `<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; background:#fbf1e4; padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#3d2b1f;padding:24px;text-align:center;">
      <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">🥐 ${settings.shop_name}</p>
    </div>
    <div style="padding:28px 26px;font-size:15px;line-height:1.6;color:#514234;">
      <p>ลูกค้าแจ้งว่าชำระเงินแล้วค่ะ 💰 กรุณาตรวจสอบและอัปเดตสถานะในระบบ</p>
      <div style="background:#f7ede0;border-radius:12px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 6px;"><strong>เลขที่ออเดอร์:</strong> ${order.order_no ?? '-'}</p>
        <p style="margin:0 0 6px;"><strong>ลูกค้า:</strong> ${customerName}</p>
        <p style="margin:0 0 6px;"><strong>ยอดที่แจ้งว่าชำระ:</strong> ${formatBaht(balanceDue)} บาท</p>
        <p style="margin:0;"><strong>เวลาที่แจ้ง:</strong> ${thaiTime}</p>
      </div>
    </div>
    <div style="padding:16px 26px;background:#f7ede0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#a1927d;">อีเมลนี้ส่งอัตโนมัติจากระบบร้าน กรุณาอย่าตอบกลับอีเมลฉบับนี้โดยตรง</p>
    </div>
  </div>
</div>`

      await transporter.sendMail({
        from: `"RYUKUNG_BAKERY(STA)" <${smtpUser}>`,
        to: settings.owner_notification_email,
        subject: `💰 ลูกค้าแจ้งชำระเงินแล้ว ออเดอร์ ${order.order_no ?? '-'} — ${settings.shop_name}`,
        html,
      })
    }

    return new Response(JSON.stringify({ ok: true, alreadyClaimed: false }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
