import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitChangeFixModal } from './UnitChangeFixModal'
import type { RecipeUsageRow } from './api'

const onCancel = vi.fn()
const onConfirm = vi.fn()

const rows: RecipeUsageRow[] = [
  { id: 'pi1', productName: 'คุกกี้ช็อกโกแลต', qtyPerUnit: 200 },
  { id: 'pi2', productName: 'บราวนี่', qtyPerUnit: 150 },
]

beforeEach(() => {
  onCancel.mockReset()
  onConfirm.mockReset()
})

describe('UnitChangeFixModal', () => {
  it('เติมค่าเดิม (ตามหน่วยเก่า) ให้ทุกแถวตั้งแต่แรก', () => {
    render(<UnitChangeFixModal newUnit="ฟอง" rows={rows} onCancel={onCancel} onConfirm={onConfirm} />)
    expect(screen.getByLabelText('จำนวนที่ใช้ใหม่สำหรับ คุกกี้ช็อกโกแลต')).toHaveValue(200)
    expect(screen.getByLabelText('จำนวนที่ใช้ใหม่สำหรับ บราวนี่')).toHaveValue(150)
  })

  it('แก้จำนวนแล้วกดบันทึกทั้งหมด ส่งค่าที่แก้แล้วทุกแถวไปให้ onConfirm', async () => {
    render(<UnitChangeFixModal newUnit="ฟอง" rows={rows} onCancel={onCancel} onConfirm={onConfirm} />)
    const cookieInput = screen.getByLabelText('จำนวนที่ใช้ใหม่สำหรับ คุกกี้ช็อกโกแลต')
    await userEvent.clear(cookieInput)
    await userEvent.type(cookieInput, '2')

    await userEvent.click(screen.getByRole('button', { name: 'บันทึกทั้งหมด' }))
    expect(onConfirm).toHaveBeenCalledWith([
      { id: 'pi1', qty_per_unit: 2 },
      { id: 'pi2', qty_per_unit: 150 },
    ])
  })

  it('มีแถวที่จำนวนเป็น 0 หรือว่าง ปุ่มบันทึกทั้งหมดกดไม่ได้', async () => {
    render(<UnitChangeFixModal newUnit="ฟอง" rows={rows} onCancel={onCancel} onConfirm={onConfirm} />)
    const cookieInput = screen.getByLabelText('จำนวนที่ใช้ใหม่สำหรับ คุกกี้ช็อกโกแลต')
    await userEvent.clear(cookieInput)
    expect(screen.getByRole('button', { name: 'บันทึกทั้งหมด' })).toBeDisabled()
  })

  it('กดยกเลิก เรียก onCancel โดยไม่บันทึก', async () => {
    render(<UnitChangeFixModal newUnit="ฟอง" rows={rows} onCancel={onCancel} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
