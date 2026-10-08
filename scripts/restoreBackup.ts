import dotenv from 'dotenv'
import fs from 'node:fs'
import readline from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'
import { decryptBackup, restoreBackup, summarize } from '../src/backup/backupCore'

/**
 * กู้คืนข้อมูลจากไฟล์สำรอง: npm run restore -- <ไฟล์.enc.json> [--apply] [--only=orders,customers]
 *  - ค่าเริ่มต้นเป็น "ซ้อมก่อน" (dry-run) แค่บอกว่าจะกู้อะไรบ้าง ไม่เขียนอะไร — ใส่ --apply ถึงจะเขียนจริง
 *  - กู้แบบ upsert ด้วย id เดิม: ใส่แถวที่หายกลับมา / ทับแถวที่ถูกแก้ ไม่ลบข้อมูลอื่นที่มีอยู่
 *  - ไม่กู้ staff_members และ audit_log (พนักงานต้องสมัครผ่านลิงก์เชิญใหม่ / ประวัติแก้ย้อนหลังไม่ได้)
 * รหัสผ่านไฟล์: ตัวแปร BACKUP_PASSPHRASE หรือพิมพ์ตอนระบบถาม
 */
dotenv.config({ path: '.env.local' })

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'))
  if (!file) throw new Error('ใช้: npm run restore -- <ไฟล์.enc.json> [--apply] [--only=orders,customers]')
  const apply = process.argv.includes('--apply')
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.slice(7).split(',').filter(Boolean) : undefined

  let pass = process.env.BACKUP_PASSPHRASE ?? ''
  if (!pass) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    pass = await rl.question('รหัสผ่านไฟล์สำรอง: ')
    rl.close()
  }
  const data = await decryptBackup(fs.readFileSync(file, 'utf8'), pass)
  const s = summarize(data)
  console.log(`ไฟล์สำรองเมื่อ ${s.createdAt} — ${s.totalRows} แถว, รูป ${s.files} ไฟล์`)

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const result = await restoreBackup(db, data, { apply, only, onProgress: (m) => console.log(m) })
  for (const r of result) console.log(`${r.error ? '✗' : '✓'} ${r.table}: ${r.rows} แถว${apply ? `, เขียน ${r.written}` : ''}${r.error ? ` — ${r.error}` : ''}`)
  if (!apply) console.log('\n(นี่คือการซ้อมเท่านั้น ยังไม่ได้เขียนอะไร — เติม --apply เพื่อกู้จริง)')
}

main().catch((e) => {
  console.error('ไม่สำเร็จ:', e instanceof Error ? e.message : e)
  process.exit(1)
})
