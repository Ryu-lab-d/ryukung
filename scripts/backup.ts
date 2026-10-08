import dotenv from 'dotenv'
import fs from 'node:fs'
import readline from 'node:readline/promises'
import { createClient } from '@supabase/supabase-js'
import { backupFileName, createBackup, encryptBackup, summarize } from '../src/backup/backupCore'

/**
 * สำรองข้อมูลทั้งระบบเป็นไฟล์เข้ารหัสจากเครื่อง: npm run backup [-- โฟลเดอร์ปลายทาง]
 * รหัสผ่านไฟล์: ตั้งตัวแปร BACKUP_PASSPHRASE เฉพาะตอนรันคำสั่ง หรือพิมพ์ตอนระบบถาม (ห้ามเขียนไว้ในไฟล์ .env)
 * ใช้ service role key จาก .env.local — เก็บไฟล์ผลลัพธ์ไว้ "นอกเครื่องนี้" (ดู docs/RECOVERY.md)
 */
dotenv.config({ path: '.env.local' })

async function main() {
  const outDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.'
  let pass = process.env.BACKUP_PASSPHRASE ?? ''
  if (!pass) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    pass = await rl.question('ตั้งรหัสผ่านไฟล์สำรอง (อย่างน้อย 12 ตัว): ')
    rl.close()
  }
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const data = await createBackup(db, (m) => console.log(m))
  const text = await encryptBackup(data, pass)
  const path = `${outDir.replace(/[\/]$/, '')}/${backupFileName()}`
  fs.writeFileSync(path, text)
  const s = summarize(data)
  console.log(`\n✓ สำรองเสร็จ: ${path}\n  ${s.totalRows} แถว, รูป ${s.files} ไฟล์\n  อย่าลืมย้ายไฟล์ไปเก็บนอกเครื่องนี้ และเก็บรหัสผ่านแยกต่างหาก`)
}

main().catch((e) => {
  console.error('สำรองไม่สำเร็จ:', e instanceof Error ? e.message : e)
  process.exit(1)
})
