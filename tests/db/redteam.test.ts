import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { adminClient, anonClient } from './helpers'

// จำลองผู้โจมตีที่มีแค่ anon key (ใครเปิดเว็บก็ดึงไปได้) — ทุกข้อต้อง "ไม่สำเร็จ"
const cleanup = { questions: [] as string[] }
afterAll(async () => {
  const admin = adminClient()
  for (const q of cleanup.questions) await admin.from('chat_unanswered_questions').delete().eq('question_text', q)
  // ล้างตัวนับจำกัดอัตราของเทสต์นี้ เพื่อไม่ให้กระทบเทสต์/ผู้ใช้จริงในนาทีเดียวกัน
  await admin.from('chat_usage').delete().like('usage_key', 'promo-fail:%')
  await admin.from('chat_usage').delete().like('usage_key', 'learn-fail:%')
})

describe('red team — เดารหัส', () => {
  it('เดาโค้ดส่วนลดผิดเกิน 30 ครั้งต่อนาที ถูกบล็อกทั้งระบบ (ตอบเหมือนผิดหมด)', async () => {
    const db = anonClient()
    let blocked = 0
    for (let i = 0; i < 36; i++) {
      const r = await db.rpc('check_promo_code', { p_code: 'RYU-GUESS' + i })
      expect(r.data.valid).toBe(false)
      if (String(r.data.message).includes('บ่อยเกินไป')) blocked++
    }
    expect(blocked).toBeGreaterThan(0)
  })

  it('เดารหัสเข้าเรียนผิดรัวๆ ถูกบล็อก', async () => {
    const db = anonClient()
    let nulls = 0
    for (let i = 0; i < 36; i++) {
      const r = await db.rpc('learn_open', { p_code: 'COOK-GUESS' + i })
      expect(r.error).toBeNull()
      if (r.data === null) nulls++
    }
    expect(nulls).toBe(36)
  })
})

describe('red team — ยัดข้อมูลเกินขนาด', () => {
  it('log_unanswered_chat_question: คำถามยาวเกิน/ว่าง ไม่ถูกบันทึก', async () => {
    const admin = adminClient()
    const long = 'ยาวเกิน'.repeat(100)
    await anonClient().rpc('log_unanswered_chat_question', { p_question: long })
    await anonClient().rpc('log_unanswered_chat_question', { p_question: '   ' })
    const r = await admin.from('chat_unanswered_questions').select('id').eq('question_text', long)
    expect(r.data ?? []).toEqual([])
    const ok = 'redteam-ทดสอบคำถาม'
    cleanup.questions.push(ok)
    await anonClient().rpc('log_unanswered_chat_question', { p_question: ok })
    expect((await admin.from('chat_unanswered_questions').select('id').eq('question_text', ok)).data!.length).toBe(1)
  })

  it('update_public_order_address: token มั่ว → false และข้อมูลยาวเกิน → ปฏิเสธ', async () => {
    const db = anonClient()
    expect((await db.rpc('update_public_order_address', { p_token: 'x'.repeat(30), p_recipient_name: 'a', p_recipient_phone: '1', p_address_text: 'x' })).data).toBe(false)
    const big = await db.rpc('update_public_order_address', { p_token: 'x'.repeat(30), p_recipient_name: 'a', p_recipient_phone: '1', p_address_text: 'x'.repeat(700) })
    expect(big.error).not.toBeNull()
  })
})

describe('red team — ลิงก์อันตราย', () => {
  it('line_url / video_url ที่ไม่ใช่ http(s) ถูกฐานข้อมูลปฏิเสธ', async () => {
    const admin = adminClient()
    const s = await admin.from('settings').select('id, line_url').limit(1).single()
    const bad = await admin.from('settings').update({ line_url: 'javascript:alert(1)' }).eq('id', s.data!.id)
    expect(bad.error).not.toBeNull()
    const c = await admin.from('courses').insert({ title: 'redteam-tmp' }).select().single()
    const lbad = await admin.from('course_lessons').insert({ course_id: c.data!.id, title: 'x', video_url: 'javascript:alert(1)' })
    expect(lbad.error).not.toBeNull()
    await admin.from('courses').delete().eq('id', c.data!.id)
  })
})

