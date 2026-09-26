import { describe, it, expect, afterAll } from 'vitest'
import { adminClient, anonClient, signedInClient } from './helpers'

// submit_customer_order ถูกล็อกให้เรียกได้เฉพาะ service_role แล้ว (ดู migration
// 20260926090500_lock_submit_customer_order_to_service_role.sql) — ของจริงเรียกผ่าน Edge Function
// submit-customer-order เท่านั้น (ตรวจ Cloudflare Turnstile ก่อนเสมอ กันบอทข้าม CAPTCHA ไปเรียก RPC ตรงๆ)
// เทสต์พวกนี้เลยต้องใช้ adminClient() แทน anonClient() ตอนเรียกฟังก์ชันนี้ เพื่อทดสอบ "ตรรกะธุรกิจ" ของ
// ฟังก์ชันเอง (ไม่ใช่ทดสอบสิทธิ์การเรียก — สิทธิ์การเรียกมีเทสต์แยกอยู่ท้ายไฟล์นี้แล้วว่า anon เรียกตรงไม่ได้)

const cleanupIds = { products: [] as string[], customers: [] as string[], orders: [] as string[] }

describe('เมนูสาธารณะ — get_public_menu', () => {
  it('anon client เรียกได้ ไม่มี cost/note หลุดออกไป', async () => {
    const db = await signedInClient()
    const prod = await db
      .from('products')
      .insert({ name: 'ทดสอบ-เมนู-สาธารณะ', price: 45, cost: 12.5, note: 'ความลับต้นทุน' })
      .select()
      .single()
    expect(prod.error).toBeNull()
    cleanupIds.products.push(prod.data!.id)

    const pub = anonClient()
    const { data, error } = await pub.rpc('get_public_menu')
    expect(error).toBeNull()
    expect(data.shop_name).toBeTruthy()

    const raw = JSON.stringify(data)
    expect(raw).not.toContain('12.5')
    expect(raw).not.toContain('ความลับต้นทุน')

    const found = (data.products as { id: string; price: number }[]).find((p) => p.id === prod.data!.id)
    expect(found).toBeTruthy()
    expect(Number(found!.price)).toBe(45)
  })
})

