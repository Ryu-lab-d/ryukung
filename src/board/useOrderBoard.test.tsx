import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOrderBoard } from './useOrderBoard'

let rows: any[] = []
const playPaymentSound = vi.fn()
vi.mock('../lib/uiSound', () => ({ playPaymentSound: () => playPaymentSound() }))
vi.mock('../lib/autoNotify', () => ({ notifyStatusChanged: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ neq: () => ({ order: async () => ({ data: rows }) }) }) }),
  },
}))

const order = (id: string, extra: Record<string, unknown> = {}) => ({
  id, order_no: id, needed_date: null, bake_date: null, fulfillment_type: 'pickup', work_status: 'new', payment_status: 'unpaid',
  grand_total: 100, is_draft: true, order_source: 'customer', updated_at: new Date().toISOString(),
  customers: { name: 'ลูกค้า' }, order_items: [], staff_members: null, ...extra,
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  rows = [order('OLD-1')]
  playPaymentSound.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('useOrderBoard — อัปเดตเอง', () => {
  it('ออเดอร์ลูกค้าใหม่เข้ามา → โผล่ในกระดานเอง + เสียงเตือน แต่ของเก่าตอนโหลดครั้งแรกไม่เตือน', async () => {
    const { result } = renderHook(() => useOrderBoard())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.orders).toHaveLength(1)
    expect(result.current.newOrders).toHaveLength(0)
    expect(playPaymentSound).not.toHaveBeenCalled()

    rows = [order('OLD-1'), order('NEW-2')]
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12500)
    })
    await waitFor(() => expect(result.current.orders).toHaveLength(2))
    expect(result.current.newOrders.map((o) => o.id)).toEqual(['NEW-2'])
    expect(playPaymentSound).toHaveBeenCalledTimes(1)
  })

  it('ดึงใหม่เองเป็นระยะแม้ไม่มีใครกดรีเฟรช', async () => {
    const { result } = renderHook(() => useOrderBoard())
    await waitFor(() => expect(result.current.loading).toBe(false))
    rows = [order('OLD-1'), order('NEW-3')]
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12500)
    })
    await waitFor(() => expect(result.current.orders).toHaveLength(2))
  })
})
