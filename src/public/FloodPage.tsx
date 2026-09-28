import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTexture, Reveal } from './PublicSiteChrome'
import { MAJOR_ROAD_TYPES, severityScore, type RoadFeature, type VehicleVerdict } from './floodData'

// โหลด Leaflet (ไลบรารีแผนที่ ~150KB) แบบ lazy — แยกเป็นชิ้นของตัวเอง ไม่ให้ปนไปกับ bundle หลักของเว็บ
// (ลูกค้าส่วนใหญ่สั่งผ่านมือถือ ใครไม่ได้เข้าหน้านี้ก็ไม่ต้องโหลด)
const FloodMap = lazy(() => import('./FloodMap').then((m) => ({ default: m.FloodMap })))

type FloodStats = {
  blockedKm: number
  riskyKm: number
  cautionKm: number
  clearedKm: number
  floodedKm: number
  reports: number
  reports1h: number
  rainMax1h: number
  rainMax24h: number
  wlHigh: number
  wlOver: number
  forecastMax3h: number
  forecastAvg3h: number
  index: number
}

const REFRESH_MS = 5 * 60 * 1000
const VEHICLE_ICONS: { key: keyof RoadFeature['properties']['verdict']; icon: string }[] = [
  { key: 'motorbike', icon: '🏍️' },
  { key: 'sedan', icon: '🚗' },
  { key: 'pickup', icon: '🛻' },
  { key: 'truck', icon: '🚚' },
]
const VERDICT_STYLE: Record<VehicleVerdict, string> = {
  ok: 'bg-green-100 text-green-700',
  caution: 'bg-amber-100 text-amber-700',
  risky: 'bg-orange-100 text-orange-700',
  blocked: 'bg-red-100 text-red-700',
}

/** หน้ารวมสถานการณ์น้ำท่วมกรุงเทพฯ แยกออกมาเป็นหน้าของตัวเอง (ไม่ฝังในหน้าเมนูแล้ว เพราะทำให้หน้าเมนูรก) —
 * ดึงข้อมูลจาก Floodboard.org (community-run, เปิด API ฟรีแบบ CORS จริง ไม่ได้ scrape) โชว์ตัวเลขดิบตรงๆ
 * **ห้ามตีความ/ตั้งชื่อระดับความรุนแรงเอง** เพราะไม่รู้เกณฑ์จริงของเขา ใช้ index แค่ไล่สีเป็นตัวช่วยสายตา —
 * โหลดไม่สำเร็จก็แค่โชว์ข้อความแจ้งเฉยๆ ไม่ crash ทั้งหน้า */
