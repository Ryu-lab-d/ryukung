import { useEffect } from 'react'

const PREFIX = 'ryukung-draft:'

/** อ่านฟอร์มร่างที่บันทึกไว้ (ถ้ามี) — เรียกครั้งเดียวตอน mount ก่อน useState อื่นๆ เพื่อใช้เป็นค่าเริ่มต้นของแต่ละช่อง */
export function loadFormDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearFormDraft(key: string | null) {
  if (!key) return
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // localStorage เต็มหรือถูกปิดใช้งาน — ยอมเสียฟีเจอร์นี้ไปโดยไม่ทำให้แอปพัง
  }
}

/** เวอร์ชันเรียกทันที (ไม่ใช่ hook) — ใช้ตอนต้องบันทึกค่าเดียวทันทีนอก render cycle เช่นบันทึก id ของแถวที่เพิ่งสร้าง */
export function saveFormDraft<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // เหตุผลเดียวกับ clearFormDraft
  }
}

/**
 * บันทึกค่าฟอร์มลง localStorage อัตโนมัติทุกครั้งที่เปลี่ยน กันข้อมูลหายตอนสลับหน้า/แท็บ (component unmount)
 * หรือมือถือรีโหลดแท็บที่ค้างอยู่เบื้องหลังเพื่อประหยัดแรม — ทั้งสองกรณีทำให้ state ในหน่วยความจำหายหมด
 * ส่ง key เป็น null ได้เมื่อยังไม่มี id ที่จะใช้อ้างอิง (เช่น รอสร้างแถวร่างในฐานข้อมูลก่อน) จะไม่บันทึกอะไรจนกว่าจะมี key จริง
 */
export function useFormDraft<T>(key: string | null, value: T) {
  useEffect(() => {
    if (!key) return
    saveFormDraft(key, value)
  }, [key, value])
}
