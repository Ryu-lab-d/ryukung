import { describe, it, expect } from 'vitest'
import { signedInClient } from './helpers'

type DB = Awaited<ReturnType<typeof signedInClient>>

async function newOrder(db: DB, fields: Record<string, unknown> = {}) {
  const { data } = await db
    .from('orders')
    .insert({ is_draft: true, ...fields })
    .select()
    .single()
  return data!
}

async function readOrder(db: DB, id: string) {
  const { data } = await db.from('orders').select('*').eq('id', id).single()
  return data!
}

describe('การคำนวณยอดอัตโนมัติ', () => {
  it('รวมยอดสินค้าและต้นทุนให้เองโดยหน้าเว็บไม่ต้องส่งมา', async () => {
    const db = await signedInClient()
    const order = await newOrder(db)

    await db.from('order_items').insert([
      { order_id: order.id, product_name: 'คุกกี้', unit_price: 40, unit_cost: 18.5, qty: 2 },
      { order_id: order.id, product_name: 'กาแฟ', unit_price: 69, unit_cost: 25, qty: 1 },
    ])

    const after = await readOrder(db, order.id)
    expect(Number(after.items_total)).toBe(149)
    expect(Number(after.items_cost_total)).toBe(62)
    expect(Number(after.grand_total)).toBe(149)

    await db.from('orders').delete().eq('id', order.id)
  })

  it('ส่วนลดเปอร์เซ็นต์ไม่ลดค่าส่ง', async () => {
    const db = await signedInClient()
    const order = await newOrder(db, {
      discount_type: 'percent', discount_value: 10, shipping_fee: 50,
    })
    await db.from('order_items').insert({
      order_id: order.id, product_name: 'คุกกี้', unit_price: 100, unit_cost: 40, qty: 2,
    })

    const after = await readOrder(db, order.id)
    expect(Number(after.items_total)).toBe(200)
    expect(Number(after.discount_amount)).toBe(20)
    expect(Number(after.grand_total)).toBe(230)

    await db.from('orders').delete().eq('id', order.id)
  })

  it('ส่วนลดเป็นบาทเกินค่าสินค้าถูกตัดให้เท่ากับค่าสินค้า', async () => {
    const db = await signedInClient()
    const order = await newOrder(db, { discount_type: 'amount', discount_value: 500 })
    await db.from('order_items').insert({
      order_id: order.id, product_name: 'คุกกี้', unit_price: 40, unit_cost: 18, qty: 1,
    })

    const after = await readOrder(db, order.id)
    expect(Number(after.discount_amount)).toBe(40)
    expect(Number(after.grand_total)).toBe(0)

    await db.from('orders').delete().eq('id', order.id)
  })

  it('สถานะเงินเดินจาก unpaid ไป partial ไป paid ตามยอดที่จ่ายจริง', async () => {
    const db = await signedInClient()
    const order = await newOrder(db)
    await db.from('order_items').insert({
      order_id: order.id, product_name: 'เค้ก', unit_price: 300, unit_cost: 120, qty: 1,
    })
    expect((await readOrder(db, order.id)).payment_status).toBe('unpaid')

    await db.from('payments').insert({ order_id: order.id, amount: 150 })
    expect((await readOrder(db, order.id)).payment_status).toBe('partial')

    await db.from('payments').insert({ order_id: order.id, amount: 150 })
    expect((await readOrder(db, order.id)).payment_status).toBe('paid')

    await db.from('orders').delete().eq('id', order.id)
  })

  it('ลบรายการสินค้าออกแล้วยอดลดลงตาม', async () => {
    const db = await signedInClient()
    const order = await newOrder(db)
    const item = await db
      .from('order_items')
      .insert({ order_id: order.id, product_name: 'ขนมปัง', unit_price: 55, unit_cost: 20, qty: 2 })
      .select()
      .single()
    expect(Number((await readOrder(db, order.id)).items_total)).toBe(110)

    await db.from('order_items').delete().eq('id', item.data!.id)
    expect(Number((await readOrder(db, order.id)).items_total)).toBe(0)

    await db.from('orders').delete().eq('id', order.id)
  })
})
