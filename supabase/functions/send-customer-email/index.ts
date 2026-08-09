import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

/**
 * ส่งอีเมลแจ้งลูกค้า (รับออเดอร์แล้ว / ได้รับชำระเงินแล้ว / เตือนชำระเงิน) ผ่าน Gmail SMTP เดียวกับที่ใช้
 * ยืนยันตัวตนพนักงานอยู่แล้ว — ฟรี ไม่มีค่าใช้จ่ายเพิ่ม เรียกได้เฉพาะพนักงาน/เจ้าของร้านที่ active เท่านั้น
 * (เช็กสิทธิ์เองในนี้ เพราะ JWT ที่ผ่านมาถึง Edge Function แค่ยืนยันว่าล็อกอินสำเร็จ ไม่ได้แปลว่าได้รับอนุมัติแล้ว)
 */
Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'ไม่ได้ล็อกอิน' }), { status: 401, headers: cors })
    }

    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: staff } = await adminClient
      .from('staff_members')
      .select('status')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (!staff || staff.status !== 'active') {
      return new Response(JSON.stringify({ error: 'ไม่มีสิทธิ์เข้าถึง' }), { status: 403, headers: cors })
    }

    const { to, subject, html } = await req.json()
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'ข้อมูลไม่ครบ (to, subject, html)' }), { status: 400, headers: cors })
    }

    const smtpUser = Deno.env.get('SMTP_USER')!
    const smtpPass = Deno.env.get('SMTP_PASS')!

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    })

    await transporter.sendMail({
      from: `"RYUKUNG_BAKERY(STA)" <${smtpUser}>`,
      to,
      subject,
      html,
    })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
