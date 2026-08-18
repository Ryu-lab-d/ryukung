import { describe, it, expect, afterAll } from 'vitest'
import { signedInClient } from './helpers'

const cleanupIds: string[] = []

describe('สิทธิ์การเข้าถึงหน้าต่างๆ ต่อพนักงาน (allowed_pages)', () => {
  it('เชิญพนักงานใหม่ ได้สิทธิ์เข้าทุกหน้าเป็นค่าเริ่มต้น', async () => {
    const db = await signedInClient()
    const ins = await db
      .from('staff_members')
      .insert({ email: 'ทดสอบ-permissions@example.com', display_name: 'ทดสอบ-สิทธิ์', role: 'staff', status: 'pending' })
      .select()
      .single()
    expect(ins.error).toBeNull()
    cleanupIds.push(ins.data!.id)

    const expectedFullAccess = [
      'orders', 'products', 'customers', 'costing', 'summary',
      'expenses', 'withdrawals', 'content', 'ingredients', 'promo', 'storage',
    ]
    expect(new Set(ins.data!.allowed_pages)).toEqual(new Set(expectedFullAccess))
  })

  it('แก้ allowed_pages ได้ และอ่านค่ากลับมาตรงกับที่บันทึกไว้', async () => {
    const db = await signedInClient()
    const ins = await db
      .from('staff_members')
      .insert({ email: 'ทดสอบ-permissions2@example.com', display_name: 'ทดสอบ-สิทธิ์2', role: 'staff', status: 'pending' })
      .select()
      .single()
    expect(ins.error).toBeNull()
    cleanupIds.push(ins.data!.id)

    const upd = await db
      .from('staff_members')
      .update({ allowed_pages: ['orders', 'customers'] })
      .eq('id', ins.data!.id)
      .select()
      .single()
    expect(upd.error).toBeNull()
    expect(upd.data!.allowed_pages).toEqual(['orders', 'customers'])

    const empty = await db.from('staff_members').update({ allowed_pages: [] }).eq('id', ins.data!.id).select().single()
    expect(empty.error).toBeNull()
    expect(empty.data!.allowed_pages).toEqual([])
  })
})

afterAll(async () => {
  if (cleanupIds.length === 0) return
  const db = await signedInClient()
  await db.from('staff_members').delete().in('id', cleanupIds)
})
