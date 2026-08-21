import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { adminClient } from './helpers'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

const cleanup = { staffMemberIds: [] as string[], authUserIds: [] as string[] }

/** สร้างพนักงานทดสอบจริง (ยืนยันอีเมลไว้ให้แล้ว) พร้อมผูก user_id เข้ากับแถว staff_members ตาม role ที่ต้องการ */
async function createTestStaff(role: 'staff' | 'manager' | 'executive'): Promise<SupabaseClient> {
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

/** สร้างแถว staff_members เป้าหมาย (ไม่ผูกบัญชีจริง ใช้แค่เป็นเป้าหมายของการเปลี่ยน role) */
async function createTargetRow(role: 'staff' | 'manager' | 'executive' | 'owner', label: string) {
  const admin = adminClient()
  const row = await admin
    .from('staff_members')
    .insert({ email: `test-target-${label}-${Date.now()}@example.com`, display_name: `ทดสอบ-เป้าหมาย-${label}`, role, status: 'active' })
    .select()
    .single()
  if (row.error) throw new Error(row.error.message)
  cleanup.staffMemberIds.push(row.data.id)
  return row.data as { id: string; role: string }
}

describe('ระดับตำแหน่งผู้บริหาร (executive) — เปลี่ยนตำแหน่งคนอื่นได้แค่ staff<->manager', () => {
  it('ผู้บริหารเลื่อนพนักงานเป็นผู้จัดการได้ (staff -> manager)', async () => {
    const exec = await createTestStaff('executive')
    const target = await createTargetRow('staff', 'staff-to-manager')

    const upd = await exec.from('staff_members').update({ role: 'manager' }).eq('id', target.id).select().single()
    expect(upd.error).toBeNull()
    expect(upd.data!.role).toBe('manager')
  })

  it('ผู้บริหารลดผู้จัดการเป็นพนักงานได้ (manager -> staff)', async () => {
    const exec = await createTestStaff('executive')
    const target = await createTargetRow('manager', 'manager-to-staff')

    const upd = await exec.from('staff_members').update({ role: 'staff' }).eq('id', target.id).select().single()
    expect(upd.error).toBeNull()
    expect(upd.data!.role).toBe('staff')
  })

  it('ผู้บริหารเลื่อนใครเป็นผู้บริหารไม่ได้ — trigger ต้อง error', async () => {
    const exec = await createTestStaff('executive')
    const target = await createTargetRow('staff', 'staff-to-executive')

    const upd = await exec.from('staff_members').update({ role: 'executive' }).eq('id', target.id)
    expect(upd.error).not.toBeNull()

    const stillStaff = await adminClient().from('staff_members').select('role').eq('id', target.id).single()
    expect(stillStaff.data!.role).toBe('staff')
  })

  it('ผู้บริหารเปลี่ยน role ของผู้บริหารคนอื่นไม่ได้', async () => {
    const exec = await createTestStaff('executive')
    const otherExec = await createTargetRow('executive', 'other-executive')

    const upd = await exec.from('staff_members').update({ role: 'manager' }).eq('id', otherExec.id)
    expect(upd.error).not.toBeNull()

    const stillExecutive = await adminClient().from('staff_members').select('role').eq('id', otherExec.id).single()
    expect(stillExecutive.data!.role).toBe('executive')
  })

  it('ผู้บริหารเปลี่ยนใครเป็นเจ้าของร้านไม่ได้', async () => {
    const exec = await createTestStaff('executive')
    const target = await createTargetRow('staff', 'staff-to-owner')

    const upd = await exec.from('staff_members').update({ role: 'owner' }).eq('id', target.id)
    expect(upd.error).not.toBeNull()

    const stillStaff = await adminClient().from('staff_members').select('role').eq('id', target.id).single()
    expect(stillStaff.data!.role).toBe('staff')
  })

  it('ผู้บริหารเปลี่ยนเจ้าของร้านให้เป็นตำแหน่งอื่นก็ไม่ได้เช่นกัน', async () => {
    const exec = await createTestStaff('executive')
    const ownerRow = await createTargetRow('owner', 'owner-target')

    const upd = await exec.from('staff_members').update({ role: 'staff' }).eq('id', ownerRow.id)
    expect(upd.error).not.toBeNull()

    const stillOwner = await adminClient().from('staff_members').select('role').eq('id', ownerRow.id).single()
    expect(stillOwner.data!.role).toBe('owner')
  })

  it('ผู้บริหารเปลี่ยน role ตัวเองไม่ได้ แม้แถวตัวเอง', async () => {
    const exec = await createTestStaff('executive')
    const me = await exec.auth.getUser()
    const selfRow = await adminClient().from('staff_members').select('id').eq('user_id', me.data.user!.id).single()

    const upd = await exec.from('staff_members').update({ role: 'manager' }).eq('id', selfRow.data!.id)
    expect(upd.error).not.toBeNull()

    const stillExecutive = await adminClient().from('staff_members').select('role').eq('id', selfRow.data!.id).single()
    expect(stillExecutive.data!.role).toBe('executive')
  })

  it('ผู้บริหารแก้ settings ได้ (พิสูจน์ว่า is_manager_or_owner() ที่ขยายแล้วครอบคลุม settings_update ถึงระดับผู้บริหาร)', async () => {
    // ใช้ shop_name เหมือน manager-role.test.ts เดิม — ตั้งกลับเป็นค่าจริงของร้านเสมอ (ไม่ทำลายข้อมูลจริง)
    // เพราะสิทธิ์แก้ settings ที่ DB/RLS เป็นแบบ all-or-nothing ต่อทั้งแถวอยู่แล้ว (ไม่ได้จำกัดเป็นรายคอลัมน์)
    // ความต่างระหว่างผู้จัดการ/ผู้บริหารที่เห็นช่องไม่เท่ากันเป็นแค่ชั้น UI (ดู SettingsPage.test.tsx) ไม่ใช่ชั้น RLS
    const exec = await createTestStaff('executive')
    const settingsRow = await exec.from('settings').select('id').single()
    const upd = await exec.from('settings').update({ shop_name: 'RYUKUNG BAKERY' }).eq('id', settingsRow.data!.id).select().single()
    expect(upd.error).toBeNull()
    expect(upd.data!.shop_name).toBe('RYUKUNG BAKERY')
  })
})

afterAll(async () => {
  const admin = adminClient()
  if (cleanup.staffMemberIds.length) await admin.from('staff_members').delete().in('id', [...new Set(cleanup.staffMemberIds)])
  for (const id of [...new Set(cleanup.authUserIds)]) await admin.auth.admin.deleteUser(id)
})
