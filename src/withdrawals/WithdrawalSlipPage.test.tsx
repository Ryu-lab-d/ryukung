import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { WithdrawalSlipPage, withdrawalSlipNo } from './WithdrawalSlipPage'

let settled = false
vi.mock('./useWithdrawal', () => ({
  useWithdrawal: () => ({
    withdrawal: {
      id: 'abcd1234-0000-0000-0000-000000000000',
      withdrawn_at: '2026-08-10',
      created_at: '2026-08-10T09:15:00Z',
      location: 'โรงเรียน',
      note: null,
      status: settled ? 'settled' : 'open',
      settled_at: null,
      staff_members: { display_name: 'น้องริว', email: 'r@x.com' },
      creator: null,
      wage_type: null,
      wage_cash_amount: null,
      wage_paid: false,
    },
    items: [{ id: 'i1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 20, qty_sold: 15, amount_collected: 600, is_wage: false }],
    loading: false,
    reload: vi.fn(),
  }),
}))
vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ settings: { shop_name: 'RYUKUNG BAKERY', logo_path: null } }) }))

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/withdrawals/w1/slip']}>
      <Routes>
        <Route path="/withdrawals/:id/slip" element={<WithdrawalSlipPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('WithdrawalSlipPage', () => {
  it('เลขที่ใบเบิกมาจาก id', () => {
    expect(withdrawalSlipNo('abcd1234-0000-0000-0000-000000000000')).toBe('WD-ABCD1234')
  })

  it('แสดงใบเบิกพร้อมรายการและมูลค่า', () => {
    settled = false
    renderPage()
    expect(screen.getAllByText('WD-ABCD1234').length).toBeGreaterThan(0)
    expect(screen.getByText('คุกกี้')).toBeInTheDocument()
    expect(screen.getAllByText('น้องริว').length).toBeGreaterThan(0)
    expect(screen.getByText('รอปิดรอบ')).toBeInTheDocument()
  })

  it('ปิดรอบแล้วแสดงผลการขาย', () => {
    settled = true
    renderPage()
    expect(screen.getByText('ปิดรอบแล้ว')).toBeInTheDocument()
    expect(screen.getByText('15 ชิ้น')).toBeInTheDocument()
  })
})
