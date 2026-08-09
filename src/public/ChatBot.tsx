import { useEffect, useRef, useState, type FormEvent } from 'react'

type Faq = { keywords: string[]; answer: string }
type ChatMessage = { id: number; from: 'bot' | 'user'; text: string }

/** จับคู่คำถามลูกค้ากับ FAQ ที่ร้านตั้งไว้แบบง่ายๆ (คำสำคัญตรงกันก็ตอบ) ไม่ใช้ AI จริงจึงไม่มีค่าใช้จ่ายต่อครั้ง */
function matchFaq(question: string, faqs: Faq[]): string | null {
  const q = question.toLowerCase()
  for (const faq of faqs) {
    if (faq.keywords.some((k) => k.trim() && q.includes(k.trim().toLowerCase()))) {
      return faq.answer
    }
  }
  return null
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
  return <span className="whitespace-pre-line">{shown}</span>
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
  const nextId = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

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
      <button
        type="button"
        onClick={handleOpen}
        aria-label="คุยกับน้องริว"
        className="fixed bottom-5 right-5 rounded-full bg-stone-900 text-white w-14 h-14 grid place-items-center text-2xl shadow-lg z-40"
      >
        💬
      </button>
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
