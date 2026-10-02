import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AmbientGlow, PageTexture, Reveal } from './PublicSiteChrome'
import { MAJOR_ROAD_TYPES, VERDICT_LABEL_TH, roadDisplayName, severityScore, type RoadFeature, type VehicleVerdict } from './floodData'

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
const VEHICLE_ICONS: { key: keyof RoadFeature['properties']['verdict']; icon: string; label: string }[] = [
  { key: 'motorbike', icon: '🏍️', label: 'มอเตอร์ไซค์' },
  { key: 'sedan', icon: '🚗', label: 'รถเก๋ง' },
  { key: 'pickup', icon: '🛻', label: 'กระบะ' },
  { key: 'truck', icon: '🚚', label: 'รถบรรทุก' },
]
const VERDICT_STYLE: Record<VehicleVerdict, string> = {
  ok: 'bg-green-100 text-green-700',
  caution: 'bg-amber-100 text-amber-700',
  risky: 'bg-orange-100 text-orange-700',
  blocked: 'bg-red-100 text-red-700',
}

/** การ์ดหมวดหมู่ตัวเลข — ไอคอนวงกลม+หัวข้อ เข้าชุดกับ TermsSection ในหน้าเงื่อนไขการสั่งซื้อ ให้ทั้งเว็บดูเป็น
 * ระบบเดียวกัน แทนที่จะเป็นกริดตัวเลขแบนๆ ไม่มีจุดสังเกต */
function StatSection({ icon, title, accent, children }: { icon: string; title: string; accent: string; children: ReactNode }) {
  return (
    <Reveal className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5">
      <div className="flex items-center gap-3 mb-3.5">
        <div className={`w-10 h-10 rounded-full grid place-items-center text-lg shrink-0 ${accent}`}>{icon}</div>
        <h2 className="font-display font-semibold text-stone-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{children}</div>
    </Reveal>
  )
}

const TILE_TONE = {
  neutral: 'from-stone-50 to-white border-stone-200/70 text-stone-900',
  red: 'from-red-50 to-white border-red-200 text-red-700',
  orange: 'from-orange-50 to-white border-orange-200 text-orange-700',
  amber: 'from-amber-50 to-white border-amber-200 text-amber-700',
  green: 'from-green-50 to-white border-green-200 text-green-700',
  sky: 'from-sky-50 to-white border-sky-200 text-sky-700',
  violet: 'from-violet-50 to-white border-violet-200 text-violet-700',
} as const

function StatTile({ value, unit, label, tone = 'neutral' }: { value: string; unit: string; label: string; tone?: keyof typeof TILE_TONE }) {
  return (
    <div className={`bg-gradient-to-br ${TILE_TONE[tone]} rounded-2xl border p-3.5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md last:odd:col-span-2 sm:last:odd:col-span-1`}>
      <p className="text-2xl font-display font-bold tabular-nums leading-none">
        {value} <span className="text-[11px] font-normal text-stone-400">{unit}</span>
      </p>
      <p className="text-[11px] text-stone-500 leading-tight mt-1.5">{label}</p>
    </div>
  )
}

/** หน้ารวมสถานการณ์น้ำท่วมกรุงเทพฯ แยกออกมาเป็นหน้าของตัวเอง (ไม่ฝังในหน้าเมนูแล้ว เพราะทำให้หน้าเมนูรก) —
 * ดึงข้อมูลจาก Floodboard.org (community-run, เปิด API ฟรีแบบ CORS จริง ไม่ได้ scrape) โชว์ตัวเลขดิบตรงๆ
 * **ห้ามตีความ/ตั้งชื่อระดับความรุนแรงเอง** เพราะไม่รู้เกณฑ์จริงของเขา ใช้ index แค่ไล่สีเป็นตัวช่วยสายตา —
 * ทั้งหน้านี้ต้องเป็นภาษาไทยล้วน ห้ามโชว์ชื่อถนน/สถานะรถผ่านเป็นภาษาอังกฤษดิบๆ — ใช้ `roadDisplayName`/
 * `VERDICT_LABEL_TH` จาก floodData.ts เสมอ (ข้อมูลดิบจาก Floodboard มีฟิลด์ name ภาษาไทยที่เข้ารหัสถูกต้องแล้ว
 * ไม่ต้อง fallback ไปใช้ nameEn ก่อน) — โหลดไม่สำเร็จก็แค่โชว์ข้อความแจ้งเฉยๆ ไม่ crash ทั้งหน้า */
