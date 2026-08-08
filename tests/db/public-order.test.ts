import { describe, it, expect } from 'vitest'
import { anonClient, signedInClient } from './helpers'

describe('ลิงก์สรุปออเดอร์สำหรับลูกค้า', () => {
  it('เปิดได้โดยไม่ต้องล็อกอิน มีชื่อลูกค้าให้ตรวจสอบ และไม่มีต้นทุนหลุดออกไป', async () => {
    const db = await signedInClient()
    const customer = await db.from('customers').insert({ name: 'ทดสอบ-ลิงก์สาธารณะ' }).select().single()
    const no = (await db.rpc('next_order_no')).data as string
    const order = (
      await db
        .from('orders')
        .insert({ is_draft: false, order_no: no, fulfillment_type: 'shipping', customer_id: customer.data!.id })
        .select()
        .single()
    ).data!

    await db.from('order_items').insert({
      order_id: order.id,
      product_name: 'คุกกี้ช็อกโกแลต',
      unit_price: 40,
      unit_cost: 18.5,
      qty: 2,
    })

    const pub = anonClient()
    const { data, error } = await pub.rpc('get_public_order', {
      p_token: order.public_token,
    })
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data.order_no).toBe(no)
    expect(data.customer_name).toBe('ทดสอบ-ลิงก์สาธารณะ')
    expect(Number(data.grand_total)).toBe(80)
    expect(data.items).toHaveLength(1)

    // ต้นทุนต้องไม่โผล่ที่ไหนเลยในข้อมูลที่ส่งกลับ
    const raw = JSON.stringify(data)
    expect(raw).not.toContain('cost')
    expect(raw).not.toContain('18.5')

    await db.from('orders').delete().eq('id', order.id)
    await db.from('customers').delete().eq('id', customer.data!.id)
  })

  it('token มั่วคืนค่าว่าง', async () => {
    const pub = anonClient()
    const { data } = await pub.rpc('get_public_order', {
      p_token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    expect(data).toBeNull()
  })

  it('ออเดอร์ร่างเปิดดูไม่ได้', async () => {
    const db = await signedInClient()
    const order = (
      await db.from('orders').insert({ is_draft: true }).select().single()
    ).data!

    const pub = anonClient()
    const { data } = await pub.rpc('get_public_order', {
      p_token: order.public_token,
    })
    expect(data).toBeNull()

    await db.from('orders').delete().eq('id', order.id)
  })
})
