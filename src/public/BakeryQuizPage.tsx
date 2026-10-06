import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicMenu } from '../lib/publicMenuApi'
import { playAddSound, playPaymentSound } from '../lib/uiSound'
import { productImageUrl } from '../products/ProductCard'
import { AmbientGlow, ConfettiRain, CountUp, PageTexture, Reveal, SquiggleUnderline, burstSparkles } from './PublicSiteChrome'
import { PASS_SCORE, QUIZ_LEVELS, TOTAL_QUESTIONS, rankFor, type QuizQuestion } from './quizData'

const STORAGE_KEY = 'bakery-quiz-progress'

type Progress = { passed: number; best: number[] }
type Prepared = { q: string; options: string[]; correct: number; why: string }

function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Progress | null
    if (raw && typeof raw.passed === 'number' && Array.isArray(raw.best)) return raw
  } catch {
    // อ่านไม่ได้ (โหมดส่วนตัว/ข้อมูลเสีย) เริ่มใหม่
  }
  return { passed: 0, best: [] }
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // เก็บไม่ได้ก็เล่นต่อได้ แค่ไม่จำความคืบหน้า
  }
}

/** สลับลำดับ (Fisher–Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function prepare(questions: QuizQuestion[]): Prepared[] {
  return shuffle(questions).map((q) => {
    const options = shuffle([q.a, ...q.wrong])
    return { q: q.q, options, correct: options.indexOf(q.a), why: q.why }
  })
}

const LETTERS = ['ก', 'ข', 'ค', 'ง']

/**
 * หน้า /test — เกมทดสอบความรู้เบเกอรี่ 6 ด่าน (พอได้ → โอเค → ปานกลาง → เก่ง → เก่งมาก → เทพเจ้า) ด่านละ 10 ข้อ
 * ผ่านด่านด้วยคะแนนอย่างน้อย PASS_SCORE ข้อ เพื่อปลดล็อกด่านถัดไป จำความคืบหน้าไว้ในเครื่อง ไม่ต้องล็อกอินและไม่ใช้ฐานข้อมูล
 */
