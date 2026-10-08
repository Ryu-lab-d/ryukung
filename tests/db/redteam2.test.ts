import { describe, it, expect, afterAll } from 'vitest'
import { adminClient, anonClient } from './helpers'

// red team รอบ 2 — โจมตีเชิงตรรกะ/เจาะข้อมูลคนอื่น/ยิงข้อมูลมั่ว
const admin = adminClient()
const cleanup = { orders: [] as string[], customers: [] as string[], products: [] as string[] }
afterAll(async () => {
  if (cleanup.orders.length) await admin.from('orders').delete().in('id', cleanup.orders)
  if (cleanup.customers.length) await admin.from('customers').delete().in('id', cleanup.customers)
  await admin.from('customers').delete().like('phone', '089-7770%')
  if (cleanup.products.length) await admin.from('products').delete().in('id', cleanup.products)
})

const submit = (phone: string, email: string, productId: string, name = 'redteam') =>
  admin.rpc('submit_customer_order', {
    p_customer_name: name, p_customer_phone: phone, p_customer_email: email, p_fulfillment_type: 'pickup',
    p_needed_date: '2099-01-01', p_pickup_place: 'x', p_pickup_time: null, p_ship_recipient_name: null, p_ship_recipient_phone: null,
    p_ship_address_text: null, p_note: null, p_items: [{ product_id: productId, qty: 1 }],
  })

describe('red team 2 — ยึดอีเมลลูกค้าคนอื่นด้วยเบอร์โทร', () => {
  it('สั่งซื้อโดยใช้เบอร์ของลูกค้าเดิมแต่ใส่อีเมลของตัวเอง ต้องไม่ทับอีเมลของลูกค้าเดิม', async () => {
    const prod = await admin.from('products').insert({ name: 'redteam2-สินค้า', price: 50, cost: 10 }).select().single()
    cleanup.products.push(prod.data!.id)
    const victim = await admin.from('customers').insert({ name: 'เหยื่อ', phone: '089-7770001', email: 'victim@example.com' }).select().single()
    cleanup.customers.push(victim.data!.id)

    const r = await submit('089-7770001', 'attacker@example.com', prod.data!.id, 'แฮกเกอร์')
    expect(r.error).toBeNull()
    cleanup.orders.push(r.data.order_id)

    const after = await admin.from('customers').select('email, name').eq('id', victim.data!.id).single()
    expect(after.data!.email).toBe('victim@example.com')
    expect(after.data!.name).toBe('เหยื่อ')
    // ออเดอร์ของผู้โจมตีต้องไม่ผูกกับตัวตนของเหยื่อ (ไม่งั้นอีเมลแจ้งสถานะ/ใบกำกับของเหยื่อ ไปปนกัน)
    const ord = await admin.from('orders').select('customer_id').eq('id', r.data.order_id).single()
    expect(ord.data!.customer_id).not.toBe(victim.data!.id)
    const mine = await admin.from('customers').select('id, email').eq('id', ord.data!.customer_id).single()
    expect(mine.data!.email).toBe('attacker@example.com')
    cleanup.customers.push(mine.data!.id)
  })

  it('ลูกค้าตัวจริง (เบอร์+อีเมลตรงกัน) ยังสั่งซ้ำได้และผูกกับตัวตนเดิม', async () => {
    const prod = await admin.from('products').insert({ name: 'redteam2-สินค้า2', price: 50, cost: 10 }).select().single()
    cleanup.products.push(prod.data!.id)
    const cust = await admin.from('customers').insert({ name: 'ลูกค้าเดิม', phone: '089-7770002', email: 'Real@Example.com' }).select().single()
    cleanup.customers.push(cust.data!.id)
    const r = await submit('089-7770002', 'real@example.com', prod.data!.id)
    cleanup.orders.push(r.data.order_id)
    const ord = await admin.from('orders').select('customer_id').eq('id', r.data.order_id).single()
    expect(ord.data!.customer_id).toBe(cust.data!.id)
  })

  it('ลูกค้าเดิมที่ยังไม่มีอีเมลในระบบ ได้รับอีเมลที่กรอกครั้งแรก', async () => {
    const prod = await admin.from('products').insert({ name: 'redteam2-สินค้า3', price: 50, cost: 10 }).select().single()
    cleanup.products.push(prod.data!.id)
    const cust = await admin.from('customers').insert({ name: 'ไม่มีอีเมล', phone: '089-7770003' }).select().single()
    cleanup.customers.push(cust.data!.id)
    const r = await submit('089-7770003', 'first@example.com', prod.data!.id)
    cleanup.orders.push(r.data.order_id)
    const after = await admin.from('customers').select('email').eq('id', cust.data!.id).single()
    expect(after.data!.email).toBe('first@example.com')
  })
})

