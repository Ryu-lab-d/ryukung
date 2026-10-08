import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AmbientGlow } from '../public/PublicSiteChrome'
import { safeHttpUrl } from '../lib/safeUrl'
import { parseIngredients, parseSteps, type CourseRow, type LessonRow } from './learnApi'

export type Slide =
  | { kind: 'cover'; title: string; emoji: string; description: string | null; lessonCount: number }
  | { kind: 'lesson'; n: number; total: number; title: string }
  | { kind: 'ingredients'; lesson: string; items: { name: string; qty: string }[] }
  | { kind: 'step'; lesson: string; n: number; total: number; text: string }
  | { kind: 'tips'; lesson: string; text: string }
  | { kind: 'video'; lesson: string; url: string }
  | { kind: 'end'; title: string }

/** แตกคอร์สเป็นสไลด์: หน้าปก → (ชื่อบท → ส่วนผสม → วิธีทำทีละขั้น → เคล็ดลับ → วิดีโอ) ต่อบท → จบ */
export function buildSlides(course: Pick<CourseRow, 'title' | 'emoji' | 'description'>, lessons: LessonRow[]): Slide[] {
  const out: Slide[] = [{ kind: 'cover', title: course.title, emoji: course.emoji, description: course.description, lessonCount: lessons.length }]
  lessons.forEach((l, i) => {
    out.push({ kind: 'lesson', n: i + 1, total: lessons.length, title: l.title })
    const ing = parseIngredients(l.ingredients)
    if (ing.length) out.push({ kind: 'ingredients', lesson: l.title, items: ing })
    const steps = parseSteps(l.steps)
    steps.forEach((text, k) => out.push({ kind: 'step', lesson: l.title, n: k + 1, total: steps.length, text }))
    if (l.tips) out.push({ kind: 'tips', lesson: l.title, text: l.tips })
    if (safeHttpUrl(l.video_url)) out.push({ kind: 'video', lesson: l.title, url: safeHttpUrl(l.video_url)! })
  })
  out.push({ kind: 'end', title: course.title })
  return out
}

/** โหมดสอนบนจอใหญ่/โปรเจกเตอร์: เต็มจอ ตัวหนังสือใหญ่ กด ← → หรือแตะซ้าย/ขวาเปลี่ยนสไลด์ (เฉพาะเจ้าของ/ผู้จัดการ) */
export function CoursePresentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState<CourseRow | null>(null)
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const rootRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      const [c, l] = await Promise.all([
        supabase.from('courses').select('*').eq('id', id).single(),
        supabase.from('course_lessons').select('*').eq('course_id', id).order('sort_order').order('created_at'),
      ])
      setCourse((c.data as CourseRow | null) ?? null)
      setLessons((l.data ?? []) as LessonRow[])
      setLoading(false)
    })()
  }, [id])

  const slides = useMemo(() => (course ? buildSlides(course, lessons) : []), [course, lessons])
  const last = slides.length - 1

  const go = useCallback(
    (to: number) => {
      setI((cur) => {
        const next = Math.max(0, Math.min(last, to))
        setDir(next >= cur ? 1 : -1)
        return next
      })
    },
    [last]
  )
  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    navigate('/courses')
  }, [navigate])
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void rootRef.current?.requestFullscreen?.()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(i + 1) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(i - 1) }
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(last)
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      else if (e.key === 'Escape' && !document.fullscreenElement) exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, i, last, toggleFullscreen, exit])

  if (loading) return <div className="fixed inset-0 z-[100] grid place-items-center bg-stone-950 text-white">กำลังโหลด…</div>
  if (!course) return <div className="fixed inset-0 z-[100] grid place-items-center bg-stone-950 text-white">ไม่พบคอร์สนี้</div>

  const s = slides[i]
  // เปิดบทไหนอยู่ ใช้แสดงแถบด้านบน
  const lessonName = s.kind === 'cover' || s.kind === 'end' ? course.title : s.kind === 'lesson' ? s.title : s.lesson

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] overflow-hidden bg-brand-shader text-white select-none"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1)
      }}
    >
      <AmbientGlow />
      <div className="absolute inset-x-0 top-0 h-1.5 bg-white/15" aria-hidden="true">
        <div className="h-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500" style={{ width: `${last ? (i / last) * 100 : 100}%` }} />
      </div>

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-4 text-sm">
        <p className="truncate rounded-full bg-black/25 backdrop-blur px-4 py-1.5 font-semibold">{course.emoji} {lessonName}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-black/25 backdrop-blur px-3 py-1.5 tabular-nums" aria-label="ลำดับสไลด์">{i + 1} / {slides.length}</span>
          <button type="button" onClick={toggleFullscreen} className="rounded-full bg-white/20 border border-white/30 px-3 py-1.5 font-semibold" aria-label="เต็มจอ">⛶ เต็มจอ</button>
          <button type="button" onClick={exit} className="rounded-full bg-white/20 border border-white/30 px-3 py-1.5 font-semibold" aria-label="ออกจากโหมดสอน">✕ ออก</button>
        </div>
      </div>

      {/* โซนแตะซ้าย/ขวา */}
      <button type="button" className="absolute left-0 top-16 bottom-16 w-1/5 z-10 cursor-w-resize" onClick={() => go(i - 1)} aria-label="สไลด์ก่อนหน้า" />
      <button type="button" className="absolute right-0 top-16 bottom-16 w-1/5 z-10 cursor-e-resize" onClick={() => go(i + 1)} aria-label="สไลด์ถัดไป" />

      <div key={i} className={'absolute inset-0 grid place-items-center px-[8vw] pt-16 pb-20 ' + (dir > 0 ? 'present-in-right' : 'present-in-left')}>
        <SlideBody s={s} />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-4 pb-4">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="rounded-full bg-white/20 border border-white/30 w-11 h-11 text-xl disabled:opacity-30" aria-label="ย้อนกลับ">‹</button>
        <p className="text-xs text-white/70 hidden sm:block">← → เปลี่ยนสไลด์ · F เต็มจอ · Esc ออก</p>
        <button type="button" onClick={() => go(i + 1)} disabled={i === last} className="rounded-full bg-white text-stone-900 w-11 h-11 text-xl font-bold disabled:opacity-30" aria-label="ถัดไป">›</button>
      </div>
    </div>
  )
}

