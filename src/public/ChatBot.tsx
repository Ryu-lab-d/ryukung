import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Linkify } from '../lib/Linkify'
import { supabase } from '../lib/supabase'
import { AmbientGlow } from './PublicSiteChrome'

/** คำถามแนะนำให้ลูกค้ากดถามได้ทันทีตอนเพิ่งเปิดแชท (ตัวคำถามล้วนๆ ไม่ใช่ข้อเท็จจริง — คำตอบมาจาก AI/FAQ ของร้าน) */
const SUGGESTIONS = ['เมนูมีอะไรบ้าง 🧁', 'ต้องสั่งล่วงหน้ากี่วัน', 'ยกเลิกออเดอร์ได้ไหม', 'ส่งไปรษณีย์กี่วัน']

type Faq = { keywords: string[]; answer: string }
type ChatMessage = { id: number; from: 'bot' | 'user'; text: string }

const FUZZY_THRESHOLD = 0.6
const MIN_FUZZY_KEYWORD_LEN = 3

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

/** วัดว่าข้อความสองอันมีตัวอักษรที่เรียงติดกัน (bigram) ซ้อนกันมากแค่ไหน — ทนต่อคำถามที่สลับลำดับคำ
 * เช่น "กี่วันส่ง" กับคำสำคัญ "ส่งกี่วัน" แม้ไม่ใช่คำเดียวกันเป๊ะแต่ก็ควรจับคู่ได้ */
function similarity(a: string, b: string): number {
  const A = bigrams(a)
  const B = bigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let overlap = 0
  for (const g of A) if (B.has(g)) overlap++
  return overlap / Math.min(A.size, B.size)
}

/**
 * จับคู่คำถามลูกค้ากับ FAQ ที่ร้านตั้งไว้ — ไม่ใช้ AI จริงจึงไม่มีค่าใช้จ่ายต่อครั้ง
 * คำสำคัญตรงตัวเป๊ะถือว่าคะแนนเต็มทันที ถ้าไม่ตรงเป๊ะจะลองเทียบความใกล้เคียงแบบสลับคำ/คำถามยาวกว่าเดิมได้
 * แต่ยังคุมเกณฑ์ไว้ไม่ให้ตอบมั่วตอนคำถามไม่เกี่ยวข้องเลย (fallback ไปหาแอดมินแทนดีกว่าตอบผิด)
 */
function matchFaq(question: string, faqs: Faq[]): string | null {
  const q = normalize(question)
  let best: { answer: string; score: number } | null = null
  for (const faq of faqs) {
    for (const raw of faq.keywords) {
      const k = normalize(raw)
      if (!k) continue
      const score = q.includes(k) ? 1 : k.length >= MIN_FUZZY_KEYWORD_LEN ? similarity(q, k) : 0
      if (score > (best?.score ?? 0)) best = { answer: faq.answer, score }
    }
  }
  return best && best.score >= FUZZY_THRESHOLD ? best.answer : null
}

/** ถามน้องริว AI ผ่าน Edge Function — คืน null เมื่อใช้ไม่ได้ทุกกรณี (ให้ผู้เรียกถอยไปใช้ระบบจับคำเดิม)
 * faqsOverride ส่งเฉพาะโหมดทดสอบของร้าน (เซิร์ฟเวอร์รับเฉพาะพนักงานที่ล็อกอินอยู่) */
async function askAi(
  history: { role: string; content: string }[],
  faqsOverride?: Faq[]
): Promise<{ answer: string; canAnswer: boolean } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('chat-assistant', {
      body: { messages: history, ...(faqsOverride ? { faqs_override: faqsOverride } : {}) },
    })
    if (error || !data || typeof data.answer !== 'string' || !data.answer.trim()) return null
    return { answer: data.answer, canAnswer: data.can_answer !== false }
  } catch {
    return null
  }
}

function TypingDots() {
  return (
    <div className="flex gap-1 px-3 py-3">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
    </div>
  )
}

/** เผยข้อความทีละนิดให้ดูเหมือนกำลังพิมพ์อยู่จริงๆ แทนที่จะโผล่มาทั้งก้อนเดียว */
function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    setShown('')
    let i = 0
    const id = setInterval(() => {
      i += 2
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, 18)
    return () => clearInterval(id)
  }, [text])
  return (
    <span className="whitespace-pre-line">
      <Linkify text={shown} />
    </span>
  )
}

