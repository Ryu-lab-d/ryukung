import { describe, it, expect } from 'vitest'
import { signedInClient } from './helpers'

describe('ตารางลูกค้า', () => {
  it('สร้างลูกค้าพร้อมที่อยู่ได้ และลบลูกค้าแล้วที่อยู่หายตาม', async () => {
    const db = await signedInClient()

    const cus = await db
      .from('customers')
      .insert({ name: 'ทดสอบ-คุณเอ', phone: '0800000000', channel: 'line' })
      .select()
      .single()
    expect(cus.error).toBeNull()

    const addr = await db
      .from('customer_addresses')
      .insert({
        customer_id: cus.data!.id,
        address_text: '123 ถนนทดสอบ',
        is_default: true,
      })
      .select()
      .single()
    expect(addr.error).toBeNull()

    await db.from('customers').delete().eq('id', cus.data!.id)

    const left = await db
      .from('customer_addresses')
      .select('*')
      .eq('id', addr.data!.id)
    expect(left.data).toEqual([])
  })

  it('ที่อยู่หลักซ้ำสองอันในลูกค้าคนเดียวกันไม่ได้', async () => {
    const db = await signedInClient()
    const cus = await db
      .from('customers')
      .insert({ name: 'ทดสอบ-คุณบี' })
      .select()
      .single()

    await db.from('customer_addresses').insert({
      customer_id: cus.data!.id,
      address_text: 'ที่อยู่ 1',
      is_default: true,
    })
    const second = await db.from('customer_addresses').insert({
      customer_id: cus.data!.id,
      address_text: 'ที่อยู่ 2',
      is_default: true,
    })
    expect(second.error).not.toBeNull()

    await db.from('customers').delete().eq('id', cus.data!.id)
  })

  it('ช่องทางที่ไม่รู้จักใส่ไม่ได้', async () => {
    const db = await signedInClient()
    const { error } = await db
      .from('customers')
      .insert({ name: 'ทดสอบ-คุณซี', channel: 'myspace' })
    expect(error).not.toBeNull()
  })
})
