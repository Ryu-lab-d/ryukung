import { describe, it, expect, afterAll } from 'vitest'
import { adminClient, anonClient, signedInClient } from './helpers'

// หน้า /learn: นักเรียนไม่มีบัญชี เข้าด้วยรหัสผ่าน learn_open เท่านั้น เห็นเฉพาะคอร์สที่เปิดสอนและรหัสนั้นมีสิทธิ์
const ids: { courses: string[]; codes: string[] } = { courses: [], codes: [] }

afterAll(async () => {
  const admin = adminClient()
  if (ids.codes.length) await admin.from('course_access_codes').delete().in('id', ids.codes)
  if (ids.courses.length) await admin.from('courses').delete().in('id', ids.courses)
})

describe('learn_open', () => {
  it('รหัสถูก เห็นคอร์สที่เปิดสอนพร้อมบทเรียน / รหัสผิด ถูกยกเลิก หมดอายุ = null / anon อ่านตารางตรงไม่ได้', async () => {
    const admin = adminClient()
    const open = await admin.from('courses').insert({ title: 'Soft Cookies TEST', is_published: true }).select().single()
    const draft = await admin.from('courses').insert({ title: 'ฉบับร่าง TEST', is_published: false }).select().single()
    ids.courses.push(open.data!.id, draft.data!.id)
    await admin.from('course_lessons').insert({ course_id: open.data!.id, title: 'สูตร', ingredients: 'แป้ง | 200 กรัม', steps: 'ผสม\nอบ' })

    const mk = async (code: string, extra: Record<string, unknown> = {}) => {
      const r = await admin.from('course_access_codes').insert({ code, student_name: 'นักเรียนทดสอบ', ...extra }).select().single()
      ids.codes.push(r.data!.id)
    }
    await mk('COOK-TESTAAAA')
    await mk('COOK-TESTREVK', { revoked: true })
    await mk('COOK-TESTEXPR', { expires_at: new Date(Date.now() - 1000).toISOString() })
    await mk('COOK-TESTONLY', { course_ids: [draft.data!.id] })

    const anon = anonClient()
    const ok = await anon.rpc('learn_open', { p_code: ' cook-testaaaa ' })
    expect(ok.error).toBeNull()
    const titles = (ok.data as any).courses.map((c: any) => c.title)
    expect(titles).toContain('Soft Cookies TEST')
    expect(titles).not.toContain('ฉบับร่าง TEST')
    expect((ok.data as any).courses.find((c: any) => c.title === 'Soft Cookies TEST').lessons[0].title).toBe('สูตร')

    expect((await anon.rpc('learn_open', { p_code: 'COOK-NOPE' })).data).toBeNull()
    expect((await anon.rpc('learn_open', { p_code: 'COOK-TESTREVK' })).data).toBeNull()
    expect((await anon.rpc('learn_open', { p_code: 'COOK-TESTEXPR' })).data).toBeNull()
    // รหัสที่จำกัดเฉพาะคอร์สร่าง ไม่เห็นอะไรเลย
    expect(((await anon.rpc('learn_open', { p_code: 'COOK-TESTONLY' })).data as any).courses).toEqual([])

    const direct = await anon.from('course_access_codes').select('code')
    expect(direct.data ?? []).toEqual([])
    const used = await admin.from('course_access_codes').select('use_count').eq('code', 'COOK-TESTAAAA').single()
    expect(used.data!.use_count).toBe(1)
  })

  it('พนักงานสร้างรหัสเองไม่ได้ถ้าไม่ใช่ผู้จัดการ/เจ้าของ แต่เจ้าของทดสอบสร้างได้', async () => {
    const db = await signedInClient()
    const r = await db.from('course_access_codes').insert({ code: 'COOK-TESTOWNR', student_name: 'x' }).select().single()
    if (r.data) ids.codes.push(r.data.id)
    expect(r.error).toBeNull()
  })
})
