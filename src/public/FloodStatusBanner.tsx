import { lazy, Suspense, useEffect, useState } from 'react'
import { Reveal } from './PublicSiteChrome'
import { MAJOR_ROAD_TYPES, severityScore, type RoadFeature, type VehicleVerdict } from './floodData'

// โหลด Leaflet (ไลบรารีแผนที่ ~150KB) แบบ lazy — โชว์เฉพาะตอนลูกค้ากดขยายดูจริงๆ ไม่ต้องแบกน้ำหนักนี้ตั้งแต่โหลดหน้าแรก
// (ลูกค้าส่วนใหญ่สั่งผ่านมือถือ เน็ตช้าเสียเวลาโหลดของที่อาจไม่ได้ใช้)
const FloodMap = lazy(() => import('./FloodMap').then((m) => ({ default: m.FloodMap })))

type FloodStats = {
  blockedKm: number
  riskyKm: number
  cautionKm: number
  floodedKm: number
  reports: number
  reports1h: number
  rainMax24h: number
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

/** ดึงข้อมูลสรุประดับ Floodboard.org (community-run, รวมข้อมูลจาก กทม./กรมทางหลวง/ThaiWater/Traffy Fondue —
 * เปิด API ให้ใช้ฟรีแบบ CORS จริง ไม่ได้ scrape) — ตั้งใจโชว์แค่ตัวเลขดิบที่มาจากเขาตรงๆ ไม่ตีความ/ตั้งชื่อ
 * ระดับความรุนแรงเอง (เช่น "วิกฤต/อันตราย") เพราะเราไม่รู้เกณฑ์จริงของเขา ใช้แค่ไล่สีอ่อน-เข้มตาม index
 * เป็นตัวช่วยสายตาเท่านั้น ไม่ได้ฟันธงแทนเขา — โหลดไม่สำเร็จก็แค่ไม่โชว์อะไรเลย (ฟีเจอร์เสริม ไม่ใช่แกนหลัก)
 * ส่วนรายการถนน (roads.geojson) โหลดแบบ lazy ตอนกดขยายเท่านั้น ประหยัด bandwidth ถ้าไม่มีใครสนใจดู — ค่า
 * "ผ่านได้/ไม่ได้" ต่อรถแต่ละแบบ (verdict) เป็นการตัดสินของ Floodboard เองที่มากับข้อมูลอยู่แล้ว ไม่ใช่เราคิดเอง */
export function FloodStatusBanner() {
  const [stats, setStats] = useState<FloodStats | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [roads, setRoads] = useState<RoadFeature[] | null>(null)
  const [roadsLoading, setRoadsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('https://floodboard.org/api/stats')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.now) setStats(data.now)
      } catch {
        // เงียบไว้ — ฟีเจอร์เสริม ไม่ใช่ระบบหลักของร้าน โหลดไม่ได้ก็แค่ไม่โชว์แบนเนอร์นี้
      }
    }
    void load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  async function handleToggleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next && !roads) {
      setRoadsLoading(true)
      try {
        const res = await fetch('https://floodboard.org/api/export/roads.geojson')
        const data = await res.json()
        setRoads((data.features ?? []) as RoadFeature[])
      } catch {
        setRoads([])
      } finally {
        setRoadsLoading(false)
      }
    }
  }

  if (!stats) return null

  const level = stats.index >= 50 ? 'high' : stats.index >= 20 ? 'medium' : 'low'
  const accent = {
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  }[level]

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
        .slice(0, 8)
    : []

  return (
    <Reveal as="section" className={`rounded-2xl border ${accent.border} ${accent.bg} p-5 space-y-3`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full ${accent.dot} shrink-0 animate-pulse`} aria-hidden="true" />
        <h2 className="font-display font-semibold text-stone-900">สถานการณ์น้ำท่วมตอนนี้</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={`text-lg font-bold tabular-nums ${accent.text}`}>{stats.floodedKm.toFixed(0)}</p>
          <p className="text-[11px] text-stone-500">กม. ถนนน้ำท่วม</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-stone-900">{stats.reports1h}</p>
          <p className="text-[11px] text-stone-500">รายงาน (1 ชม.)</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-stone-900">{stats.rainMax24h.toFixed(0)}</p>
          <p className="text-[11px] text-stone-500">มม. ฝน (24 ชม.)</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleToggleExpand()}
        className="w-full rounded-xl border border-stone-300 bg-white text-stone-700 font-medium py-2.5 text-sm"
      >
        {expanded ? '▲ ซ่อนแผนที่+รายชื่อถนน' : '▼ ดูแผนที่ + ถนนที่ได้รับผลกระทบหนักสุด'}
      </button>

      {expanded && (
        <div className="space-y-2">
          {roadsLoading ? (
            <p className="text-sm text-stone-500 text-center py-2">กำลังโหลด...</p>
          ) : (roads?.length ?? 0) > 0 ? (
            <Suspense fallback={<p className="text-sm text-stone-500 text-center py-2">กำลังโหลดแผนที่...</p>}>
              <FloodMap roads={roads!} />
            </Suspense>
          ) : null}
          {roadsLoading ? null : worstRoads.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-2">ไม่มีข้อมูลถนนสายหลักที่ได้รับผลกระทบตอนนี้</p>
          ) : (
            worstRoads.map((f, i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-200 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium text-stone-900 truncate">{f.properties.nameEn || f.properties.name}</p>
                  {f.properties.depthCm != null && (
                    <p className="text-xs text-stone-400 shrink-0">ลึก {f.properties.depthCm} ซม.</p>
                  )}
                </div>
                <div className="flex gap-1.5">
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
            ))
          )}
        </div>
      )}

      <a
        href="https://floodboard.org"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-stone-900 text-white font-medium py-2.5 text-sm"
      >
        🗺️ ดูแผนที่เต็ม + เส้นทางแนะนำ →
      </a>

      <p className="text-[11px] text-stone-400 text-center leading-relaxed">
        ข้อมูลจาก Floodboard.org (รวมข้อมูลจาก กทม./กรมทางหลวง/ThaiWater/Traffy Fondue) อัปเดตอัตโนมัติทุก 5 นาที
        — เป็นข้อมูลชุมชนไม่ใช่ทางการ 100% โปรดใช้วิจารณญาณก่อนเดินทาง
      </p>
    </Reveal>
  )
}