describe('red team — ช่องทางอื่น', () => {
  it('anon ฟัง realtime ตาราง orders ไม่ได้รับเหตุการณ์ใดๆ', async () => {
    const db = anonClient()
    const events: unknown[] = []
    const ch = db.channel('redteam-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => events.push(p))
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') resolve()
      })
      setTimeout(resolve, 5000)
    })
    const admin = adminClient()
    const o = await admin.from('orders').insert({ is_draft: true, order_source: 'staff' }).select().single()
    await new Promise((r) => setTimeout(r, 3000))
    await admin.from('orders').delete().eq('id', o.data!.id)
    await db.removeChannel(ch)
    expect(events).toEqual([])
  })

  it('อ่านไฟล์สลิป (ที่เก็บส่วนตัว) ด้วย anon ไม่ได้ และแสดงรายการไฟล์ไม่ได้', async () => {
    const db = anonClient()
    const list = await db.storage.from('slips').list('')
    expect(list.data ?? []).toEqual([])
    const dl = await db.storage.from('slips').download('any/file.png')
    expect(dl.error).not.toBeNull()
    const up = await db.storage.from('slips').upload('evil.png', new Blob(['x'], { type: 'image/png' }))
    expect(up.error).not.toBeNull()
    const up2 = await db.storage.from('product-images').upload('evil.png', new Blob(['x'], { type: 'image/png' }))
    expect(up2.error).not.toBeNull()
  })
})

describe('red team — คนสมัครบัญชีเองแต่ไม่ใช่พนักงาน (authenticated แต่ไม่มีสิทธิ์)', () => {
  it('อ่าน/เขียนข้อมูลร้านไม่ได้เลย เรียกฟังก์ชันหลังบ้านไม่ได้ และยกระดับสิทธิ์ตัวเองไม่ได้', async () => {
    const admin = adminClient()
    const email = `redteam-${Date.now()}@example.com`
    const password = 'Redteam-' + Math.random().toString(36).slice(2) + 'Aa1!'
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    expect(created.error).toBeNull()
    const uid = created.data.user!.id
    try {
      const attacker = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
      const login = await attacker.auth.signInWithPassword({ email, password })
      expect(login.error).toBeNull()

      // อ่านตารางสำคัญ: ต้องได้ว่างเปล่า (ไม่ใช่ข้อมูลจริง)
      for (const t of ['orders', 'customers', 'payments', 'settings', 'expenses', 'products', 'invoices', 'promotions', 'course_access_codes', 'audit_log', 'staff_members', 'ingredients']) {
        const r = await attacker.from(t).select('*').limit(5)
        expect(r.data ?? [], `อ่าน ${t} ได้`).toEqual([])
      }
      // เขียน/ลบ/แก้ ไม่ได้
      expect((await attacker.from('orders').insert({ is_draft: true, order_source: 'staff' })).error).not.toBeNull()
      expect((await attacker.from('promotions').insert({ name: 'x', kind: 'amount', value: 1 })).error).not.toBeNull()
      expect((await attacker.from('settings').update({ shop_name: 'HACKED' }).not('id', 'is', null)).error ?? { ok: 1 }).toBeTruthy()
      const shop = await admin.from('settings').select('shop_name').limit(1).single()
      expect(shop.data!.shop_name).not.toBe('HACKED')
      // ฟังก์ชันหลังบ้าน: ถูกปฏิเสธ
      for (const [fn, args] of [
        ['next_order_no', {}], ['create_pos_sale', { p_items: [], p_payment_method: 'cash' }],
        ['purge_expired_invoices', {}], ['next_invoice_no', {}], ['next_receipt_no', {}], ['adjust_ingredient_stock', { p_ingredient_id: '00000000-0000-0000-0000-000000000000', p_qty_delta: 1, p_note: 'x' }],
      ] as [string, Record<string, unknown>][]) {
        expect((await attacker.rpc(fn, args)).error, fn).not.toBeNull()
      }
      // ยกระดับสิทธิ์: ขอเป็นพนักงานได้แค่ "pending" และแก้ role/status ตัวเองไม่ได้
      const claim = await attacker.rpc('claim_staff_invite', { p_display_name: 'แฮกเกอร์' })
      expect(claim.data).toBe('pending')
      const esc = await attacker.from('staff_members').update({ role: 'owner', status: 'active' }).eq('user_id', uid).select()
      expect(esc.data ?? []).toEqual([])
      const row = await admin.from('staff_members').select('role, status').eq('user_id', uid).single()
      expect(row.data).toEqual({ role: 'staff', status: 'pending' })
      expect((await attacker.rpc('is_active_member')).data).toBe(false)
      // pending ก็ยังอ่านข้อมูลไม่ได้
      expect((await attacker.from('orders').select('id').limit(1)).data ?? []).toEqual([])
    } finally {
      await admin.from('staff_members').delete().eq('user_id', uid)
      await admin.auth.admin.deleteUser(uid)
    }
  })
})

