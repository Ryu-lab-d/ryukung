import { describe, it, expect, afterAll } from 'vitest'
import { adminClient, anonClient } from './helpers'

// หน้าติดตามออเดอร์: ด่านยืนยันตัวตน (ชื่อ/เบอร์) ต้องบังคับที่เซิร์ฟเวอร์ ไม่ใช่แค่ในเบราว์เซอร์
const admin = adminClient()
const cleanup = { orders: [] as string[], customers: [] as string[], products: [] as string[] }
let token = ''
let orderId = ''

afterAll(async () => {
  if (cleanup.orders.length) await admin.from('orders').delete().in('id', cleanup.orders)
  if (cleanup.customers.length) await admin.from('customers').delete().in('id', cleanup.customers)
  if (cleanup.products.length) await admin.from('products').delete().in('id', cleanup.products)
  await admin.from('chat_usage').delete().like('usage_key', 'track-fail:%')
})

async function setup() {
  if (token) return
  const prod = await admin.from('products').insert({ name: 'track-สินค้า', price: 40, cost: 5 }).select().single()
  cleanup.products.push(prod.data!.id)
  const r = await admin.rpc('submit_customer_order', {
    p_customer_name: 'สมชาย  ใจดี', p_customer_phone: '081-555-6677', p_customer_email: 'track@example.com', p_fulfillment_type: 'shipping',
    p_needed_date: '2099-01-01', p_pickup_place: null, p_pickup_time: null, p_ship_recipient_name: 'ผู้รับลับ', p_ship_recipient_phone: '0899998888',
    p_ship_address_text: '99/9 ที่อยู่ลับ ถนนลับ', p_note: 'โน้ตลับ', p_items: [{ product_id: prod.data!.id, qty: 1 }],
  })
  expect(r.error).toBeNull()
  orderId = r.data.order_id
  cleanup.orders.push(orderId)
  const o = (await admin.from('orders').select('public_token, customer_id').eq('id', orderId).single()).data!
  token = o.public_token
  cleanup.customers.push(o.customer_id)
}

const SECRETS = ['สมชาย', '081-555-6677', '0815556677', 'ผู้รับลับ', '0899998888', 'ที่อยู่ลับ', 'โน้ตลับ', 'track-สินค้า']
const leaks = (data: unknown) => SECRETS.filter((s) => JSON.stringify(data).includes(s))

describe('ด่านยืนยันตัวตนหน้าติดตามออเดอร์ — บังคับที่เซิร์ฟเวอร์', () => {
  it('มีแค่ token (ไม่ส่งชื่อ/เบอร์) ได้แค่หน้าล็อก ไม่มีข้อมูลส่วนตัวหลุดแม้แต่ตัวเดียว', async () => {
    await setup()
    const r = await anonClient().rpc('get_public_order', { p_token: token })
    expect(r.error).toBeNull()
    expect(r.data.locked).toBe(true)
    expect(leaks(r.data)).toEqual([])
  })

  it('ส่งชื่อ/เบอร์ผิด → ล็อกและไม่หลุดข้อมูล', async () => {
    await setup()
    for (const guess of ['แฮกเกอร์', '0800000000', 'สมชา', '']) {
      const r = await anonClient().rpc('get_public_order', { p_token: token, p_verify: guess })
      expect(r.data.locked, guess).toBe(true)
      expect(leaks(r.data), guess).toEqual([])
    }
  })

  it('ชื่อถูก (ช่องว่าง/ตัวพิมพ์ต่างได้) หรือเบอร์ถูก (+66 ได้) → เห็นข้อมูลครบ', async () => {
    await setup()
    for (const ok of ['สมชาย ใจดี', '  สมชาย    ใจดี ', '0815556677', '081 555 6677', '+66815556677']) {
      const r = await anonClient().rpc('get_public_order', { p_token: token, p_verify: ok })
      expect(r.data.locked, ok).toBeUndefined()
      expect(r.data.customer_name).toContain('สมชาย')
      expect(r.data.items[0].product_name).toBe('track-สินค้า')
    }
  })

  it('เดาผิดเกิน 10 ครั้งในชั่วโมงเดียว → ล็อกยาว (แม้ภายหลังเดาถูกก็ยังไม่ให้ จนกว่าจะพ้นชั่วโมง)', async () => {
    await setup()
    const db = anonClient()
    for (let i = 0; i < 12; i++) await db.rpc('get_public_order', { p_token: token, p_verify: 'เดา' + i })
    const r = await db.rpc('get_public_order', { p_token: token, p_verify: 'สมชาย ใจดี' })
    expect(r.data.locked).toBe(true)
    expect(r.data.reason).toBe('locked_out')
    expect(leaks(r.data)).toEqual([])
    await admin.from('chat_usage').delete().like('usage_key', 'track-fail:%')
  })

  it('แก้ที่อยู่จัดส่ง: ไม่ยืนยันตัวตน/ยืนยันผิด → ปฏิเสธ ที่อยู่เดิมไม่เปลี่ยน / ยืนยันถูก → เปลี่ยนได้และมีบันทึกกิจกรรม', async () => {
    await setup()
    // ออเดอร์ลูกค้าต้องผ่านการยืนยันของร้านก่อนถึงแก้ที่อยู่ผ่านลิงก์ได้
    await admin.from('orders').update({ is_draft: false, order_no: 'TRK-' + Date.now() }).eq('id', orderId)
    const db = anonClient()
    const noVerify = await db.rpc('update_public_order_address', { p_token: token, p_recipient_name: 'x', p_recipient_phone: '1', p_address_text: 'ที่อยู่ปลอมของคนร้าย' })
    expect(noVerify.error).not.toBeNull()
    const wrong = await db.rpc('update_public_order_address', { p_token: token, p_recipient_name: 'x', p_recipient_phone: '1', p_address_text: 'ที่อยู่ปลอมของคนร้าย', p_verify: 'ผิด' })
    expect(wrong.error).not.toBeNull()
    expect((await admin.from('orders').select('ship_address_text').eq('id', orderId).single()).data!.ship_address_text).toBe('99/9 ที่อยู่ลับ ถนนลับ')
    await admin.from('chat_usage').delete().like('usage_key', 'track-fail:%')

    const ok = await db.rpc('update_public_order_address', { p_token: token, p_recipient_name: 'ผู้รับใหม่', p_recipient_phone: '0811112222', p_address_text: '1/1 ที่อยู่ใหม่ที่ถูกต้อง', p_verify: '0815556677' })
    expect(ok.error).toBeNull()
    expect(ok.data).toBe(true)
    const log = await admin.from('audit_log').select('action, table_name').eq('table_name', 'orders').eq('row_id', orderId).eq('action', 'UPDATE')
    expect((log.data ?? []).length).toBeGreaterThan(0)
  })

  it('ฟังก์ชันตรวจตัวตนภายในเรียกจากภายนอกไม่ได้ (กันใช้เป็นตัวเดาถูก/ผิด)', async () => {
    await setup()
    expect((await anonClient().rpc('verify_order_token', { p_token: token, p_verify: 'x' })).error).not.toBeNull()
  })
})
