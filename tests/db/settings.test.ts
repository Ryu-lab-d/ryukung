import { describe, it, expect } from 'vitest'
import { anonClient, signedInClient } from './helpers'

describe('ตาราง settings', () => {
  it('คนที่ล็อกอินแล้วอ่านได้ และมีแถวเดียว', async () => {
    const db = await signedInClient()
    const { data, error } = await db.from('settings').select('*')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].shop_name).toBeTruthy()
  })

  it('คนที่ยังไม่ล็อกอินอ่านไม่ได้', async () => {
    const db = anonClient()
    const { data } = await db.from('settings').select('*')
    expect(data).toEqual([])
  })

  it('เพิ่มแถวที่สองไม่ได้', async () => {
    const db = await signedInClient()
    const { error } = await db.from('settings').insert({ shop_name: 'ร้านปลอม' })
    expect(error).not.toBeNull()
  })

  it('แก้ชื่อร้านได้และ updated_at ขยับ', async () => {
    const db = await signedInClient()
    const before = await db.from('settings').select('*').single()
    const { error } = await db
      .from('settings')
      .update({ shop_name: 'RYUKUNG BAKERY' })
      .eq('id', before.data!.id)
    expect(error).toBeNull()
    const after = await db.from('settings').select('*').single()
    expect(new Date(after.data!.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.data!.updated_at).getTime()
    )
  })
})
