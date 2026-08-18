import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { WithdrawalsPage } from './WithdrawalsPage'
import type { WithdrawalListItem } from './useWithdrawals'

let withdrawalsOverride: WithdrawalListItem[] = []
let loadingOverride = false
vi.mock('./useWithdrawals', () => ({
  useWithdrawals: () => ({ withdrawals: withdrawalsOverride, loading: loadingOverride, reload: vi.fn() }),
}))

let sessionOverride: { user: { id: string } } | null = null
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ session: sessionOverride }),
}))

let staffMembersOverride: { id: string; user_id: string | null }[] = []
vi.mock('../staff/useStaffMembers', () => ({
  useStaffMembers: () => ({ members: staffMembersOverride }),
}))

function renderPage() {
  render(
    <MemoryRouter>
      <WithdrawalsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionOverride = null
  staffMembersOverride = []
})

describe('WithdrawalsPage', () => {
  it('ยังไม่เคยเบิกของเลย แสดงข้อความชวนกดเบิกของใหม่', () => {
    withdrawalsOverride = []
    loadingOverride = false
    renderPage()
    expect(screen.getByText(/ยังไม่เคยเบิกของเลย/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ เบิกของใหม่' })).toHaveAttribute('href', '/withdrawals/new')
  })

  it('รายการที่ยังไม่ปิดรอบ แสดงสถานะ "กำลังขาย" และจำนวนที่เบิกไป', () => {
    withdrawalsOverride = [
      {
        id: 'w1',
        withdrawn_at: '2026-08-10',
        location: 'โรงเรียน',
        status: 'open',
        settled_at: null,
        withdrawn_by: 'staff1',
        staff_members: { display_name: 'น้องริว', email: 'ryu@example.com' },
        proceeds_received: false,
        items: [{ qty_out: 20, qty_sold: null, amount_collected: null, unit_cost: 15, is_wage: false }],
      },
    ]
    renderPage()
    expect(screen.getByText('กำลังขาย')).toBeInTheDocument()
    expect(screen.getByText(/เบิกไป 20 ชิ้น/)).toBeInTheDocument()
    expect(screen.getByText(/น้องริว/)).toBeInTheDocument()
  })

  it('รายการที่ปิดรอบแล้ว แสดงยอดขายและกำไรที่คำนวณจากข้อมูลจริง', () => {
    withdrawalsOverride = [
      {
        id: 'w2',
        withdrawn_at: '2026-08-09',
        location: null,
        status: 'settled',
        settled_at: '2026-08-09T12:00:00Z',
        withdrawn_by: null,
        staff_members: null,
        proceeds_received: true,
        items: [{ qty_out: 20, qty_sold: 18, amount_collected: 720, unit_cost: 15, is_wage: false }],
      },
    ]
    renderPage()
    expect(screen.getByText('ปิดรอบแล้ว')).toBeInTheDocument()
    expect(screen.getByText(/ขายได้ 18\/20 ชิ้น \(90%\)/)).toBeInTheDocument()
    // กำไร = รายรับ 720 - ต้นทุน (20*15=300) = 420
    expect(screen.getByText(/กำไร 420\.00/)).toBeInTheDocument()
    expect(screen.getByText('👤 ไม่ระบุผู้เบิก')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /ขายได้ 18\/20/ })
    expect(link).toHaveAttribute('href', '/withdrawals/w2')
  })
})

describe('WithdrawalsPage — เงินค้างเก็บ', () => {
  it('ปิดรอบแล้วแต่ยังไม่ได้รับเงิน แสดง banner พร้อมชื่อผู้เบิกและจำนวนเงินที่ค้าง และ badge ต่อแถว', () => {
    withdrawalsOverride = [
      {
        id: 'w3',
        withdrawn_at: '2026-08-09',
        location: null,
        status: 'settled',
        settled_at: '2026-08-09T12:00:00Z',
        withdrawn_by: 's2',
        staff_members: { display_name: 'น้องริว', email: 'ryu@example.com' },
        proceeds_received: false,
        items: [{ qty_out: 20, qty_sold: 18, amount_collected: 720, unit_cost: 15, is_wage: false }],
      },
    ]
    renderPage()
    expect(screen.getByText(/ยังไม่เก็บเงิน 1 รายการ รวม 720\.00 บาท/)).toBeInTheDocument()
    expect(screen.getAllByText(/น้องริว/).length).toBeGreaterThan(0) // ระบุชื่อผู้ที่ยังไม่จ่ายในสรุปด้านบน
    expect(screen.getByText('ยังไม่เก็บเงิน')).toBeInTheDocument()
  })

  it('ได้รับเงินแล้ว ไม่แสดง banner หรือ badge', () => {
    withdrawalsOverride = [
      {
        id: 'w4',
        withdrawn_at: '2026-08-09',
        location: null,
        status: 'settled',
        settled_at: '2026-08-09T12:00:00Z',
        withdrawn_by: null,
        staff_members: null,
        proceeds_received: true,
        items: [{ qty_out: 20, qty_sold: 18, amount_collected: 720, unit_cost: 15, is_wage: false }],
      },
    ]
    renderPage()
    expect(screen.queryByText(/ยังไม่เก็บเงิน/)).not.toBeInTheDocument()
  })
})

describe('WithdrawalsPage — ของฉันเท่านั้น', () => {
  it('ไม่ใช่พนักงานที่ผูกบัญชีไว้ ไม่แสดงปุ่มกรอง', () => {
    sessionOverride = { user: { id: 'user-x' } }
    staffMembersOverride = []
    renderPage()
    expect(screen.queryByRole('button', { name: 'ของฉันเท่านั้น' })).not.toBeInTheDocument()
  })

  it('เป็นพนักงานที่ผูกบัญชีไว้ กดกรองเหลือเฉพาะรายการของตัวเอง', async () => {
    sessionOverride = { user: { id: 'user-1' } }
    staffMembersOverride = [{ id: 'staff1', user_id: 'user-1' }]
    withdrawalsOverride = [
      {
        id: 'w5',
        withdrawn_at: '2026-08-10',
        location: 'โรงเรียน',
        status: 'open',
        settled_at: null,
        withdrawn_by: 'staff1',
        staff_members: { display_name: 'ของฉัน', email: 'me@example.com' },
        proceeds_received: false,
        items: [{ qty_out: 5, qty_sold: null, amount_collected: null, unit_cost: 10, is_wage: false }],
      },
      {
        id: 'w6',
        withdrawn_at: '2026-08-10',
        location: 'ตลาดนัด',
        status: 'open',
        settled_at: null,
        withdrawn_by: 'staff2',
        staff_members: { display_name: 'คนอื่น', email: 'other@example.com' },
        proceeds_received: false,
        items: [{ qty_out: 5, qty_sold: null, amount_collected: null, unit_cost: 10, is_wage: false }],
      },
    ]
    renderPage()
    expect(screen.getByText('👤 ของฉัน')).toBeInTheDocument()
    expect(screen.getByText('👤 คนอื่น')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ของฉันเท่านั้น' }))
    expect(screen.getByText('👤 ของฉัน')).toBeInTheDocument()
    expect(screen.queryByText('👤 คนอื่น')).not.toBeInTheDocument()
  })
})
