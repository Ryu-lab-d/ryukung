import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  loadDraftFromLocalStorage,
  clearDraftFromLocalStorage,
  useOrderDraftAutosave,
  getPendingNewOrderId,
  setPendingNewOrderId,
  clearPendingNewOrderId,
} from './useOrderDraftAutosave'

beforeEach(() => {
  localStorage.clear()
})

describe('useOrderDraftAutosave — ร่างออเดอร์รายตัว', () => {
  it('บันทึกร่างด้วย orderId แล้วอ่านคืนได้', () => {
    renderHook(() => useOrderDraftAutosave('order-1', { customer_id: 'c1' }))
    expect(loadDraftFromLocalStorage('order-1')).toEqual({ customer_id: 'c1' })
  })

  it('orderId เป็น null ไม่บันทึกอะไรเลย (ยังไม่มีแถวร่างในฐานข้อมูล)', () => {
    renderHook(() => useOrderDraftAutosave(null, { customer_id: 'c1' }))
    expect(loadDraftFromLocalStorage('null')).toBeNull()
  })

  it('clearDraftFromLocalStorage ลบร่างทิ้ง', () => {
    renderHook(() => useOrderDraftAutosave('order-2', { customer_id: 'c2' }))
    clearDraftFromLocalStorage('order-2')
    expect(loadDraftFromLocalStorage('order-2')).toBeNull()
  })
})

describe('pending-new-order-id — กู้ร่างออเดอร์ใหม่กลับมาได้แม้ URL ไม่มี id ให้อ้างอิง', () => {
  it('ยังไม่เคยสร้างร่างค้างไว้ ได้ null', () => {
    expect(getPendingNewOrderId()).toBeNull()
  })

  it('จำ id ของร่างที่กำลังสร้างไว้ อ่านคืนได้ทันที (จำลองมือถือรีโหลดแท็บพื้นหลังทิ้ง)', () => {
    setPendingNewOrderId('draft-abc-123')
    expect(getPendingNewOrderId()).toBe('draft-abc-123')
  })

  it('บันทึกร่าง/ยืนยันสำเร็จแล้วเรียก clearPendingNewOrderId — "+ สร้างออเดอร์ใหม่" ครั้งหน้าไม่กลับมาที่แถวเดิม', () => {
    setPendingNewOrderId('draft-abc-123')
    clearPendingNewOrderId()
    expect(getPendingNewOrderId()).toBeNull()
  })
})
