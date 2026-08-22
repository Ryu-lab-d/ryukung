import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodaySalesPanel } from './TodaySalesPanel'
import type { TodaySale } from './useTodaySales'

const sales: TodaySale[] = [
  { id: 'o1', order_no: 'RYB-000010', grand_total: 100, created_at: '2026-08-24T05:00:00Z' },
  { id: 'o2', order_no: 'RYB-000011', grand_total: 60, created_at: '2026-08-24T06:00:00Z' },
]

describe('TodaySalesPanel', () => {
  it('กำลังโหลด ไม่แสดงอะไรเลย', () => {
    const { container } = render(<TodaySalesPanel sales={[]} loading={true} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('แสดงยอดรวมและจำนวนบิลถูกต้อง ยังไม่กางรายการ', () => {
    render(<TodaySalesPanel sales={sales} loading={false} />)
    expect(screen.getByText('ยอดขายวันนี้ (2 บิล)')).toBeInTheDocument()
    expect(screen.getByText('160.00 บาท')).toBeInTheDocument()
    expect(screen.queryByText(/RYB-000010/)).not.toBeInTheDocument()
  })

  it('แตะแถบ กางดูรายการแต่ละบิล มีลิงก์ไปใบเสร็จ', async () => {
    render(<TodaySalesPanel sales={sales} loading={false} />)
    await userEvent.click(screen.getByRole('button', { name: /ยอดขายวันนี้/ }))
    const link = screen.getByRole('link', { name: /RYB-000010/ })
    expect(link).toHaveAttribute('href', '/orders/o1/receipt')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('ไม่มีการขายเลยวันนี้ กางแล้วแสดงข้อความว่าง', async () => {
    render(<TodaySalesPanel sales={[]} loading={false} />)
    expect(screen.getByText('ยอดขายวันนี้ (0 บิล)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /ยอดขายวันนี้/ }))
    expect(screen.getByText('ยังไม่มีการขายวันนี้')).toBeInTheDocument()
  })
})
