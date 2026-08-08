import { useEffect } from 'react'

const PREFIX = 'ryukung-order-draft:'

export function saveDraftToLocalStorage<T>(orderId: string, draft: T) {
  try {
    localStorage.setItem(PREFIX + orderId, JSON.stringify(draft))
  } catch {
    // localStorage เต็มหรือถูกปิดใช้งาน — ยอมเสียฟีเจอร์นี้ไปโดยไม่ทำให้แอปพัง
  }
}

export function loadDraftFromLocalStorage<T>(orderId: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + orderId)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearDraftFromLocalStorage(orderId: string) {
  try {
    localStorage.removeItem(PREFIX + orderId)
  } catch {
    // เหตุผลเดียวกับด้านบน
  }
}

export function useOrderDraftAutosave<T>(orderId: string | null, draft: T) {
  useEffect(() => {
    if (!orderId) return
    saveDraftToLocalStorage(orderId, draft)
  }, [orderId, draft])
}
