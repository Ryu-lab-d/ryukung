import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdjustStockModal } from './AdjustStockModal'

const adjustIngredientStock = vi.fn()
vi.mock('./api', () => ({ adjustIngredientStock: (...args: unknown[]) => adjustIngredientStock(...args) }))

const onClose = vi.fn()
const onSaved = vi.fn()

beforeEach(() => {
  adjustIngredientStock.mockReset()
  onClose.mockReset()
  onSaved.mockReset()
})

function renderModal() {
  render(<AdjustStockModal ingredientId="i1" ingredientName="แป้งสาลี" unit="กรัม" onClose={onClose} onSaved={onSaved} />)
}

describe('AdjustStockModal', () => {
  it('ไม่กรอกจำนวน กดปรับสต็อกแล้วขึ้น error ไม่ยิง adjustIngredientStock', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ปรับสต็อก' }))
    expect(await screen.findByText('กรุณาใส่จำนวนที่ต้องการปรับ (ห้ามเป็น 0)')).toBeInTheDocument()
    expect(adjustIngredientStock).not.toHaveBeenCalled()
  })

  it('กรอกจำนวนแต่ไม่กรอกเหตุผล ขึ้น error ไม่ยิง adjustIngredientStock', async () => {
    renderModal()
    await userEvent.type(screen.getByLabelText('จำนวนที่ปรับ (กรัม)'), '-50')
    await userEvent.click(screen.getByRole('button', { name: 'ปรับสต็อก' }))
    expect(await screen.findByText('กรุณาระบุเหตุผลที่ปรับสต็อก')).toBeInTheDocument()
    expect(adjustIngredientStock).not.toHaveBeenCalled()
  })

  it('กรอกค่าลบพร้อมเหตุผล ส่งจำนวนติดลบไปตรงๆ', async () => {
    adjustIngredientStock.mockResolvedValue({ error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('จำนวนที่ปรับ (กรัม)'), '-50')
    await userEvent.type(screen.getByLabelText('เหตุผล'), 'ของเสียหาย')
    await userEvent.click(screen.getByRole('button', { name: 'ปรับสต็อก' }))
    expect(adjustIngredientStock).toHaveBeenCalledWith('i1', -50, 'ของเสียหาย')
  })

  it('ปรับสต็อกสำเร็จ ขึ้นป็อปอัพยืนยันก่อนแล้วค่อยเรียก onSaved', async () => {
    adjustIngredientStock.mockResolvedValue({ error: null })
    renderModal()
    await userEvent.type(screen.getByLabelText('จำนวนที่ปรับ (กรัม)'), '20')
    await userEvent.type(screen.getByLabelText('เหตุผล'), 'นับใหม่')
    await userEvent.click(screen.getByRole('button', { name: 'ปรับสต็อก' }))
    expect(await screen.findByText('ปรับสต็อกแล้ว')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 1300))
    expect(onSaved).toHaveBeenCalled()
  }, 10000)

  it('กด "ยกเลิก" ปิดป็อปอัพโดยไม่บันทึกอะไร', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalled()
    expect(adjustIngredientStock).not.toHaveBeenCalled()
  })
})
