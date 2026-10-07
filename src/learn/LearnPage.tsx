import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AmbientGlow, PageTexture, Reveal } from '../public/PublicSiteChrome'
import { openWithCode, parseIngredients, parseSteps, type LearnCourse, type LearnSession } from './learnApi'

const KEY = 'learn-code'

function remembered(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
function remember(code: string | null) {
  try {
    if (code) localStorage.setItem(KEY, code)
    else localStorage.removeItem(KEY)
  } catch {
    // เก็บไม่ได้ก็ใส่รหัสใหม่ทุกครั้ง
  }
}

/** หน้าเรียนทำเบเกอรี่สำหรับนักเรียน: ใส่รหัส → เลือกคอร์ส → อ่านสูตรและวิธีทำทีละบท */
export function LearnPage() {
  const [code, setCode] = useState(remembered)
  const [session, setSession] = useState<LearnSession | null>(null)
  const [course, setCourse] = useState<LearnCourse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enter(value: string) {
    setBusy(true)
    setError(null)
    const { session: s, error: err } = await openWithCode(value)
    setBusy(false)
    if (err) return setError('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง')
    if (!s) {
      remember(null)
      return setError('รหัสไม่ถูกต้อง หมดอายุ หรือถูกยกเลิก — ตรวจรหัสที่ได้รับจากร้านอีกครั้ง')
    }
    remember(value)
    setSession(s)
    if (s.courses.length === 1) setCourse(s.courses[0])
  }

  // เคยเข้าไว้แล้ว เข้าให้อัตโนมัติครั้งเดียวตอนเปิดหน้า
  useEffect(() => {
    const saved = remembered()
    if (saved) void enter(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function logout() {
    remember(null)
    setSession(null)
    setCourse(null)
    setCode('')
  }

  return (
    <div className="min-h-screen bg-stone-50 relative">
      <PageTexture />
      <header className="relative overflow-hidden bg-brand-shader text-white">
        <AmbientGlow />
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 text-center space-y-2">
          <p className="text-5xl animate-icon-pop" aria-hidden="true">🍪</p>
          <h1 className="text-3xl font-display font-bold">เรียนทำเบเกอรี่</h1>
          <p className="text-sm text-white/85">
            {session ? `สวัสดี ${session.student_name} 👋` : 'RYUKUNG BAKERY · ใส่รหัสเข้าเรียนที่ได้รับจากร้าน'}
          </p>
          {session && (
            <button type="button" onClick={logout} className="rounded-full bg-white/20 border border-white/40 text-xs font-semibold px-3 py-1">
              ออกจากระบบ
            </button>
          )}
        </div>
      </header>

      <main className="relative max-w-3xl mx-auto px-4 py-6 space-y-5">
        {!session && (
          <Reveal>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) void enter(code)
              }}
              className="rounded-3xl bg-white border border-amber-200 p-5 shadow-[0_14px_30px_-18px_rgb(51_32_14_/_0.5)] space-y-3"
            >
              <label htmlFor="learn-code" className="block text-sm font-semibold text-stone-800">รหัสเข้าเรียน</label>
              <input
                id="learn-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="เช่น COOK-7F3K9QXA"
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-lg font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="w-full rounded-2xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-50 active:scale-95 transition-transform"
              >
                {busy ? 'กำลังตรวจสอบ…' : 'เข้าเรียน'}
              </button>
              <p className="text-xs text-stone-500">ยังไม่มีรหัส? ติดต่อร้านเพื่อสมัครเรียน แล้วร้านจะออกรหัสให้คุณ</p>
            </form>
          </Reveal>
        )}

        {session && !course && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-stone-900">เลือกคอร์สที่จะเรียน</h2>
            {session.courses.length === 0 && <p className="text-stone-500">ตอนนี้ยังไม่มีคอร์สที่เปิดให้คุณ ติดต่อร้านได้เลย</p>}
            {session.courses.map((c, i) => (
              <Reveal key={c.id} delay={i * 80}>
                <button
                  type="button"
                  onClick={() => setCourse(c)}
                  className="w-full text-left flex items-center gap-4 rounded-3xl bg-white border border-amber-200 p-4 shadow-[0_12px_28px_-16px_rgb(51_32_14_/_0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <span className="text-4xl">{c.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-display font-bold text-stone-900">{c.title}</span>
                    {c.description && <span className="block text-sm text-stone-600">{c.description}</span>}
                    <span className="block text-xs text-amber-800 mt-1">{c.lessons.length} บทเรียน</span>
                  </span>
                  <span aria-hidden="true" className="text-stone-400">›</span>
                </button>
              </Reveal>
            ))}
          </section>
        )}

        {session && course && <CourseView course={course} onBack={session.courses.length > 1 ? () => setCourse(null) : undefined} />}

        <p className="text-center text-xs text-stone-400 pt-4">
          <Link to="/menu" className="underline">ดูเมนูขนมของร้าน</Link>
        </p>
      </main>
    </div>
  )
}

function CourseView({ course, onBack }: { course: LearnCourse; onBack?: () => void }) {
  return (
    <section className="space-y-4">
      {onBack && (
        <button type="button" onClick={onBack} className="rounded-full bg-white border border-stone-300 text-sm font-medium px-3.5 py-1.5 shadow-sm">
          ← เลือกคอร์สอื่น
        </button>
      )}
      <div className="rounded-3xl bg-white border border-amber-200 p-5 shadow-sm">
        <h2 className="text-2xl font-display font-bold text-stone-900">{course.emoji} {course.title}</h2>
        {course.description && <p className="text-stone-600 mt-1">{course.description}</p>}
      </div>
      {course.lessons.length === 0 && <p className="text-stone-500">คอร์สนี้ยังไม่มีบทเรียน เร็วๆ นี้นะ</p>}
      {course.lessons.map((l, i) => {
        const ing = parseIngredients(l.ingredients)
        const steps = parseSteps(l.steps)
        return (
          <Reveal key={l.id}>
            <article className="rounded-3xl bg-white border border-stone-200 overflow-hidden shadow-[0_12px_28px_-18px_rgb(51_32_14_/_0.5)]">
              <h3 className="bg-brand-shader text-white font-display font-bold px-5 py-3">
                บทที่ {i + 1} · {l.title}
              </h3>
              <div className="p-5 space-y-4">
                {ing.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-stone-900 mb-2">🧂 ส่วนผสม</h4>
                    <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
                      {ing.map((x, k) => (
                        <li key={k} className="flex justify-between gap-3 px-3.5 py-2 text-sm">
                          <span>{x.name}</span>
                          <b className="tabular-nums shrink-0">{x.qty}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {steps.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-stone-900 mb-2">👩‍🍳 วิธีทำ</h4>
                    <ol className="space-y-2">
                      {steps.map((s, k) => (
                        <li key={k} className="flex gap-3 text-sm leading-relaxed">
                          <span className="shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-bold grid place-items-center">{k + 1}</span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {l.tips && (
                  <p className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm whitespace-pre-line">💡 {l.tips}</p>
                )}
                {l.video_url && (
                  <a href={l.video_url} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-stone-900 text-white text-sm font-semibold px-4 py-2">
                    ▶ ดูวิดีโอประกอบ
                  </a>
                )}
              </div>
            </article>
          </Reveal>
        )
      })}
    </section>
  )
}
