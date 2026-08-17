import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ExpensesPage } from './ExpensesPage'
import type { Expense } from './useExpenses'

let expensesOverride: Expense[] = []
let loadingOverride = false
const reload = vi.fn()
vi.mock('./useExpenses', () => ({
  useExpenses: () => ({ expenses: expensesOverride, loading: loadingOverride, reload }),
}))

const deleteExpense = vi.fn()
vi.mock('./expensesApi', () => ({ deleteExpense: (...args: unknown[]) => deleteExpense(...args) }))

vi.mock('./ExpenseFormModal', () => ({
  ExpenseFormModal: ({ expense, onClose, onSaved, onDelete }: any) => (
    <div>
      <p>Expense Modal {expense ? `(edit ${expense.id})` : '(new)'}</p>
      <button type="button" onClick={onClose}>ปิด (mock)</button>
      <button type="button" onClick={onSaved}>บันทึกแล้ว (mock)</button>
      {onDelete && <button type="button" onClick={onDelete}>ลบ (mock)</button>}
    </div>
  ),
}))

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    expense_date: '2026-08-10',
    category: 'packaging',
    amount: 250,
    note: 'ถุงกระดาษ',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <ExpensesPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  expensesOverride = []
  loadingOverride = false
  reload.mockReset()
  deleteExpense.mockReset()
})

describe('ExpensesPage', () => {
  it('ยังไม่มีรายจ่ายเลย แสดงข้อความชวนบันทึก', () => {
    renderPage()
    expect(screen.getByText(/ยังไม่มีรายจ่ายในช่วงนี้/)).toBeInTheDocument()
  })

  it('แสดงรายการรายจ่ายพร้อมยอดรวม', () => {
    expensesOverride = [makeExpense({ amount: 250 }), makeExpense({ id: 'e2', category: 'marketing', amount: 500, note: null })]
    renderPage()
    expect(screen.getByText('บรรจุภัณฑ์/ถุง/กล่อง')).toBeInTheDocument()
    expect(screen.getByText('การตลาด/โฆษณา')).toBeInTheDocument()
    // ยอดรวม 250+500 = 750
    expect(screen.getByText('750.00')).toBeInTheDocument()
  })

  it('กดปุ่ม "+ บันทึกรายจ่าย" เปิดป็อปอัพแบบเพิ่มใหม่', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ บันทึกรายจ่าย' }))
    expect(screen.getByText('Expense Modal (new)')).toBeInTheDocument()
  })

  it('กดแถวรายจ่าย เปิดป็อปอัพแบบแก้ไขของแถวนั้น', async () => {
    expensesOverride = [makeExpense({ id: 'e2' })]
    renderPage()
    await userEvent.click(screen.getByText('บรรจุภัณฑ์/ถุง/กล่อง'))
    expect(screen.getByText('Expense Modal (edit e2)')).toBeInTheDocument()
  })

  it('บันทึกสำเร็จจากป็อปอัพ ปิดป็อปอัพและโหลดรายการใหม่', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ บันทึกรายจ่าย' }))
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกแล้ว (mock)' }))
    expect(screen.queryByText(/Expense Modal/)).not.toBeInTheDocument()
    expect(reload).toHaveBeenCalled()
  })

  it('กดลบในป็อปอัพแก้ไข ต้องยืนยันก่อนถึงเรียก deleteExpense จริง', async () => {
    deleteExpense.mockResolvedValue({ error: null })
    expensesOverride = [makeExpense({ id: 'e2' })]
    renderPage()
    await userEvent.click(screen.getByText('บรรจุภัณฑ์/ถุง/กล่อง'))
    await userEvent.click(screen.getByRole('button', { name: 'ลบ (mock)' }))
    expect(deleteExpense).not.toHaveBeenCalled()

    const confirmButtons = screen.getAllByRole('button', { name: 'ลบ' })
    await userEvent.click(confirmButtons[confirmButtons.length - 1])
    expect(deleteExpense).toHaveBeenCalledWith('e2')
    expect(reload).toHaveBeenCalled()
  })

  it('มีลิงก์กลับไปหน้าสรุปยอด', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /กลับหน้าสรุปยอด/ })).toHaveAttribute('href', '/summary')
  })
})
