import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IngredientFormModal } from './IngredientFormModal'

const saveIngredient = vi.fn()
vi.mock('./api', () => ({ saveIngredient: (...args: unknown[]) => saveIngredient(...args) }))

const onClose = vi.fn()
const onSaved = vi.fn()

beforeEach(() => {
  saveIngredient.mockReset()
  onClose.mockReset()
  onSaved.mockReset()
})

function renderModal() {
  render(<IngredientFormModal onClose={onClose} onSaved={onSaved} />)
}

describe('IngredientFormModal', () => {
  it('ไม่กรอกชื่อ กดบันทึกแล้วขึ้น error ไม่ยิง saveIngredient', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('กรุณาใส่ชื่อวัตถุดิบ')).toBeInTheDocument()
    expect(saveIngredient).not.toHaveBeenCalled()
  })

  it('กรอกชื่อแล้วบันทึก ใช้หน่วยเริ่มต้น "กรัม" และเกณฑ์เตือน 0 ถ้าไม่ได้แก้', async () => {
    saveIngredient.mockResolvedValue({ id: 'new-id', error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('ชื่อวัตถุดิบ'), 'แป้งสาลี')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(saveIngredient).toHaveBeenCalledWith(null, {
      name: 'แป้งสาลี',
      unit: 'กรัม',
      low_stock_threshold: 0,
      note: null,
      is_active: true,
    })
  })

  it('แก้หน่วยและเกณฑ์เตือนเอง ส่งค่าที่แก้ไปด้วย', async () => {
    saveIngredient.mockResolvedValue({ id: 'new-id', error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('ชื่อวัตถุดิบ'), 'ไข่ไก่')
    const unitInput = screen.getByLabelText('หน่วย')
    await userEvent.clear(unitInput)
    await userEvent.type(unitInput, 'ฟอง')
    await userEvent.type(screen.getByLabelText('เตือนเมื่อสต็อกเหลือไม่เกิน (ไม่บังคับ)'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(saveIngredient).toHaveBeenCalledWith(null, expect.objectContaining({ unit: 'ฟอง', low_stock_threshold: 10 }))
  })

  it('บันทึกสำเร็จ ขึ้นป็อปอัพยืนยันก่อนแล้วค่อยเรียก onSaved', async () => {
    saveIngredient.mockResolvedValue({ id: 'new-id', error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('ชื่อวัตถุดิบ'), 'แป้งสาลี')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('บันทึกวัตถุดิบแล้ว')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 1300))
    expect(onSaved).toHaveBeenCalled()
  }, 10000)

  it('กด "ยกเลิก" ปิดป็อปอัพโดยไม่บันทึกอะไร', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalled()
    expect(saveIngredient).not.toHaveBeenCalled()
  })
})
