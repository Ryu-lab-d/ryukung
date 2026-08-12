import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RestockModal } from './RestockModal'

const restockIngredient = vi.fn()
vi.mock('./api', () => ({ restockIngredient: (...args: unknown[]) => restockIngredient(...args) }))

const onClose = vi.fn()
const onSaved = vi.fn()

beforeEach(() => {
  restockIngredient.mockReset()
  onClose.mockReset()
  onSaved.mockReset()
})

function renderModal() {
  render(<RestockModal ingredientId="i1" ingredientName="แป้งสาลี" unit="กรัม" onClose={onClose} onSaved={onSaved} />)
}

describe('RestockModal', () => {
  it('ไม่กรอกจำนวน กดเติมสต็อกแล้วขึ้น error ไม่ยิง restockIngredient', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'เติมสต็อก' }))
    expect(await screen.findByText('กรุณาใส่จำนวนที่เติมให้ถูกต้อง')).toBeInTheDocument()
    expect(restockIngredient).not.toHaveBeenCalled()
  })

  it('กรอกจำนวนอย่างเดียว ไม่ใส่ราคา ส่ง null เป็นราคาต่อหน่วย', async () => {
    restockIngredient.mockResolvedValue({ error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('จำนวนที่เติม (กรัม)'), '5000')
    await userEvent.click(screen.getByRole('button', { name: 'เติมสต็อก' }))
    expect(restockIngredient).toHaveBeenCalledWith('i1', 5000, null, null)
  })

  it('กรอกราคาต่อหน่วยและหมายเหตุด้วย ส่งครบทุกค่า', async () => {
    restockIngredient.mockResolvedValue({ error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('จำนวนที่เติม (กรัม)'), '5000')
    await userEvent.type(screen.getByLabelText('ราคาซื้อต่อ กรัม (ไม่บังคับ)'), '0.5')
    await userEvent.type(screen.getByLabelText('หมายเหตุ (ไม่บังคับ)'), 'ซื้อจากตลาด')
    await userEvent.click(screen.getByRole('button', { name: 'เติมสต็อก' }))
    expect(restockIngredient).toHaveBeenCalledWith('i1', 5000, 0.5, 'ซื้อจากตลาด')
  })

  it('เติมสต็อกสำเร็จ ขึ้นป็อปอัพยืนยันก่อนแล้วค่อยเรียก onSaved', async () => {
    restockIngredient.mockResolvedValue({ error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('จำนวนที่เติม (กรัม)'), '1000')
    await userEvent.click(screen.getByRole('button', { name: 'เติมสต็อก' }))
    expect(await screen.findByText('เติมสต็อกแล้ว')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 1300))
    expect(onSaved).toHaveBeenCalled()
  }, 10000)

  it('เติมสต็อกไม่สำเร็จ แสดง error จาก restockIngredient', async () => {
    restockIngredient.mockResolvedValue({ error: { message: 'เชื่อมต่อไม่ได้' } })
    renderModal()
    await userEvent.type(screen.getByLabelText('จำนวนที่เติม (กรัม)'), '1000')
    await userEvent.click(screen.getByRole('button', { name: 'เติมสต็อก' }))
    expect(await screen.findByText('เชื่อมต่อไม่ได้')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('กด "ยกเลิก" ปิดป็อปอัพโดยไม่บันทึกอะไร', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalled()
    expect(restockIngredient).not.toHaveBeenCalled()
  })
})
