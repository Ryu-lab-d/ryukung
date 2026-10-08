import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHero } from '../layout/PageHero'
import { useAuth } from '../auth/AuthProvider'
import { MIN_PASSPHRASE, backupFileName, createBackup, decryptBackup, encryptBackup, summarize, type BackupSummary } from './backupCore'

const LAST_KEY = 'last-backup-at'
const CARD = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3'
const INPUT = 'w-full rounded-xl border border-stone-300 px-3 py-2 text-sm'
const BTN = 'rounded-full bg-stone-900 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40'

function lastBackup(): Date | null {
  try {
    const v = localStorage.getItem(LAST_KEY)
    return v ? new Date(v) : null
  } catch {
    return null
  }
}

/** สำรองข้อมูลเข้ารหัส + ตรวจไฟล์สำรอง + ปุ่มฉุกเฉินออกจากระบบทุกอุปกรณ์ + คู่มือเมื่อคอมถูกแฮ็ก (เฉพาะเจ้าของร้าน) */
export function BackupPage() {
  const { staffStatus } = useAuth()
  const isOwner = staffStatus?.role === 'owner'
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [done, setDone] = useState<BackupSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<Date | null>(lastBackup)
  const [checkPass, setCheckPass] = useState('')
  const [checkResult, setCheckResult] = useState<BackupSummary | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [panicMsg, setPanicMsg] = useState<string | null>(null)

  const daysAgo = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null

  async function handleBackup() {
    setError(null)
    setDone(null)
    if (pass.length < MIN_PASSPHRASE) return setError(`รหัสผ่านสำรองต้องยาวอย่างน้อย ${MIN_PASSPHRASE} ตัวอักษร`)
    if (pass !== pass2) return setError('รหัสผ่านสองช่องไม่ตรงกัน')
    setBusy(true)
    try {
      const data = await createBackup(supabase, setProgress)
      setProgress('กำลังเข้ารหัส…')
      const text = await encryptBackup(data, pass)
      const blob = new Blob([text], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupFileName()
      a.click()
      URL.revokeObjectURL(url)
      setDone(summarize(data))
      const now = new Date()
      try {
        localStorage.setItem(LAST_KEY, now.toISOString())
      } catch {
        // เก็บไม่ได้ก็แค่ไม่แสดงวันที่สำรองล่าสุด
      }
      setLast(now)
      setPass('')
      setPass2('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function handleCheck(file: File | undefined) {
    setCheckError(null)
    setCheckResult(null)
    if (!file) return
    if (!checkPass) return setCheckError('กรอกรหัสผ่านของไฟล์ก่อน')
    try {
      setCheckResult(summarize(await decryptBackup(await file.text(), checkPass)))
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handlePanic() {
    if (!window.confirm('ออกจากระบบทุกอุปกรณ์ของทุกคนทันที? (พนักงานทุกคนและตัวคุณเองต้องล็อกอินใหม่ด้วยรหัสผ่าน)')) return
    const { data, error: e } = await supabase.rpc('emergency_revoke_sessions')
    setPanicMsg(e ? `ไม่สำเร็จ: ${e.message}` : `ออกจากระบบแล้ว ${data} เซสชัน — หน้านี้จะใช้งานต่อไม่ได้จนกว่าจะล็อกอินใหม่ (เปลี่ยนรหัสผ่านต่อด้วยนะ)`)
  }

  if (!isOwner) {
    return <p className="p-6 text-stone-600">หน้านี้เฉพาะเจ้าของร้านเท่านั้น</p>
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto pb-24">
      <PageHero icon="🛟" title="สำรองข้อมูล & ฉุกเฉิน" subtitle="ไฟล์สำรองเข้ารหัส เก็บไว้ที่ปลอดภัยนอกเครื่องนี้ — กู้ร้านกลับมาได้แม้คอมโดนแฮ็ก">
        <Link to="/settings">← ตั้งค่า</Link>
      </PageHero>

      {(daysAgo === null || daysAgo >= 7) && (
        <p role="status" className="rounded-2xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
          ⚠️ {daysAgo === null ? 'เครื่องนี้ยังไม่เคยสำรองข้อมูล' : `สำรองล่าสุดเมื่อ ${daysAgo} วันก่อน`} — แนะนำสำรองอย่างน้อยสัปดาห์ละครั้ง
        </p>
      )}

      <section className={CARD}>
        <h2 className="font-bold">1) สำรองข้อมูลทั้งหมด (เข้ารหัส)</h2>
        <p className="text-sm text-stone-600">
          ได้ไฟล์เดียว รวมออเดอร์ ลูกค้า สินค้า สูตรต้นทุน รายจ่าย Invoice คอร์ส โปรโมชั่น ตั้งค่า และรูปสินค้า — เข้ารหัสด้วยรหัสผ่านที่คุณตั้งตรงนี้
          ต่อให้ไฟล์หลุดก็เปิดอ่านไม่ได้ <b>แต่ถ้าลืมรหัส ระบบกู้ไฟล์ให้ไม่ได้</b>
        </p>
        <input type="password" className={INPUT} placeholder={`ตั้งรหัสผ่านไฟล์สำรอง (อย่างน้อย ${MIN_PASSPHRASE} ตัว)`} value={pass} onChange={(e) => setPass(e.target.value)} aria-label="รหัสผ่านไฟล์สำรอง" autoComplete="new-password" />
        <input type="password" className={INPUT} placeholder="พิมพ์รหัสผ่านซ้ำ" value={pass2} onChange={(e) => setPass2(e.target.value)} aria-label="ยืนยันรหัสผ่านไฟล์สำรอง" autoComplete="new-password" />
        <button type="button" className={BTN} disabled={busy} onClick={() => void handleBackup()}>
          {busy ? 'กำลังสำรอง…' : '💾 สำรองและดาวน์โหลดไฟล์'}
        </button>
        {progress && <p className="text-xs text-stone-500">{progress}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {done && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 space-y-1">
            <p className="font-semibold">✓ สำรองเสร็จแล้ว — {done.totalRows.toLocaleString()} แถว, รูป {done.files} ไฟล์</p>
            <p className="text-xs">ย้ายไฟล์ไปเก็บ <b>นอกเครื่องนี้</b> ทันที (เช่น Google Drive ส่วนตัวที่เปิด 2FA, ฮาร์ดดิสก์แยกที่ไม่เสียบค้างไว้) และเก็บรหัสผ่านแยกต่างหาก</p>
          </div>
        )}
        <p className="text-xs text-stone-500">เครื่องนี้สำรองล่าสุด: {last ? last.toLocaleString('th-TH') : 'ยังไม่เคย'}</p>
      </section>

      <section className={CARD}>
        <h2 className="font-bold">2) ตรวจว่าไฟล์สำรองเปิดได้จริง</h2>
        <p className="text-sm text-stone-600">เลือกไฟล์ + กรอกรหัสผ่าน ระบบจะถอดรหัสในเครื่องคุณ (ไม่ส่งไปไหน) แล้วบอกว่ามีข้อมูลอะไรอยู่บ้าง — ควรลองสักครั้งก่อนจะเชื่อว่าสำรองใช้ได้</p>
        <input type="password" className={INPUT} placeholder="รหัสผ่านของไฟล์" value={checkPass} onChange={(e) => setCheckPass(e.target.value)} aria-label="รหัสผ่านตรวจไฟล์" autoComplete="off" />
        <input type="file" accept=".json,application/json" aria-label="เลือกไฟล์สำรอง" onChange={(e) => void handleCheck(e.target.files?.[0])} className="text-sm" />
        {checkError && <p role="alert" className="text-sm text-red-600">{checkError}</p>}
        {checkResult && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 space-y-1">
            <p className="font-semibold">✓ ไฟล์ใช้ได้ — สำรองเมื่อ {new Date(checkResult.createdAt).toLocaleString('th-TH')}</p>
            <p className="text-xs">{Object.entries(checkResult.counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(' · ')} · รูป {checkResult.files} ไฟล์</p>
          </div>
        )}
      </section>

      <section className={CARD + ' !border-red-300'}>
        <h2 className="font-bold text-red-700">3) 🚨 ฉุกเฉิน: ออกจากระบบทุกอุปกรณ์</h2>
        <p className="text-sm text-stone-600">ถ้าสงสัยว่าคอมหรือบัญชีถูกแฮ็ก ให้ <b>ใช้ปุ่มนี้จากมือถือ/เครื่องที่ปลอดภัย</b> — ลบเซสชันล็อกอินของทุกคนทันที โจรที่ค้างล็อกอินอยู่จะถูกเตะออก แล้วรีบเปลี่ยนรหัสผ่านตามคู่มือด้านล่าง</p>
        <button type="button" className="rounded-full bg-red-600 text-white px-5 py-2.5 text-sm font-semibold" onClick={() => void handlePanic()}>
          🚨 ออกจากระบบทุกอุปกรณ์ทันที
        </button>
        {panicMsg && <p role="status" className="text-sm text-stone-700">{panicMsg}</p>}
      </section>

      <section className={CARD}>
        <h2 className="font-bold">📋 ถ้าคอมโดนแฮ็ก ทำตามนี้ (จากอุปกรณ์ที่ปลอดภัย ไม่ใช่คอมเครื่องนั้น)</h2>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-stone-700">
          <li>ตัดอินเทอร์เน็ตเครื่องที่ถูกแฮ็ก (ถอดสาย/ปิด Wi-Fi) ห้ามล็อกอินอะไรบนเครื่องนั้นอีก</li>
          <li>กดปุ่ม 🚨 ด้านบนจากมือถือ เพื่อเตะทุกเซสชัน</li>
          <li>เปลี่ยนรหัสผ่าน <b>อีเมลหลัก</b> ก่อนเสมอ (ใครคุมอีเมลได้ก็รีเซ็ตทุกบัญชีได้) แล้วเปิด 2FA</li>
          <li>เปลี่ยนรหัสผ่าน + ออกจากทุกอุปกรณ์ + เปิด 2FA ที่: Supabase, Cloudflare, GitHub, Google (Gmail ที่ใช้ส่งอีเมล/ชีต)</li>
          <li>หมุนคีย์ลับทั้งหมด: Supabase (service_role/JWT secret), รหัสแอป Gmail (SMTP), คีย์ Anthropic, Turnstile secret, โทเคน Cloudflare/GitHub ที่ล็อกอินค้างในเครื่อง</li>
          <li>เปิดหน้า "ประวัติกิจกรรม" ดูว่ามีอะไรถูกแก้/ลบ/เชิญพนักงานแปลกๆ ไหม และตรวจรายชื่อพนักงาน</li>
          <li>ติดตั้งเครื่องใหม่/ล้างเครื่อง แล้วกู้ข้อมูลจากไฟล์สำรองถ้าจำเป็น (ดู docs/RECOVERY.md ใน GitHub ของโปรเจกต์)</li>
          <li>แจ้งลูกค้าถ้าข้อมูลลูกค้าอาจรั่ว (กฎหมายคุ้มครองข้อมูลส่วนบุคคลกำหนดให้แจ้งเหตุ)</li>
        </ol>
      </section>
    </div>
  )
}
