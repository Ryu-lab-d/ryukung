import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CalendarPage } from './CalendarPage'

const addHoliday = vi.fn()
const removeHoliday = vi.fn()

vi.mock('./useCalendarOrders', () => ({
  useCalendarOrders: () => ({ byBakeDate: new Map(), byNeededDate: new Map(), loading: false, reload: vi.fn() }),
}))

vi.mock('./useHolidays', () => ({
  useHolidays: () => ({ holidays: [], loading: false, addHoliday, removeHoliday, reload: vi.fn() }),
}))

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('หน้าปฏิทินออเดอร์', () => {
  it('แสดงเดือนปัจจุบันและมีช่องวันครบ 42 ช่อง (ตาราง 6 แถว x 7 วัน)', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ }).length).toBe(42)
  })

  it('กดวันที่แล้วเปิดแผงรายละเอียด มีตัวเลือกตั้งวันหยุด', async () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: todayKey() }))
    expect(screen.getByText('ทำเครื่องหมายเป็นวันหยุดร้าน')).toBeInTheDocument()
  })

  it('กด "ตั้งเป็นวันหยุด" เรียก addHoliday', async () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: todayKey() }))
    await userEvent.click(screen.getByRole('button', { name: '🎌 ตั้งเป็นวันหยุด' }))
    expect(addHoliday).toHaveBeenCalledWith(todayKey(), null)
  })
})
