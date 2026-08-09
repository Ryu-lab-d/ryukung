import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { StorageManagementPage } from './StorageManagementPage'

const deleteOverdue = vi.fn().mockResolvedValue({ errors: [] })
const deleteCancelled = vi.fn().mockResolvedValue({ errors: [] })
const deleteDrafts = vi.fn().mockResolvedValue({ errors: [] })
const removeHoliday = vi.fn().mockResolvedValue({ error: null })
const removeQuestion = vi.fn().mockResolvedValue({ error: null })

vi.mock('./useStorageCleanup', () => ({
  useStorageCleanup: () => ({ orders: [], loading: false, deleteMany: deleteOverdue, reload: vi.fn() }),
}))

vi.mock('./useCancelledOrders', () => ({
  useCancelledOrders: () => ({
    orders: [
      { id: 'c1', order_no: 'RYB-000009', customer_name: 'ลูกค้าทดสอบ', grand_total: 200, refund_status: 'pending', updated_at: '2026-08-01T00:00:00Z' },
    ],
    loading: false,
    deleteMany: deleteCancelled,
    reload: vi.fn(),
  }),
}))

vi.mock('./useAbandonedDrafts', () => ({
  useAbandonedDrafts: () => ({ drafts: [], loading: false, deleteMany: deleteDrafts, reload: vi.fn() }),
}))

vi.mock('../calendar/useHolidays', () => ({
  useHolidays: () => ({
    holidays: [
      { id: 'h-past', holiday_date: '2020-01-01', note: 'วันหยุดเก่า' },
      { id: 'h-future', holiday_date: '2099-01-01', note: 'วันหยุดอนาคต' },
    ],
    loading: false,
    addHoliday: vi.fn(),
    removeHoliday,
    reload: vi.fn(),
  }),
}))

vi.mock('../chatbot/useUnansweredQuestions', () => ({
  useUnansweredQuestions: () => ({ questions: [], loading: false, remove: removeQuestion, reload: vi.fn() }),
}))

function renderPage() {
  render(<MemoryRouter><StorageManagementPage /></MemoryRouter>)
}

describe('หน้าจัดการพื้นที่จัดเก็บ (รวมทุกหมวด)', () => {
  it('แสดงออเดอร์ที่ยกเลิกแล้ว พร้อมเตือนสถานะคืนเงินที่ยังไม่เสร็จ', () => {
    renderPage()
    expect(screen.getByText(/RYB-000009/)).toBeInTheDocument()
    expect(screen.getByText(/รอคืนเงิน/)).toBeInTheDocument()
  })

  it('วันหยุดในปฏิทิน กรองให้เหลือแค่วันที่ผ่านไปแล้ว ไม่โชว์วันหยุดในอนาคต', () => {
    renderPage()
    expect(screen.getByText('2020-01-01')).toBeInTheDocument()
    expect(screen.queryByText('2099-01-01')).not.toBeInTheDocument()
  })

  it('เลือกออเดอร์ที่ยกเลิกแล้วกดลบที่เลือก เรียก deleteMany ของหมวดนั้นด้วย id ที่ถูกต้อง', async () => {
    renderPage()
    const cancelledSection = screen.getByText(/ออเดอร์ที่ยกเลิกแล้ว/).closest('section')!
    await userEvent.click(within(cancelledSection).getByRole('checkbox', { name: /เลือกทั้งหมด/ }))
    await userEvent.click(within(cancelledSection).getByRole('button', { name: /ลบที่เลือก/ }))
    await userEvent.click(screen.getByRole('button', { name: 'ลบถาวร' }))
    expect(deleteCancelled).toHaveBeenCalledWith(['c1'])
  })

  it('ลบวันหยุดเก่า เรียก removeHoliday ด้วย id ของวันหยุดนั้น', async () => {
    renderPage()
    const holidaySection = screen.getByText(/วันหยุดในปฏิทินที่ผ่านไปแล้ว/).closest('section')!
    await userEvent.click(within(holidaySection).getByRole('button', { name: /ลบทั้งหมด/ }))
    await userEvent.click(screen.getByRole('button', { name: 'ลบถาวร' }))
    expect(removeHoliday).toHaveBeenCalledWith('h-past')
  })
})
