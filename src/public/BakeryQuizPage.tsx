import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as htmlToImage from 'html-to-image'
import { saveImage } from '../lib/saveImage'
import { getPublicMenu } from '../lib/publicMenuApi'
import { playAddSound, playPaymentSound } from '../lib/uiSound'
import { productImageUrl } from '../products/ProductCard'
import { AmbientGlow, ConfettiRain, CountUp, PageTexture, Reveal, SquiggleUnderline, burstSparkles } from './PublicSiteChrome'
import { PASS_SCORE, QUIZ_LEVELS, TOTAL_QUESTIONS, rankFor, type QuizQuestion } from './quizData'
import { TOPICS, answerKey, buildCritique, topicOf } from './quizCritique'
import { QuizCertificate, type CertificateData } from './QuizCertificate'

const STORAGE_KEY = 'bakery-quiz-progress'

type Progress = {
  passed: number
  best: number[]
  /** ผลตอบล่าสุดของแต่ละข้อ (key = "ด่าน-ข้อ") ใช้วิเคราะห์คำวิจารณ์รายหมวด */
  answers?: Record<string, boolean>
  firstName?: string
  lastName?: string
  certNo?: string
  certDate?: string
}
type Prepared = { q: string; options: string[]; correct: number; why: string; key: string }

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

function prepare(questions: QuizQuestion[], levelIdx: number): Prepared[] {
  return shuffle(questions.map((q, i) => ({ q, i }))).map(({ q, i }) => {
    const options = shuffle([q.a, ...q.wrong])
    return { q: q.q, options, correct: options.indexOf(q.a), why: q.why, key: answerKey(levelIdx, i) }
  })
}

const LETTERS = ['ก', 'ข', 'ค', 'ง']

/** วงแหวนความคืบหน้า (SVG) — เส้นวิ่งเต็มตามค่าเมื่อโผล่ขึ้นมา ใส่เนื้อหาไว้กลางวงได้ */
function Ring({ value, max, size = 132, stroke = 10, children }: { value: number; max: number; size?: number; stroke?: number; children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80)
    return () => clearTimeout(t)
  }, [])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const target = c * (1 - Math.min(1, value / Math.max(1, max)))
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="quiz-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#quiz-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={ready ? target : c}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)', filter: 'drop-shadow(0 0 6px rgba(253,224,71,0.8))' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/**
 * หน้า /test — เกมทดสอบความรู้เบเกอรี่ 6 ด่าน (พอได้ → โอเค → ปานกลาง → เก่ง → เก่งมาก → เทพเจ้า) ด่านละ 10 ข้อ
 * ผ่านด่านด้วยคะแนนอย่างน้อย PASS_SCORE ข้อ เพื่อปลดล็อกด่านถัดไป จำความคืบหน้าไว้ในเครื่อง ไม่ต้องล็อกอินและไม่ใช้ฐานข้อมูล
 */
