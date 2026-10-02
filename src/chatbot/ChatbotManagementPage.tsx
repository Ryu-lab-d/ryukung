import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../settings/useSettings'
import { useUnansweredQuestions } from './useUnansweredQuestions'
import { ChatBot } from '../public/ChatBot'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { Toast } from '../lib/Toast'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

type Faq = { keywords: string[]; answer: string }
type ChatbotDraft = { faqs: Faq[]; lineUrl: string }

const DRAFT_KEY = 'chatbot-settings-form'

export function ChatbotManagementPage() {
  const { settings, loading, save } = useSettings()
  const { questions, loading: questionsLoading, remove: removeQuestion } = useUnansweredQuestions()
  const [draft] = useState(() => loadFormDraft<ChatbotDraft>(DRAFT_KEY))
  const [faqs, setFaqs] = useState<Faq[]>(draft?.faqs ?? [])
  const [lineUrl, setLineUrl] = useState(draft?.lineUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  useEffect(() => {
    if (settings && !draft) {
      setFaqs(settings.faqs)
      setLineUrl(settings.line_url ?? '')
    }
  }, [settings, draft])

  useFormDraft(DRAFT_KEY, { faqs, lineUrl })

  if (loading || !settings) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด...
        </div>
      </div>
    )
  }

  function updateFaq(index: number, patch: Partial<{ keywordsText: string; answer: string }>) {
    setFaqs((prev) => {
      const next = [...prev]
      const current = next[index]
      next[index] = {
        answer: patch.answer ?? current.answer,
        keywords:
          patch.keywordsText !== undefined
            ? patch.keywordsText.split(',').map((k) => k.trim()).filter(Boolean)
            : current.keywords,
      }
      return next
    })
  }

  function addFaq(prefillKeyword?: string) {
    setFaqs((prev) => [...prev, { keywords: prefillKeyword ? [prefillKeyword] : [], answer: '' }])
  }

  function removeFaq(index: number) {
    setFaqs((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setBusy(true)
    const { error } = await save({ faqs, line_url: lineUrl.trim() || null })
    setBusy(false)
    if (!error) clearFormDraft(DRAFT_KEY)
    setMessage(error ? 'บันทึกไม่สำเร็จ: ' + error.message : 'บันทึกแล้ว')
  }

  async function handleAddFromQuestion(questionId: string, questionText: string) {
    addFaq(questionText)
    await removeQuestion(questionId)
  }

  return (
    <div className="bg-stone-50 min-h-screen">
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-8">
      <div className="space-y-1">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
        >
          ← กลับหน้าตั้งค่า
        </Link>
        <h1 className="text-xl font-bold text-stone-900 pt-2">จัดการแชทบอทน้องริว</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-700">ทดสอบคุยกับบอท (มุมมองลูกค้า)</h2>
        <p className="text-xs text-stone-400">แก้ไขคำถาม/คำตอบด้านล่างแล้วลองพิมพ์คุยที่นี่ได้เลย ยังไม่ต้องกดบันทึกก่อนก็ทดสอบได้</p>
        <ChatBot shopName={settings.shop_name} faqs={faqs} lineUrl={lineUrl || null} mode="embedded" />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-700">คำถามที่ลูกค้าถามบ่อยแต่บอทตอบไม่ได้</h2>
        {questionsLoading ? (
          <div className="flex items-center justify-center gap-2.5 py-6 text-stone-400 text-sm">
            <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
            กำลังโหลด...
          </div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-stone-400 rounded-2xl bg-white border border-stone-200 p-5 text-center">ยังไม่มีคำถามที่ตอบไม่ได้ 🎉</p>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-stone-200 bg-white p-3.5 space-y-1.5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)]"
              >
                <p className="text-sm">{q.question_text}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-stone-400 shrink-0">
                    ถาม {q.asked_count} ครั้ง · ล่าสุด {new Date(q.last_asked_at).toLocaleDateString('th-TH')}
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleAddFromQuestion(q.id, q.question_text)}
                      className="text-xs rounded-full bg-stone-900 text-white px-3 py-1.5 font-medium"
                    >
                      + เพิ่มเป็น FAQ
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(q.id)}
                      className="text-xs rounded-full border border-stone-300 bg-white text-stone-600 px-3 py-1.5"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">คำถามที่พบบ่อย (น้องริวตอบให้อัตโนมัติ)</h2>
          <button
            type="button"
            onClick={() => addFaq()}
            className="text-xs rounded-full bg-stone-900 text-white px-3 py-1.5 font-medium shrink-0"
          >
            + เพิ่มคำถาม
          </button>
        </div>
        <p className="text-xs text-stone-400 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
          ✨ น้องริวตอบด้วย AI โดยอ่านเมนู/ราคาจริง ข้อมูลร้าน และคำถามที่พบบ่อยด้านล่างเป็นความรู้ — AI จะไม่เดาเรื่องที่ไม่มีข้อมูล
          (จะประสานเจ้าหน้าที่แทน และเก็บคำถามไว้ให้เพิ่ม FAQ) ถ้า AI ใช้ไม่ได้ ระบบจะกลับไปตอบด้วยคำสำคัญเหมือนเดิมอัตโนมัติ
        </p>
        <p className="text-xs text-stone-400">
          ใส่คำสำคัญได้หลายคำ/หลายรูปแบบต่อ 1 คำตอบ (คั่นด้วยจุลภาค) — เช่นลูกค้าอาจพิมพ์ "กี่วันถึง" หรือ "จัดส่งเมื่อไหร่"
          ความหมายเดียวกันแต่คนละคำ ใส่เป็นคำสำคัญไว้ทั้งคู่ บอทจะตอบเหมือนกันทั้งสองแบบ
        </p>
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="rounded-2xl border border-stone-200 bg-white p-3.5 space-y-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500">คำถามที่ {i + 1}</span>
              <button
                type="button"
                onClick={() => removeFaq(i)}
                className="text-xs rounded-full border border-red-300 bg-white text-red-600 px-3 py-1 font-medium"
              >
                ลบ
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-500">คำสำคัญ (คั่นด้วยจุลภาค — ใส่ได้หลายแบบ)</label>
              <input
                value={faq.keywords.join(', ')}
                onChange={(e) => updateFaq(i, { keywordsText: e.target.value })}
                placeholder="เช่น จัดส่ง, ส่งกี่วัน, กี่วันถึง, จัดส่งเมื่อไหร่"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-500">คำตอบ</label>
              <textarea
                value={faq.answer}
                onChange={(e) => updateFaq(i, { answer: e.target.value })}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}
        {faqs.length === 0 && (
          <p className="text-sm text-stone-400 rounded-2xl bg-white border border-stone-200 p-5 text-center">ยังไม่มีคำถามที่ตั้งไว้</p>
        )}
      </section>

      <section className="space-y-1">
        <label htmlFor="line_url" className="text-sm text-stone-600">ลิงก์ไลน์ร้าน (ใช้ตอนน้องริวตอบไม่ได้แล้วส่งต่อให้พนักงาน)</label>
        <input
          id="line_url"
          value={lineUrl}
          onChange={(e) => setLineUrl(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </section>

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSave()}
        className="w-full rounded-xl bg-stone-900 text-white px-4 py-2.5 font-medium disabled:opacity-50 shadow-[0_6px_16px_-4px_rgb(0_0_0_/_0.3)]"
      >
        {busy ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>

      {removeTarget && (
        <ConfirmDialog
          title="ลบคำถามนี้ออกจากรายการ?"
          confirmLabel="ลบ"
          cancelLabel="ไม่ลบ"
          onConfirm={() => { const id = removeTarget; setRemoveTarget(null); void removeQuestion(id) }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      {message && <Toast message={message} onDone={() => setMessage(null)} />}
    </div>
    </div>
  )
}
