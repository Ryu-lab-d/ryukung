import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * แกนระบบสำรอง/กู้คืนข้อมูล — ใช้ร่วมกันทั้งปุ่มสำรองในหน้าเว็บ (/backup) และสคริปต์ scripts/backup.ts / restoreBackup.ts
 * ไฟล์สำรองเข้ารหัสด้วยรหัสผ่านของเจ้าของ (AES-256-GCM, คีย์จาก PBKDF2-SHA256 600,000 รอบ) ต่อให้ไฟล์หลุดหรือคอมโดนแฮ็กก็เปิดอ่านไม่ได้ถ้าไม่มีรหัส
 * รหัสผ่านไม่ถูกเก็บที่ไหนเลย — ลืมรหัส = กู้ไฟล์ไม่ได้ (ตั้งใจ)
 */

/** ตารางที่สำรอง เรียงตามลำดับพึ่งพากัน (ตารางแม่ก่อนตารางลูก) — ใช้ลำดับเดียวกันตอนกู้คืน */
export const BACKUP_TABLES = [
  'settings',
  'categories',
  'customers',
  'customer_addresses',
  'ingredients',
  'products',
  'product_ingredients',
  'cost_recipes',
  'cost_recipe_ingredients',
  'cost_recipe_labor',
  'promotions',
  'orders',
  'order_items',
  'payments',
  'receipts',
  'invoices',
  'expenses',
  'ingredient_stock_movements',
  'stock_withdrawals',
  'stock_withdrawal_items',
  'content_items',
  'shop_holidays',
  'courses',
  'course_lessons',
  'course_access_codes',
  'chat_unanswered_questions',
  'staff_members',
  'audit_log',
] as const

/** ตารางที่ "ไม่กู้คืน" โดยอัตโนมัติ: พนักงานผูกกับบัญชีผู้ใช้ (auth) ที่อาจไม่มีแล้ว / ประวัติกิจกรรมแก้ย้อนหลังไม่ได้ */
export const NO_RESTORE: readonly string[] = ['staff_members', 'audit_log']

export const IMAGE_BUCKET = 'product-images'
const MAX_FILE_BYTES_TOTAL = 60 * 1024 * 1024

export type BackupFile = { path: string; contentType: string; base64: string }
export type BackupData = {
  format: 'ryukung-backup'
  version: 1
  createdAt: string
  tables: Record<string, Record<string, unknown>[]>
  files: BackupFile[]
}

export type BackupSummary = { createdAt: string; counts: Record<string, number>; files: number; totalRows: number }

const PAGE = 1000

async function fetchAll(db: SupabaseClient, table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select('*').order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(`อ่านตาราง ${table} ไม่สำเร็จ: ${error.message}`)
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** ไล่รายชื่อไฟล์ในที่เก็บรูปแบบเข้าโฟลเดอร์ย่อย (โฟลเดอร์ในที่เก็บไฟล์ของ Supabase มี id เป็น null) */
async function listFiles(db: SupabaseClient, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return []
  const { data } = await db.storage.from(IMAGE_BUCKET).list(prefix, { limit: 1000 })
  const out: string[] = []
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) out.push(...(await listFiles(db, full, depth + 1)))
    else out.push(full)
  }
  return out
}

/** อ่านข้อมูลทุกตาราง + รูปสินค้าในที่เก็บไฟล์ (ถ้าไม่เกินเพดาน) ด้วยสิทธิ์ของ client ที่ส่งมา (เจ้าของร้านอ่านได้ครบ) */
export async function createBackup(db: SupabaseClient, onProgress?: (msg: string) => void): Promise<BackupData> {
  const tables: BackupData['tables'] = {}
  for (const t of BACKUP_TABLES) {
    onProgress?.(`กำลังอ่านตาราง ${t}…`)
    tables[t] = await fetchAll(db, t)
  }
  const files: BackupFile[] = []
  onProgress?.('กำลังสำรองรูปภาพ…')
  const paths = await listFiles(db, '')
  let total = 0
  for (const path of paths) {
    const dl = await db.storage.from(IMAGE_BUCKET).download(path)
    if (dl.error || !dl.data) continue
    const buf = new Uint8Array(await dl.data.arrayBuffer())
    total += buf.length
    if (total > MAX_FILE_BYTES_TOTAL) break
    files.push({ path, contentType: dl.data.type || 'application/octet-stream', base64: toBase64(buf) })
  }
  return { format: 'ryukung-backup', version: 1, createdAt: new Date().toISOString(), tables, files }
}

