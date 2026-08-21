import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { adminClient, signedInClient } from './helpers'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

const cleanup = { staffMemberIds: [] as string[], authUserIds: [] as string[], withdrawalIds: [] as string[] }

/** สร้างพนักงานทดสอบจริง (ยืนยันอีเมลไว้ให้แล้ว) พร้อมผูก user_id เข้ากับแถว staff_members ตาม role ที่ต้องการ */
async function createTestStaff(role: 'staff' | 'manager'): Promise<SupabaseClient> {
  const email = `test-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const admin = adminClient()
  const created = await admin.auth.admin.createUser({ email, password: 'Test1234!', email_confirm: true })
  if (created.error) throw new Error(created.error.message)
  cleanup.authUserIds.push(created.data.user!.id)

  const staff = await admin
    .from('staff_members')
    .insert({ email, display_name: `ทดสอบ-${role}`, role, status: 'active', user_id: created.data.user!.id })
    .select()
    .single()
  if (staff.error) throw new Error(staff.error.message)
  cleanup.staffMemberIds.push(staff.data.id)

  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const signIn = await client.auth.signInWithPassword({ email, password: 'Test1234!' })
  if (signIn.error) throw new Error(signIn.error.message)
  return client
}

describe('ระดับตำแหน่งผู้จัดการ (manager) — สิทธิ์จัดการพนักงานคนอื่น', () => {
  it('ผู้จัดการเชิญพนักงานใหม่ได้ (insert แถว staff_members อื่น)', async () => {
    const manager = await createTestStaff('manager')
    const invited = await manager
      .from('staff_members')
      .insert({ email: `test-invited-by-manager-${Date.now()}@example.com`, display_name: 'ทดสอบ-ถูกเชิญ', role: 'staff', status: 'pending' })
      .select()
      .single()
    expect(invited.error).toBeNull()
    cleanup.staffMemberIds.push(invited.data!.id)
  })

  it('ผู้จัดการอนุมัติพนักงานคนอื่นได้ (update status ของแถวอื่น)', async () => {
    const manager = await createTestStaff('manager')
    const admin = adminClient()
    const pending = await admin
      .from('staff_members')
      .insert({ email: `test-pending-${Date.now()}@example.com`, display_name: 'ทดสอบ-รออนุมัติ', role: 'staff', status: 'pending' })
      .select()
      .single()
    expect(pending.error).toBeNull()
    cleanup.staffMemberIds.push(pending.data!.id)

    const approved = await manager.from('staff_members').update({ status: 'active' }).eq('id', pending.data!.id).select().single()
    expect(approved.error).toBeNull()
    expect(approved.data!.status).toBe('active')
  })

  it('ผู้จัดการเปลี่ยน role ของพนักงานคนอื่นไม่ได้ — trigger ต้อง error เสมอ', async () => {
    const manager = await createTestStaff('manager')
    const admin = adminClient()
    const other = await admin
      .from('staff_members')
      .insert({ email: `test-role-target-${Date.now()}@example.com`, display_name: 'ทดสอบ-เป้าหมาย', role: 'staff', status: 'active' })
      .select()
      .single()
    expect(other.error).toBeNull()
    cleanup.staffMemberIds.push(other.data!.id)

    const changeRole = await manager.from('staff_members').update({ role: 'manager' }).eq('id', other.data!.id)
    expect(changeRole.error).not.toBeNull()

    const stillStaff = await admin.from('staff_members').select('role').eq('id', other.data!.id).single()
    expect(stillStaff.data!.role).toBe('staff')
  })

  it('ผู้จัดการเลื่อนขั้นตัวเองเป็นเจ้าของร้านไม่ได้ — trigger กันแม้แถวตัวเอง', async () => {
    const manager = await createTestStaff('manager')
    const me = await manager.auth.getUser()
    const selfRow = await adminClient().from('staff_members').select('id').eq('user_id', me.data.user!.id).single()
    const changeSelfRole = await manager.from('staff_members').update({ role: 'owner' }).eq('id', selfRow.data!.id)
    expect(changeSelfRole.error).not.toBeNull()

    const stillManager = await adminClient().from('staff_members').select('role').eq('id', selfRow.data!.id).single()
    expect(stillManager.data!.role).toBe('manager')
  })

  it('ผู้จัดการแก้ settings ได้ (ชื่อร้าน)', async () => {
    const manager = await createTestStaff('manager')
    const settingsRow = await manager.from('settings').select('id').single()
    const upd = await manager.from('settings').update({ shop_name: 'RYUKUNG BAKERY' }).eq('id', settingsRow.data!.id).select().single()
    expect(upd.error).toBeNull()
    expect(upd.data!.shop_name).toBe('RYUKUNG BAKERY')
  })

  it('พนักงานทั่วไป (ไม่ใช่ผู้จัดการ) ยังเขียนแถว staff_members ของคนอื่นไม่ได้เหมือนเดิม', async () => {
    const staff = await createTestStaff('staff')
    const admin = adminClient()
    const other = await admin
      .from('staff_members')
      .insert({ email: `test-other-${Date.now()}@example.com`, display_name: 'ทดสอบ-คนอื่น', role: 'staff', status: 'pending' })
      .select()
      .single()
    expect(other.error).toBeNull()
    cleanup.staffMemberIds.push(other.data!.id)

    const approve = await staff.from('staff_members').update({ status: 'active' }).eq('id', other.data!.id)
    // RLS ปฏิเสธเงียบๆ (update 0 แถว ไม่ error) — ต้องเช็คว่าแถวจริงไม่เปลี่ยนแทน
    void approve
    const stillPending = await admin.from('staff_members').select('status').eq('id', other.data!.id).single()
    expect(stillPending.data!.status).toBe('pending')
  })

  it('พนักงานทั่วไปแก้ settings ไม่ได้', async () => {
    const staff = await createTestStaff('staff')
    const settingsRow = await staff.from('settings').select('id').single()
    const upd = await staff.from('settings').update({ shop_name: 'ร้านปลอมจากพนักงาน' }).eq('id', settingsRow.data!.id).select()
    expect(upd.data).toEqual([])
  })
})

describe('รายละเอียดการเบิกของ — created_by อัตโนมัติ + FK hint สองจุด', () => {
  it('insert stock_withdrawals ด้วย staff ทั่วไป ได้ created_by เป็น staff_members.id ของตัวเองอัตโนมัติ', async () => {
    const staff = await createTestStaff('staff')
    const me = await staff.auth.getUser()
    const myStaffRow = await adminClient().from('staff_members').select('id').eq('user_id', me.data.user!.id).single()

    const withdrawal = await staff
      .from('stock_withdrawals')
      .insert({ location: 'ทดสอบ-created-by' })
      .select()
      .single()
    expect(withdrawal.error).toBeNull()
    cleanup.withdrawalIds.push(withdrawal.data!.id)
    expect(withdrawal.data!.created_by).toBe(myStaffRow.data!.id)
  })

  it('select ด้วย FK hint สองจุด (withdrawn_by / created_by) แยกกันได้ถูกต้อง เมื่อคนสร้างกับผู้เบิกเป็นคนละคน', async () => {
    const owner = await signedInClient()
    const staff = await createTestStaff('staff')
    const staffUser = await staff.auth.getUser()
    const staffRow = await adminClient().from('staff_members').select('id, display_name, email').eq('user_id', staffUser.data.user!.id).single()

    // เจ้าของร้าน (owner) เป็นคนสร้างรายการ แต่ระบุว่า staff ทดสอบเป็นผู้เบิกไปขายจริง
    const withdrawal = await owner
      .from('stock_withdrawals')
      .insert({ location: 'ทดสอบ-fk-hint', withdrawn_by: staffRow.data!.id })
      .select()
      .single()
    expect(withdrawal.error).toBeNull()
    cleanup.withdrawalIds.push(withdrawal.data!.id)

    const joined = await owner
      .from('stock_withdrawals')
      .select(
        '*, staff_members!stock_withdrawals_withdrawn_by_fkey(display_name, email), creator:staff_members!stock_withdrawals_created_by_fkey(display_name, email)'
      )
      .eq('id', withdrawal.data!.id)
      .single()
    expect(joined.error).toBeNull()
    expect(joined.data!.staff_members.email).toBe(staffRow.data!.email)
    expect(joined.data!.creator).not.toBeNull()
    expect(joined.data!.creator.email).not.toBe(staffRow.data!.email) // สร้างโดย owner ไม่ใช่ staff ที่เป็นผู้เบิก
  })
})

afterAll(async () => {
  const admin = adminClient()
  if (cleanup.withdrawalIds.length) await admin.from('stock_withdrawals').delete().in('id', [...new Set(cleanup.withdrawalIds)])
  if (cleanup.staffMemberIds.length) await admin.from('staff_members').delete().in('id', [...new Set(cleanup.staffMemberIds)])
  for (const id of [...new Set(cleanup.authUserIds)]) await admin.auth.admin.deleteUser(id)
})
