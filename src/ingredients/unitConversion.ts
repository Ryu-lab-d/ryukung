export type UnitCategory = 'weight' | 'volume' | 'piece' | 'unknown'

function normalize(unit: string): string {
  return unit.trim().toLowerCase()
}

// ฐาน: weight เป็นกรัม, volume เป็นมิลลิลิตร — ตัวเลข = กี่หน่วยฐานต่อ 1 หน่วยนั้น
const WEIGHT_UNITS: Record<string, number> = {
  'มก.': 0.001, 'มิลลิกรัม': 0.001, 'mg': 0.001,
  'ก.': 1, 'กรัม': 1, 'g': 1, 'gram': 1, 'grams': 1,
  'ขีด': 100,
  'กก.': 1000, 'กิโลกรัม': 1000, 'kg': 1000,
}
const VOLUME_UNITS: Record<string, number> = {
  'มล.': 1, 'มิลลิลิตร': 1, 'ซีซี': 1, 'ml': 1, 'cc': 1,
  'ล.': 1000, 'ลิตร': 1000, 'l': 1000, 'liter': 1000, 'litre': 1000,
}
// หน่วยนับ "1 ชิ้น" แบบเดี่ยว ที่หมายถึงสิ่งเดียวกันจริง ต่างจากหน่วยบรรจุภัณฑ์ที่ขนาดไม่คงที่
// (แพ็ค/ถุง/กล่อง/ลัง/โหล — พวกนี้ไม่ใส่ไว้ที่นี่ เพราะเดาขนาดบรรจุไม่ได้ ต้องถามเจ้าของร้านเสมอ)
const PIECE_UNITS = new Set(['ชิ้น', 'อัน', 'ลูก', 'ฟอง', 'แผ่น', 'ก้อน', 'หน่วย', 'piece', 'pieces', 'pcs'])

export function categoryOf(unit: string): UnitCategory {
  const u = normalize(unit)
  if (u in WEIGHT_UNITS) return 'weight'
  if (u in VOLUME_UNITS) return 'volume'
  if (PIECE_UNITS.has(u)) return 'piece'
  return 'unknown'
}

/**
 * คืนตัวคูณ ("1 หน่วยเดิม เท่ากับกี่หน่วยใหม่") ถ้าแปลงเองได้ชัวร์เพราะทั้งสองหน่วยมีอัตราส่วนคงที่ตายตัวจริง
 * (น้ำหนัก↔น้ำหนัก, ปริมาตร↔ปริมาตร, หรือหน่วยนับชิ้นเดี่ยว↔กันเอง) — คืน null ถ้าข้ามหมวดหรือไม่รู้จักหน่วยใดหน่วยหนึ่ง
 * (รวมหน่วยบรรจุภัณฑ์ทุกแบบที่ขนาดไม่คงที่) กรณีนี้ต้องถามเจ้าของร้านเอง ไม่มีทางเดาถูกได้เอง
 */
export function autoConversionFactor(fromUnit: string, toUnit: string): number | null {
  const fromCat = categoryOf(fromUnit)
  const toCat = categoryOf(toUnit)
  if (fromCat === 'unknown' || toCat === 'unknown' || fromCat !== toCat) return null
  if (fromCat === 'piece') return 1
  const dict = fromCat === 'weight' ? WEIGHT_UNITS : VOLUME_UNITS
  return dict[normalize(fromUnit)] / dict[normalize(toUnit)]
}
