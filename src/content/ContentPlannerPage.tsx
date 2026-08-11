import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useContentItems } from './useContentItems'
import { updateContentStatus } from './api'
import { PLATFORMS, PLATFORM_ICON, CONTENT_STAGES, STATUS_LABEL, STATUS_ICON, STATUS_COLOR, nextContentStatus } from './contentMeta'
import type { ContentPlatform, ContentStatus } from './contentMeta'

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

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">📋 แผนคอนเทนต์</h1>
        <Link to="/content/new" className="rounded-lg bg-stone-900 text-white text-sm font-medium px-3.5 py-2">
          + เพิ่มไอเดียใหม่
        </Link>
      </div>

      <input
        placeholder="ค้นหาชื่อคอนเทนต์หรือไอเดีย"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setPlatform(null)}
          className={'rounded-full px-3 py-1.5 text-sm ' + (!platform ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700')}
        >
          ทุกแพลตฟอร์ม
        </button>
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPlatform(p.value)}
            className={'rounded-full px-3 py-1.5 text-sm ' + (platform === p.value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700')}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setStatus(null)}
          className={'rounded-full px-3 py-1.5 text-xs font-medium border ' + (!status ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200')}
        >
          ทุกสถานะ
        </button>
        {CONTENT_STAGES.map((s) => (
          <button
            key={s.status}
            type="button"
            onClick={() => setStatus(s.status)}
            className={'rounded-full px-3 py-1.5 text-xs font-medium border ' + (status === s.status ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200')}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400">ยังไม่มีคอนเทนต์ที่ตรงเงื่อนไข ลองกด "+ เพิ่มไอเดียใหม่" เพื่อเริ่มวางแผน</p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((it) => {
            const next = nextContentStatus(it.status)
            return (
              <div key={it.id} className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-2">
                <Link to={`/content/${it.id}/edit`} className="block space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{it.title}</p>
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
                    className="w-full rounded-lg bg-stone-100 text-stone-700 text-xs font-medium py-2 disabled:opacity-50"
                  >
                    {advancingId === it.id ? 'กำลังอัปเดต...' : `▶ ขั้นต่อไป: ${STATUS_ICON[next]} ${STATUS_LABEL[next]}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
