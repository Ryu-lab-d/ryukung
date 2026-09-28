import { useEffect, useState } from 'react'
import { Reveal } from './PublicSiteChrome'

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

/** ดึงข้อมูลสรุประดับ Floodboard.org (community-run, รวมข้อมูลจาก กทม./กรมทางหลวง/ThaiWater/Traffy Fondue —
 * เปิด API ให้ใช้ฟรีแบบ CORS จริง ไม่ได้ scrape) — ตั้งใจโชว์แค่ตัวเลขดิบที่มาจากเขาตรงๆ ไม่ตีความ/ตั้งชื่อ
 * ระดับความรุนแรงเอง (เช่น "วิกฤต/อันตราย") เพราะเราไม่รู้เกณฑ์จริงของเขา ใช้แค่ไล่สีอ่อน-เข้มตาม index
 * เป็นตัวช่วยสายตาเท่านั้น ไม่ได้ฟันธงแทนเขา — โหลดไม่สำเร็จก็แค่ไม่โชว์อะไรเลย (ฟีเจอร์เสริม ไม่ใช่แกนหลัก) */
export function FloodStatusBanner() {
  const [stats, setStats] = useState<FloodStats | null>(null)

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

  if (!stats) return null

  const level = stats.index >= 50 ? 'high' : stats.index >= 20 ? 'medium' : 'low'
  const accent = {
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  }[level]

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
