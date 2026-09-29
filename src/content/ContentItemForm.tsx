import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContentItem } from './useContentItems'
import { saveContentItem, deleteContentItem } from './api'
import { PLATFORMS, CONTENT_STAGES } from './contentMeta'
import type { ContentPlatform, ContentStatus } from './contentMeta'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { SuccessOverlay } from '../lib/SuccessOverlay'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

type ContentDraft = {
  title: string
  platforms: ContentPlatform[]
  status: ContentStatus
  idea: string
  hook: string
  goal: string
  caption: string
  hashtags: string
  editingStyle: string
  referenceUrl: string
  note: string
  postDate: string
}

export function ContentItemForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { item, loading } = useContentItem(id ?? null)

  const draftKey = `content-form:${id ?? 'new'}`
  const [draft] = useState(() => loadFormDraft<ContentDraft>(draftKey))

  const [title, setTitle] = useState(draft?.title ?? '')
  const [platforms, setPlatforms] = useState<ContentPlatform[]>(draft?.platforms ?? [])
  const [status, setStatus] = useState<ContentStatus>(draft?.status ?? 'idea')
  const [idea, setIdea] = useState(draft?.idea ?? '')
  const [hook, setHook] = useState(draft?.hook ?? '')
  const [goal, setGoal] = useState(draft?.goal ?? '')
  const [caption, setCaption] = useState(draft?.caption ?? '')
  const [hashtags, setHashtags] = useState(draft?.hashtags ?? '')
  const [editingStyle, setEditingStyle] = useState(draft?.editingStyle ?? '')
  const [referenceUrl, setReferenceUrl] = useState(draft?.referenceUrl ?? '')
  const [note, setNote] = useState(draft?.note ?? '')
  const [postDate, setPostDate] = useState(draft?.postDate ?? '')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (!item || draft) return
    setTitle(item.title)
    setPlatforms(item.platforms)
    setStatus(item.status)
    setIdea(item.idea ?? '')
    setHook(item.hook ?? '')
    setGoal(item.goal ?? '')
    setCaption(item.caption ?? '')
    setHashtags(item.hashtags ?? '')
    setEditingStyle(item.editing_style ?? '')
    setReferenceUrl(item.reference_url ?? '')
    setNote(item.note ?? '')
    setPostDate(item.post_date ?? '')
  }, [item, draft])

  useFormDraft(draftKey, {
    title, platforms, status, idea, hook, goal, caption, hashtags, editingStyle, referenceUrl, note, postDate,
  })

  function togglePlatform(p: ContentPlatform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  async function handleCopyHashtags() {
    if (!hashtags) return
    await navigator.clipboard.writeText(hashtags)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('กรุณาใส่ชื่อคอนเทนต์')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await saveContentItem(id ?? null, {
      title: title.trim(),
      platforms,
      status,
      idea: idea.trim() || null,
      hook: hook.trim() || null,
      goal: goal.trim() || null,
      caption: caption.trim() || null,
      hashtags: hashtags.trim() || null,
      editing_style: editingStyle.trim() || null,
      reference_url: referenceUrl.trim() || null,
      note: note.trim() || null,
      post_date: postDate || null,
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    clearFormDraft(draftKey)
    setShowSuccess(true)
  }

  async function handleDelete() {
    if (!id) return
    setShowDeleteConfirm(false)
    setDeleting(true)
    const { error: deleteError } = await deleteContentItem(id)
    setDeleting(false)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    navigate('/content')
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2.5 text-stone-400">
        <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
        กำลังโหลด...
      </div>
    )
  }

  const inputClass = 'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400'
  const cardClass = 'rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)] p-4 space-y-3.5'

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{id ? 'แก้ไขคอนเทนต์' : 'เพิ่มไอเดียใหม่'}</h1>
          <p className="text-sm text-stone-500 mt-0.5">กรอกชื่อ+แพลตฟอร์มก่อนก็ได้ ส่วนอื่นค่อยเติมทีหลัง</p>
        </div>

        <section className={cardClass}>
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-stone-100 grid place-items-center text-sm shrink-0">📌</span>
            ข้อมูลพื้นฐาน
          </h2>
          <div className="space-y-1">
            <label htmlFor="content-title" className="text-xs font-medium text-stone-500">ชื่อคอนเทนต์</label>
            <input
              id="content-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ขนมปังใหม่ประจำเดือน"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-500">แพลตฟอร์ม</p>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
                    (platforms.includes(p.value) ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
                  }
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-500">สถานะ</p>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_STAGES.map((s) => (
                <button
                  key={s.status}
                  type="button"
                  onClick={() => setStatus(s.status)}
                  className={
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors ' +
                    (status === s.status ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
                  }
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="content-post-date" className="text-xs font-medium text-stone-500">วันที่วางแผนโพสต์ (ไม่บังคับ)</label>
            <input
              id="content-post-date"
              type="date"
              value={postDate}
              onChange={(e) => setPostDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-50 grid place-items-center text-sm shrink-0">💡</span>
            ไอเดียและสคริปต์
          </h2>
          <div className="space-y-1">
            <label htmlFor="content-idea" className="text-xs font-medium text-stone-500">ไอเดีย/คอนเซปต์</label>
            <textarea
              id="content-idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={3}
              placeholder="อยากสื่ออะไร ทำไมถึงน่าสนใจ"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="content-hook" className="text-xs font-medium text-stone-500">Hook (ประโยคเปิดดึงความสนใจ)</label>
            <textarea
              id="content-hook"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              rows={2}
              placeholder="เช่น 3 วินาทีแรกที่จะทำให้คนหยุดเลื่อน..."
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="content-goal" className="text-xs font-medium text-stone-500">เป้าหมายการโพสต์ครั้งนี้</label>
            <input
              id="content-goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="เช่น ขายของ, สร้าง engagement, ประกาศโปรโมชั่น"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="content-caption" className="text-xs font-medium text-stone-500">บทพูด/แคปชั่น</label>
            <textarea
              id="content-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="สคริปต์ที่จะพูด หรือแคปชั่นที่จะลงพร้อมโพสต์"
              className={inputClass}
            />
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-50 grid place-items-center text-sm shrink-0">🎬</span>
            รายละเอียดเพิ่มเติม
          </h2>
          <div className="space-y-1">
            <label htmlFor="content-editing-style" className="text-xs font-medium text-stone-500">แนวการตัดต่อ</label>
            <input
              id="content-editing-style"
              type="text"
              value={editingStyle}
              onChange={(e) => setEditingStyle(e.target.value)}
              placeholder="เช่น ตลก, ให้ความรู้, ASMR, ก่อน-หลัง"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="content-hashtags" className="text-xs font-medium text-stone-500">แฮชแท็ก</label>
              {hashtags && (
                <button
                  type="button"
                  onClick={() => void handleCopyHashtags()}
                  className="text-xs font-medium rounded-full bg-stone-100 text-stone-600 px-2.5 py-1"
                >
                  {copied ? 'คัดลอกแล้ว ✓' : '📋 คัดลอก'}
                </button>
              )}
            </div>
            <textarea
              id="content-hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              rows={2}
              placeholder="#ryukungbakery #ขนมปังโฮมเมด"
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="content-reference" className="text-xs font-medium text-stone-500">ลิงก์อ้างอิง/ไอเดียต้นแบบ (ไม่บังคับ)</label>
            <input
              id="content-reference"
              type="text"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="content-note" className="text-xs font-medium text-stone-500">หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              id="content-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { clearFormDraft(draftKey); navigate('/content') }}
            className="flex-1 rounded-xl bg-white border border-stone-300 text-stone-700 py-2.5 font-medium"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-xl bg-stone-900 text-white py-2.5 font-medium shadow-[0_6px_16px_-4px_rgb(0_0_0_/_0.3)] disabled:opacity-50 disabled:shadow-none"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>

        {id && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="w-full rounded-xl border border-red-200 bg-red-50 text-red-700 font-medium py-2.5 disabled:opacity-50"
          >
            {deleting ? 'กำลังลบ...' : '🗑️ ลบคอนเทนต์นี้'}
          </button>
        )}

        {showDeleteConfirm && (
          <ConfirmDialog
            title="แน่ใจนะว่าจะลบคอนเทนต์นี้?"
            message="ลบแล้วกู้คืนไม่ได้"
            confirmLabel="ลบถาวร"
            cancelLabel="ไม่ลบ"
            busy={deleting}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}

        {showSuccess && (
          <SuccessOverlay message="คอนเทนต์ถูกบันทึกแล้ว" durationMs={1200} onDone={() => navigate('/content')} />
        )}
      </div>
    </div>
  )
}