export function BakeryQuizPage() {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [screen, setScreen] = useState<'intro' | 'playing' | 'result'>('intro')
  const [levelIdx, setLevelIdx] = useState(0)
  const [qs, setQs] = useState<Prepared[]>([])
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [shop, setShop] = useState<{ name: string; logo: string | null } | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getPublicMenu().then(({ menu }) => {
      if (menu) setShop({ name: menu.shop_name, logo: menu.logo_path ? productImageUrl(menu.logo_path) : null })
    })
  }, [])

  const level = QUIZ_LEVELS[levelIdx]
  const current = qs[qi]
  const passedAll = progress.passed >= QUIZ_LEVELS.length
  const rank = rankFor(progress.passed)
  const passedThisRun = score >= PASS_SCORE

  const start = useCallback((idx: number) => {
    setLevelIdx(idx)
    setQs(prepare(QUIZ_LEVELS[idx].questions))
    setQi(0)
    setPicked(null)
    setScore(0)
    setShareMsg(null)
    setScreen('playing')
    window.scrollTo({ top: 0 })
  }, [])

  function choose(i: number, el: HTMLElement | null) {
    if (picked !== null || !current) return
    setPicked(i)
    if (i === current.correct) {
      setScore((s) => s + 1)
      playAddSound()
      if (el) burstSparkles(el, 10)
    }
  }

  const next = useCallback(() => {
    if (picked === null) return
    if (qi + 1 < qs.length) {
      setQi(qi + 1)
      setPicked(null)
      topRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      return
    }
    // จบด่าน: บันทึกผล
    const finalScore = score
    const best = [...progress.best]
    best[levelIdx] = Math.max(best[levelIdx] ?? 0, finalScore)
    let passed = progress.passed
    if (finalScore >= PASS_SCORE && levelIdx === progress.passed) passed = progress.passed + 1
    const updated = { passed, best }
    setProgress(updated)
    saveProgress(updated)
    if (finalScore >= PASS_SCORE) playPaymentSound()
    setScreen('result')
    window.scrollTo({ top: 0 })
  }, [picked, qi, qs.length, score, progress, levelIdx])

  // คีย์ลัดบนคอม: 1–4 เลือกตัวเลือก, Enter/Space ไปข้อต่อไป
  useEffect(() => {
    if (screen !== 'playing') return
    function onKey(e: KeyboardEvent) {
      if (e.key >= '1' && e.key <= '4') {
        const btn = document.querySelector<HTMLElement>(`[data-opt="${Number(e.key) - 1}"]`)
        if (btn) choose(Number(e.key) - 1, btn)
      } else if ((e.key === 'Enter' || e.key === ' ') && picked !== null) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, picked, next, current])

  async function handleShare() {
    const text = `ฉันอยู่ระดับ “${rank.name}” ${rank.icon} ในแบบทดสอบความรู้เบเกอรี่${shop ? ' ของ ' + shop.name : ''}! มาลองดูว่าคุณเก่งแค่ไหน`
    const url = `${window.location.origin}/test`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ทดสอบความรู้เบเกอรี่', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setShareMsg('คัดลอกข้อความแล้ว ส่งให้เพื่อนได้เลย')
    } catch {
      setShareMsg('แชร์ไม่สำเร็จ ลองใหม่อีกครั้งนะ')
    }
  }

  const progressPct = useMemo(() => (screen === 'playing' ? ((qi + (picked !== null ? 1 : 0)) / qs.length) * 100 : 0), [screen, qi, picked, qs.length])

  return (
    <div className="min-h-screen pb-16 font-warm bg-stone-50">
      <PageTexture />
      <div ref={topRef} className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/menu" className="rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm">
            ← กลับหน้าเมนู
          </Link>
          {screen !== 'intro' && (
            <button type="button" onClick={() => setScreen('intro')} className="text-sm text-stone-500 underline">
              เลือกด่านอื่น
            </button>
          )}
        </div>

        {screen === 'intro' && (
          <>
            <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-6 text-center shadow-[0_18px_36px_-16px_rgb(51_32_14_/_0.7)] animate-form-in">
              <AmbientGlow />
              <div className="relative z-10 space-y-2">
                {shop?.logo && <img src={shop.logo} alt="" className="mx-auto w-14 h-14 rounded-full object-cover border-2 border-white/60" />}
                <p className="text-5xl animate-icon-pop" aria-hidden="true">{rank.icon}</p>
                <h1 className="text-2xl font-display font-bold leading-tight">ทดสอบความรู้เบเกอรี่</h1>
                <SquiggleUnderline className="w-20 h-2.5 mx-auto text-white/40" />
                <p className="text-sm text-white/85">
                  {TOTAL_QUESTIONS} ข้อ · 6 ระดับ จาก “พอได้” ไปถึง “เทพเจ้า” — ผ่านแต่ละด่านให้ได้อย่างน้อย {PASS_SCORE}/10 ข้อ
                </p>
                <p className="inline-block rounded-full bg-black/25 border border-white/25 px-4 py-1.5 text-sm font-semibold">
                  ระดับของคุณตอนนี้: {rank.icon} {rank.name}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {QUIZ_LEVELS.map((lv, i) => {
                const unlocked = i <= progress.passed
                const done = i < progress.passed
                const best = progress.best[i]
                return (
                  <Reveal key={lv.name} delay={i * 0.06}>
                    <div
                      className={
                        'relative overflow-hidden flex items-center gap-3.5 rounded-3xl border p-4 transition-all duration-300 ' +
                        (unlocked
                          ? 'bg-white border-amber-200 shadow-[0_12px_28px_-16px_rgb(51_32_14_/_0.5)]'
                          : 'bg-stone-100/80 border-stone-200 opacity-75')
                      }
                    >
                      <span className={'absolute left-0 top-0 bottom-0 w-1.5 ' + (done ? 'bg-green-500' : unlocked ? 'bg-gradient-to-b from-amber-400 to-amber-700' : 'bg-stone-300')} aria-hidden="true" />
                      <div className={'w-14 h-14 shrink-0 rounded-2xl grid place-items-center text-3xl ' + (unlocked ? 'bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200' : 'bg-stone-200 grayscale')}>
                        {unlocked ? lv.icon : '🔒'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold tracking-widest text-stone-400">ด่านที่ {i + 1}</p>
                        <p className="font-display font-bold text-lg text-stone-900 leading-tight">{lv.name}</p>
                        <p className="text-xs text-stone-500">{lv.tagline}</p>
                        {best !== undefined && <p className="text-xs mt-0.5 font-semibold text-amber-800">คะแนนดีที่สุด {best}/10{done ? ' · ผ่านแล้ว ✓' : ''}</p>}
                      </div>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => start(i)}
                        className={
                          'shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 ' +
                          (unlocked ? 'bg-stone-900 text-white shadow-md' : 'bg-stone-200 text-stone-400 cursor-not-allowed')
                        }
                      >
                        {done ? 'เล่นอีก' : unlocked ? 'เริ่ม' : 'ล็อก'}
                      </button>
                    </div>
                  </Reveal>
                )
              })}
            </div>
            {progress.passed > 0 && (
              <button
                type="button"
                onClick={() => {
                  const fresh = { passed: 0, best: [] }
                  setProgress(fresh)
                  saveProgress(fresh)
                }}
                className="mx-auto block text-xs text-stone-400 underline"
              >
                เริ่มนับใหม่ทั้งหมด
              </button>
            )}
          </>
        )}

        {screen === 'playing' && current && (
          <div key={qi} className="space-y-3 animate-form-in">
            <div className="rounded-3xl bg-white border border-amber-200 p-4 shadow-[0_12px_28px_-16px_rgb(51_32_14_/_0.5)]">
              <div className="flex items-center justify-between text-sm">
                <span className="font-display font-bold text-stone-900">{level.icon} ด่าน {levelIdx + 1} · {level.name}</span>
                <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-0.5 text-xs font-bold tabular-nums">
                  ข้อ {qi + 1}/{qs.length} · ถูก {score}
                </span>
              </div>
              <div className="mt-2.5 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-700 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-stone-200 p-5 shadow-[0_14px_30px_-18px_rgb(51_32_14_/_0.5)]">
              <p className="text-lg font-display font-semibold text-stone-900 leading-snug">{current.q}</p>
            </div>

            <div className="space-y-2.5" role="group" aria-label="ตัวเลือกคำตอบ">
              {current.options.map((opt, i) => {
                const isCorrect = i === current.correct
                const isPicked = i === picked
                const reveal = picked !== null
                return (
                  <button
                    key={opt}
                    type="button"
                    data-opt={i}
                    disabled={reveal}
                    onClick={(e) => choose(i, e.currentTarget)}
                    className={
                      'quiz-option w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200 ' +
                      (!reveal
                        ? 'bg-white border-stone-200 hover:border-amber-400 hover:-translate-y-0.5 active:scale-[0.98] shadow-sm'
                        : isCorrect
                          ? 'bg-green-50 border-green-500 text-green-900 quiz-correct-pop'
                          : isPicked
                            ? 'bg-red-50 border-red-400 text-red-900 animate-shake'
                            : 'bg-white border-stone-200 opacity-60')
                    }
                    style={{ animationDelay: reveal ? '0s' : `${i * 0.05}s` }}
                  >
                    <span
                      className={
                        'w-8 h-8 shrink-0 rounded-full grid place-items-center text-sm font-bold ' +
                        (!reveal ? 'bg-amber-100 text-amber-800' : isCorrect ? 'bg-green-500 text-white' : isPicked ? 'bg-red-500 text-white' : 'bg-stone-100 text-stone-400')
                      }
                    >
                      {reveal && isCorrect ? '✓' : reveal && isPicked ? '✕' : LETTERS[i]}
                    </span>
                    <span className="text-[15px] leading-snug">{opt}</span>
                  </button>
                )
              })}
            </div>

            {picked !== null && (
              <div className="animate-form-in space-y-3">
                <div className={'rounded-2xl border px-4 py-3 text-sm leading-relaxed ' + (picked === current.correct ? 'bg-green-50 border-green-200 text-green-900' : 'bg-amber-50 border-amber-200 text-amber-900')}>
                  <p className="font-bold mb-0.5">{picked === current.correct ? '🎉 ถูกต้อง!' : '😅 ยังไม่ใช่นะ'}</p>
                  <p>{current.why}</p>
                </div>
                <button type="button" onClick={next} className="btn-shimmer w-full rounded-full bg-stone-900 text-white font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(0_0_0_/_0.6)] active:scale-95">
                  {qi + 1 < qs.length ? 'ข้อต่อไป →' : 'ดูผลคะแนน →'}
                </button>
              </div>
            )}
            <p className="hidden sm:block text-center text-[11px] text-stone-400">คีย์ลัด: กด 1–4 เพื่อเลือกคำตอบ · Enter เพื่อไปข้อต่อไป</p>
          </div>
        )}

        {screen === 'result' && (
          <div className="space-y-4 animate-form-in">
            <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-6 text-center shadow-[0_18px_36px_-16px_rgb(51_32_14_/_0.7)]">
              <AmbientGlow />
              {passedThisRun && <ConfettiRain pieces={36} />}
              <div className="relative z-10 space-y-2">
                <p className="text-6xl animate-icon-pop" aria-hidden="true">{passedThisRun ? level.icon : '💪'}</p>
                <p className="text-sm text-white/80">ด่านที่ {levelIdx + 1} · {level.name}</p>
                <p className="text-6xl font-display font-bold tabular-nums leading-none">
                  <CountUp value={score} format={(n) => String(Math.round(n))} duration={900} />
                  <span className="text-2xl text-white/70">/{qs.length}</span>
                </p>
                <h2 className="text-xl font-display font-bold">
                  {passedThisRun ? (levelIdx + 1 === QUIZ_LEVELS.length ? '👑 คุณคือเทพเจ้าเบเกอรี่!' : 'ผ่านด่านแล้ว!') : 'เกือบแล้ว ลองอีกครั้งนะ'}
                </h2>
                <p className="text-sm text-white/85">
                  {passedThisRun
                    ? levelIdx + 1 === QUIZ_LEVELS.length
                      ? 'คุณผ่านครบทั้ง 6 ระดับ ความรู้เบเกอรี่ระดับสุดยอดจริงๆ'
                      : `ปลดล็อกด่านถัดไป: ${QUIZ_LEVELS[levelIdx + 1].icon} ${QUIZ_LEVELS[levelIdx + 1].name}`
                    : `ต้องได้อย่างน้อย ${PASS_SCORE}/10 ข้อถึงจะผ่าน`}
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-amber-200 p-4 text-center shadow-sm">
              <p className="text-xs text-stone-500">ระดับของคุณตอนนี้</p>
              <p className="text-2xl font-display font-bold text-stone-900">{rank.icon} {rank.name}</p>
            </div>

            <div className="grid gap-2.5">
              {passedThisRun && levelIdx + 1 < QUIZ_LEVELS.length && (
                <button type="button" onClick={() => start(levelIdx + 1)} className="btn-shimmer w-full rounded-full bg-stone-900 text-white font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(0_0_0_/_0.6)] active:scale-95">
                  ไปด่านต่อไป: {QUIZ_LEVELS[levelIdx + 1].icon} {QUIZ_LEVELS[levelIdx + 1].name} →
                </button>
              )}
              <button type="button" onClick={() => start(levelIdx)} className="w-full rounded-full bg-white border-2 border-stone-300 text-stone-800 font-semibold py-3 active:scale-95">
                🔄 เล่นด่านนี้ใหม่
              </button>
              <button type="button" onClick={() => void handleShare()} className="w-full rounded-full bg-white border-2 border-amber-400 text-amber-900 font-semibold py-3 active:scale-95">
                📣 แชร์ผลให้เพื่อน
              </button>
              {shareMsg && <p className="text-center text-sm text-green-700">{shareMsg}</p>}
              {passedAll && (
                <Link to="/menu" className="block text-center w-full rounded-full bg-gradient-to-r from-amber-500 to-amber-700 text-white font-bold py-3.5 shadow-lg active:scale-95">
                  🍪 ฉลองด้วยขนมอร่อยๆ จากร้านเรา
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
