/**
 * บวก/ลบวันแบบไม่สนโซนเวลา เพราะ needed_date/bake_date เป็น Postgres `date` (ไม่มีเวลา) ล้วนๆ
 * คำนวณที่เที่ยงวัน UTC เสมอเพื่อไม่ให้ตกไปเป็นวันก่อนหน้าหรือถัดไปโดยไม่ตั้งใจ
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const utcNoon = Date.UTC(y, m - 1, d, 12) + days * 86400000
  return new Date(utcNoon).toISOString().slice(0, 10)
}

export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dateStr === todayStr
}
