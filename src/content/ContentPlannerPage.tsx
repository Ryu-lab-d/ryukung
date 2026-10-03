import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useContentItems } from './useContentItems'
import { updateContentStatus } from './api'
import { PLATFORMS, PLATFORM_ICON, CONTENT_STAGES, STATUS_LABEL, STATUS_ICON, STATUS_COLOR, nextContentStatus } from './contentMeta'
import type { ContentPlatform, ContentStatus } from './contentMeta'
import { QuickAddContentModal } from './QuickAddContentModal'
import { PageHero } from '../layout/PageHero'

function formatPostDate(d: string | null): string {
  if (!d) return 'ยังไม่กำหนดวันโพสต์'
  return new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ContentPlannerPage() {
  const { items, loading, reload } = useContentItems()
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState<ContentPlatform | null>(null)
  const [status, setStatus] = useState<ContentStatus | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter((it) => {
      const matchesSearch = !q || it.title.toLowerCase().includes(q) || (it.idea ?? '').toLowerCase().includes(q)
      const matchesPlatform = !platform || it.platforms.includes(platform)
      const matchesStatus = !status || it.status === status
      return matchesSearch && matchesPlatform && matchesStatus
    })
  }, [items, search, platform, status])

  async function handleAdvance(id: string, current: string) {
    const next = nextContentStatus(current)
    if (!next) return
    setAdvancingId(id)
    await updateContentStatus(id, next)
    await reload()
    setAdvancingId(null)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2.5 text-stone-400">
        <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
        กำลังโหลด...
      </div>
    )
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-8">
        <PageHero icon="🎬" title="แผนคอนเทนต์" subtitle={`${items.length} รายการทั้งหมด`}>
          <Link to="/content/stats">📊 สถิติ</Link>
          <button type="button" onClick={() => setShowQuickAdd(true)}>+ เพิ่มไอเดีย</button>
        </PageHero>

        <input
          placeholder="🔍 ค้นหาชื่อคอนเทนต์หรือไอเดีย"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
        />

        <div className="rounded-2xl bg-white border border-stone-200 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)] p-3.5 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-400">แพลตฟอร์ม</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPlatform(null)}
                className={'rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' + (!platform ? 'bg-stone-900 text-white shadow-sm' : 'bg-stone-100 text-stone-700')}
              >
                ทุกแพลตฟอร์ม
              </button>
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  className={'rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' + (platform === p.value ? 'bg-stone-900 text-white shadow-sm' : 'bg-stone-100 text-stone-700')}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-stone-400">สถานะ</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setStatus(null)}
                className={'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ' + (!status ? 'bg-stone-900 text-white border-stone-900 shadow-sm' : 'bg-white text-stone-600 border-stone-200')}
              >
                ทุกสถานะ
              </button>
              {CONTENT_STAGES.map((s) => (
                <button
                  key={s.status}
                  type="button"
                  onClick={() => setStatus(s.status)}
                  className={'rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ' + (status === s.status ? 'bg-stone-900 text-white border-stone-900 shadow-sm' : 'bg-white text-stone-600 border-stone-200')}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
            <p className="text-3xl mb-1.5">💡</p>
            <p className="text-sm text-stone-400">ยังไม่มีคอนเทนต์ที่ตรงเงื่อนไข ลองกด "+ เพิ่มไอเดีย" เพื่อเริ่มวางแผน</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((it) => {
              const next = nextContentStatus(it.status)
              return (
                <div
                  key={it.id}
                  className="rounded-2xl border border-stone-200 bg-white p-3.5 space-y-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)]"
                >
                  <Link to={`/content/${it.id}/edit`} className="block space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-stone-900">{it.title}</p>
                      <span className={'shrink-0 text-xs font-medium rounded-full px-2 py-0.5 border ' + STATUS_COLOR[it.status]}>
                        {STATUS_ICON[it.status]} {STATUS_LABEL[it.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span>{it.platforms.map((p) => PLATFORM_ICON[p]).join(' ') || '—'}</span>
                      <span>·</span>
                      <span>{formatPostDate(it.post_date)}</span>
                    </div>
                    {it.idea && <p className="text-sm text-stone-600 line-clamp-2">{it.idea}</p>}
                  </Link>
                  {next && (
                    <button
                      type="button"
                      onClick={() => void handleAdvance(it.id, it.status)}
                      disabled={advancingId === it.id}
                      className="w-full rounded-xl bg-stone-100 text-stone-700 text-xs font-medium py-2.5 disabled:opacity-50"
                    >
                      {advancingId === it.id ? 'กำลังอัปเดต...' : `▶ ขั้นต่อไป: ${STATUS_ICON[next]} ${STATUS_LABEL[next]}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {showQuickAdd && (
          <QuickAddContentModal
            onClose={() => setShowQuickAdd(false)}
            onSaved={() => {
              setShowQuickAdd(false)
              void reload()
            }}
          />
        )}
      </div>
    </div>
  )
}
