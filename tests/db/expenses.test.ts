import { describe, it, expect, afterAll } from 'vitest'
import { anonClient, signedInClient } from './helpers'

const created: string[] = []

describe('ตารางรายจ่าย', () => {
  it('บันทึกรายจ่ายได้ และแก้ไข/ลบได้', async () => {
    const db = await signedInClient()
    const ins = await db
      .from('expenses')
      .insert({ expense_date: '2026-08-15', category: 'packaging', amount: 250, note: 'ทดสอบ-ถุงกระดาษ' })
      .select()
      .single()
    expect(ins.error).toBeNull()
    expect(Number(ins.data!.amount)).toBe(250)
    created.push(ins.data!.id)

    const upd = await db.from('expenses').update({ amount: 300 }).eq('id', ins.data!.id).select().single()
    expect(upd.error).toBeNull()
    expect(Number(upd.data!.amount)).toBe(300)

    const del = await db.from('expenses').delete().eq('id', ins.data!.id)
    expect(del.error).toBeNull()
    created.splice(created.indexOf(ins.data!.id), 1)
  })

  it('หมวดหมู่ที่ไม่อยู่ใน enum ใส่ไม่ได้', async () => {
    const db = await signedInClient()
    const { error } = await db.from('expenses').insert({ category: 'ไม่มีจริง', amount: 100 })
    expect(error).not.toBeNull()
  })

  it('จำนวนเงินติดลบหรือศูนย์ใส่ไม่ได้', async () => {
    const db = await signedInClient()
    const { error } = await db.from('expenses').insert({ category: 'other', amount: 0 })
    expect(error).not.toBeNull()
  })

  it('คนที่ยังไม่ล็อกอินอ่านรายจ่ายไม่ได้', async () => {
    const db = anonClient()
    const { data } = await db.from('expenses').select('*')
    expect(data).toEqual([])
  })
})

afterAll(async () => {
  if (created.length === 0) return
  const db = await signedInClient()
  await db.from('expenses').delete().in('id', created)
})