export function summarize(b: BackupData): BackupSummary {
  const counts = Object.fromEntries(Object.entries(b.tables).map(([k, v]) => [k, v.length]))
  return { createdAt: b.createdAt, counts, files: b.files.length, totalRows: Object.values(counts).reduce((s, n) => s + n, 0) }
}

// ---------- เข้ารหัส / ถอดรหัส ----------
const KDF_ITER = 600_000

async function deriveKey(passphrase: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export const MIN_PASSPHRASE = 12

/** เข้ารหัสไฟล์สำรอง คืนข้อความ JSON (เก็บเป็นไฟล์ .json ได้เลย) */
export async function encryptBackup(data: BackupData, passphrase: string, iter = KDF_ITER): Promise<string> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSPHRASE} ตัวอักษร`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, iter)
  const plain = new TextEncoder().encode(JSON.stringify(data))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource))
  return JSON.stringify({
    format: 'ryukung-backup-enc', version: 1, kdf: 'PBKDF2-SHA256', iter, alg: 'AES-256-GCM',
    salt: toBase64(salt), iv: toBase64(iv), data: toBase64(cipher),
  })
}

/** ถอดรหัส — รหัสผิด/ไฟล์ถูกแก้ไข จะ error (AES-GCM ตรวจความสมบูรณ์ในตัว) */
export async function decryptBackup(text: string, passphrase: string): Promise<BackupData> {
  let env: { format?: string; version?: number; iter?: number; salt?: string; iv?: string; data?: string }
  try {
    env = JSON.parse(text)
  } catch {
    throw new Error('ไฟล์ไม่ใช่ไฟล์สำรองของระบบนี้')
  }
  if (env.format !== 'ryukung-backup-enc' || env.version !== 1 || !env.salt || !env.iv || !env.data || !env.iter) {
    throw new Error('ไฟล์ไม่ใช่ไฟล์สำรองของระบบนี้')
  }
  try {
    const key = await deriveKey(passphrase, fromBase64(env.salt), env.iter)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(env.iv) as BufferSource }, key, fromBase64(env.data) as BufferSource)
    const data = JSON.parse(new TextDecoder().decode(plain)) as BackupData
    if (data.format !== 'ryukung-backup' || typeof data.tables !== 'object') throw new Error('bad')
    return data
  } catch {
    throw new Error('รหัสผ่านไม่ถูกต้อง หรือไฟล์เสียหาย/ถูกแก้ไข')
  }
}

// ---------- กู้คืน ----------
export type RestoreOptions = {
  /** กู้เฉพาะตารางเหล่านี้ (ค่าเริ่มต้น = ทุกตารางที่กู้ได้) */
  only?: string[]
  /** false = แค่นับว่าจะกู้อะไรบ้าง ไม่เขียนอะไรเลย */
  apply: boolean
  onProgress?: (msg: string) => void
}
export type RestoreResult = { table: string; rows: number; written: number; error?: string }[]

/**
 * กู้คืนแบบ "ใส่กลับ/ทับด้วย id เดิม" (upsert) — ไม่ลบข้อมูลที่มีอยู่ในฐานข้อมูล จึงใช้กู้แถวที่ถูกลบ/ถูกแก้ได้อย่างปลอดภัย
 * ต้องใช้ client ที่มีสิทธิ์เขียนข้ามกฎ (service role) — ใช้จากสคริปต์ในเครื่องเท่านั้น ห้ามใช้ในหน้าเว็บ
 */
export async function restoreBackup(db: SupabaseClient, data: BackupData, opts: RestoreOptions): Promise<RestoreResult> {
  const out: RestoreResult = []
  const tables = BACKUP_TABLES.filter((t) => !NO_RESTORE.includes(t) && (!opts.only || opts.only.includes(t)))
  for (const t of tables) {
    const rows = data.tables[t] ?? []
    let written = 0
    let error: string | undefined
    if (opts.apply) {
      opts.onProgress?.(`กู้ตาราง ${t} (${rows.length} แถว)…`)
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const { error: e } = await db.from(t).upsert(chunk, { onConflict: 'id' })
        if (e) {
          error = e.message
          break
        }
        written += chunk.length
      }
    }
    out.push({ table: t, rows: rows.length, written, error })
  }
  if (opts.apply && (!opts.only || opts.only.includes('files'))) {
    for (const f of data.files) {
      const { error } = await db.storage.from(IMAGE_BUCKET).upload(f.path, fromBase64(f.base64) as unknown as Blob, { upsert: true, contentType: f.contentType })
      out.push({ table: `file:${f.path}`, rows: 1, written: error ? 0 : 1, error: error?.message })
    }
  }
  return out
}

export function backupFileName(d = new Date()): string {
  return `ryukung-backup-${d.toISOString().slice(0, 10)}.enc.json`
}
