import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WithdrawalsPage } from './WithdrawalsPage'
import type { WithdrawalListItem } from './useWithdrawals'

let withdrawalsOverride: WithdrawalListItem[] = []
let loadingOverride = false
vi.mock('./useWithdrawals', () => ({
  useWithdrawals: () => ({ withdrawals: withdrawalsOverride, loading: loadingOverride, reload: vi.fn() }),
}))

function renderPage() {
  render(
    <MemoryRouter>
      <WithdrawalsPage />
    </MemoryRouter>
  )
}

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
        items: [{ qty_out: 20, qty_sold: null, amount_collected: null, unit_cost: 15 }],
      },
    ]
    renderPage()
    expect(screen.getByText('กำลังขาย')).toBeInTheDocument()
    expect(screen.getByText(/เบิกไป 20 ชิ้น/)).toBeInTheDocument()
  })

  it('รายการที่ปิดรอบแล้ว แสดงยอดขายและกำไรที่คำนวณจากข้อมูลจริง', () => {
    withdrawalsOverride = [
      {
        id: 'w2',
        withdrawn_at: '2026-08-09',
        location: null,
        status: 'settled',
        settled_at: '2026-08-09T12:00:00Z',
        items: [{ qty_out: 20, qty_sold: 18, amount_collected: 720, unit_cost: 15 }],
      },
    ]
    renderPage()
    expect(screen.getByText('ปิดรอบแล้ว')).toBeInTheDocument()
    expect(screen.getByText(/ขายได้ 18\/20 ชิ้น \(90%\)/)).toBeInTheDocument()
    // กำไร = รายรับ 720 - ต้นทุน (20*15=300) = 420
    expect(screen.getByText(/กำไร 420\.00/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /ขายได้ 18\/20/ })
    expect(link).toHaveAttribute('href', '/withdrawals/w2')
  })
})
