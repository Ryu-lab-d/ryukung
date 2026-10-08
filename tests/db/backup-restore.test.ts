import { describe, it, expect, afterAll } from 'vitest'
import { adminClient, anonClient, signedInClient } from './helpers'
import { createBackup, decryptBackup, encryptBackup, restoreBackup, summarize } from '../../src/backup/backupCore'

// ซ้อมกู้คืนจริง: สำรอง → ลบแถวทดสอบ → กู้ → แถวกลับมาเหมือนเดิม
const admin = adminClient()
const ids: string[] = []
afterAll(async () => {
  if (ids.length) await admin.from('categories').delete().in('id', ids)
})

describe('สำรอง/กู้คืนข้อมูลจริง', () => {
  it('สำรองด้วยสิทธิ์เจ้าของ → เข้ารหัส/ถอดรหัส → ลบแถว → กู้กลับมาได้ และไม่ลบแถวอื่น', async () => {
    const cat = await admin.from('categories').insert({ name: 'ทดสอบ-สำรอง-' + Date.now() }).select().single()
    expect(cat.error).toBeNull()
    ids.push(cat.data!.id)

    const owner = await signedInClient()
    const data = await createBackup(owner)
    expect(summarize(data).totalRows).toBeGreaterThan(0)
    expect(data.tables.categories.some((r) => r.id === cat.data!.id)).toBe(true)

    const text = await encryptBackup(data, 'test-passphrase-123456', 1000)
    expect(text).not.toContain(cat.data!.name)
    const restored = await decryptBackup(text, 'test-passphrase-123456')

    await admin.from('categories').delete().eq('id', cat.data!.id)
    expect((await admin.from('categories').select('id').eq('id', cat.data!.id)).data).toEqual([])

    const before = (await admin.from('categories').select('id')).data!.length
    const res = await restoreBackup(admin, restored, { apply: true, only: ['categories'] })
    expect(res.find((r) => r.table === 'categories')?.error).toBeUndefined()
    const back = await admin.from('categories').select('*').eq('id', cat.data!.id).single()
    expect(back.data!.name).toBe(cat.data!.name)
    expect((await admin.from('categories').select('id')).data!.length).toBe(before + 1)
  }, 120000)

  it('คนไม่ล็อกอิน/คนสมัครเอง สำรองข้อมูลไม่ได้ (อ่านตารางไม่ได้)', async () => {
    await expect(createBackup(anonClient())).rejects.toThrow()
  })

  it('ปุ่มฉุกเฉินล็อกเอาท์ทุกอุปกรณ์: คนไม่ล็อกอินเรียกไม่ได้', async () => {
    expect((await anonClient().rpc('emergency_revoke_sessions')).error).not.toBeNull()
  })
})
