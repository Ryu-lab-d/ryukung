import { createClient } from '@supabase/supabase-js'

/**
 * แปลงข้อความเป็นเสียงพูดภาษาไทยผ่าน Google Cloud Text-to-Speech — ใช้แทนเสียงในเครื่อง (Web Speech API)
 * เพราะเสียงในเครื่องขึ้นอยู่กับว่าอุปกรณ์นั้นติดตั้งเสียงไทยไว้หรือเปล่า (Windows ส่วนใหญ่ไม่มีมาให้ตั้งแต่แรก)
 * ทำให้ได้เสียงภาษาอังกฤษอ่านคำไทยแทนบางเครื่อง — เสียงจากเซิร์ฟเวอร์นี้ออกมาถูกต้องเหมือนกันทุกเครื่องเสมอ
 * ไม่ต้องพึ่งว่าเครื่องผู้ใช้มีเสียงไทยติดตั้งไว้หรือไม่
 *
 * ต้องตั้งค่า secret GOOGLE_TTS_API_KEY ไว้ก่อน (Google Cloud Console > APIs & Services > Credentials
 * สร้าง API key แล้วเปิดใช้งาน "Cloud Text-to-Speech API") — ถ้ายังไม่ได้ตั้งไว้ ฟังก์ชันนี้จะคืน error
 * ชัดเจน ฝั่งหน้าเว็บจะ fallback ไปใช้เสียงในเครื่องแทนอัตโนมัติ ไม่ทำให้แอปพัง
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

    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'ข้อมูลไม่ครบ (text)' }), { status: 400, headers: cors })
    }

    const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ยังไม่ได้ตั้งค่า GOOGLE_TTS_API_KEY' }), { status: 501, headers: cors })
    }

    const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'th-TH', name: 'th-TH-Standard-A' },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    })

    if (!ttsRes.ok) {
      const detail = await ttsRes.text()
      return new Response(JSON.stringify({ error: `Google TTS ผิดพลาด: ${detail}` }), { status: 502, headers: cors })
    }

    const { audioContent } = await ttsRes.json()
    return new Response(JSON.stringify({ audioContent }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
