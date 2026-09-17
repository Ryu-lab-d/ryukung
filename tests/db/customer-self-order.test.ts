import { describe, it, expect, afterAll } from 'vitest'
import { anonClient, signedInClient } from './helpers'

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

    const pub = anonClient()
    const { data, error } = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-ลูกค้าสั่งเอง',
      p_customer_phone: '081-234-5678',
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

    const customer = await db.from('customers').select('id').eq('phone', '081-234-5678').maybeSingle()
    expect(customer.data).toBeTruthy()
    if (customer.data) cleanupIds.customers.push(customer.data.id)
  })

  it('ลูกค้าคนเดิม (เบอร์เดียวกัน รูปแบบต่าง) สั่งซ้ำ จับคู่ customer_id เดิม ไม่สร้างลูกค้าใหม่ซ้ำ', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-สั่งเอง-2', price: 30, cost: 10 }).select().single()
    cleanupIds.products.push(prod.data!.id)

    const pub = anonClient()
    const first = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-ลูกค้าซ้ำ', p_customer_phone: '0899998888',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: prod.data!.id, qty: 1 }],
    })
    expect(first.error).toBeNull()
    cleanupIds.orders.push(first.data.order_id)

    const second = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-ลูกค้าซ้ำ', p_customer_phone: '089-999-8888', // รูปแบบมีขีดต่างจากครั้งแรก
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

    const pub = anonClient()
    // RPC ไม่มีช่องให้ส่ง unit_price มาเลยในพารามิเตอร์ p_items (มีแค่ product_id, qty) — พิสูจน์ว่าฝั่ง client
    // ไม่มีทางระบุราคาเองได้ตั้งแต่ต้น (ต่างจาก confirm_order ที่รับ unit_price มาจาก client เพราะเป็นฝั่งพนักงาน)
    const { data, error } = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-กันปลอมราคา', p_customer_phone: '0812223333',
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
    const pub = anonClient()
    const { error } = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-สินค้าไม่มีจริง', p_customer_phone: '0800001111',
      p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: 'หน้าร้าน', p_pickup_time: '10:00',
      p_ship_recipient_name: null, p_ship_recipient_phone: null, p_ship_address_text: null,
      p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(error).not.toBeNull()
  })

  it('ไม่กรอกชื่อ/เบอร์ ถูกปฏิเสธ', async () => {
    const pub = anonClient()
    const { error } = await pub.rpc('submit_customer_order', {
      p_customer_name: '', p_customer_phone: '', p_fulfillment_type: 'pickup', p_needed_date: '2026-09-01',
      p_pickup_place: null, p_pickup_time: null, p_ship_recipient_name: null, p_ship_recipient_phone: null,
      p_ship_address_text: null, p_note: null, p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
    })
    expect(error).not.toBeNull()
  })
})

describe('พนักงานยืนยัน/ปฏิเสธออเดอร์ที่ลูกค้าส่งมา', () => {
  it('confirm_order (authenticated) ยืนยันออเดอร์ลูกค้าได้ปกติ ได้เลขที่ + ตัดสต็อกถ้ามีสูตร', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-ยืนยัน-ออเดอร์ลูกค้า', price: 20, cost: 8 }).select().single()
    cleanupIds.products.push(prod.data!.id)

    const pub = anonClient()
    const submitted = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-รอยืนยัน', p_customer_phone: '0855554444',
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

    const pub = anonClient()
    const submitted = await pub.rpc('submit_customer_order', {
      p_customer_name: 'ทดสอบ-รอปฏิเสธ', p_customer_phone: '0866667777',
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
  if (cleanupIds.orders.length) await db.from('orders').delete().in('id', cleanupIds.orders)
  if (cleanupIds.products.length) await db.from('products').delete().in('id', cleanupIds.products)
  if (cleanupIds.customers.length) await db.from('customers').delete().in('id', [...new Set(cleanupIds.customers)])
})
