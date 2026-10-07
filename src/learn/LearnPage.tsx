import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AmbientGlow, ConfettiRain, PageTexture, Reveal, burstSparkles } from '../public/PublicSiteChrome'
import { openWithCode, parseIngredients, parseSteps, type LearnCourse, type LearnSession, type Lesson } from './learnApi'

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

const doneKey = (courseId: string) => `learn-done:${courseId}`
function loadDone(courseId: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(doneKey(courseId)) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function saveDone(courseId: string, ids: string[]) {
  try {
    localStorage.setItem(doneKey(courseId), JSON.stringify(ids))
  } catch {
    // เก็บไม่ได้ก็ยังเรียนต่อได้
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
          <div className="flex justify-center gap-3 text-5xl" aria-hidden="true">
            {['🥐', '🍪', '🧁'].map((e, i) => (
              <span key={e} className="learn-bob" style={{ animationDelay: `${i * 0.35}s` }}>{e}</span>
            ))}
          </div>
          <h1 className="text-3xl font-display font-bold drop-shadow">เรียนทำเบเกอรี่</h1>
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
              key={error ?? 'ok'}
              className={'glow-card relative overflow-hidden rounded-3xl bg-white border border-amber-200 p-5 shadow-[0_18px_36px_-18px_rgb(51_32_14_/_0.55)] space-y-3 ' + (error ? 'learn-shake' : '')}
            >
              <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-300 via-amber-600 to-amber-300" aria-hidden="true" />
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-amber-100 grid place-items-center text-xl" aria-hidden="true">🔑</span>
                <label htmlFor="learn-code" className="block text-base font-display font-bold text-stone-900">รหัสเข้าเรียน</label>
              </div>
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
                className="w-full rounded-2xl bg-gradient-to-r from-stone-800 to-stone-950 text-white font-semibold py-3 shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
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
                  className="glow-card w-full text-left flex items-center gap-4 rounded-3xl bg-white border border-amber-200 p-4 shadow-[0_12px_28px_-16px_rgb(51_32_14_/_0.5)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <span className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 grid place-items-center text-4xl shadow-inner">{c.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-display font-bold text-stone-900">{c.title}</span>
                    {c.description && <span className="block text-sm text-stone-600">{c.description}</span>}
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-2 flex-1 rounded-full bg-stone-100 overflow-hidden">
                        <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-700 transition-all duration-700" style={{ width: `${c.lessons.length ? (loadDone(c.id).filter((id) => c.lessons.some((l) => l.id === id)).length / c.lessons.length) * 100 : 0}%` }} />
                      </span>
                      <span className="text-xs text-amber-800 shrink-0">{c.lessons.length} บทเรียน</span>
                    </span>
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
  const [done, setDone] = useState<string[]>(() => loadDone(course.id))
  const [openId, setOpenId] = useState<string | null>(course.lessons[0]?.id ?? null)
  const total = course.lessons.length
  const doneCount = course.lessons.filter((l) => done.includes(l.id)).length
  const pct = total ? Math.round((doneCount / total) * 100) : 0
  const finished = total > 0 && doneCount === total

  function toggleDone(id: string, el: HTMLElement) {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id]
    setDone(next)
    saveDone(course.id, next)
    if (next.includes(id)) {
      burstSparkles(el, 16)
      const nextLesson = course.lessons.find((l) => !next.includes(l.id))
      if (nextLesson) setOpenId(nextLesson.id)
    }
  }

  return (
    <section className="space-y-4">
      {onBack && (
        <button type="button" onClick={onBack} className="rounded-full bg-white border border-stone-300 text-sm font-medium px-3.5 py-1.5 shadow-sm">
          ← เลือกคอร์สอื่น
        </button>
      )}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-amber-200 p-5 shadow-[0_14px_30px_-18px_rgb(51_32_14_/_0.5)]">
        {finished && <ConfettiRain pieces={24} />}
        <div className="relative flex items-center gap-4">
          <span className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 grid place-items-center text-4xl shadow-inner">{course.emoji}</span>
          <div className="min-w-0">
            <h2 className="text-2xl font-display font-bold text-stone-900 leading-tight">{course.title}</h2>
            {course.description && <p className="text-stone-600 text-sm mt-0.5">{course.description}</p>}
          </div>
        </div>
        {total > 0 && (
          <div className="relative mt-4">
            <div className="flex justify-between text-xs font-semibold text-amber-900 mb-1">
              <span>{finished ? '🎉 เรียนจบคอร์สแล้ว เก่งมาก!' : `เรียนแล้ว ${doneCount}/${total} บท`}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-3 rounded-full bg-stone-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-700 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {total === 0 && <p className="text-stone-500">คอร์สนี้ยังไม่มีบทเรียน เร็วๆ นี้นะ</p>}
      {course.lessons.map((l, i) => (
        <LessonCard
          key={l.id}
          lesson={l}
          index={i}
          open={openId === l.id}
          done={done.includes(l.id)}
          onToggleOpen={() => setOpenId(openId === l.id ? null : l.id)}
          onToggleDone={(el) => toggleDone(l.id, el)}
        />
      ))}
    </section>
  )
}

function LessonCard({
  lesson: l,
  index,
  open,
  done,
  onToggleOpen,
  onToggleDone,
}: {
  lesson: Lesson
  index: number
  open: boolean
  done: boolean
  onToggleOpen: () => void
  onToggleDone: (el: HTMLElement) => void
}) {
  const ing = parseIngredients(l.ingredients)
  const steps = parseSteps(l.steps)
  const [ticked, setTicked] = useState<Record<string, boolean>>({})
  const tick = (k: string) => setTicked((t) => ({ ...t, [k]: !t[k] }))
  return (
    <Reveal>
      <article className={'rounded-3xl bg-white border overflow-hidden shadow-[0_12px_28px_-18px_rgb(51_32_14_/_0.5)] ' + (done ? 'border-green-300' : 'border-stone-200')}>
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className="w-full flex items-center gap-3 bg-brand-shader text-white px-4 py-3 text-left">
          <span className={'w-9 h-9 shrink-0 rounded-full grid place-items-center font-bold ' + (done ? 'bg-green-500 text-white' : 'bg-white/25 border border-white/40')}>
            {done ? '✓' : index + 1}
          </span>
          <span className="flex-1 font-display font-bold">บทที่ {index + 1} · {l.title}</span>
          <span aria-hidden="true" className={'transition-transform duration-300 ' + (open ? 'rotate-180' : '')}>▾</span>
        </button>
        {open && (
          <div className="p-5 space-y-5 animate-form-in">
            {ing.length > 0 && (
              <div>
                <h4 className="font-semibold text-stone-900 mb-2">🧂 ส่วนผสม <span className="text-xs font-normal text-stone-400">แตะเพื่อติ๊กตอนเตรียมของ</span></h4>
                <ul className="rounded-2xl border border-stone-200 overflow-hidden">
                  {ing.map((x, k) => (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => tick('i' + k)}
                        className={'w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-left border-b border-stone-100 last:border-0 transition-colors ' + (ticked['i' + k] ? 'bg-green-50' : k % 2 ? 'bg-stone-50' : 'bg-white')}
                      >
                        <span className={'w-5 h-5 shrink-0 rounded-md border grid place-items-center text-xs ' + (ticked['i' + k] ? 'bg-green-500 border-green-500 text-white' : 'border-stone-300')}>{ticked['i' + k] ? '✓' : ''}</span>
                        <span className={'flex-1 ' + (ticked['i' + k] ? 'line-through text-stone-400' : '')}>{x.name}</span>
                        <b className="tabular-nums shrink-0 text-amber-900">{x.qty}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {steps.length > 0 && (
              <div>
                <h4 className="font-semibold text-stone-900 mb-2">👩‍🍳 วิธีทำ</h4>
                <ol className="space-y-2.5">
                  {steps.map((st, k) => (
                    <li key={k}>
                      <button type="button" onClick={() => tick('s' + k)} className="w-full flex gap-3 text-sm leading-relaxed text-left">
                        <span className={'shrink-0 w-8 h-8 rounded-full font-bold grid place-items-center transition-all ' + (ticked['s' + k] ? 'bg-green-500 text-white scale-95' : 'bg-gradient-to-br from-amber-200 to-amber-400 text-amber-950')}>
                          {ticked['s' + k] ? '✓' : k + 1}
                        </span>
                        <span className={'pt-1 ' + (ticked['s' + k] ? 'line-through text-stone-400' : '')}>{st}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {l.tips && <p className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm whitespace-pre-line">💡 {l.tips}</p>}
            {l.video_url && (
              <a href={l.video_url} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-stone-900 text-white text-sm font-semibold px-4 py-2">
                ▶ ดูวิดีโอประกอบ
              </a>
            )}
            <button
              type="button"
              onClick={(e) => onToggleDone(e.currentTarget)}
              className={'w-full rounded-2xl py-3 font-semibold active:scale-95 transition-all ' + (done ? 'bg-green-50 border border-green-300 text-green-800' : 'bg-gradient-to-r from-amber-500 to-amber-700 text-white shadow-lg')}
            >
              {done ? '✓ เรียนบทนี้จบแล้ว (แตะเพื่อยกเลิก)' : '✅ เรียนบทนี้จบแล้ว'}
            </button>
          </div>
        )}
      </article>
    </Reveal>
  )
}