export function FloodPage() {
  const [stats, setStats] = useState<FloodStats | null>(null)
  const [statsFailed, setStatsFailed] = useState(false)
  const [roads, setRoads] = useState<RoadFeature[] | null>(null)
  const [roadsLoading, setRoadsLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      try {
        const res = await fetch('https://floodboard.org/api/stats')
        if (!res.ok) throw new Error('bad response')
        const data = await res.json()
        if (!cancelled && data?.now) {
          setStats(data.now)
          setUpdatedAt(new Date())
          setStatsFailed(false)
        }
      } catch {
        if (!cancelled) setStatsFailed(true)
      }
    }
    async function loadRoads() {
      try {
        const res = await fetch('https://floodboard.org/api/export/roads.geojson')
        const data = await res.json()
        if (!cancelled) setRoads((data.features ?? []) as RoadFeature[])
      } catch {
        if (!cancelled) setRoads([])
      } finally {
        if (!cancelled) setRoadsLoading(false)
      }
    }
    void loadStats()
    void loadRoads()
    const timer = setInterval(() => {
      void loadStats()
      void loadRoads()
    }, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const level = !stats ? 'low' : stats.index >= 50 ? 'high' : stats.index >= 20 ? 'medium' : 'low'
  const accent = {
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  }[level]

  const statCards = stats
    ? [
        { label: 'กม. ถนนน้ำท่วม', value: stats.floodedKm.toFixed(1), unit: 'กม.' },
        { label: 'ตัดขาดสมบูรณ์', value: stats.blockedKm.toFixed(1), unit: 'กม.' },
        { label: 'เสี่ยง ผ่านลำบาก', value: stats.riskyKm.toFixed(1), unit: 'กม.' },
        { label: 'ต้องระวัง', value: stats.cautionKm.toFixed(1), unit: 'กม.' },
        { label: 'กลับมาใช้ได้แล้ว', value: stats.clearedKm.toFixed(1), unit: 'กม.' },
        { label: 'รายงานทั้งหมด', value: stats.reports.toString(), unit: 'รายงาน' },
        { label: 'รายงาน (1 ชม. ล่าสุด)', value: stats.reports1h.toString(), unit: 'รายงาน' },
        { label: 'ฝนสูงสุด (1 ชม.)', value: stats.rainMax1h.toFixed(1), unit: 'มม.' },
        { label: 'ฝนสูงสุด (24 ชม.)', value: stats.rainMax24h.toFixed(1), unit: 'มม.' },
        { label: 'จุดระดับน้ำสูง', value: stats.wlHigh.toString(), unit: 'จุด' },
        { label: 'จุดน้ำล้นตลิ่ง', value: stats.wlOver.toString(), unit: 'จุด' },
        { label: 'คาดการณ์ฝน 3 ชม. (สูงสุด)', value: stats.forecastMax3h.toFixed(1), unit: 'มม.' },
      ]
    : []

  // เอาถนนสายหลักที่สาหัสที่สุดมาโชว์ ตัดชื่อซ้ำ (ถนนเส้นเดียวมักถูกตัดเป็นหลายท่อนในข้อมูลดิบ) เอาแค่ท่อน
  // ที่หนักสุดของแต่ละชื่อถนนพอ ไม่งั้นรายการจะซ้ำถนนเดิมหลายรอบ
  const worstRoads = roads
    ? Object.values(
        roads
          .filter((f) => MAJOR_ROAD_TYPES.has(f.properties.hw))
          .reduce<Record<string, RoadFeature>>((acc, f) => {
            const name = f.properties.nameEn || f.properties.name
            if (!name) return acc
            const existing = acc[name]
            if (!existing || severityScore(f.properties.verdict) > severityScore(existing.properties.verdict)) {
              acc[name] = f
            }
            return acc
          }, {})
      )
        .sort((a, b) => severityScore(b.properties.verdict) - severityScore(a.properties.verdict))
        .slice(0, 16)
    : []

  return (
    <div className="min-h-screen pb-16 font-warm bg-stone-50">
      <PageTexture />
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link
            to="/menu"
            className="shrink-0 rounded-full border border-stone-300 bg-white w-10 h-10 grid place-items-center text-stone-700 shadow-sm"
            aria-label="กลับไปหน้าเมนู"
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900">สถานการณ์น้ำท่วมกรุงเทพฯ</h1>
            <p className="text-xs text-stone-500">
              {updatedAt ? `อัปเดตล่าสุด ${updatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : 'กำลังโหลดข้อมูล...'}
            </p>
          </div>
        </div>

        {statsFailed && !stats && (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center text-sm text-stone-500">
            ตอนนี้โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง หรือดูโดยตรงที่{' '}
            <a href="https://floodboard.org" target="_blank" rel="noopener noreferrer" className="underline">
              floodboard.org
            </a>
          </div>
        )}

        {stats && (
          <Reveal as="section" className={`rounded-2xl border ${accent.border} ${accent.bg} p-5 space-y-4`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${accent.dot} shrink-0 animate-pulse`} aria-hidden="true" />
              <h2 className="font-display font-semibold text-stone-900">ภาพรวมตอนนี้</h2>
              <span className={`ml-auto text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-white ${accent.text}`}>
                index {stats.index}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {statCards.map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-stone-200 p-2.5 text-center">
                  <p className="text-base font-bold tabular-nums text-stone-900">
                    {s.value} <span className="text-[10px] font-normal text-stone-400">{s.unit}</span>
                  </p>
                  <p className="text-[11px] text-stone-500 leading-tight mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        <Reveal as="section" delay={0.06} className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
          <h2 className="font-display font-semibold text-stone-900 px-1">แผนที่ถนนสายหลัก</h2>
          {roadsLoading ? (
            <p className="text-sm text-stone-500 text-center py-6">กำลังโหลดแผนที่...</p>
          ) : (
            <Suspense fallback={<p className="text-sm text-stone-500 text-center py-6">กำลังโหลดแผนที่...</p>}>
              <FloodMap roads={roads ?? []} />
            </Suspense>
          )}
          <p className="text-[11px] text-stone-400 px-1">
            🟢 ผ่านได้ปกติ · 🟡 ควรระวัง · 🟠 เสี่ยง · 🔴 ผ่านไม่ได้ — แตะเส้นถนนเพื่อดูชื่อ+ความลึก
          </p>
        </Reveal>

        <Reveal as="section" delay={0.12} className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5">
          <h2 className="font-display font-semibold text-stone-900 px-1">ถนนที่ได้รับผลกระทบหนักสุด</h2>
          {roadsLoading ? (
            <p className="text-sm text-stone-500 text-center py-4">กำลังโหลด...</p>
          ) : worstRoads.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-4">ไม่มีข้อมูลถนนสายหลักที่ได้รับผลกระทบตอนนี้</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {worstRoads.map((f, i) => (
                <div key={i} className="bg-stone-50 rounded-xl border border-stone-200 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium text-stone-900 truncate">{f.properties.nameEn || f.properties.name}</p>
                    {f.properties.depthCm != null && (
                      <p className="text-xs text-stone-400 shrink-0">ลึก {f.properties.depthCm} ซม.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_ICONS.map(({ key, icon }) => (
                      <span
                        key={key}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${VERDICT_STYLE[f.properties.verdict[key]]}`}
                      >
                        {icon} {f.properties.verdict[key]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Reveal>

        <a
          href="https://floodboard.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-stone-900 text-white font-medium py-3 text-sm"
        >
          🗺️ ดูแผนที่เต็ม + เส้นทางแนะนำที่ Floodboard.org →
        </a>

        <p className="text-[11px] text-stone-400 text-center leading-relaxed px-4">
          ข้อมูลจาก Floodboard.org (รวมข้อมูลจาก กทม./กรมทางหลวง/ThaiWater/Traffy Fondue) อัปเดตอัตโนมัติทุก 5 นาที
          — เป็นข้อมูลชุมชนไม่ใช่ทางการ 100% โปรดใช้วิจารณญาณก่อนเดินทาง
        </p>
      </div>
    </div>
  )
}
