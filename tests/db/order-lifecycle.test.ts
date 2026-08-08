import { describe, it, expect } from 'vitest'
import { signedInClient, purgeOrder } from './helpers'

describe('วงจรชีวิตออเดอร์แบบครบวงจร (เหมือนที่หน้าเว็บทำจริง)', () => {
  it('สร้างสินค้า+ลูกค้า → ยืนยันออเดอร์ → จ่ายมัดจำ → จ่ายครบ → ส่งมอบ → ตรวจลิงก์สาธารณะ', async () => {
    const db = await signedInClient()

    const product = await db
      .from('products')
      .insert({ name: 'ทดสอบ-วงจรชีวิต', price: 100, cost: 40 })
      .select()
      .single()
    const customer = await db
      .from('customers')
      .insert({ name: 'ทดสอบ-ลูกค้าวงจรชีวิต', phone: '0899999999' })
      .select()
      .single()

    const draft = await db
      .from('orders')
      .insert({ is_draft: true, fulfillment_type: 'pickup' })
      .select()
      .single()

    const confirm = await db.rpc('confirm_order', {
      p_order_id: draft.data!.id,
      p_customer_id: customer.data!.id,
      p_fulfillment_type: 'pickup',
      p_needed_date: '2026-08-15',
      p_bake_date: '2026-08-15',
      p_pickup_place: 'หน้าร้าน',
      p_pickup_time: '10:00',
      p_ship_recipient_name: null,
      p_ship_recipient_phone: null,
      p_ship_address_text: null,
      p_shipping_fee: 0,
      p_discount_type: 'none',
      p_discount_value: 0,
      p_note: null,
      p_items: [{ product_id: product.data!.id, product_name: product.data!.name, unit_price: 100, unit_cost: 40, qty: 2, note: null }],
    })
    expect(confirm.error).toBeNull()
    expect(confirm.data).toMatch(/^RYB-\d{6}$/)

    let order = (await db.from('orders').select('*').eq('id', draft.data!.id).single()).data!
    expect(Number(order.grand_total)).toBe(200)
    expect(order.payment_status).toBe('unpaid')

    await db.from('payments').insert({ order_id: order.id, amount: 100, method: 'transfer' })
    order = (await db.from('orders').select('*').eq('id', order.id).single()).data!
    expect(order.payment_status).toBe('partial')

    await db.from('payments').insert({ order_id: order.id, amount: 100, method: 'transfer' })
    order = (await db.from('orders').select('*').eq('id', order.id).single()).data!
    expect(order.payment_status).toBe('paid')

    await db.from('orders').update({ work_status: 'delivered' }).eq('id', order.id)
    order = (await db.from('orders').select('*').eq('id', order.id).single()).data!
    expect(order.work_status).toBe('delivered')

    // ลิงก์สาธารณะต้องเห็นยอดถูกต้องและไม่มีต้นทุนหลุดออกไป
    const pub = await db.rpc('get_public_order', { p_token: order.public_token })
    expect(Number(pub.data.grand_total)).toBe(200)
    expect(JSON.stringify(pub.data)).not.toContain('40')

    await purgeOrder(order.id)
    await db.from('customers').delete().eq('id', customer.data!.id)
    await db.from('products').delete().eq('id', product.data!.id)
  })
})
