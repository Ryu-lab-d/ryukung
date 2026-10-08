import { describe, it, expect } from 'vitest'
import { BACKUP_TABLES, NO_RESTORE, decryptBackup, encryptBackup, restoreBackup, summarize, type BackupData } from './backupCore'

const sample = (): BackupData => ({
  format: 'ryukung-backup',
  version: 1,
  createdAt: '2026-10-09T00:00:00.000Z',
  tables: { customers: [{ id: 'c1', name: 'ลูกค้าลับ', phone: '0812345678' }], orders: [{ id: 'o1', note: 'ความลับ' }] },
  files: [{ path: 'logo.png', contentType: 'image/png', base64: 'AAEC' }],
})

describe('เข้ารหัส/ถอดรหัสไฟล์สำรอง', () => {
  it('เข้ารหัสแล้วถอดกลับได้เหมือนเดิม และข้อความในไฟล์ไม่มีข้อมูลจริงให้อ่าน', async () => {
    const text = await encryptBackup(sample(), 'correct horse battery staple', 1000)
    expect(text).not.toContain('ลูกค้าลับ')
    expect(text).not.toContain('0812345678')
    expect(text).not.toContain('ความลับ')
    expect(await decryptBackup(text, 'correct horse battery staple')).toEqual(sample())
  })

  it('รหัสผิด / ไฟล์ถูกแก้ไขแม้ 1 ตัวอักษร / ไม่ใช่ไฟล์สำรอง → ถอดไม่ได้', async () => {
    const text = await encryptBackup(sample(), 'correct horse battery staple', 1000)
    await expect(decryptBackup(text, 'wrong passphrase!!')).rejects.toThrow(/ไม่ถูกต้อง/)
    const env = JSON.parse(text)
    const flipped = env.data.slice(0, 10) + (env.data[10] === 'A' ? 'B' : 'A') + env.data.slice(11)
    await expect(decryptBackup(JSON.stringify({ ...env, data: flipped }), 'correct horse battery staple')).rejects.toThrow()
    await expect(decryptBackup('{"hello":1}', 'x')).rejects.toThrow(/ไม่ใช่ไฟล์สำรอง/)
    await expect(decryptBackup('not json', 'x')).rejects.toThrow(/ไม่ใช่ไฟล์สำรอง/)
  })

  it('รหัสผ่านสั้นเกินไป ไม่ยอมเข้ารหัส / เข้ารหัสสองครั้งได้ผลต่างกัน (salt/iv สุ่ม)', async () => {
    await expect(encryptBackup(sample(), 'short', 1000)).rejects.toThrow(/อย่างน้อย/)
    const a = await encryptBackup(sample(), 'correct horse battery staple', 1000)
    const b = await encryptBackup(sample(), 'correct horse battery staple', 1000)
    expect(a).not.toEqual(b)
  })

  it('สรุปจำนวนแถว', () => {
    expect(summarize(sample())).toEqual({ createdAt: '2026-10-09T00:00:00.000Z', counts: { customers: 1, orders: 1 }, files: 1, totalRows: 2 })
  })

  it('ลำดับตารางตารางแม่มาก่อนลูก และไม่กู้ staff_members/audit_log', () => {
    expect(BACKUP_TABLES.indexOf('orders')).toBeLessThan(BACKUP_TABLES.indexOf('order_items'))
    expect(BACKUP_TABLES.indexOf('customers')).toBeLessThan(BACKUP_TABLES.indexOf('orders'))
    expect(BACKUP_TABLES.indexOf('products')).toBeLessThan(BACKUP_TABLES.indexOf('product_ingredients'))
    expect(NO_RESTORE).toEqual(expect.arrayContaining(['staff_members', 'audit_log']))
  })

  it('ซ้อมกู้ (apply=false) ไม่เขียนอะไรเลย', async () => {
    const db = { from: () => { throw new Error('ห้ามแตะฐานข้อมูลตอนซ้อม') }, storage: { from: () => { throw new Error('ห้ามแตะ') } } }
    const r = await restoreBackup(db as never, sample(), { apply: false })
    expect(r.find((x) => x.table === 'customers')).toMatchObject({ rows: 1, written: 0 })
    expect(r.find((x) => x.table === 'staff_members')).toBeUndefined()
  })
})
