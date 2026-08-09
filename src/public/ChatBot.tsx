import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Linkify } from '../lib/Linkify'

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
}: {
  shopName: string
  faqs: Faq[]
  lineUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  const [greeted, setGreeted] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [botTyping, setBotTyping] = useState(false)
  const [input, setInput] = useState('')
  const [showNudge, setShowNudge] = useState(false)
  const nextId = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // เด้งข้อความชวนคุยขึ้นมาสักพักหลังโหลดหน้า เพราะปุ่มแชทลอยเฉยๆ ลูกค้ามักไม่สังเกตเห็น
  useEffect(() => {
    const showTimer = setTimeout(() => setShowNudge(true), 1200)
    const hideTimer = setTimeout(() => setShowNudge(false), 9000)
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer) }
  }, [])

  function pushBotMessage(text: string) {
    setBotTyping(true)
    setTimeout(() => {
      setBotTyping(false)
      nextId.current += 1
      setMessages((m) => [...m, { id: nextId.current, from: 'bot', text }])
    }, 700 + Math.random() * 500)
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
    const question = input.trim()
    if (!question) return
    nextId.current += 1
    setMessages((m) => [...m, { id: nextId.current, from: 'user', text: question }])
    setInput('')

    const answer = matchFaq(question, faqs)
    if (answer) {
      pushBotMessage(answer)
    } else {
      const lineText = lineUrl ? `ฝากแอดไลน์ร้านไว้ก่อนนะคะ: ${lineUrl}\n\n` : ''
      pushBotMessage(
        `ต้องขออภัยด้วยนะคะ น้องริวยังไม่สามารถช่วยตอบคำถามนี้ได้ แต่เดี๋ยวน้องประสานงานเจ้าหน้าที่ให้นะคะ 🙏\n\n${lineText}หากมีคำถามไหนที่ทางร้านสามารถตอบได้ ทางร้านจะตอบให้แน่นอนค่ะ`
      )
    }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, botTyping])

  if (!open) {
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
          className="relative rounded-full bg-stone-900 text-white w-14 h-14 grid place-items-center text-2xl shadow-lg"
        >
          <span className="absolute inset-0 rounded-full bg-stone-900 animate-chat-ring pointer-events-none" aria-hidden="true" />
          <span className="relative">💬</span>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-96 sm:h-[560px] sm:rounded-2xl bg-white shadow-xl z-40 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-stone-900 text-white sm:rounded-t-2xl shrink-0">
        <div>
          <p className="font-semibold text-sm">🥐 น้องริว</p>
          <p className="text-xs text-stone-300">{shopName}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="ปิดแชท" className="text-white text-2xl leading-none px-1">
          ×
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-stone-50">
        {messages.map((m) => (
          <div key={m.id} className={'flex ' + (m.from === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={
                'max-w-[80%] rounded-2xl px-3 py-2 text-sm ' +
                (m.from === 'user'
                  ? 'bg-stone-900 text-white rounded-br-sm'
                  : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm')
              }
            >
              {m.from === 'bot' ? <TypewriterText text={m.text} /> : m.text}
            </div>
          </div>
        ))}
        {botTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm">
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
          className="flex-1 rounded-full border border-stone-300 px-3.5 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="ส่งข้อความ"
          className="rounded-full bg-stone-900 text-white w-10 h-10 grid place-items-center disabled:opacity-40 shrink-0"
        >
          ➤
        </button>
      </form>
    </div>
  )
}