export function FloodPage() {
  // สวิตช์รวมที่เจ้าของร้านคุมจากหน้าตั้งค่า — ปิดไว้ตอนไม่มีเหตุ (ไม่ fetch ข้อมูลอะไรเลย ไม่ใช่แค่ซ่อน UI)
  // แล้วเปิดกลับมาใช้งานได้ทันทีตอนมีภัยพิบัติจริงโดยไม่ต้องแก้โค้ด/deploy ใหม่ — เช็คไม่สำเร็จ (เช่น เน็ตหลุด)
  // ให้ fail-safe เป็น "เปิด" ไว้ก่อน เพราะเป็นข้อมูลด้านความปลอดภัย ไม่อยากเสี่ยงซ่อนข้อมูลจริงเพราะเน็ตสะดุด
  const [disasterMode, setDisasterMode] = useState<boolean | null>(null)
  const [stats, setStats] = useState<FloodStats | null>(null)
  const [statsFailed, setStatsFailed] = useState(false)
  const [roads, setRoads] = useState<RoadFeature[] | null>(null)
  const [roadsLoading, setRoadsLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDisasterMode() {
      const { data, error } = await supabase.rpc('get_disaster_mode')
      if (!cancelled) setDisasterMode(error ? true : (data ?? true))
    }
    void loadDisasterMode()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (disasterMode !== true) return
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
  }, [disasterMode])

  const level = !stats ? 'low' : stats.index >= 50 ? 'high' : stats.index >= 20 ? 'medium' : 'low'
  const accent = {
    high: { hero: 'from-red-800 via-red-600 to-orange-600', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', label: 'รุนแรง' },
    medium: { hero: 'from-amber-700 via-amber-600 to-yellow-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', label: 'ปานกลาง' },
    low: { hero: 'from-green-800 via-green-600 to-emerald-500', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500', label: 'เบาบาง' },
  }[level]

  // เอาถนนสายหลักที่สาหัสที่สุดมาโชว์ ตัดชื่อซ้ำ (ถนนเส้นเดียวมักถูกตัดเป็นหลายท่อนในข้อมูลดิบ) เอาแค่ท่อน
  // ที่หนักสุดของแต่ละชื่อถนนพอ ไม่งั้นรายการจะซ้ำถนนเดิมหลายรอบ
  const worstRoads = roads
    ? Object.values(
        roads
          .filter((f) => MAJOR_ROAD_TYPES.has(f.properties.hw))
          .reduce<Record<string, RoadFeature>>((acc, f) => {
            const name = roadDisplayName(f)
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
        <div className="flex items-center gap-3 rounded-3xl bg-white/80 backdrop-blur border border-stone-200/70 shadow-[0_8px_24px_-12px_rgb(51_32_14_/_0.35)] p-3 animate-form-in">
          <Link
            to="/menu"
            className="shrink-0 rounded-full bg-gradient-to-br from-stone-800 to-stone-900 text-white w-10 h-10 grid place-items-center shadow-md"
            aria-label="กลับไปหน้าเมนู"
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-display font-bold text-stone-900">🌊 สถานการณ์น้ำท่วมกรุงเทพฯ</h1>
            <p className="text-xs text-stone-500">
              {updatedAt
                ? `อัปเดตล่าสุด ${updatedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
                : disasterMode === false
                  ? ''
                  : 'กำลังโหลดข้อมูล...'}
            </p>
          </div>
        </div>

        {disasterMode === null && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
            กำลังโหลด...
          </div>
        )}

        {disasterMode === false && (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center space-y-2">
            <p className="text-3xl">🌤️</p>
            <p className="text-sm text-stone-600 font-medium">ตอนนี้ยังไม่มีการเปิดใช้งานระบบติดตามภัยพิบัติ</p>
            <p className="text-xs text-stone-400">ร้านจะเปิดใช้งานทันทีเมื่อมีสถานการณ์ที่ควรแจ้งให้ลูกค้าทราบ</p>
          </div>
        )}

        {disasterMode === true && statsFailed && !stats && (
          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center text-sm text-stone-500">
            ตอนนี้โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง หรือดูโดยตรงที่{' '}
            <a href="https://floodboard.org" target="_blank" rel="noopener noreferrer" className="underline">
              floodboard.org
            </a>
          </div>
        )}

        {disasterMode === true && stats && (
          <Reveal
            as="section"
            className={`relative overflow-hidden rounded-3xl text-white p-5 shadow-[0_18px_36px_-16px_rgb(0_0_0_/_0.55)] bg-gradient-to-br ${accent.hero}`}
          >
            <AmbientGlow />
            <div className="relative z-10 flex items-center gap-4">
              <div className="relative w-20 h-20 shrink-0">
                <span className="absolute inset-0 rounded-full bg-white/30 animate-fab-ring" aria-hidden="true" />
                <div className="relative w-20 h-20 rounded-full bg-white/95 grid place-items-center shadow-lg">
                  <p className={`text-3xl font-display font-extrabold tabular-nums ${accent.text}`}>{stats.index}</p>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/80 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden="true" /> ภาพรวมตอนนี้
                </p>
                <p className="text-xl font-display font-bold leading-tight">ระดับ{accent.label}</p>
                <p className="text-xs text-white/80">ดัชนีน้ำท่วม จาก 100</p>
              </div>
            </div>
            <div className="relative z-10 mt-4 h-2.5 rounded-full bg-black/20 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-white/90 transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(4, stats.index))}%` }} />
            </div>
          </Reveal>
        )}

        {disasterMode === true && stats && (
          <div className="space-y-3.5">
            <StatSection icon="🛣️" title="สถานะถนน" accent="bg-orange-50">
              <StatTile tone="sky" value={stats.floodedKm.toFixed(1)} unit="กม." label="ถนนน้ำท่วมรวม" />
              <StatTile tone="red" value={stats.blockedKm.toFixed(1)} unit="กม." label="ตัดขาดสมบูรณ์" />
              <StatTile tone="orange" value={stats.riskyKm.toFixed(1)} unit="กม." label="เสี่ยง ผ่านลำบาก" />
              <StatTile tone="amber" value={stats.cautionKm.toFixed(1)} unit="กม." label="ต้องระวัง" />
              <StatTile tone="green" value={stats.clearedKm.toFixed(1)} unit="กม." label="กลับมาใช้ได้แล้ว" />
            </StatSection>

            <StatSection icon="🌧️" title="ฝนและระดับน้ำ" accent="bg-sky-50">
              <StatTile tone="sky" value={stats.rainMax1h.toFixed(1)} unit="มม." label="ฝนสูงสุด (1 ชม.)" />
              <StatTile tone="sky" value={stats.rainMax24h.toFixed(1)} unit="มม." label="ฝนสูงสุด (24 ชม.)" />
              <StatTile tone="sky" value={stats.forecastMax3h.toFixed(1)} unit="มม." label="คาดการณ์ฝน 3 ชม.หน้า" />
              <StatTile tone="sky" value={stats.wlHigh.toString()} unit="จุด" label="ระดับน้ำสูง" />
              <StatTile tone="red" value={stats.wlOver.toString()} unit="จุด" label="น้ำล้นตลิ่ง" />
            </StatSection>

            <StatSection icon="📢" title="รายงานจากประชาชน" accent="bg-violet-50">
              <StatTile tone="violet" value={stats.reports.toString()} unit="รายงาน" label="รายงานทั้งหมด" />
              <StatTile tone="violet" value={stats.reports1h.toString()} unit="รายงาน" label="ใน 1 ชม. ล่าสุด" />
            </StatSection>
          </div>
        )}

        {disasterMode === true && (
        <>
        <Reveal as="section" className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-10 h-10 rounded-full bg-blue-50 grid place-items-center text-lg shrink-0">🗺️</div>
            <h2 className="font-display font-semibold text-stone-900">แผนที่ถนนสายหลัก</h2>
          </div>
          {roadsLoading ? (
            <p className="text-sm text-stone-500 text-center py-6">กำลังโหลดแผนที่...</p>
          ) : (
            <Suspense fallback={<p className="text-sm text-stone-500 text-center py-6">กำลังโหลดแผนที่...</p>}>
              <FloodMap roads={roads ?? []} />
            </Suspense>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-3 text-[11px] text-stone-500">
            <span>🟢 ผ่านได้ปกติ</span>
            <span>🟡 ควรระวัง</span>
            <span>🟠 เสี่ยง</span>
            <span>🔴 ผ่านไม่ได้</span>
            <span className="text-stone-400">— แตะเส้นถนนเพื่อดูชื่อ+ความลึก</span>
          </div>
        </Reveal>

        <Reveal as="section" className="bg-white rounded-2xl border border-stone-200/70 shadow-[0_2px_16px_-6px_rgb(51_32_14_/_0.18)] p-5">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-10 h-10 rounded-full bg-red-50 grid place-items-center text-lg shrink-0">🚧</div>
            <h2 className="font-display font-semibold text-stone-900">ถนนที่ได้รับผลกระทบหนักสุด</h2>
          </div>
          {roadsLoading ? (
            <p className="text-sm text-stone-500 text-center py-4">กำลังโหลด...</p>
          ) : worstRoads.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-4">ไม่มีข้อมูลถนนสายหลักที่ได้รับผลกระทบตอนนี้</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {worstRoads.map((f, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden bg-gradient-to-br from-stone-50 to-white rounded-2xl border border-stone-200/70 p-3 pl-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${severityScore(f.properties.verdict) >= 9 ? 'bg-red-500' : severityScore(f.properties.verdict) >= 5 ? 'bg-orange-400' : 'bg-amber-400'}`} aria-hidden="true" />
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-semibold text-stone-900 truncate"><span className="text-stone-300 mr-1.5">#{i + 1}</span>{roadDisplayName(f)}</p>
                    {f.properties.depthCm != null && (
                      <p className="text-xs text-stone-400 shrink-0">ลึก {f.properties.depthCm} ซม.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_ICONS.map(({ key, icon, label }) => (
                      <span
                        key={key}
                        title={label}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${VERDICT_STYLE[f.properties.verdict[key]]}`}
                      >
                        {icon} {VERDICT_LABEL_TH[f.properties.verdict[key]]}
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
          className="btn-shimmer flex items-center justify-center gap-1.5 w-full rounded-full bg-gradient-to-r from-stone-800 to-stone-900 text-white font-semibold py-3.5 text-sm shadow-[0_12px_24px_-12px_rgb(51_32_14_/_0.8)] transition-transform active:scale-95"
        >
          🗺️ ดูแผนที่เต็ม + เส้นทางแนะนำที่ Floodboard.org →
        </a>

        <p className="text-[11px] text-stone-400 text-center leading-relaxed px-4">
          ข้อมูลจาก Floodboard.org (รวมข้อมูลจาก กทม./กรมทางหลวง/ThaiWater/Traffy Fondue) อัปเดตอัตโนมัติทุก 5 นาที
          — เป็นข้อมูลชุมชนไม่ใช่ทางการ 100% โปรดใช้วิจารณญาณก่อนเดินทาง
        </p>
        </>
        )}
      </div>
    </div>
  )
}
