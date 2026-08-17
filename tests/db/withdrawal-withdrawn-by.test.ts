import { describe, it, expect, afterAll } from 'vitest'
import { signedInClient } from './helpers'

const cleanupIds = { withdrawals: [] as string[] }

describe('เบิกของ — ผูกผู้เบิก (withdrawn_by)', () => {
  it('บันทึกผู้เบิกได้ และดึงข้อมูลชื่อ/อีเมลผู้เบิกกลับมาผ่านความสัมพันธ์ staff_members', async () => {
    const db = await signedInClient()

    const me = await db.auth.getUser()
    expect(me.error).toBeNull()
    const staff = await db.from('staff_members').select('id, display_name, email').eq('user_id', me.data.user!.id).single()
    expect(staff.error).toBeNull()

    const withdrawal = await db
      .from('stock_withdrawals')
      .insert({ location: 'ทดสอบ-โรงเรียน', withdrawn_by: staff.data!.id })
      .select()
      .single()
    expect(withdrawal.error).toBeNull()
    cleanupIds.withdrawals.push(withdrawal.data!.id)

    // จำลอง select ที่ useWithdrawal / useWithdrawals ใช้จริง
    const joined = await db
      .from('stock_withdrawals')
      .select('*, staff_members(display_name, email)')
      .eq('id', withdrawal.data!.id)
      .single()
    expect(joined.error).toBeNull()
    expect(joined.data!.withdrawn_by).toBe(staff.data!.id)
    expect(joined.data!.staff_members).not.toBeNull()
    expect(joined.data!.staff_members.email).toBe(staff.data!.email)
  })

  it('ไม่ระบุผู้เบิก เก็บเป็น null ได้ตามปกติ', async () => {
    const db = await signedInClient()
    const withdrawal = await db.from('stock_withdrawals').insert({ location: 'ทดสอบ-ไม่ระบุผู้เบิก' }).select().single()
    expect(withdrawal.error).toBeNull()
    cleanupIds.withdrawals.push(withdrawal.data!.id)
    expect(withdrawal.data!.withdrawn_by).toBeNull()
  })
})

afterAll(async () => {
  if (cleanupIds.withdrawals.length === 0) return
  const db = await signedInClient()
  await db.from('stock_withdrawals').delete().in('id', cleanupIds.withdrawals)
})
