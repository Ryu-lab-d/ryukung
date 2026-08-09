import { describe, it, expect } from 'vitest'
import { signedInClient } from './helpers'

describe('ลบออเดอร์และลูกค้า', () => {
  it('ลบออเดอร์ที่ไม่มีใบเสร็จได้ปกติ', async () => {
    const db = await signedInClient()
    const order = await db.from('orders').insert({ is_draft: true }).select().single()
    const { error } = await db.from('orders').delete().eq('id', order.data!.id)
    expect(error).toBeNull()
  })

  it('ลบออเดอร์ที่เคยออกใบเสร็จแล้วได้ และใบเสร็จถูกลบไปด้วย (เพื่อประหยัดพื้นที่ตามที่ร้านต้องการ)', async () => {
    const db = await signedInClient()
    const no = (await db.rpc('next_order_no')).data as string
    const order = await db.from('orders').insert({ is_draft: false, order_no: no }).select().single()
    const receipt = await db.rpc('issue_receipt', { p_order_id: order.data!.id, p_snapshot: {} })
    expect(receipt.error).toBeNull()

    const { error } = await db.from('orders').delete().eq('id', order.data!.id)
    expect(error).toBeNull()

    const remaining = await db.from('receipts').select('id').eq('order_id', order.data!.id)
    expect(remaining.data).toEqual([])
  })

  it('ลบลูกค้าได้ และออเดอร์เก่ายังอยู่แค่ไม่มีลูกค้าผูกแล้ว', async () => {
    const db = await signedInClient()
    const customer = await db.from('customers').insert({ name: 'ทดสอบ-จะลบ' }).select().single()
    const order = await db.from('orders').insert({ is_draft: true, customer_id: customer.data!.id }).select().single()

    const { error } = await db.from('customers').delete().eq('id', customer.data!.id)
    expect(error).toBeNull()

    const after = await db.from('orders').select('customer_id').eq('id', order.data!.id).single()
    expect(after.data!.customer_id).toBeNull()

    await db.from('orders').delete().eq('id', order.data!.id)
  })
})
