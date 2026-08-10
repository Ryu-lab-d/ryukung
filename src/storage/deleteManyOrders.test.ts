import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteManyOrders } from './deleteManyOrders'

const maybeSingle = vi.fn()
const eq = vi.fn((..._args: unknown[]) => ({ maybeSingle }))
const select = vi.fn((..._args: unknown[]) => ({ eq }))
const from = vi.fn((..._args: unknown[]) => ({ select }))
vi.mock('../lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => from(...args) } }))

const deleteOrder = vi.fn()
vi.mock('../orders/api', () => ({ deleteOrder: (...args: unknown[]) => deleteOrder(...args) }))

const archiveOrderToSheets = vi.fn()
vi.mock('../lib/sheetsArchive', () => ({ archiveOrderToSheets: (...args: unknown[]) => archiveOrderToSheets(...args) }))

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    order_no: 'RYB-000001',
    fulfillment_type: 'pickup',
    grand_total: 80,
    payment_status: 'paid',
    needed_date: '2026-08-10',
    delivered_at: '2026-08-09T10:00:00Z',
    created_at: '2026-08-08T10:00:00Z',
    customers: { name: 'Somchai', phone: '0812345678' },
    order_items: [{ product_name: 'คุกกี้', qty: 2 }],
    ...overrides,
  }
}

describe('deleteManyOrders', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
    deleteOrder.mockReset()
    archiveOrderToSheets.mockReset()
  })

  it('สำรองไป Sheets สำเร็จก่อน แล้วค่อยลบออเดอร์จริง', async () => {
    maybeSingle.mockResolvedValue({ data: orderRow() })
    archiveOrderToSheets.mockResolvedValue({ error: null })
    deleteOrder.mockResolvedValue({ error: null })

    const { errors } = await deleteManyOrders(['order-1'])

    expect(archiveOrderToSheets).toHaveBeenCalledWith(
      expect.objectContaining({
        order_no: 'RYB-000001',
        customer_name: 'Somchai',
        customer_phone: '0812345678',
        items_summary: 'คุกกี้ x2',
        grand_total: 80,
      })
    )
    expect(deleteOrder).toHaveBeenCalledWith('order-1')
    expect(errors).toEqual([])
  })

  it('สำรองไป Sheets ไม่สำเร็จ ต้องไม่ลบออเดอร์นั้น กันข้อมูลหายโดยไม่มีสำเนา', async () => {
    maybeSingle.mockResolvedValue({ data: orderRow() })
    archiveOrderToSheets.mockResolvedValue({ error: 'บันทึกสำรองลง Google Sheets ไม่สำเร็จ (HTTP 500)' })

    const { errors } = await deleteManyOrders(['order-1'])

    expect(deleteOrder).not.toHaveBeenCalled()
    expect(errors).toEqual(['RYB-000001: บันทึกสำรองลง Google Sheets ไม่สำเร็จ (HTTP 500)'])
  })

  it('หลายออเดอร์ อันที่สำรองไม่สำเร็จข้ามไป แต่อันอื่นที่สำเร็จยังลบต่อได้ตามปกติ', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: orderRow({ order_no: 'RYB-000001' }) })
      .mockResolvedValueOnce({ data: orderRow({ order_no: 'RYB-000002' }) })
    archiveOrderToSheets
      .mockResolvedValueOnce({ error: 'ล้มเหลว' })
      .mockResolvedValueOnce({ error: null })
    deleteOrder.mockResolvedValue({ error: null })

    const { errors } = await deleteManyOrders(['order-1', 'order-2'])

    expect(deleteOrder).toHaveBeenCalledTimes(1)
    expect(deleteOrder).toHaveBeenCalledWith('order-2')
    expect(errors).toEqual(['RYB-000001: ล้มเหลว'])
  })
})
