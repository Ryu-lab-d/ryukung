import { Link } from 'react-router-dom'
import { useContentStats } from './useContentStats'
import { editingStyleCounts, platformCounts, monthCounts } from './contentStats'

const PALETTE = ['#3d2b1f', '#b45309', '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04']

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
}

function PieChart({ data }: { data: { label: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <p className="text-sm text-stone-400">ยังไม่มีคอนเทนต์ที่โพสต์แล้วให้สรุปสถิติ</p>

  let cumulativeDeg = 0

  return (
    <div className="flex items-center gap-4">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        {data.length === 1 ? (
          <circle cx={70} cy={70} r={65} fill={PALETTE[0]} />
        ) : (
          data.map((d, i) => {
            const sweep = (d.count / total) * 360
            const path = describeSlice(70, 70, 65, cumulativeDeg, cumulativeDeg + sweep)
            cumulativeDeg += sweep
            return <path key={d.label} d={path} fill={PALETTE[i % PALETTE.length]} />
          })
        )}
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate text-stone-700">{d.label}</span>
            <span className="text-stone-500 tabular-nums shrink-0">
              {d.count} ({Math.round((d.count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data }: { data: { key: string; label: string; icon?: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <p className="text-sm text-stone-400">ยังไม่มีคอนเทนต์ที่โพสต์แล้วให้สรุปสถิติ</p>

  const max = Math.max(...data.map((d) => d.count))

  return (
    <div className="flex items-end gap-3 h-28">
      {data.map((d) => {
        const heightPercent = d.count > 0 ? Math.max((d.count / max) * 100, 4) : 1
        return (
          <div key={d.key} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
            <span className="text-xs text-stone-600 tabular-nums">{d.count > 0 ? d.count : ''}</span>
            <div
              className={'w-full rounded-t ' + (d.count > 0 ? 'bg-stone-900' : 'bg-stone-100')}
              style={{ height: `${heightPercent}%` }}
            />
            <span className="text-[11px] text-stone-500 text-center leading-tight">
              {d.icon && <>{d.icon} </>}
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ContentStatsPage() {
  const { items, loading } = useContentStats()

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  const styles = editingStyleCounts(items)
  const platforms = platformCounts(items)
  const months = monthCounts(items)
  const busiestMonth = months.length > 0 ? months.reduce((a, b) => (b.count > a.count ? b : a)) : null

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/content" className="text-sm text-stone-600 underline">
          ← กลับแผนคอนเทนต์
        </Link>
      </div>
      <h1 className="text-lg font-semibold">📊 สรุปสถิติคอนเทนต์</h1>
      <p className="text-xs text-stone-400">นับจากคอนเทนต์ที่มีสถานะ "โพสต์แล้ว" เท่านั้น</p>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-500">ส่วนใหญ่เราโพสต์อะไร (แยกตามแนวการตัดต่อ)</h2>
        <PieChart data={styles} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-500">โพสต์เดือนไหนเยอะที่สุด</h2>
        {busiestMonth && <p className="text-sm text-stone-700">เดือนที่โพสต์เยอะที่สุดคือ <strong>{busiestMonth.label}</strong> ({busiestMonth.count} คอนเทนต์)</p>}
        <BarChart data={months.map((m) => ({ key: m.monthKey, label: m.label, count: m.count }))} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-500">โพสต์ช่องทางไหนเยอะที่สุด</h2>
        <BarChart data={platforms.map((p) => ({ key: p.platform, label: p.label, icon: p.icon, count: p.count }))} />
      </div>
    </div>
  )
}
