import { useState } from 'react'
import { STAFF_PAGES } from './pages'
import type { StaffMember } from './useStaffMembers'
import { SuccessOverlay } from '../lib/SuccessOverlay'

export function StaffPermissionsModal({
  member,
  onClose,
  onSave,
}: {
  member: StaffMember
  onClose: () => void
  onSave: (id: string, pages: string[]) => Promise<{ error: { message: string } | null }>
}) {
  const [pages, setPages] = useState<string[]>(member.allowed_pages)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggle(key: string) {
    setPages((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  async function handleSave() {
    setBusy(true)
    const { error } = await onSave(member.id, pages)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setSaved(true)
  }

  if (saved) return <SuccessOverlay message="บันทึกสิทธิ์แล้ว" onDone={onClose} />

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 animate-toast-pop" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold">สิทธิ์การเข้าถึง</h2>
          <p className="text-sm text-stone-500">{member.display_name ?? member.email}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPages(STAFF_PAGES.map((p) => p.key))}
            className="text-xs rounded-lg bg-stone-100 text-stone-700 px-2.5 py-1.5 font-medium"
          >
            เลือกทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => setPages([])}
            className="text-xs rounded-lg bg-stone-100 text-stone-700 px-2.5 py-1.5 font-medium"
          >
            ไม่เลือกเลย
          </button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {STAFF_PAGES.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={pages.includes(p.key)} onChange={() => toggle(p.key)} className="w-4 h-4" />
              {p.label}
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            className="flex-1 rounded-lg bg-stone-900 text-white py-2.5 font-medium disabled:opacity-50"
          >
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}