describe('red team — พนักงานธรรมดา (role=staff) พยายามยกระดับ/ทำเกินสิทธิ์', () => {
  it('แก้ role ตัวเอง เชิญคน ลบพนักงาน ออกโปร/คอร์ส อ่าน audit แก้อีเมลรับแจ้งของร้าน ไม่ได้', async () => {
    const admin = adminClient()
    const email = `redteam-staff-${Date.now()}@example.com`
    const password = 'Redteam-' + Math.random().toString(36).slice(2) + 'Aa1!'
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    const uid = created.data.user!.id
    const ins = await admin.from('staff_members').insert({ user_id: uid, email, display_name: 'redteam-staff', role: 'staff', status: 'active' }).select().single()
    expect(ins.error).toBeNull()
    const before = await admin.from('settings').select('id, owner_notification_email, shop_name, promptpay').limit(1).single()
    try {
      const staff = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
      expect((await staff.auth.signInWithPassword({ email, password })).error).toBeNull()
      expect((await staff.rpc('is_active_member')).data).toBe(true)

      // ยกระดับตัวเอง
      const up = await staff.from('staff_members').update({ role: 'owner' }).eq('user_id', uid).select()
      const role = await admin.from('staff_members').select('role').eq('user_id', uid).single()
      expect(role.data!.role, `up=${JSON.stringify(up.error)}`).toBe('staff')
      // เชิญ/ลบพนักงาน
      expect((await staff.from('staff_members').insert({ email: 'x@example.com', role: 'owner', status: 'active' })).error).not.toBeNull()
      const del = await staff.from('staff_members').delete().neq('user_id', uid).select()
      expect(del.data ?? []).toEqual([])
      // ฟีเจอร์ของผู้จัดการ/เจ้าของ
      expect((await staff.from('promotions').insert({ name: 'x', kind: 'amount', value: 1 })).error).not.toBeNull()
      expect((await staff.from('courses').insert({ title: 'x' })).error).not.toBeNull()
      expect((await staff.from('course_access_codes').insert({ code: 'COOK-REDTEAMX', student_name: 'x' })).error).not.toBeNull()
      expect((await staff.from('audit_log').select('id').limit(1)).data ?? []).toEqual([])
      // ตั้งค่าร้านที่เป็นจุดเสี่ยง (อีเมลรับแจ้งออเดอร์/พร้อมเพย์) — พนักงานธรรมดาต้องแก้ไม่ได้
      await staff.from('settings').update({ owner_notification_email: 'attacker@example.com', promptpay: '0000000000' }).eq('id', before.data!.id)
      const after = await admin.from('settings').select('owner_notification_email, promptpay').eq('id', before.data!.id).single()
      expect(after.data!.owner_notification_email).toBe(before.data!.owner_notification_email)
      expect(after.data!.promptpay).toBe(before.data!.promptpay)
    } finally {
      await admin.from('settings').update({ owner_notification_email: before.data!.owner_notification_email, promptpay: before.data!.promptpay }).eq('id', before.data!.id)
      await admin.from('staff_members').delete().eq('user_id', uid)
      await admin.auth.admin.deleteUser(uid)
    }
  })
})