export function BakeryQuizPage() {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [screen, setScreen] = useState<'intro' | 'playing' | 'result' | 'critique' | 'name' | 'certificate'>('intro')
  const [runAnswers, setRunAnswers] = useState<Record<string, boolean>>({})
  const [firstName, setFirstName] = useState(() => loadProgress().firstName ?? '')
  const [lastName, setLastName] = useState(() => loadProgress().lastName ?? '')
  const certRef = useRef<HTMLDivElement>(null)
  const [levelIdx, setLevelIdx] = useState(0)
  const [qs, setQs] = useState<Prepared[]>([])
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
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
    setQs(prepare(QUIZ_LEVELS[idx].questions, idx))
    setRunAnswers({})
    setQi(0)
    setPicked(null)
    setScore(0)
    setStreak(0)
    setShareMsg(null)
    setScreen('playing')
    window.scrollTo({ top: 0 })
  }, [])

  function choose(i: number, el: HTMLElement | null) {
    if (picked !== null || !current) return
    setPicked(i)
    setRunAnswers((r) => ({ ...r, [current.key]: i === current.correct }))
    if (i !== current.correct) {
      setStreak(0)
      navigator.vibrate?.(60)
    }
    if (i === current.correct) {
      setStreak((s) => s + 1)
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
    const updated: Progress = { ...progress, passed, best, answers: { ...(progress.answers ?? {}), ...runAnswers } }
    setProgress(updated)
    saveProgress(updated)
    if (finalScore >= PASS_SCORE) playPaymentSound()
    setScreen('result')
    window.scrollTo({ top: 0 })
  }, [picked, qi, qs.length, score, progress, levelIdx, runAnswers])

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

  const critique = useMemo(() => buildCritique(progress.answers ?? {}), [progress.answers])
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
  const nameValid = firstName.trim().length >= 1 && lastName.trim().length >= 1

  function issueCertificate() {
    if (!nameValid) return
    const now = new Date()
    const certNo = progress.certNo ?? `BK-${now.getFullYear() + 543}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`
    const updated: Progress = {
      ...progress,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      certNo,
      certDate: progress.certDate ?? now.toISOString(),
    }
    setProgress(updated)
    saveProgress(updated)
    setScreen('certificate')
    window.scrollTo({ top: 0 })
  }

  const certData: CertificateData = {
    name: fullName,
    correct: critique.correct,
    total: critique.total || TOTAL_QUESTIONS,
    pct: critique.pct,
    shopName: shop?.name ?? 'RYUKUNG BAKERY',
    logoUrl: shop?.logo ?? null,
    issuedAt: progress.certDate ? new Date(progress.certDate) : new Date(),
    certNo: progress.certNo ?? '-',
  }

  async function saveCertificatePng() {
    if (!certRef.current) return
    const blob = await htmlToImage.toBlob(certRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
    if (blob) await saveImage(blob, `certificate-${fullName.replace(/\s+/g, '-')}.png`, 'เกียรติบัตร')
  }


  return (
    <div className="min-h-screen pb-16 font-warm bg-stone-50">
      <PageTexture />
      <div ref={topRef} className={(screen === 'certificate' ? 'max-w-4xl' : 'max-w-xl') + ' mx-auto px-4 pt-4 space-y-4'}>
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
                <Ring value={progress.passed} max={QUIZ_LEVELS.length}>
                  <div className="text-center">
                    {shop?.logo ? (
                      <img src={shop.logo} alt="" className="mx-auto w-14 h-14 rounded-full object-cover border-2 border-white/70" />
                    ) : (
                      <p className="text-5xl animate-icon-pop" aria-hidden="true">{rank.icon}</p>
                    )}
                    <p className="text-[11px] font-bold text-white/90 mt-0.5">ผ่าน {Math.min(progress.passed, QUIZ_LEVELS.length)}/{QUIZ_LEVELS.length} ด่าน</p>
                  </div>
                </Ring>
                <h1 className="text-3xl font-display font-bold leading-tight">ทดสอบความรู้เบเกอรี่</h1>
                <SquiggleUnderline className="w-20 h-2.5 mx-auto text-white/40" />
                <p className="text-sm text-white/85">
                  {TOTAL_QUESTIONS} ข้อ · 6 ระดับ จาก “พอได้” ไปถึง “เทพเจ้า” — ผ่านแต่ละด่านให้ได้อย่างน้อย {PASS_SCORE}/10 ข้อ
                </p>
                <p className="inline-block rounded-full bg-black/25 border border-white/25 px-4 py-1.5 text-sm font-semibold">
                  ระดับของคุณตอนนี้: {rank.icon} {rank.name}
                </p>
              </div>
            </div>

            {passedAll && (
              <button
                type="button"
                onClick={() => setScreen('critique')}
                className="btn-shimmer w-full flex items-center gap-3 rounded-3xl bg-gradient-to-r from-amber-500 to-amber-700 text-white p-4 text-left shadow-[0_14px_30px_-14px_rgb(146_82_12_/_0.9)] active:scale-[0.98]"
              >
                <span className="text-4xl" aria-hidden="true">📜</span>
                <span className="flex-1">
                  <span className="block font-display font-bold text-lg">ผ่านครบทุกระดับแล้ว!</span>
                  <span className="block text-sm text-white/90">ดูคำวิจารณ์ผลของคุณ และรับเกียรติบัตร →</span>
                </span>
              </button>
            )}
            <div className="relative space-y-3">
              <span className="pointer-events-none absolute left-[2.1rem] top-8 bottom-8 w-1 rounded-full bg-gradient-to-b from-green-400 via-amber-400 to-stone-300" aria-hidden="true" />
              {QUIZ_LEVELS.map((lv, i) => {
                const isNext = i === progress.passed && i < QUIZ_LEVELS.length
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
                          : 'bg-stone-100 border-stone-200 text-stone-500') +
                        (isNext ? ' quiz-next-glow border-amber-400' : '')
                      }
                    >
                      <span className={'absolute left-0 top-0 bottom-0 w-1.5 ' + (done ? 'bg-green-500' : unlocked ? 'bg-gradient-to-b from-amber-400 to-amber-700' : 'bg-stone-300')} aria-hidden="true" />
                      <div className={'w-14 h-14 shrink-0 rounded-2xl grid place-items-center text-3xl ' + (unlocked ? 'bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200' : 'bg-stone-200 grayscale')}>
                        {unlocked ? lv.icon : '🔒'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold tracking-widest text-stone-400">
                          ด่านที่ {i + 1}
                          {isNext && <span className="ml-2 rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] tracking-normal animate-pulse">ด่านถัดไป</span>}
                        </p>
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
              <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                {qs.map((q, i) => {
                  const done = runAnswers[q.key]
                  return (
                    <span
                      key={q.key}
                      className={
                        'h-2.5 flex-1 rounded-full transition-all duration-500 ' +
                        (done === true ? 'bg-gradient-to-r from-green-400 to-emerald-600' : done === false ? 'bg-gradient-to-r from-orange-400 to-red-500' : i === qi ? 'bg-amber-400 animate-pulse' : 'bg-stone-200')
                      }
                    />
                  )
                })}
              </div>
              {streak >= 2 && (
                <p key={streak} className="mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-400 to-red-500 text-white text-xs font-bold px-3 py-1 shadow-md animate-qty-pop">
                  🔥 ตอบถูกติดกัน {streak} ข้อ!
                </p>
              )}
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-white border border-stone-200 p-5 pt-6 shadow-[0_14px_30px_-18px_rgb(51_32_14_/_0.5)]">
              <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-300 via-amber-600 to-amber-300" aria-hidden="true" />
              {(() => {
                const [li, qiOrig] = current.key.split('-').map(Number)
                const tp = TOPICS[topicOf(li, qiOrig)]
                return (
                  <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                    <span>{tp.icon}</span>
                    {tp.name}
                  </p>
                )
              })()}
              <p className="text-xl font-display font-semibold text-stone-900 leading-snug">{current.q}</p>
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

        {screen === 'critique' && (
          <div className="space-y-4 animate-form-in">
            <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-6 text-center shadow-[0_18px_36px_-16px_rgb(51_32_14_/_0.7)]">
              <AmbientGlow />
              <div className="relative z-10 space-y-1.5">
                <p className="text-5xl animate-icon-pop" aria-hidden="true">📝</p>
                <h2 className="text-2xl font-display font-bold">คำวิจารณ์ผลของคุณ</h2>
                <p className="text-sm text-white/85">วิเคราะห์จากคำตอบทั้งหมดของคุณ แยกตามหมวดความรู้</p>
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-amber-200 p-5 shadow-[0_12px_28px_-16px_rgb(51_32_14_/_0.5)] space-y-3">
              {critique.lines.map((line, i) => (
                <p key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-stone-800">
                  <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-amber-100 text-amber-800 text-xs font-bold grid place-items-center">{i + 1}</span>
                  <span>{line}</span>
                </p>
              ))}
            </div>

            <div className="rounded-3xl bg-white border border-stone-200 p-5 space-y-3 shadow-sm">
              <p className="font-display font-semibold text-stone-900">คะแนนรายหมวดความรู้</p>
              {critique.stats.map((s) => (
                <div key={s.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{s.icon} {s.name}</span>
                    <span className="font-bold tabular-nums">{s.correct}/{s.total} · {s.pct}%</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={'h-full rounded-full transition-all duration-1000 ' + (s.pct >= 80 ? 'bg-gradient-to-r from-green-400 to-emerald-600' : s.pct >= 60 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-orange-400 to-red-500')}
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setScreen('name')} className="btn-shimmer w-full rounded-full bg-stone-900 text-white font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(0_0_0_/_0.6)] active:scale-95">
              ถัดไป: กรอกชื่อรับเกียรติบัตร →
            </button>
          </div>
        )}

        {screen === 'name' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              issueCertificate()
            }}
            className="space-y-4 animate-form-in"
          >
            <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-6 text-center shadow-[0_18px_36px_-16px_rgb(51_32_14_/_0.7)]">
              <AmbientGlow />
              <div className="relative z-10 space-y-1.5">
                <p className="text-5xl animate-icon-pop" aria-hidden="true">📜</p>
                <h2 className="text-2xl font-display font-bold">ใบเกียรติบัตรของคุณ</h2>
                <p className="text-sm text-white/85">กรอกชื่อและนามสกุลเพื่อพิมพ์ลงบนเกียรติบัตร</p>
              </div>
            </div>
            <div className="rounded-3xl bg-white border border-amber-200 p-5 space-y-4 shadow-[0_12px_28px_-16px_rgb(51_32_14_/_0.5)]">
              <div className="space-y-1">
                <label htmlFor="quiz-first" className="text-sm font-medium text-stone-600">ชื่อ</label>
                <input
                  id="quiz-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value.slice(0, 30))}
                  autoComplete="given-name"
                  placeholder="เช่น สมหญิง"
                  className="w-full rounded-2xl border-2 border-stone-200 bg-stone-50/60 px-4 py-3 text-lg focus:border-amber-600 focus:bg-white"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="quiz-last" className="text-sm font-medium text-stone-600">นามสกุล</label>
                <input
                  id="quiz-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value.slice(0, 30))}
                  autoComplete="family-name"
                  placeholder="เช่น ใจดี"
                  className="w-full rounded-2xl border-2 border-stone-200 bg-stone-50/60 px-4 py-3 text-lg focus:border-amber-600 focus:bg-white"
                />
              </div>
              <p className="text-xs text-stone-400">ชื่อนี้ใช้แสดงบนเกียรติบัตรเท่านั้น เก็บไว้ในเครื่องของคุณ ไม่ถูกส่งไปที่ร้าน</p>
            </div>
            <button
              type="submit"
              disabled={!nameValid}
              className="btn-shimmer w-full rounded-full bg-stone-900 text-white font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(0_0_0_/_0.6)] active:scale-95 disabled:opacity-40"
            >
              🎓 ออกใบเกียรติบัตร
            </button>
          </form>
        )}

        {screen === 'certificate' && (
          <div className="space-y-4 animate-form-in">
            <div className="text-center space-y-1 no-print">
              <h2 className="text-2xl font-display font-bold text-stone-900">🎉 ยินดีด้วยนะ {firstName.trim()}!</h2>
              <p className="text-sm text-stone-500">นี่คือเกียรติบัตรของคุณ บันทึกเป็นรูปหรือพิมพ์เก็บไว้ได้เลย</p>
            </div>
            <div className="relative -mx-4 sm:mx-0">
              <ConfettiRain pieces={30} />
              <QuizCertificate ref={certRef} data={certData} />
            </div>
            <div className="grid gap-2.5 no-print">
              <button type="button" onClick={() => void saveCertificatePng()} className="btn-shimmer w-full rounded-full bg-stone-900 text-white font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(0_0_0_/_0.6)] active:scale-95">
                🖼️ บันทึกเป็นรูป
              </button>
              <button type="button" onClick={() => window.print()} className="w-full rounded-full bg-white border-2 border-stone-300 text-stone-800 font-semibold py-3 active:scale-95">
                🖨️ พิมพ์ / บันทึกเป็น PDF (แนวนอน)
              </button>
              <button type="button" onClick={() => void handleShare()} className="w-full rounded-full bg-white border-2 border-amber-400 text-amber-900 font-semibold py-3 active:scale-95">
                📣 แชร์ผลให้เพื่อน
              </button>
              {shareMsg && <p className="text-center text-sm text-green-700">{shareMsg}</p>}
              <button type="button" onClick={() => setScreen('name')} className="text-sm text-stone-500 underline">แก้ไขชื่อบนเกียรติบัตร</button>
            </div>
          </div>
        )}

        {screen === 'result' && (
          <div className="space-y-4 animate-form-in">
            <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-6 text-center shadow-[0_18px_36px_-16px_rgb(51_32_14_/_0.7)]">
              <AmbientGlow />
              {passedThisRun && <ConfettiRain pieces={36} />}
              <div className="relative z-10 space-y-2">
                <p className="text-sm text-white/80">ด่านที่ {levelIdx + 1} · {level.name}</p>
                <Ring value={score} max={qs.length} size={150} stroke={12}>
                  <div className="text-center">
                    <p className="text-3xl leading-none" aria-hidden="true">{passedThisRun ? level.icon : '💪'}</p>
                    <p className="text-5xl font-display font-bold tabular-nums leading-none mt-1">
                      <CountUp value={score} format={(n) => String(Math.round(n))} duration={900} />
                      <span className="text-xl text-white/70">/{qs.length}</span>
                    </p>
                  </div>
                </Ring>
                <div className="flex justify-center gap-2 text-4xl" aria-label={`ได้ ${score >= 10 ? 3 : score >= 9 ? 2 : score >= PASS_SCORE ? 1 : 0} ดาว`}>
                  {[1, 2, 3].map((n) => {
                    const earned = (score >= 10 ? 3 : score >= 9 ? 2 : score >= PASS_SCORE ? 1 : 0) >= n
                    return (
                      <span
                        key={n}
                        className={earned ? 'quiz-star' : 'opacity-30 grayscale'}
                        style={earned ? { animationDelay: `${0.5 + n * 0.25}s` } : undefined}
                        aria-hidden="true"
                      >
                        ⭐
                      </span>
                    )
                  })}
                </div>
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
                <button type="button" onClick={() => setScreen('critique')} className="btn-shimmer w-full rounded-full bg-gradient-to-r from-amber-500 to-amber-700 text-white font-bold py-3.5 shadow-lg active:scale-95">
                  📜 ดูคำวิจารณ์ & รับเกียรติบัตร →
                </button>
              )}
              {passedAll && (
                <Link to="/menu" className="block text-center w-full rounded-full bg-white border-2 border-amber-400 text-amber-900 font-semibold py-3 active:scale-95">
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
