import { describe, it, expect } from 'vitest'
import { signedInClient } from './helpers'

describe('ยืนยันออเดอร์แบบอะตอมมิก', () => {
  it('ยืนยันพร้อมกัน 20 ออเดอร์ ได้เลขไม่ซ้ำกันและถูกรูปแบบ', async () => {
    const db = await signedInClient()
    const drafts = await Promise.all(
      Array.from({ length: 20 }, () =>
        db.from('orders').insert({ is_draft: true, fulfillment_type: 'pickup' }).select().single()
      )
    )
    const results = await Promise.all(
      drafts.map((d) =>
        db.rpc('confirm_order', {
          p_order_id: d.data!.id,
          p_customer_id: null,
          p_fulfillment_type: 'pickup',
          p_needed_date: null,
          p_bake_date: null,
          p_pickup_place: 'หน้าร้าน',
          p_pickup_time: '10:00',
          p_ship_recipient_name: null,
          p_ship_recipient_phone: null,
          p_ship_address_text: null,
          p_shipping_fee: 0,
          p_discount_type: 'none',
          p_discount_value: 0,
          p_note: null,
          p_items: [{ product_id: null, product_name: 'ทดสอบ-ของ', unit_price: 10, unit_cost: 5, qty: 2, note: null }],
        })
      )
    )
    const numbers = results.map((r) => r.data as string)
    expect(new Set(numbers).size).toBe(20)
    expect(numbers.every((n) => /^RYB-\d{6}$/.test(n))).toBe(true)

    const after = await db.from('orders').select('*').eq('id', drafts[0].data!.id).single()
    expect(Number(after.data!.grand_total)).toBe(20)

    await db.from('orders').delete().in('id', drafts.map((d) => d.data!.id))
  })

  it('ยืนยันไม่สำเร็จ (fulfillment_type ผิดเงื่อนไข) ไม่ทิ้งรายการสินค้าหรือเลขที่ค้างไว้', async () => {
    const db = await signedInClient()
    const draft = await db.from('orders').insert({ is_draft: true, fulfillment_type: 'pickup' }).select().single()

    const res = await db.rpc('confirm_order', {
      p_order_id: draft.data!.id,
      p_customer_id: null,
      p_fulfillment_type: 'ผิดพลาด',
      p_needed_date: null,
      p_bake_date: null,
      p_pickup_place: null,
      p_pickup_time: null,
      p_ship_recipient_name: null,
      p_ship_recipient_phone: null,
      p_ship_address_text: null,
      p_shipping_fee: 0,
      p_discount_type: 'none',
      p_discount_value: 0,
      p_note: null,
      p_items: [{ product_id: null, product_name: 'ทดสอบ-ของ', unit_price: 10, unit_cost: 5, qty: 1, note: null }],
    })
    expect(res.error).not.toBeNull()

    const after = await db.from('orders').select('*').eq('id', draft.data!.id).single()
    expect(after.data!.is_draft).toBe(true)
    expect(after.data!.order_no).toBeNull()

    const items = await db.from('order_items').select('*').eq('order_id', draft.data!.id)
    expect(items.data).toEqual([])

    await db.from('orders').delete().eq('id', draft.data!.id)
  })
})