function SlideBody({ s }: { s: Slide }) {
  switch (s.kind) {
    case 'cover':
      return (
        <div className="text-center space-y-[3vh]">
          <p className="text-[18vmin] leading-none learn-bob" aria-hidden="true">{s.emoji}</p>
          <h1 className="font-display font-bold drop-shadow-lg" style={{ fontSize: 'clamp(2.5rem, 9vmin, 8rem)', lineHeight: 1.15 }}>{s.title}</h1>
          {s.description && <p className="mx-auto max-w-4xl text-white/85" style={{ fontSize: 'clamp(1.1rem, 3vmin, 2.2rem)' }}>{s.description}</p>}
          <p className="inline-block rounded-full bg-white/20 border border-white/30 px-6 py-2" style={{ fontSize: 'clamp(1rem, 2.4vmin, 1.8rem)' }}>RYUKUNG BAKERY · {s.lessonCount} บทเรียน</p>
        </div>
      )
    case 'lesson':
      return (
        <div className="text-center space-y-[3vh]">
          <p className="mx-auto w-[16vmin] h-[16vmin] rounded-full bg-gradient-to-br from-amber-300 to-amber-600 grid place-items-center font-display font-bold shadow-2xl" style={{ fontSize: '8vmin' }}>{s.n}</p>
          <p className="tracking-[0.3em] text-white/70" style={{ fontSize: 'clamp(1rem, 2.4vmin, 1.8rem)' }}>บทที่ {s.n} จาก {s.total}</p>
          <h2 className="font-display font-bold drop-shadow-lg" style={{ fontSize: 'clamp(2.2rem, 8vmin, 7rem)', lineHeight: 1.2 }}>{s.title}</h2>
        </div>
      )
    case 'ingredients': {
      const cols = s.items.length > 7 ? 2 : 1
      return (
        <div className="w-full max-w-6xl space-y-[3vh]">
          <h2 className="text-center font-display font-bold" style={{ fontSize: 'clamp(1.8rem, 6vmin, 4.5rem)' }}>🧂 ส่วนผสม</h2>
          <ul className={'grid gap-x-[3vw] gap-y-[1.4vh] ' + (cols === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto')}>
            {s.items.map((x, k) => (
              <li key={k} className="flex items-baseline justify-between gap-4 rounded-2xl bg-white/12 border border-white/20 backdrop-blur px-[2vmin] py-[1.4vmin]" style={{ fontSize: 'clamp(1.1rem, 3.4vmin, 2.6rem)' }}>
                <span>{x.name}</span>
                <b className="shrink-0 text-amber-200 tabular-nums">{x.qty}</b>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    case 'step':
      return (
        <div className="w-full max-w-5xl text-center space-y-[3vh]">
          <p className="mx-auto w-[14vmin] h-[14vmin] rounded-full bg-gradient-to-br from-amber-300 to-amber-600 grid place-items-center font-display font-bold shadow-2xl" style={{ fontSize: '7vmin' }}>{s.n}</p>
          <p className="text-white/70 tracking-widest" style={{ fontSize: 'clamp(0.9rem, 2.2vmin, 1.6rem)' }}>ขั้นตอนที่ {s.n} จาก {s.total}</p>
          <p className="font-display font-semibold drop-shadow" style={{ fontSize: 'clamp(1.6rem, 5.6vmin, 4.6rem)', lineHeight: 1.35 }}>{s.text}</p>
        </div>
      )
    case 'tips':
      return (
        <div className="w-full max-w-5xl text-center space-y-[3vh]">
          <p className="text-[12vmin] leading-none" aria-hidden="true">💡</p>
          <h2 className="font-display font-bold text-amber-200" style={{ fontSize: 'clamp(1.6rem, 5vmin, 4rem)' }}>เคล็ดลับ</h2>
          <p className="whitespace-pre-line" style={{ fontSize: 'clamp(1.3rem, 4.2vmin, 3.4rem)', lineHeight: 1.4 }}>{s.text}</p>
        </div>
      )
    case 'video':
      return (
        <div className="text-center space-y-[3vh]">
          <p className="text-[12vmin] leading-none" aria-hidden="true">▶️</p>
          <a href={s.url} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-white text-stone-900 font-bold px-[5vmin] py-[2vmin]" style={{ fontSize: 'clamp(1.2rem, 3.6vmin, 2.8rem)' }}>เปิดวิดีโอประกอบบทนี้</a>
        </div>
      )
    case 'end':
      return (
        <div className="text-center space-y-[3vh]">
          <p className="text-[18vmin] leading-none learn-bob" aria-hidden="true">🎉</p>
          <h2 className="font-display font-bold" style={{ fontSize: 'clamp(2.2rem, 8vmin, 7rem)' }}>จบคอร์ส {s.title}</h2>
          <p className="text-white/85" style={{ fontSize: 'clamp(1.1rem, 3.2vmin, 2.4rem)' }}>ขอบคุณที่ตั้งใจเรียน — ฝึกทำที่บ้านแล้วมาอวดกันนะ 🍪</p>
        </div>
      )
  }
}