describe('ลูกค้าสั่งของเอง — submit_customer_order', () => {
  it('anon client สั่งสำเร็จ สร้างออเดอร์รอตรวจ (is_draft=true, order_source=customer) + payment_claimed_at ไม่ว่าง', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-สั่งเอง-1', price: 55, cost: 20 }).select().single()
    expect(prod.error).toBeNull()
    cleanupIds.products.push(prod.data!.id)

    const pub = adminClient()
    const { data, error } = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-ลูกค้าสั่งเอง',
      p_customer_phone: '081-234-5678',
      p_customer_email: 'test-customer@example.com',
      p_fulfillment_type: 'pickup',
      p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน',
      p_pickup_time: '10:00',
      p_ship_recipient_name: null,
      p_ship_recipient_phone: null,
      p_ship_address_text: null,
      p_note: 'ทดสอบระบบ',
      p_items: [{ product_id: prod.data!.id, qty: 2 }],
    })
    expect(error).toBeNull()
    expect(data.order_id).toBeTruthy()
    expect(data.public_token).toBeTruthy()
    expect(Number(data.grand_total)).toBe(110)
    cleanupIds.orders.push(data.order_id)

    const order = await db.from('orders').select('*').eq('id', data.order_id).single()
    expect(order.data!.is_draft).toBe(true)
    expect(order.data!.order_source).toBe('customer')
    expect(order.data!.payment_claimed_at).not.toBeNull()
    expect(order.data!.order_no).toBeNull()

    const customer = await db.from('customers').select('id, email').eq('phone', '081-234-5678').maybeSingle()
    expect(customer.data).toBeTruthy()
    expect(customer.data!.email).toBe('test-customer@example.com')
    if (customer.data) cleanupIds.customers.push(customer.data.id)
  })

  it('ไม่กรอกอีเมล หรือกรอกรูปแบบผิด ถูกปฏิเสธ', async () => {
    const pub = adminClient()
    const missing = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-ไม่มีอีเมล', p_customer_phone: '0899990000', p_customer_email: '',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(missing.error).not.toBeNull()

    const malformed = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-อีเมลผิด', p_customer_phone: '0899990001', p_customer_email: 'ไม่ใช่อีเมล',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(malformed.error).not.toBeNull()
  })

  it('ลูกค้าเดิมยังไม่เคยมีอีเมล — สั่งซ้ำพร้อมกรอกอีเมล ต้องซิงค์อีเมลเข้า customers ให้', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-ซิงค์อีเมล', price: 40, cost: 15 }).select().single()
    cleanupIds.products.push(prod.data!.id)

    const pub = adminClient()
    const before = await db.from('customers').insert({ name: 'ทดสอบ-รออีเมล', phone: '0877776666' }).select().single()
    cleanupIds.customers.push(before.data!.id)
    expect(before.data!.email).toBeNull()

    const submitted = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-รออีเมล', p_customer_phone: '087-777-6666', p_customer_email: 'synced@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: prod.data!.id, qty: 1 }],
    })
    expect(submitted.error).toBeNull()
    cleanupIds.orders.push(submitted.data.order_id)

    const after = await db.from('customers').select('id, email').eq('id', before.data!.id).single()
    expect(after.data!.email).toBe('synced@example.com')
  })

  it('ลูกค้าคนเดิม (เบอร์เดียวกัน รูปแบบต่าง) สั่งซ้ำ จับคู่ customer_id เดิม ไม่สร้างลูกค้าใหม่ซ้ำ', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-สั่งเอง-2', price: 30, cost: 10 }).select().single()
    cleanupIds.products.push(prod.data!.id)

    const pub = adminClient()
    const first = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-ลูกค้าซ้ำ', p_customer_phone: '0899998888', p_customer_email: 'zam1@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: prod.data!.id, qty: 1 }],
    })
    expect(first.error).toBeNull()
    cleanupIds.orders.push(first.data.order_id)

    const second = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-ลูกค้าซ้ำ', p_customer_phone: '089-999-8888', p_customer_email: 'zam1@example.com', // รูปแบบมีขีดต่างจากครั้งแรก
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-02',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '11:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: prod.data!.id, qty: 1 }],
    })
    expect(second.error).toBeNull()
    cleanupIds.orders.push(second.data.order_id)

    const orders = await db.from('orders').select('customer_id').in('id', [first.data.order_id, second.data.order_id])
    const customerIds = new Set(orders.data!.map((o) => o.customer_id))
    expect(customerIds.size).toBe(1)
    cleanupIds.customers.push([...customerIds][0] as string)
  })

  it('ส่งราคาปลอมมาทาง product_id เดียวกัน — ต้องใช้ราคาจริงจากตาราง products เสมอ ไม่เชื่อ client', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-กันปลอมราคา', price: 100, cost: 40 }).select().single()
    cleanupIds.products.push(prod.data!.id)

    const pub = adminClient()
    // RPC ไม่มีช่องให้ส่ง unit_price มาเลยในพารามิเตอร์ p_items (มีแค่ product_id, qty) — พิสูจน์ว่าฝั่ง client
    // ไม่มีทางระบุราคาเองได้ตั้งแต่ต้น (ต่างจาก confirm_order ที่รับ unit_price มาจาก client เพราะเป็นฝั่งพนักงาน)
    const { data, error } = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-กันปลอมราคา', p_customer_phone: '0812223333', p_customer_email: 'fakeprice@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null,
      p_items: [{ product_id: prod.data!.id, qty: 1, unit_price: 1 }], // ยัด unit_price ปลอมเข้ามาด้วย เผื่อ RPC เผลออ่าน
    })
    expect(error).toBeNull()
    cleanupIds.orders.push(data.order_id)

    const item = await db.from('order_items').select('unit_price, unit_cost').eq('order_id', data.order_id).single()
    expect(Number(item.data!.unit_price)).toBe(100)
    expect(Number(item.data!.unit_cost)).toBe(40)

    const customer = await db.from('customers').select('id').eq('phone', '0812223333').maybeSingle()
    if (customer.data) cleanupIds.customers.push(customer.data.id)
  })

  it('product_id ปลอม/ปิดขายแล้ว ถูกปฏิเสธ ไม่สร้างออเดอร์', async () => {
    const pub = adminClient()
    const { error } = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-สินค้าไม่มีจริง', p_customer_phone: '0800001111', p_customer_email: 'noproduct@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(error).not.toBeNull()
  })

  it('ไม่กรอกชื่อ/เบอร์ ถูกปฏิเสธ', async () => {
    const pub = adminClient()
    const { error } = await pub.rpc('submit_customer_order', {
      p_customer_name: '', p_customer_phone: '', p_customer_email: '', p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: null, p_pickup_time: null, p_ship_recipient_name: null, p_ship_recipient_phone: null,
      p_ship_address_text: null, p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(error).not.toBeNull()
  })
})

