import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContentItem } from './useContentItems'
import { saveContentItem, deleteContentItem } from './api'
import { PLATFORMS, CONTENT_STAGES } from './contentMeta'
import type { ContentPlatform, ContentStatus } from './contentMeta'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { SuccessOverlay } from '../lib/SuccessOverlay'

export function ContentItemForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { item, loading } = useContentItem(id ?? null)

  const [title, setTitle] = useState('')
  const [platforms, setPlatforms] = useState<ContentPlatform[]>([])
  const [status, setStatus] = useState<ContentStatus>('idea')
  const [idea, setIdea] = useState('')
  const [hook, setHook] = useState('')
  const [goal, setGoal] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [editingStyle, setEditingStyle] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [note, setNote] = useState('')
  const [postDate, setPostDate] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (!item) return
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
  }, [item])

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

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">
      <h1 className="text-lg font-semibold">{id ? 'แก้ไขคอนเทนต์' : 'เพิ่มไอเดียใหม่'}</h1>

      <div className="space-y-1">
        <label htmlFor="content-title" className="text-sm text-stone-600">ชื่อคอนเทนต์</label>
        <input
          id="content-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น ขนมปังใหม่ประจำเดือน"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm text-stone-600">แพลตฟอร์ม</p>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => togglePlatform(p.value)}
              className={
                'rounded-full px-3 py-1.5 text-sm border-2 ' +
                (platforms.includes(p.value) ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600')
              }
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-stone-600">สถานะ</p>
        <div className="flex flex-wrap gap-1.5">
          {CONTENT_STAGES.map((s) => (
            <button
              key={s.status}
              type="button"
              onClick={() => setStatus(s.status)}
              className={
                'rounded-full px-3 py-1.5 text-xs font-medium border-2 ' +
                (status === s.status ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600')
              }
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="content-post-date" className="text-sm text-stone-600">วันที่วางแผนโพสต์ (ไม่บังคับ)</label>
        <input
          id="content-post-date"
          type="date"
          value={postDate}
          onChange={(e) => setPostDate(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content-idea" className="text-sm text-stone-600">ไอเดีย/คอนเซปต์</label>
        <textarea
          id="content-idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={3}
          placeholder="อยากสื่ออะไร ทำไมถึงน่าสนใจ"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content-hook" className="text-sm text-stone-600">Hook (ประโยคเปิดดึงความสนใจ)</label>
        <textarea
          id="content-hook"
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          rows={2}
          placeholder="เช่น 3 วินาทีแรกที่จะทำให้คนหยุดเลื่อน..."
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content-goal" className="text-sm text-stone-600">เป้าหมายการโพสต์ครั้งนี้</label>
        <input
          id="content-goal"
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="เช่น ขายของ, สร้าง engagement, ประกาศโปรโมชั่น"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content-caption" className="text-sm text-stone-600">บทพูด/แคปชั่น</label>
        <textarea
          id="content-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          placeholder="สคริปต์ที่จะพูด หรือแคปชั่นที่จะลงพร้อมโพสต์"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content-editing-style" className="text-sm text-stone-600">แนวการตัดต่อ</label>
        <input
          id="content-editing-style"
          type="text"
          value={editingStyle}
          onChange={(e) => setEditingStyle(e.target.value)}
          placeholder="เช่น ตลก, ให้ความรู้, ASMR, ก่อน-หลัง"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="content-hashtags" className="text-sm text-stone-600">แฮชแท็ก</label>
          {hashtags && (
            <button type="button" onClick={() => void handleCopyHashtags()} className="text-xs text-stone-500 underline">
              {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}
            </button>
          )}
        </div>
        <textarea
          id="content-hashtags"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          rows={2}
          placeholder="#ryukungbakery #ขนมปังโฮมเมด"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content-reference" className="text-sm text-stone-600">ลิงก์อ้างอิง/ไอเดียต้นแบบ (ไม่บังคับ)</label>
        <input
          id="content-reference"
          type="text"
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content-note" className="text-sm text-stone-600">หมายเหตุ (ไม่บังคับ)</label>
        <textarea
          id="content-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => navigate('/content')} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>

      {id && (
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="w-full rounded-lg border-2 border-red-300 text-red-700 font-medium py-2.5 disabled:opacity-50"
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
  )
}
