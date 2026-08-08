import { describe, it, expect } from 'vitest'
import { signedInClient } from './helpers'

describe('ตารางออเดอร์', () => {
  it('เลขออเดอร์ที่ขอมาต้องไม่ซ้ำกันแม้ขอพร้อมกัน 20 ครั้ง', async () => {
    const db = await signedInClient()
    const results = await Promise.all(
      Array.from({ length: 20 }, () => db.rpc('next_order_no'))
    )
    const numbers = results.map((r) => r.data as string)
    expect(numbers.every((n) => typeof n === 'string')).toBe(true)
    expect(new Set(numbers).size).toBe(20)
    expect(numbers[0]).toMatch(/^RYB-\d{6}$/)
  })

  it('ออเดอร์ร่างไม่ต้องมีเลขที่', async () => {
    const db = await signedInClient()
    const { data, error } = await db
      .from('orders')
      .insert({ is_draft: true, fulfillment_type: 'shipping' })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.order_no).toBeNull()
    expect(data!.public_token).toHaveLength(32)
    await db.from('orders').delete().eq('id', data!.id)
  })

  it('ออเดอร์ที่ยืนยันแล้วแต่ไม่มีเลขที่ บันทึกไม่ได้', async () => {
    const db = await signedInClient()
    const { error } = await db
      .from('orders')
      .insert({ is_draft: false, fulfillment_type: 'pickup' })
    expect(error).not.toBeNull()
  })

  it('ลบออเดอร์แล้วรายการสินค้าในออเดอร์หายตาม', async () => {
    const db = await signedInClient()
    const order = await db
      .from('orders')
      .insert({ is_draft: true })
      .select()
      .single()
    const item = await db
      .from('order_items')
      .insert({
        order_id: order.data!.id,
        product_name: 'ทดสอบ-คุกกี้',
        unit_price: 40,
        unit_cost: 18.5,
        qty: 2,
        line_total: 80,
      })
      .select()
      .single()
    expect(item.error).toBeNull()

    await db.from('orders').delete().eq('id', order.data!.id)
    const left = await db.from('order_items').select('*').eq('id', item.data!.id)
    expect(left.data).toEqual([])
  })
})