export function ChatBot({
  shopName,
  faqs,
  lineUrl,
  mode = 'floating',
}: {
  shopName: string
  faqs: Faq[]
  lineUrl: string | null
  /** 'embedded' = ใช้ในหน้าจัดการแชทบอทของร้าน (เจ้าของร้านลองคุยเทส) เปิดค้างในหน้าเสมอ ไม่ลอย ไม่นับเป็นคำถามลูกค้าจริง */
  mode?: 'floating' | 'embedded'
}) {
  const embedded = mode === 'embedded'
  const [open, setOpen] = useState(embedded)
  const [greeted, setGreeted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [botTyping, setBotTyping] = useState(false)
  const [input, setInput] = useState('')
  const [showNudge, setShowNudge] = useState(false)
  const nextId = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // เด้งข้อความชวนคุยขึ้นมาสักพักหลังโหลดหน้า เพราะปุ่มแชทลอยเฉยๆ ลูกค้ามักไม่สังเกตเห็น (โหมดฝังในหน้าไม่ต้องมี)
  useEffect(() => {
    if (embedded) return
    const showTimer = setTimeout(() => setShowNudge(true), 1200)
    const hideTimer = setTimeout(() => setShowNudge(false), 9000)
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer) }
  }, [embedded])

  // โหมดฝังในหน้า (ทดสอบจากฝั่งร้าน) เปิดค้างอยู่แล้วตั้งแต่แรก ต้องทักทายเองตั้งแต่เมานท์
  useEffect(() => {
    if (!embedded || greeted) return
    setGreeted(true)
    pushBotMessage(`สวัสดีค่ะ หนูเป็นน้องริว จากร้าน ${shopName} ค่ะ มีปัญหาหรือคำถามอะไร สอบถามได้เลยนะคะ 😊`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded])

  /** instant = true ตอนคำตอบมาจาก AI (รอเครือข่ายมาแล้ว ไม่ต้องหน่วงเทียมซ้ำ) */
  function pushBotMessage(text: string, instant = false) {
    const add = () => {
      setBotTyping(false)
      nextId.current += 1
      setMessages((m) => [...m, { id: nextId.current, from: 'bot', text }])
    }
    if (instant) {
      add()
      return
    }
    setBotTyping(true)
    setTimeout(add, 700 + Math.random() * 500)
  }

  function handleOpen() {
    setOpen(true)
    setShowNudge(false)
    if (!greeted) {
      setGreeted(true)
      pushBotMessage(`สวัสดีค่ะ หนูเป็นน้องริว จากร้าน ${shopName} ค่ะ มีปัญหาหรือคำถามอะไร สอบถามได้เลยนะคะ 😊`)
    }
  }

  function handleSend(e: FormEvent) {
    e.preventDefault()
    void submitQuestion(input.trim())
  }

  async function submitQuestion(question: string) {
    if (!question || botTyping) return
    const history = [
      ...messages.map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text })),
      { role: 'user', content: question },
    ]
    nextId.current += 1
    setMessages((m) => [...m, { id: nextId.current, from: 'user', text: question }])
    setInput('')
    setBotTyping(true)

    // ถามน้องริว AI ก่อน (Edge Function chat-assistant อ่านเมนู/FAQ จริงของร้านมาตอบ) — ถ้า AI ใช้ไม่ได้ (ยังไม่ตั้งคีย์,
    // โควตาเต็ม, เน็ตหลุด) ถอยกลับไปใช้ระบบจับคำ FAQ แบบเดิมด้านล่างแทน แชทไม่ตายและไม่โชว์ error ดิบให้ลูกค้าเห็น
    const ai = await askAi(history, embedded ? faqs : undefined)
    if (ai) {
      const needsLine = !ai.canAnswer && lineUrl && !ai.answer.includes(lineUrl)
      pushBotMessage(needsLine ? `${ai.answer}\n\nแอดไลน์ร้าน: ${lineUrl}` : ai.answer, true)
      return
    }

    const answer = matchFaq(question, faqs)
    if (answer) {
      pushBotMessage(answer)
    } else {
      const lineText = lineUrl ? `ฝากแอดไลน์ร้านไว้ก่อนนะคะ: ${lineUrl}\n\n` : ''
      pushBotMessage(
        `ต้องขออภัยด้วยนะคะ น้องริวยังไม่สามารถช่วยตอบคำถามนี้ได้ แต่เดี๋ยวน้องประสานงานเจ้าหน้าที่ให้นะคะ 🙏\n\n${lineText}หากมีคำถามไหนที่ทางร้านสามารถตอบได้ ทางร้านจะตอบให้แน่นอนค่ะ`
      )
      // เก็บเฉพาะข้อความคำถามที่ตอบไม่ได้ไว้ให้ร้านดูว่าควรเพิ่ม FAQ อะไรบ้าง — ข้ามตอนเจ้าของร้านทดสอบเองในหน้าจัดการ
      if (!embedded) void supabase.rpc('log_unanswered_chat_question', { p_question: question })
    }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, botTyping])

  if (!open && !embedded) {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {showNudge && (
          <div className="relative bg-white text-stone-800 text-sm rounded-2xl rounded-br-sm shadow-lg pl-3.5 pr-7 py-2.5 max-w-[190px] animate-chat-nudge">
            <button
              type="button"
              onClick={() => setShowNudge(false)}
              aria-label="ปิดข้อความแนะนำ"
              className="absolute top-1 right-1 w-5 h-5 rounded-full text-stone-400 text-xs grid place-items-center hover:bg-stone-100"
            >
              ×
            </button>
            มีคำถามเหรอคะ? ถามน้องริวได้เลยนะ 😊
          </div>
        )}
        <button
          type="button"
          onClick={handleOpen}
          aria-label="คุยกับน้องริว"
          className="relative rounded-full bg-brand-shader text-white w-14 h-14 grid place-items-center text-2xl shadow-[0_12px_28px_-8px_rgb(51_32_14_/_0.6)] transition-transform duration-200 hover:scale-110 active:scale-95"
        >
          <span className="absolute inset-0 rounded-full bg-amber-700 animate-chat-ring pointer-events-none" aria-hidden="true" />
          <span className="relative">💬</span>
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={
        embedded
          ? 'w-full h-[560px] rounded-2xl border border-stone-200 bg-white shadow-sm flex flex-col'
          : 'fixed inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-96 sm:h-[560px] sm:rounded-2xl bg-white shadow-xl z-40 flex flex-col'
      }
    >
      <div className="relative overflow-hidden flex items-center justify-between px-4 py-3.5 bg-brand-shader text-white rounded-t-2xl shrink-0">
        <AmbientGlow />
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur border border-white/30 grid place-items-center text-xl">🥐</div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              น้องริว
              <span className="ml-1.5 align-middle text-[10px] rounded-full bg-white/20 px-1.5 py-0.5 font-medium">✨ AI</span>
            </p>
            <p className="text-xs text-white/75">{embedded ? 'ทดสอบคุยกับบอท (มุมมองลูกค้า)' : `${shopName} · ออนไลน์`}</p>
          </div>
        </div>
        {!embedded && (
          <button type="button" onClick={() => setOpen(false)} aria-label="ปิดแชท" className="relative z-10 text-white text-2xl leading-none px-1 transition-transform active:scale-90">
            ×
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-stone-50">
        {messages.map((m) => (
          <div key={m.id} className={'flex animate-chat-nudge ' + (m.from === 'user' ? 'justify-end' : 'justify-start items-end gap-2')}>
            {m.from === 'bot' && (
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-stone-100 border border-amber-200 grid place-items-center text-sm shrink-0" aria-hidden="true">
                🥐
              </span>
            )}
            <div
              className={
                'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ' +
                (m.from === 'user'
                  ? 'bg-gradient-to-br from-stone-800 to-stone-900 text-white rounded-br-sm'
                  : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm')
              }
            >
              {m.from === 'bot' ? <TypewriterText text={m.text} /> : m.text}
            </div>
          </div>
        ))}
        {messages.length > 0 && messages.length <= 1 && !botTyping && (
          <div className="flex flex-wrap gap-2 pl-9 pt-1">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => void submitQuestion(s)}
                className="animate-timeline-in rounded-full border border-amber-300 bg-white text-amber-900 text-xs font-medium px-3 py-1.5 shadow-sm transition-all duration-200 hover:bg-amber-50 hover:-translate-y-0.5 active:scale-95"
                style={{ animationDelay: `${0.9 + i * 0.1}s` }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {botTyping && (
          <div className="flex justify-start items-end gap-2 animate-chat-nudge">
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-stone-100 border border-amber-200 grid place-items-center text-sm shrink-0" aria-hidden="true">
              🥐
            </span>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-stone-100 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="พิมพ์คำถาม..."
          className="flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-600/60"
        />
        <button
          type="submit"
          disabled={!input.trim() || botTyping}
          aria-label="ส่งข้อความ"
          className="rounded-full bg-brand-shader text-white w-10 h-10 grid place-items-center shadow-md transition-transform active:scale-90 disabled:opacity-40 shrink-0"
        >
          ➤
        </button>
      </form>
    </div>
  )
}