describe('submit_customer_order ถูกล็อกให้ anon เรียกตรงไม่ได้แล้ว (ต้องผ่าน Edge Function + Turnstile เท่านั้น)', () => {
  it('anon client เรียก submit_customer_order ตรงๆ ผ่าน RPC ต้องถูกปฏิเสธ (กันบอทข้าม CAPTCHA)', async () => {
    const pub = anonClient()
    const { error } = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-เจาะระบบ', p_customer_phone: '0899990000', p_customer_email: 'hack@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(error).not.toBeNull()
  })

  it('authenticated client (พนักงาน) เรียก submit_customer_order ตรงๆ ก็ต้องถูกปฏิเสธเหมือนกัน', async () => {
    const db = await signedInClient()
    const { error } = await db.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-เจาะระบบ2', p_customer_phone: '0899990001', p_customer_email: 'hack2@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(error).not.toBeNull()
  })
})

describe('พนักงานยืนยัน/ปฏิเสธออเดอร์ที่ลูกค้าส่งมา', () => {
  it('confirm_order (authenticated) ยืนยันออเดอร์ลูกค้าได้ปกติ ได้เลขที่ + ตัดสต็อกถ้ามีสูตร', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-ยืนยัน-ออเดอร์ลูกค้า', price: 20, cost: 8 }).select().single()
    cleanupIds.products.push(prod.data!.id)

    const pub = adminClient()
    const submitted = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-รอยืนยัน', p_customer_phone: '0855554444', p_customer_email: 'confirm-flow@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-05',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: prod.data!.id, qty: 2 }],
    })
    expect(submitted.error).toBeNull()
    const orderId = submitted.data.order_id as string
    cleanupIds.orders.push(orderId)

    const before = await db.from('orders').select('customer_id').eq('id', orderId).single()

    const confirm = await db.rpc('confirm_order', {
      p_order_id: orderId,
      p_customer_id: before.data!.customer_id,
      p_fulfillment_type: 'pickup',
      p_needed_date: '2026-09-05',
      p_bake_date: '2026-09-05',
      p_pickup_place: 'หน้าร้าน',
      p_pickup_time: '10:00',
      p_ship_recipient_name: null,
      p_ship_recipient_phone: null,
      p_ship_address_text: null,
      p_shipping_fee: 0,
      p_discount_type: 'none',
      p_discount_value: 0,
      p_note: null,
      p_items: [{ product_id: prod.data!.id, product_name: 'ทดสอบ-ยืนยัน-ออเดอร์ลูกค้า', unit_price: 20, unit_cost: 8, qty: 2, note: null }],
    })
    expect(confirm.error).toBeNull()
    expect(confirm.data).toMatch(/^RYB-\d{6}$/)

    const after = await db.from('orders').select('is_draft, order_no').eq('id', orderId).single()
    expect(after.data!.is_draft).toBe(false)
    expect(after.data!.order_no).toBe(confirm.data)

    const customer = await db.from('customers').select('id').eq('phone', '0855554444').maybeSingle()
    if (customer.data) cleanupIds.customers.push(customer.data.id)
  })

  it('reject_customer_order (authenticated) ปฏิเสธออเดอร์ลูกค้าที่จ่ายมาแล้ว ตั้ง refund_status=pending + ออกเลขที่ให้', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-ปฏิเสธ-ออเดอร์ลูกค้า', price: 25, cost: 9 }).select().single()
    cleanupIds.products.push(prod.data!.id)

    const pub = adminClient()
    const submitted = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-รอปฏิเสธ', p_customer_phone: '0866667777', p_customer_email: 'reject-flow@example.com',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-05',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: prod.data!.id, qty: 1 }],
    })
    const orderId = submitted.data.order_id as string
    cleanupIds.orders.push(orderId)

    const db2 = await signedInClient()
    const reject = await db2.rpc('reject_customer_order', { p_order_id: orderId, p_reason: 'คิวอบเต็มวันนั้น' })
    expect(reject.error).toBeNull()

    const after = await db.from('orders').select('is_draft, work_status, refund_status, order_no, cancelled_reason').eq('id', orderId).single()
    expect(after.data!.is_draft).toBe(false)
    expect(after.data!.work_status).toBe('cancelled')
    expect(after.data!.refund_status).toBe('pending')
    expect(after.data!.order_no).not.toBeNull()
    expect(after.data!.cancelled_reason).toBe('คิวอบเต็มวันนั้น')

    const customer = await db.from('customers').select('id').eq('phone', '0866667777').maybeSingle()
    if (customer.data) cleanupIds.customers.push(customer.data.id)
  })

  it('anon client เรียก confirm_order/reject_customer_order ต้องถูกปฏิเสธ (กันสิทธิ์)', async () => {
    const pub = anonClient()
    const confirm = await pub.rpc('confirm_order', {
      p_order_id: '00000000-0000-0000-0000-000000000000', p_customer_id: null, p_fulfillment_type: 'pickup',
      p_needed_date: null, p_bake_date: null, p_pickup_place: null, p_pickup_time: null,
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_shipping_fee: 0, p_discount_type: 'none', p_discount_value: 0, p_note: null, p_items: [],
    })
    expect(confirm.error).not.toBeNull()

    const reject = await pub.rpc('reject_customer_order', { p_order_id: '00000000-0000-0000-0000-000000000000', p_reason: null })
    expect(reject.error).not.toBeNull()
  })
})

