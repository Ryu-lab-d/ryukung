import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { Toast } from '../lib/Toast'

/** ส่วนลบข้อมูลแบบเลือกได้ ใช้ซ้ำได้ทุกหมวดในหน้าจัดการพื้นที่จัดเก็บ (ออเดอร์ ร่างค้าง วันหยุดเก่า ฯลฯ) */
export function CleanupSection<T extends { id: string }>({
  title,
  description,
  items,
  loading,
  renderItem,
  onDeleteMany,
  confirmMessage,
  emptyMessage,
}: {
  title: string
  description?: ReactNode
  items: T[]
  loading: boolean
  renderItem: (item: T) => ReactNode
  onDeleteMany: (ids: string[]) => Promise<{ errors: string[] }>
  confirmMessage: (count: number) => string
  emptyMessage: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmTarget, setConfirmTarget] = useState<'selected' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))))
  }

  async function handleConfirmedDelete() {
    const ids = confirmTarget === 'all' ? items.map((i) => i.id) : Array.from(selected)
    setConfirmTarget(null)
    setDeleting(true)
    const { errors } = await onDeleteMany(ids)
    setDeleting(false)
    setSelected(new Set())
    setMessage(errors.length > 0 ? `ลบไม่สำเร็จ ${errors.length} รายการ` : `ลบเรียบร้อย ${ids.length} รายการ`)
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-stone-500">{title} ({items.length})</h2>
      {description && <p className="text-xs text-stone-400">{description}</p>}

      {loading ? (
        <p className="text-sm text-stone-400">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-stone-400 rounded-lg border border-stone-200 p-3 text-center">{emptyMessage}</p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.size === items.length} onChange={toggleAll} />
              เลือกทั้งหมด
            </label>
            <button
              type="button"
              disabled={selected.size === 0 || deleting}
              onClick={() => setConfirmTarget('selected')}
              className="rounded-lg bg-red-600 text-white text-xs px-3 py-1.5 font-medium disabled:opacity-40"
            >
              🗑️ ลบที่เลือก ({selected.size})
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <label key={item.id} className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 cursor-pointer">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                <div className="flex-1 min-w-0">{renderItem(item)}</div>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmTarget('all')}
            className="w-full rounded-lg border-2 border-red-300 text-red-700 font-medium py-2 text-sm disabled:opacity-40"
          >
            🗑️ ลบทั้งหมด ({items.length} รายการ)
          </button>
        </>
      )}

      {confirmTarget && (
        <ConfirmDialog
          title="แน่ใจนะว่าจะลบ?"
          message={confirmMessage(confirmTarget === 'all' ? items.length : selected.size)}
          confirmLabel="ลบถาวร"
          cancelLabel="ไม่ลบ"
          busy={deleting}
          onConfirm={handleConfirmedDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {message && <Toast message={message} onDone={() => setMessage(null)} />}
    </section>
  )
}
