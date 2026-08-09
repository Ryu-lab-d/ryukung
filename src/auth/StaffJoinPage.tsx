import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

/**
 * หน้าสมัครเป็นพนักงาน — ไม่ต้องล็อกอินก่อนเข้าได้ (เจ้าของร้านส่งลิงก์นี้ให้พนักงานใหม่โดยตรง)
 * หลังสมัคร ต้องกดยืนยันอีเมลก่อนถึงจะล็อกอินได้ (ระบบยืนยันตัวตนของ Supabase เอง) แล้วสิทธิ์การใช้งาน
 * จะขึ้นกับว่าเจ้าของร้านเชิญอีเมลนี้ไว้ล่วงหน้าหรือเปล่า — ถ้าเชิญไว้แล้วจะได้สิทธิ์ทันที ถ้าไม่เคยเชิญ
 * ต้องรอเจ้าของร้านมาอนุมัติเองอีกที (ดูที่หน้าตั้งค่า)
 */
export function StaffJoinPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() || null } },
    })
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('already registered') || error.message.includes('User already registered')
          ? 'อีเมลนี้เคยสมัครไว้แล้ว ลองเข้าสู่ระบบแทน'
          : 'สมัครไม่สำเร็จ: ' + error.message
      )
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center bg-stone-50 px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
          <p className="text-3xl">📧</p>
          <p className="font-semibold text-stone-900">สมัครสำเร็จ! เช็กอีเมลของคุณ</p>
          <p className="text-sm text-stone-500">
            กดยืนยันอีเมลตามลิงก์ที่ส่งไปที่ {email} เพื่อยืนยันตัวตนก่อน แล้วค่อยกลับมาเข้าสู่ระบบ
            (ถ้าเจ้าของร้านเชิญอีเมลนี้ไว้ล่วงหน้าแล้ว จะใช้งานได้ทันทีหลังยืนยันอีเมล ถ้ายังไม่เคยเชิญไว้
            ต้องรอเจ้าของร้านอนุมัติอีกขั้นหนึ่ง)
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">สมัครเป็นพนักงาน</h1>
          <p className="text-sm text-stone-500 mt-1">RYUKUNG BAKERY</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="display_name" className="text-sm text-stone-600">ชื่อที่ให้แสดง</label>
          <input
            id="display_name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-stone-600">อีเมล</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-stone-600">ตั้งรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-stone-900 text-white py-2.5 disabled:opacity-50"
        >
          {busy ? 'กำลังสมัคร...' : 'สมัคร'}
        </button>
      </form>
    </div>
  )
}