afterAll(async () => {
  const db = await signedInClient()
  // ลำดับสำคัญมาก — ต้องลบ receipts ก่อนเสมอ (receipts.order_id เป็น on delete RESTRICT ไม่ใช่ cascade
  // ถ้ามี receipt ผูกออเดอร์ไหนอยู่ จะลบออเดอร์นั้นไม่ออกเลย) ส่วน order_items จริงๆ cascade เองตาม order
  // อยู่แล้ว แต่ลบเผื่อไว้ให้ชัดเจน — ที่สำคัญกว่านั้นคือ (supabase-js ไม่ throw ตอน .delete() error เอง
  // ต้องเช็ค .error เองเสมอ ไม่งั้นจะไม่รู้เลยว่าลบไม่สำเร็จ แล้วข้อมูลทดสอบจะค้างในฐานข้อมูลจริงไปเรื่อยๆ
  // แบบที่เคยเกิดมาแล้ว — ก่อนแก้ไฟล์นี้ afterAll เดิมไม่เช็ค error เลยสักบรรทัดเดียว)
  if (cleanupIds.orders.length) {
    const { error } = await db.from('receipts').delete().in('order_id', cleanupIds.orders)
    if (error) console.error('cleanup: ลบ receipts ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.orders.length) {
    const { error } = await db.from('order_items').delete().in('order_id', cleanupIds.orders)
    if (error) console.error('cleanup: ลบ order_items ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.orders.length) {
    const { error } = await db.from('orders').delete().in('id', cleanupIds.orders)
    if (error) console.error('cleanup: ลบ orders ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.products.length) {
    const { error } = await db.from('products').delete().in('id', cleanupIds.products)
    if (error) console.error('cleanup: ลบ products ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.customers.length) {
    const { error } = await db.from('customers').delete().in('id', [...new Set(cleanupIds.customers)])
    if (error) console.error('cleanup: ลบ customers ไม่สำเร็จ', error.message)
  }
})
