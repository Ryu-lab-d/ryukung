import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOrderBoard } from './useOrderBoard'

let rows: any[] = []
const playPaymentSound = vi.fn()
vi.mock('../lib/uiSound', () => ({ playPaymentSound: () => playPaymentSound() }))
vi.mock('../lib/autoNotify', () => ({ notifyStatusChanged: vi.fn() }))

let onChange: (() => void) | null = null
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ neq: () => ({ order: async () => ({ data: rows }) }) }) }),
    channel: () => {
      const ch: any = {
        on: (_e: string, _f: unknown, cb: () => void) => { onChange = cb; return ch },
        subscribe: () => ch,
      }
      return ch
    },
    removeChannel: vi.fn(),
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
  onChange = null
})
afterEach(() => vi.useRealTimers())

describe('useOrderBoard — อัปเดตเอง', () => {
  it('ออเดอร์ลูกค้าใหม่เข้ามาตอน realtime แจ้งเตือน → โผล่ในกระดาน + เสียงเตือน แต่ของเก่าตอนโหลดครั้งแรกไม่เตือน', async () => {
    const { result } = renderHook(() => useOrderBoard())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.orders).toHaveLength(1)
    expect(result.current.newOrders).toHaveLength(0)
    expect(playPaymentSound).not.toHaveBeenCalled()

    rows = [order('OLD-1'), order('NEW-2')]
    await act(async () => {
      onChange?.()
      await vi.advanceTimersByTimeAsync(1000)
    })
    await waitFor(() => expect(result.current.orders).toHaveLength(2))
    expect(result.current.newOrders.map((o) => o.id)).toEqual(['NEW-2'])
    expect(playPaymentSound).toHaveBeenCalledTimes(1)
  })

  it('ไม่มี realtime ก็ยังดึงใหม่เองทุก 20 วินาที', async () => {
    const { result } = renderHook(() => useOrderBoard())
    await waitFor(() => expect(result.current.loading).toBe(false))
    rows = [order('OLD-1'), order('NEW-3')]
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20500)
    })
    await waitFor(() => expect(result.current.orders).toHaveLength(2))
  })
})