describe('red team 2 — ท่วมคิวออเดอร์ด้วยคำสั่งซื้อปลอม', () => {
  it('เบอร์เดียวสั่งรัวเกินโควต้าต่อวัน → ถูกปฏิเสธ', async () => {
    const prod = await admin.from('products').insert({ name: 'redteam2-flood', price: 50, cost: 10 }).select().single()
    cleanup.products.push(prod.data!.id)
    let rejected = 0
    for (let i = 0; i < 18; i++) {
      const r = await submit('089-7770009', 'flood@example.com', prod.data!.id)
      if (r.error) rejected++
      else cleanup.orders.push(r.data.order_id)
    }
    expect(rejected).toBeGreaterThan(0)
  }, 60000)
})

describe('red team 2 — ข้อมูลที่หน้าสาธารณะคืนให้ต้องไม่มีของภายใน', () => {
  it('get_public_order / get_public_menu ไม่มีต้นทุน หมายเหตุภายใน คนอื่น หรือคีย์ลับ', async () => {
    const prod = await admin.from('products').insert({ name: 'redteam2-leak', price: 77, cost: 31.37, note: 'ความลับภายใน-xyz' }).select().single()
    cleanup.products.push(prod.data!.id)
    const r = await submit('089-7770010', 'leak@example.com', prod.data!.id)
    cleanup.orders.push(r.data.order_id)
    const tok = (await admin.from('orders').select('public_token, customer_id').eq('id', r.data.order_id).single()).data!
    cleanup.customers.push(tok.customer_id)
    const pub = (await anonClient().rpc('get_public_order', { p_token: tok.public_token })).data
    const menu = (await anonClient().rpc('get_public_menu')).data
    for (const blob of [JSON.stringify(pub), JSON.stringify(menu)]) {
      expect(blob).not.toContain('31.37')
      expect(blob).not.toContain('ความลับภายใน-xyz')
      expect(blob).not.toMatch(/service_role|SMTP|password|owner_notification_email|unit_cost|items_cost_total|api[_-]?key/i)
    }
  })
})

describe('red team 2 — ยิงข้อมูลมั่ว (fuzz) เข้าทุกฟังก์ชันสาธารณะ ต้องไม่พัง/ไม่รั่ว', () => {
  const evil = [
    null, '', ' ', "'; drop table orders; --", '" OR 1=1 --', '\u0000', 'x'.repeat(100000), '%', '_', '\\', '{"a":1}', '[]', 'RYU-%', '../../etc/passwd',
    '<script>alert(1)</script>', '🍪'.repeat(2000), '9'.repeat(400), '-1', 'NaN', '１２３',
  ]
  const fns: [string, (v: unknown) => Record<string, unknown>][] = [
    ['get_public_order', (v) => ({ p_token: v })],
    ['get_public_invoice', (v) => ({ p_token: v })],
    ['check_promo_code', (v) => ({ p_code: v })],
    ['learn_open', (v) => ({ p_code: v })],
    ['acknowledge_needed_date_change', (v) => ({ p_token: v })],
    ['log_unanswered_chat_question', (v) => ({ p_question: v })],
    ['update_public_order_address', (v) => ({ p_token: v, p_recipient_name: v, p_recipient_phone: v, p_address_text: v })],
  ]
  it('ทุกค่าอันตราย: ไม่มี error จากฐานข้อมูลภายใน (5xx/สตริง SQL) และไม่คืนข้อมูลจริง', async () => {
    const db = anonClient()
    for (const [fn, mk] of fns) {
      for (const v of evil) {
        const r = await db.rpc(fn, mk(v))
        if (r.error) {
          expect(String(r.error.message), `${fn}(${String(v).slice(0, 20)})`).not.toMatch(/syntax error|relation .* does not exist|pg_|stack|at /i)
        }
        if (fn.startsWith('get_public') ) expect(r.data == null || typeof r.data === 'object').toBe(true)
        if (fn === 'get_public_order' || fn === 'get_public_invoice') expect(r.data).toBeNull()
      }
    }
    await admin.from('chat_unanswered_questions').delete().like('question_text', '%drop table%')
    await admin.from('chat_unanswered_questions').delete().like('question_text', '%script%')
    await admin.from('chat_usage').delete().like('usage_key', 'promo-fail:%')
    await admin.from('chat_usage').delete().like('usage_key', 'learn-fail:%')
  }, 120000)
})
