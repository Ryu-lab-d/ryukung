import { describe, it, expect, afterAll } from 'vitest'
import { adminClient, anonClient, signedInClient } from './helpers'

// โปรโมชั่น: โปรอัตโนมัติ / โค้ดส่วนลด คิดที่เซิร์ฟเวอร์ใน submit_customer_order (เรียกด้วย service role เหมือนเทสต์สั่งเอง)
const ids = { promos: [] as string[], products: [] as string[], orders: [] as string[], customers: [] as string[] }

afterAll(async () => {
  const admin = adminClient()
  if (ids.orders.length) await admin.from('orders').delete().in('id', ids.orders)
  if (ids.promos.length) await admin.from('promotions').delete().in('id', ids.promos)
  if (ids.products.length) await admin.from('products').delete().in('id', ids.products)
  if (ids.customers.length) await admin.from('customers').delete().in('id', ids.customers)
})

async function order(productId: string, qty: number, code: string | null = null) {
  const r = await adminClient().rpc('submit_customer_order', {
    p_customer_name: 'ทดสอบ-โปร',
    p_customer_phone: '089-111-2233',
    p_customer_email: 'promo@example.com',
    p_fulfillment_type: 'pickup',
    p_needed_date: '2026-12-01',
    p_pickup_place: 'หน้าร้าน',
    p_pickup_time: '10:00',
    p_ship_recipient_name: null,
    p_ship_recipient_phone: null,
    p_ship_address_text: null,
    p_note: null,
    p_items: [{ product_id: productId, qty }],
    p_promo_code: code,
  })
  if (r.data?.order_id) ids.orders.push(r.data.order_id)
  return r
}

describe('โปรโมชั่น', () => {
  it('โค้ดส่วนลด/โปรอัตโนมัติ/ขั้นต่ำ/โควต้า/สิทธิ์การอ่าน', async () => {
    const db = await signedInClient()
    const admin = adminClient()
    const prod = await admin.from('products').insert({ name: 'ทดสอบ-โปร-สินค้า', price: 100, cost: 30 }).select().single()
    ids.products.push(prod.data!.id)

    const mk = async (row: Record<string, unknown>) => {
      const r = await db.from('promotions').insert(row).select().single()
      expect(r.error).toBeNull()
      ids.promos.push(r.data!.id)
      return r.data!
    }
    const code10 = await mk({ name: 'ลด10', code: 'TEST10', kind: 'percent', value: 10, min_subtotal: 200, max_discount: 25 })
    const codeOnce = await mk({ name: 'ครั้งเดียว', code: 'TESTONCE', kind: 'amount', value: 50, usage_limit: 1 })
    const codeOff = await mk({ name: 'ปิด', code: 'TESTOFF', kind: 'amount', value: 50, is_active: false })

    const anon = anonClient()
    // โค้ดถูก (พิมพ์เล็กได้) / ผิด / ถูกปิด
    expect((await anon.rpc('check_promo_code', { p_code: ' test10 ' })).data.valid).toBe(true)
    expect((await anon.rpc('check_promo_code', { p_code: 'NOPE' })).data.valid).toBe(false)
    expect((await anon.rpc('check_promo_code', { p_code: 'TESTOFF' })).data.valid).toBe(false)

    // ลด 10% ของ 300 = 30 แต่เพดาน 25
    const a = await order(prod.data!.id, 3, 'test10')
    expect(a.error).toBeNull()
    expect(Number(a.data.discount_amount)).toBe(25)
    expect(Number(a.data.grand_total)).toBe(275)
    const row = await admin.from('orders').select('discount_amount, promo_label, promotion_id').eq('id', a.data.order_id).single()
    expect(Number(row.data!.discount_amount)).toBe(25)
    expect(row.data!.promo_label).toContain('TEST10')
    expect(row.data!.promotion_id).toBe(code10.id)

    // ไม่ถึงขั้นต่ำ 200 → ปฏิเสธ / โค้ดผิด → ปฏิเสธ
    expect((await order(prod.data!.id, 1, 'TEST10')).error).not.toBeNull()
    expect((await order(prod.data!.id, 1, 'WRONG')).error).not.toBeNull()

    // โควต้า 1 ครั้ง: ครั้งแรกผ่าน ครั้งสองไม่ผ่าน
    expect((await order(prod.data!.id, 1, 'TESTONCE')).error).toBeNull()
    expect((await order(prod.data!.id, 1, 'TESTONCE')).error).not.toBeNull()
    const used = await admin.from('promotions').select('used_count').eq('id', codeOnce.id).single()
    expect(used.data!.used_count).toBe(1)
    void codeOff

    // โปรอัตโนมัติ: ลูกค้าไม่กรอกอะไร ได้ลดเอง และขึ้นในรายการสาธารณะ (โค้ดไม่หลุดไปในรายการนี้)
    const auto = await mk({ name: 'ลดอัตโนมัติ 20 บาท', kind: 'amount', value: 20 })
    const pub = await anon.rpc('get_public_promotions')
    expect(pub.data.some((p: { id: string }) => p.id === auto.id)).toBe(true)
    expect(JSON.stringify(pub.data)).not.toContain('TEST10')
    const b = await order(prod.data!.id, 1)
    expect(Number(b.data.discount_amount)).toBe(20)
    expect(Number(b.data.grand_total)).toBe(80)

    // anon อ่าน/เขียนตารางโดยตรงไม่ได้
    expect((await anon.from('promotions').select('id')).data ?? []).toEqual([])
    expect((await anon.from('promotions').insert({ name: 'x', kind: 'amount', value: 1 })).error).not.toBeNull()
  })
})
