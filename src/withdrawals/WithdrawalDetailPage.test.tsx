import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { WithdrawalDetailPage } from './WithdrawalDetailPage'

let withdrawalOverride: any = null
let itemsOverride: any[] = []
let loadingOverride = false
const reload = vi.fn()
vi.mock('./useWithdrawal', () => ({
  useWithdrawal: () => ({ withdrawal: withdrawalOverride, items: itemsOverride, loading: loadingOverride, reload }),
}))

const settleWithdrawal = vi.fn()
const reopenWithdrawal = vi.fn()
const deleteWithdrawal = vi.fn()
vi.mock('./api', () => ({
  settleWithdrawal: (...args: unknown[]) => settleWithdrawal(...args),
  reopenWithdrawal: (...args: unknown[]) => reopenWithdrawal(...args),
  deleteWithdrawal: (...args: unknown[]) => deleteWithdrawal(...args),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/withdrawals/w1']}>
      <Routes>
        <Route path="/withdrawals/:id" element={<WithdrawalDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  withdrawalOverride = { id: 'w1', withdrawn_at: '2026-08-10', location: 'โรงเรียน', note: null, status: 'open', settled_at: null }
  itemsOverride = [
    { id: 'i1', product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 20, qty_sold: null, amount_collected: null },
  ]
  loadingOverride = false
  settleWithdrawal.mockReset()
  reopenWithdrawal.mockReset()
  deleteWithdrawal.mockReset()
  navigate.mockReset()
  reload.mockReset()
})

describe('WithdrawalDetailPage — ยังไม่ปิดรอบ', () => {
  it('แสดงชื่อผู้เบิกที่ผูกไว้', async () => {
    withdrawalOverride = {
      ...withdrawalOverride,
      withdrawn_by: 's2',
      staff_members: { display_name: 'น้องริว', email: 'ryu@example.com' },
    }
    renderPage()
    expect(await screen.findByText('👤 ผู้เบิก: น้องริว')).toBeInTheDocument()
  })

  it('ไม่ได้ผูกผู้เบิกไว้ แสดง "ไม่ระบุ"', async () => {
    renderPage()
    expect(await screen.findByText('👤 ผู้เบิก: ไม่ระบุ')).toBeInTheDocument()
  })

  it('กรอกจำนวนที่ขายได้ ระบบเดาจำนวนเงินให้อัตโนมัติจากราคาสินค้า แต่ยังแก้ไขเองได้', async () => {
    renderPage()
    const qtySoldInput = await screen.findByLabelText('ขายได้กี่ชิ้น')
    await userEvent.type(qtySoldInput, '18')
    const amountInput = screen.getByLabelText('ได้เงินเท่าไหร่ (บาท)') as HTMLInputElement
    expect(amountInput.value).toBe('720') // 18 * 40 (unit_price)

    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '700')
    expect(amountInput.value).toBe('700') // แก้เองแล้วไม่ถูกทับด้วยค่าเดาอัตโนมัติอีก
  })

  it('กดปิดรอบ ส่งค่าที่กรอกไป settleWithdrawal ถูกต้อง', async () => {
    settleWithdrawal.mockResolvedValue({ error: null })
    renderPage()
    await userEvent.type(await screen.findByLabelText('ขายได้กี่ชิ้น'), '18')
    await userEvent.click(screen.getByRole('button', { name: 'ปิดรอบ / บันทึกผลขาย' }))

    expect(settleWithdrawal).toHaveBeenCalledWith('w1', [{ id: 'i1', qty_sold: 18, amount_collected: 720 }])
    expect(reload).toHaveBeenCalled()
  })
})

describe('WithdrawalDetailPage — ปิดรอบแล้ว', () => {
  beforeEach(() => {
    withdrawalOverride = { id: 'w1', withdrawn_at: '2026-08-10', location: 'โรงเรียน', note: null, status: 'settled', settled_at: '2026-08-10T12:00:00Z' }
    itemsOverride = [
      { id: 'i1', product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 20, qty_sold: 18, amount_collected: 720 },
    ]
  })

  it('แสดงสรุปกำไรที่คำนวณถูกต้อง (รายรับ - ต้นทุนจาก qty_out)', async () => {
    renderPage()
    expect(await screen.findByText(/ขายได้ 18\/20 ชิ้น/)).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    // ต้นทุน = 20*15 = 300, กำไร = 720-300 = 420
    expect(screen.getByText('420.00')).toBeInTheDocument()
  })

  it('กด "แก้ไขผลขาย" เรียก reopenWithdrawal', async () => {
    reopenWithdrawal.mockResolvedValue({ error: null })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'แก้ไขผลขาย' }))
    expect(reopenWithdrawal).toHaveBeenCalledWith('w1')
  })
})

describe('WithdrawalDetailPage — ลบรายการ', () => {
  it('กดลบ ต้องยืนยันก่อน แล้วค่อยเรียก deleteWithdrawal และพากลับหน้ารายการ', async () => {
    deleteWithdrawal.mockResolvedValue({ error: null })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'ลบ' }))
    // ConfirmDialog ต่อท้าย DOM ทีหลัง ปุ่ม "ลบ" ยืนยันจึงเป็นตัวสุดท้ายเสมอ (ปุ่มเดิมที่กดเปิด dialog ยังอยู่ใน DOM ด้วย)
    const confirmButtons = screen.getAllByRole('button', { name: 'ลบ' })
    await userEvent.click(confirmButtons[confirmButtons.length - 1])
    expect(deleteWithdrawal).toHaveBeenCalledWith('w1')
    expect(navigate).toHaveBeenCalledWith('/withdrawals')
  })
})
