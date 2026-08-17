import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseFormModal } from './ExpenseFormModal'
import type { Expense } from './useExpenses'

const saveExpense = vi.fn()
vi.mock('./expensesApi', () => ({ saveExpense: (...args: unknown[]) => saveExpense(...args) }))

const onClose = vi.fn()
const onSaved = vi.fn()
const onDelete = vi.fn()

beforeEach(() => {
  saveExpense.mockReset()
  onClose.mockReset()
  onSaved.mockReset()
  onDelete.mockReset()
})

function renderNew() {
  render(<ExpenseFormModal expense={null} onClose={onClose} onSaved={onSaved} />)
}

function existingExpense(overrides: Partial<Expense> = {}): Expense {
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

describe('ExpenseFormModal — เพิ่มใหม่', () => {
  it('ไม่กรอกจำนวนเงิน กดบันทึกแล้วขึ้น error ไม่ยิง saveExpense', async () => {
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('กรุณาใส่จำนวนเงินให้ถูกต้อง')).toBeInTheDocument()
    expect(saveExpense).not.toHaveBeenCalled()
  })

  it('กรอกครบแล้วบันทึก ส่งค่าที่กรอกไปยัง saveExpense ครบถ้วน', async () => {
    saveExpense.mockResolvedValue({ id: 'new-id', error: null })
    renderNew()
    const dateInput = screen.getByLabelText('วันที่')
    await userEvent.clear(dateInput)
    await userEvent.type(dateInput, '2026-08-15')
    await userEvent.selectOptions(screen.getByLabelText('หมวดหมู่'), 'marketing')
    await userEvent.type(screen.getByLabelText('จำนวนเงิน (บาท)'), '500')
    await userEvent.type(screen.getByLabelText('หมายเหตุ (ไม่บังคับ)'), 'บูสต์โพสต์เฟซบุ๊ก')

    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(saveExpense).toHaveBeenCalledWith(null, {
      expense_date: '2026-08-15',
      category: 'marketing',
      amount: 500,
      note: 'บูสต์โพสต์เฟซบุ๊ก',
    })
  })

  it('บันทึกสำเร็จ ขึ้นป็อปอัพยืนยันก่อนแล้วค่อยเรียก onSaved', async () => {
    saveExpense.mockResolvedValue({ id: 'new-id', error: null })
    renderNew()
    await userEvent.type(screen.getByLabelText('จำนวนเงิน (บาท)'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('บันทึกรายจ่ายแล้ว')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 1300))
    expect(onSaved).toHaveBeenCalled()
  }, 10000)

  it('ไม่มีปุ่มลบตอนเพิ่มใหม่ (ยังไม่มี expense ให้ลบ)', () => {
    renderNew()
    expect(screen.queryByText('🗑️ ลบรายจ่ายนี้')).not.toBeInTheDocument()
  })

  it('กด "ยกเลิก" ปิดป็อปอัพโดยไม่บันทึกอะไร', async () => {
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalled()
    expect(saveExpense).not.toHaveBeenCalled()
  })
})

describe('ExpenseFormModal — แก้ไขของเดิม', () => {
  it('เติมฟอร์มด้วยข้อมูลเดิม', () => {
    render(<ExpenseFormModal expense={existingExpense()} onClose={onClose} onSaved={onSaved} />)
    expect(screen.getByLabelText('วันที่')).toHaveValue('2026-08-10')
    expect(screen.getByLabelText('หมวดหมู่')).toHaveValue('packaging')
    expect(screen.getByLabelText('จำนวนเงิน (บาท)')).toHaveValue(250)
    expect(screen.getByLabelText('หมายเหตุ (ไม่บังคับ)')).toHaveValue('ถุงกระดาษ')
  })

  it('บันทึกแก้ไข ส่ง id เดิมไปด้วย', async () => {
    saveExpense.mockResolvedValue({ id: 'e1', error: null })
    render(<ExpenseFormModal expense={existingExpense()} onClose={onClose} onSaved={onSaved} />)
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(saveExpense).toHaveBeenCalledWith('e1', expect.objectContaining({ amount: 250 }))
  })

  it('มีปุ่มลบ กดแล้วเรียก onDelete', async () => {
    render(<ExpenseFormModal expense={existingExpense()} onClose={onClose} onSaved={onSaved} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: '🗑️ ลบรายจ่ายนี้' }))
    expect(onDelete).toHaveBeenCalled()
  })
})
