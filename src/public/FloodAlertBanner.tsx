import { useEffect, useState } from 'react'

type FloodStats = { index: number }

// ใช้เกณฑ์เดียวกับ FloodStatusBanner (index >= 20 = ควรรู้, >= 50 = รุนแรง) ไม่ตั้งเกณฑ์ใหม่แยกกัน
const ALERT_THRESHOLD = 20

/** แจ้งเตือนทันทีตอนเข้าเว็บ ถ้าสถานการณ์น้ำท่วมตอนนี้อยู่ในระดับที่ควรรู้ก่อนสั่งซื้อ/เดินทางมารับของ — ดึงข้อมูลสดจาก
 * Floodboard.org ทุกครั้งที่โหลดหน้า ตั้งใจไม่ใช้ข้อความคงที่ (เช่น อ้างอิงประกาศเขตภัยพิบัติที่เป็นข่าว ณ ช่วงเวลาหนึ่ง)
 * เพราะสถานการณ์น้ำท่วมเปลี่ยนเร็วมาก ข้อความตายตัวจะกลายเป็นข้อมูลเท็จทันทีที่สถานการณ์คลี่คลาย — ปิดแล้วปิดเลยจนกว่า
 * จะโหลดหน้าใหม่ (ไม่เก็บ state ข้ามการเข้าเว็บ เพราะอยากให้ลูกค้าเห็นสถานะล่าสุดทุกครั้งที่แวะมาจริงๆ) */
export function FloodAlertBanner() {
  const [stats, setStats] = useState<FloodStats | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('https://floodboard.org/api/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.now) setStats(data.now)
      })
      .catch(() => {
        // เงียบไว้ — ฟีเจอร์เสริม โหลดไม่ได้ก็แค่ไม่โชว์แจ้งเตือน
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!stats || dismissed || stats.index < ALERT_THRESHOLD) return null
  const isHigh = stats.index >= 50

  return (
    <div className={`relative z-50 ${isHigh ? 'bg-red-600' : 'bg-amber-500'} text-white`}>
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3 text-sm">
        <span className="text-lg shrink-0" aria-hidden="true">⚠️</span>
        <p className="flex-1 leading-snug">
          {isHigh
            ? 'ขณะนี้หลายพื้นที่ในกรุงเทพฯ กำลังมีน้ำท่วม/ฝนตกหนัก การจัดส่งอาจล่าช้า และบางเส้นทางรถผ่านไม่ได้ — ดูรายละเอียดถนน+แผนที่ได้ในหน้าเมนู'
            : 'ช่วงนี้บางพื้นที่ในกรุงเทพฯ มีฝนตก/น้ำท่วมขังบางจุด อาจกระทบเวลาจัดส่ง โปรดตรวจสอบก่อนเดินทางมารับของ'}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full w-7 h-7 grid place-items-center bg-white/20"
          aria-label="ปิดการแจ้งเตือน"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
