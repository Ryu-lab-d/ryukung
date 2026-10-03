import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'
import { AmbientGlow } from '../public/PublicSiteChrome'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
          : 'เข้าสู่ระบบไม่สำเร็จ: ' + error.message
      )
    }
  }

  return (
    <div className="relative overflow-hidden min-h-screen flex items-center justify-center bg-brand-shader px-4 font-warm">
      <AmbientGlow />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm overflow-hidden bg-white/95 backdrop-blur rounded-3xl shadow-[0_24px_50px_-18px_rgb(33_21_10_/_0.7)] p-6 pt-0 space-y-4 animate-form-in"
      >
        <div className="-mx-6 h-1.5 bg-gradient-to-r from-amber-300 via-amber-600 to-amber-300" aria-hidden="true" />
        <div className="text-center space-y-2 pt-5">
          <div className="relative w-16 h-16 mx-auto">
            <span className="absolute inset-0 rounded-full bg-amber-300/60 animate-fab-ring" aria-hidden="true" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-50 to-amber-200 border-4 border-white shadow-lg grid place-items-center text-3xl animate-icon-pop">🥐</div>
          </div>
          <h1 className="text-xl font-display font-bold text-stone-900">RYUKUNG BAKERY</h1>
          <p className="text-xs text-stone-500">เข้าสู่ระบบจัดการร้าน</p>
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
          <label htmlFor="password" className="text-sm text-stone-600">รหัสผ่าน</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="btn-shimmer w-full rounded-full bg-gradient-to-r from-stone-800 to-stone-900 text-white py-3 font-semibold shadow-[0_10px_20px_-10px_rgb(51_32_14_/_0.8)] active:scale-95 disabled:opacity-50"
        >
          {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
