import { createClient } from '@supabase/supabase-js'

/**
 * ทางเข้าเดียวที่ลูกค้าสั่งของเองจากหน้าเมนู (/menu) ใช้ได้จริง — submit_customer_order (RPC) ถูกล็อกให้
 * เรียกได้เฉพาะ service_role เท่านั้นแล้ว (ดู migration 20260926090500) ฟังก์ชันนี้เป็นตัวเดียวที่ถือ service
 * role key จริง (อยู่ฝั่งเซิร์ฟเวอร์ ไม่ใช่ anon key ที่ฝังอยู่ใน frontend) จึงเป็นจุดเดียวที่ยืนยัน Cloudflare
 * Turnstire token ก่อนเสมอ — กันบอท/สคริปต์ยิง order ปลอมเข้าระบบตรงๆ โดยข้าม CAPTCHA ไปเลย
 */
Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const turnstileToken = body.turnstile_token
    if (!turnstileToken || typeof turnstileToken !== 'string') {
      return new Response(JSON.stringify({ error: 'กรุณายืนยันตัวตนก่อนสั่งซื้อ (ไม่พบผลการยืนยัน)' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ยืนยัน token กับ Cloudflare ก่อนเสมอ — remoteip ใส่เผื่อไว้ได้ถ้ามี (ไม่บังคับ) ช่วยให้ Cloudflare
    // ประเมินความเสี่ยงแม่นขึ้น แต่ไม่ได้ทำให้ validate ผิดถ้าไม่มี
    const remoteIp = req.headers.get('cf-connecting-ip') ?? undefined
    const verifyForm = new FormData()
    verifyForm.append('secret', Deno.env.get('TURNSTILE_SECRET_KEY')!)
    verifyForm.append('response', turnstileToken)
    if (remoteIp) verifyForm.append('remoteip', remoteIp)

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyForm,
    })
    const verifyResult = (await verifyRes.json()) as { success: boolean; ['error-codes']?: string[] }
    if (!verifyResult.success) {
      return new Response(JSON.stringify({ error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await admin.rpc('submit_customer_order', {
      p_customer_name: body.customer_name,
      p_customer_phone: body.customer_phone,
      p_customer_email: body.customer_email,
      p_fulfillment_type: body.fulfillment_type,
      p_needed_date: body.needed_date,
      p_pickup_place: body.pickup_place,
      p_pickup_time: body.pickup_time,
      p_ship_recipient_name: body.ship_recipient_name,
      p_ship_recipient_phone: body.ship_recipient_phone,
      p_ship_address_text: body.ship_address_text,
      p_note: body.note,
      p_items: body.items,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
