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
        <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl animate-toast-pop" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-amber-50 grid place-items-center text-base shrink-0">💡</span>
            เพิ่มไอเดียใหม่
          </h2>

          <div className="space-y-1">
            <label htmlFor="quick-add-title" className="text-xs font-medium text-stone-500">ชื่อคอนเทนต์</label>
            <input
              id="quick-add-title"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ขนมปังใหม่ประจำเดือน"
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-500">แพลตฟอร์ม (ไม่บังคับ)</p>
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

          <p className="text-xs text-stone-400">รายละเอียดอื่นๆ เช่น ไอเดีย, Hook, แคปชั่น เพิ่มทีหลังได้จากหน้าแก้ไข</p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white border border-stone-300 text-stone-700 py-2.5 font-medium">
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
