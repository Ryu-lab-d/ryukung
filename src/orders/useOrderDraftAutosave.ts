import { loadFormDraft, saveFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

const PREFIX = 'order-draft:'
const PENDING_NEW_ID_KEY = PREFIX + 'pending-new-id'

export function loadDraftFromLocalStorage<T>(orderId: string): T | null {
  return loadFormDraft<T>(PREFIX + orderId)
}

export function clearDraftFromLocalStorage(orderId: string) {
  clearFormDraft(PREFIX + orderId)
}

export function useOrderDraftAutosave<T>(orderId: string | null, draft: T) {
  useFormDraft(orderId ? PREFIX + orderId : null, draft)
}

/**
 * ตอนสร้างออเดอร์ใหม่ (ไม่มี id ใน URL) แถวร่างในฐานข้อมูลถูกสร้างแบบ async หลัง mount — ถ้าไม่จำ id นี้ไว้ที่ไหนเลย
 * แล้วเบราว์เซอร์ (โดยเฉพาะมือถือ) รีโหลดแท็บที่ค้างอยู่เบื้องหลังทิ้ง (เช่น สลับไปแอปโทรศัพท์เพื่อดูเบอร์ลูกค้าแล้วกลับมา)
 * URL จะยังเป็น /orders/new เหมือนเดิม (ไม่มี id ให้อ้างอิง) ทำให้กู้ร่างเดิมกลับมาไม่ได้ ต้องเริ่มเขียนใหม่ทุกครั้ง —
 * ฟังก์ชันชุดนี้จำ id ของร่างที่กำลังสร้างไว้แยกต่างหาก (คีย์คงที่ ไม่ขึ้นกับ id) เพื่อให้กลับมาที่แถวเดิมได้เสมอ
 */
export function getPendingNewOrderId(): string | null {
  return loadFormDraft<string>(PENDING_NEW_ID_KEY)
}

export function setPendingNewOrderId(orderId: string) {
  saveFormDraft(PENDING_NEW_ID_KEY, orderId)
}

/** เรียกตอนออกจากการสร้างออเดอร์ใหม่แล้ว (บันทึกร่าง/ยืนยันสำเร็จ) กันไม่ให้ "+ สร้างออเดอร์ใหม่" ครั้งต่อไปกลับมาที่แถวนี้อีก */
export function clearPendingNewOrderId() {
  clearFormDraft(PENDING_NEW_ID_KEY)
}
