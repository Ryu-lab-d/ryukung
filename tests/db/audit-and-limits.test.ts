import { describe, it, expect, afterAll } from 'vitest'
import { adminClient, anonClient, signedInClient } from './helpers'

const ids: string[] = []
afterAll(async () => {
  const admin = adminClient()
  if (ids.length) await admin.from('promotions').delete().in('id', ids)
})

describe('audit log', () => {
  it('บันทึกการเพิ่ม/แก้/ลบ — เจ้าของอ่านได้ ลบ/แก้/เขียนเองไม่ได้ anon อ่านไม่ได้', async () => {
    const db = await signedInClient()
    const ins = await db.from('promotions').insert({ name: 'ทดสอบ-audit', kind: 'amount', value: 5, code: 'AUDITTEST1' }).select().single()
    expect(ins.error).toBeNull()
    ids.push(ins.data!.id)
    await db.from('promotions').update({ value: 9, name: 'ทดสอบ-audit-แก้' }).eq('id', ins.data!.id)
    await db.from('promotions').delete().eq('id', ins.data!.id)

    const log = await db.from('audit_log').select('*').eq('table_name', 'promotions').eq('row_id', ins.data!.id).order('id')
    expect(log.error).toBeNull()
    expect(log.data!.map((r) => r.action)).toEqual(['INSERT', 'UPDATE', 'DELETE'])
    const upd = log.data![1].detail as Record<string, { from: string; to: string }>
    expect(upd.value.to).toBe('9.00')
    expect(upd.name.to).toBe('ทดสอบ-audit-แก้')
    expect(log.data![0].actor_email).toBeTruthy()

    // แก้ไข/ลบ/เพิ่มบันทึกเองไม่ได้ (ไม่มีสิทธิ์/นโยบาย)
    expect((await db.from('audit_log').delete().eq('id', log.data![0].id)).error).not.toBeNull()
    expect((await db.from('audit_log').update({ action: 'INSERT' }).eq('id', log.data![0].id)).error).not.toBeNull()
    expect((await db.from('audit_log').insert({ table_name: 'x', action: 'INSERT' })).error).not.toBeNull()
    expect((await anonClient().from('audit_log').select('id')).error).not.toBeNull()
  })

  it('ไม่เก็บค่าความลับของตั้งค่าร้านในบันทึก', async () => {
    const db = await signedInClient()
    const s = await db.from('settings').select('id, phone').limit(1).single()
    await db.from('settings').update({ phone: s.data!.phone ?? '' }).eq('id', s.data!.id)
    const log = await db.from('audit_log').select('detail').eq('table_name', 'settings').order('id', { ascending: false }).limit(5)
    expect(JSON.stringify(log.data)).not.toMatch(/secret|token"?:\s*"[^"]{8,}/i)
  })
})

describe('เพดานขนาดข้อมูล', () => {
  it('จำนวนสินค้าต่อรายการเกิน 10000 ถูกปฏิเสธ', async () => {
    const admin = adminClient()
    const order = await admin.from('orders').insert({ is_draft: true, order_source: 'staff' }).select().single()
    const prod = await admin.from('products').insert({ name: 'ทดสอบ-limit', price: 1, cost: 0 }).select().single()
    const r = await admin.from('order_items').insert({ order_id: order.data!.id, product_id: prod.data!.id, product_name: 'x', unit_price: 1, unit_cost: 0, qty: 10001 })
    expect(r.error).not.toBeNull()
    await admin.from('orders').delete().eq('id', order.data!.id)
    await admin.from('products').delete().eq('id', prod.data!.id)
  })
})

describe('Edge Function สั่งซื้อ — ตรวจรูปแบบข้อมูล', () => {
  it('จำนวนผิดรูปแบบ/ยัดรายการเยอะ/ข้อความยาวเกิน ถูกปฏิเสธด้วย 400 ก่อนถึงฐานข้อมูล', async () => {
    const db = anonClient()
    const base = {
      customer_name: 'x', customer_phone: '0812345678', customer_email: 'a@b.co', fulfillment_type: 'pickup',
      needed_date: '2099-01-01', pickup_place: 'x', turnstile_token: 'x',
    }
    const pid = '00000000-0000-0000-0000-000000000000'
    const bad = [
      { ...base, items: [{ product_id: pid, qty: -3 }] },
      { ...base, items: [{ product_id: pid, qty: 100000 }] },
      { ...base, items: [{ product_id: pid, qty: 1.5 }] },
      { ...base, items: Array.from({ length: 60 }, () => ({ product_id: pid, qty: 1 })) },
      { ...base, items: [{ product_id: pid, qty: 1 }], note: 'x'.repeat(5000) },
      { ...base, items: [{ product_id: 'not-a-uuid', qty: 1 }] },
    ]
    for (const body of bad) {
      const { data, error } = await db.functions.invoke('submit-customer-order', { body })
      expect(error ?? data?.error).toBeTruthy()
      const msg = String((await (error as { context?: Response } | null)?.context?.json?.().catch(() => null))?.error ?? data?.error ?? '')
      expect(msg).toContain('ข้อมูลคำสั่งซื้อไม่ถูกต้อง')
    }
  })
})

describe('Edge Function ส่งอีเมล — ส่งได้เฉพาะลูกค้าในระบบ', () => {
  it('พนักงานส่งหาอีเมลแปลกหน้าไม่ได้ (403)', async () => {
    const db = await signedInClient()
    const { error } = await db.functions.invoke('send-customer-email', {
      body: { to: 'stranger-not-a-customer@example.com', subject: 'ทดสอบ', html: '<p>x</p>' },
    })
    expect(error).not.toBeNull()
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    expect(String(body?.error ?? '')).toContain('เฉพาะลูกค้าที่มีในระบบ')
  })

  it('ไม่ล็อกอินเรียกไม่ได้', async () => {
    const { error } = await anonClient().functions.invoke('send-customer-email', { body: { to: 'a@b.co', subject: 'x', html: 'x' } })
    expect(error).not.toBeNull()
  })
})
