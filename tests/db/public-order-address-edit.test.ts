import { describe, it, expect } from 'vitest'
import { signedInClient, anonClient, purgeOrder } from './helpers'

async function makeShippingOrder(db: Awaited<ReturnType<typeof signedInClient>>, workStatus = 'to_bake') {
  const no = (await db.rpc('next_order_no')).data as string
  const { data } = await db
    .from('orders')
    .insert({
      is_draft: false, order_no: no, fulfillment_type: 'shipping', work_status: workStatus,
      ship_recipient_name: 'เดิม', ship_recipient_phone: '0800000000', ship_address_text: 'ที่อยู่เดิม',
    })
    .select()
    .single()
  return data!
}

describe('ลิงก์สาธารณะ: รายละเอียดเพิ่มเติมและแก้ที่อยู่', () => {
  it('get_public_order คืนวิธีชำระเงินและรายละเอียดที่อยู่/นัดรับ', async () => {
    const db = await signedInClient()
    const order = await makeShippingOrder(db)

    const pub = anonClient()
    const { data } = await pub.rpc('get_public_order', { p_token: order.public_token })
    expect(data.payment_instructions).toContain('ryukung_bakery')
    expect(data.ship_address_text).toBe('ที่อยู่เดิม')
    expect(data.address_editable).toBe(true)

    await purgeOrder(order.id)
  })

  it('แก้ที่อยู่ผ่านลิงก์สาธารณะได้ตอนสถานะยังไม่เกิน "กำลังทำ"', async () => {
    const db = await signedInClient()
    const order = await makeShippingOrder(db, 'baking')

    const pub = anonClient()
    const { data, error } = await pub.rpc('update_public_order_address', {
      p_token: order.public_token,
      p_recipient_name: 'ใหม่',
      p_recipient_phone: '0899999999',
      p_address_text: 'ที่อยู่ใหม่ 456',
    })
    expect(error).toBeNull()
    expect(data).toBe(true)

    const after = await db.from('orders').select('ship_address_text, ship_recipient_name').eq('id', order.id).single()
    expect(after.data!.ship_address_text).toBe('ที่อยู่ใหม่ 456')
    expect(after.data!.ship_recipient_name).toBe('ใหม่')

    await purgeOrder(order.id)
  })

  it('แก้ที่อยู่ไม่ได้แล้วถ้าสถานะเลย "กำลังทำ" ไปแล้ว (แพ็คแล้วรอส่ง)', async () => {
    const db = await signedInClient()
    const order = await makeShippingOrder(db, 'ready')

    const pub = anonClient()
    const { data: getData } = await pub.rpc('get_public_order', { p_token: order.public_token })
    expect(getData.address_editable).toBe(false)

    const { error } = await pub.rpc('update_public_order_address', {
      p_token: order.public_token,
      p_recipient_name: 'ใหม่',
      p_recipient_phone: '0899999999',
      p_address_text: 'พยายามแก้',
    })
    expect(error).not.toBeNull()

    const after = await db.from('orders').select('ship_address_text').eq('id', order.id).single()
    expect(after.data!.ship_address_text).toBe('ที่อยู่เดิม')

    await purgeOrder(order.id)
  })

  it('ออเดอร์แบบนัดรับแก้ที่อยู่ไม่ได้เพราะไม่มีที่อยู่ให้แก้', async () => {
    const db = await signedInClient()
    const no = (await db.rpc('next_order_no')).data as string
    const order = (
      await db.from('orders').insert({ is_draft: false, order_no: no, fulfillment_type: 'pickup' }).select().single()
    ).data!

    const pub = anonClient()
    const { error } = await pub.rpc('update_public_order_address', {
      p_token: order.public_token,
      p_recipient_name: 'ใหม่',
      p_recipient_phone: null,
      p_address_text: 'พยายามแก้',
    })
    expect(error).not.toBeNull()

    await purgeOrder(order.id)
  })
})
