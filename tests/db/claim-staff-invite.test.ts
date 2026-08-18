import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { adminClient, signedInClient } from './helpers'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

const cleanup = { staffMemberIds: [] as string[], authUserIds: [] as string[] }

describe('claim_staff_invite — บั๊กเดิม: เจ้าของร้านกดอนุมัติคำเชิญก่อนพนักงานสมัครจริง', () => {
  it('แถวคำเชิญที่ user_id ยังว่างแต่ status ถูกกดเป็น active ไปก่อนแล้ว ยังจับคู่กับบัญชีจริงได้ตอนพนักงานสมัคร', async () => {
    const testEmail = `test-claim-${Date.now()}@example.com`
    const owner = await signedInClient()

    // จำลองบั๊กเดิม: เจ้าของร้านเชิญไว้ (user_id ว่าง) แล้วกดอนุมัติก่อนที่พนักงานจะสมัครจริง (status เลยเป็น active
    // ทั้งที่ยังไม่มีบัญชีผูกอยู่เลย — ก่อนแก้ ตรงนี้จะทำให้ claim_staff_invite หาแถวนี้ไม่เจอ)
    const invite = await owner
      .from('staff_members')
      .insert({ email: testEmail, display_name: 'ทดสอบ-claim', role: 'staff', status: 'active' })
      .select()
      .single()
    expect(invite.error).toBeNull()
    cleanup.staffMemberIds.push(invite.data!.id)

    // สร้างบัญชีทดสอบจริงแบบยืนยันอีเมลไว้ให้แล้วเลย (ข้ามขั้นตอนกดลิงก์ยืนยันในอีเมลจริง เพราะทดสอบอัตโนมัติ)
    const admin = adminClient()
    const created = await admin.auth.admin.createUser({ email: testEmail, password: 'Test1234!', email_confirm: true })
    expect(created.error).toBeNull()
    cleanup.authUserIds.push(created.data.user!.id)

    const newStaffClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const signIn = await newStaffClient.auth.signInWithPassword({ email: testEmail, password: 'Test1234!' })
    expect(signIn.error).toBeNull()

    const claim = await newStaffClient.rpc('claim_staff_invite', { p_display_name: 'ทดสอบ-claim' })
    expect(claim.error).toBeNull()
    expect(claim.data).toBe('active')

    // แถวคำเชิญเดิมต้องถูกผูกกับบัญชีจริงที่เพิ่งสมัคร ไม่ใช่สร้างแถวใหม่ซ้ำ
    const updated = await owner.from('staff_members').select('id, user_id, status').eq('id', invite.data!.id).single()
    expect(updated.data!.user_id).toBe(created.data.user!.id)
    expect(updated.data!.status).toBe('active')

    // ต้องไม่มีแถวซ้ำสำหรับอีเมลเดียวกันเกิดขึ้นมาใหม่
    const allRows = await owner.from('staff_members').select('id').eq('email', testEmail)
    expect(allRows.data).toHaveLength(1)
  })

  it('คำเชิญที่ถูกยกเลิกไปแล้ว (revoked) ไม่ถูกจับคู่ให้อัตโนมัติ — อีเมลนั้นยังถูกกันไว้ (unique index) จนกว่าเจ้าของร้านจะลบแถวเดิมทิ้งจริงๆ', async () => {
    const testEmail = `test-claim-revoked-${Date.now()}@example.com`
    const owner = await signedInClient()

    const invite = await owner
      .from('staff_members')
      .insert({ email: testEmail, display_name: 'ทดสอบ-revoked', role: 'staff', status: 'revoked' })
      .select()
      .single()
    expect(invite.error).toBeNull()
    cleanup.staffMemberIds.push(invite.data!.id)

    const admin = adminClient()
    const created = await admin.auth.admin.createUser({ email: testEmail, password: 'Test1234!', email_confirm: true })
    expect(created.error).toBeNull()
    cleanup.authUserIds.push(created.data.user!.id)

    const newStaffClient = createClient(url, anonKey, { auth: { persistSession: false } })
    await newStaffClient.auth.signInWithPassword({ email: testEmail, password: 'Test1234!' })
    const claim = await newStaffClient.rpc('claim_staff_invite', { p_display_name: 'ทดสอบ-revoked' })
    // ไม่จับคู่กับแถวที่ถูกระงับไว้ (ตั้งใจ) — แต่ insert แถวใหม่ด้วยอีเมลเดียวกันชนกับ unique index เดิม (email ถูกกันไว้
    // จนกว่าเจ้าของร้านจะลบแถว revoked เดิมทิ้งจริงๆ) จึงได้ error กลับมาแทนที่จะเงียบๆ สร้างแถวซ้ำ — พฤติกรรมเดิมที่ถูกต้องอยู่แล้ว
    expect(claim.error).not.toBeNull()

    const rows = await owner.from('staff_members').select('id, user_id, status').eq('email', testEmail)
    expect(rows.data).toHaveLength(1) // ยังมีแค่แถว revoked เดิม ไม่มีแถวใหม่ค้างซ้ำ
    expect(rows.data![0].status).toBe('revoked')
    expect(rows.data![0].user_id).toBeNull()
  })
})

afterAll(async () => {
  const admin = adminClient()
  if (cleanup.staffMemberIds.length) await admin.from('staff_members').delete().in('id', [...new Set(cleanup.staffMemberIds)])
  for (const id of cleanup.authUserIds) await admin.auth.admin.deleteUser(id)
})
