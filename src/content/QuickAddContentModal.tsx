import { useState } from 'react'
import { saveContentItem } from './api'
import { PLATFORMS } from './contentMeta'
import type { ContentPlatform } from './contentMeta'
import { SuccessOverlay } from '../lib/SuccessOverlay'

/** ป็อปอัพเพิ่มไอเดียคอนเทนต์แบบเร็ว กรอกแค่ชื่อ+แพลตฟอร์ม (ไม่บังคับ) แล้วบันทึกได้เลย รายละเอียดอื่นๆ (Hook/แคปชั่น/แฮชแท็ก ฯลฯ) ค่อยเติมทีหลังจากหน้าแก้ไข */
export function QuickAddContentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [platforms, setPlatforms] = useState<ContentPlatform[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  function togglePlatform(p: ContentPlatform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('กรุณาใส่ชื่อคอนเทนต์')
      return
    }
    setSaving(true)
    setError(null)
    const { error: saveError } = await saveContentItem(null, {
      title: title.trim(),
      platforms,
      status: 'idea',
      idea: null,
      hook: null,
      goal: null,
      caption: null,
      hashtags: null,
      editing_style: null,
      reference_url: null,
      note: null,
      post_date: null,
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setShowSuccess(true)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade" onClick={onClose}>
        <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold">+ เพิ่มไอเดียใหม่</h2>

          <div className="space-y-1">
            <label htmlFor="quick-add-title" className="text-sm text-stone-600">ชื่อคอนเทนต์</label>
            <input
              id="quick-add-title"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ขนมปังใหม่ประจำเดือน"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm text-stone-600">แพลตฟอร์ม (ไม่บังคับ)</p>
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

          <p className="text-xs text-stone-400">รายละเอียดอื่นๆ เช่น ไอเดีย, Hook, แคปชั่น เพิ่มทีหลังได้จากหน้าแก้ไข</p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
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
        </div>
      </div>

      {showSuccess && (
        <SuccessOverlay
          message="คอนเทนต์ถูกบันทึกแล้ว"
          durationMs={1200}
          onDone={() => {
            setShowSuccess(false)
            onSaved()
          }}
        />
      )}
    </>
  )
}
