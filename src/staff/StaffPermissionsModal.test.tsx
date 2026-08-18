import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaffPermissionsModal } from './StaffPermissionsModal'
import type { StaffMember } from './useStaffMembers'

const onClose = vi.fn()
const onSave = vi.fn()

function makeMember(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: 's1',
    user_id: 'u1',
    email: 'staff@example.com',
    display_name: 'น้องริว',
    role: 'staff',
    status: 'active',
    allowed_pages: ['orders', 'customers'],
    created_at: '',
    ...overrides,
  }
}

beforeEach(() => {
  onClose.mockReset()
  onSave.mockReset()
})

describe('StaffPermissionsModal', () => {
  it('ติ๊กช่องตามสิทธิ์เดิมที่มีอยู่แล้วให้ถูกต้อง', () => {
    render(<StaffPermissionsModal member={makeMember()} onClose={onClose} onSave={onSave} />)
    expect((screen.getByLabelText('ออเดอร์ & ปฏิทิน') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('ลูกค้า') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('สินค้า') as HTMLInputElement).checked).toBe(false)
  })

  it('ติ๊ก/ปลดทีละช่องได้', async () => {
    render(<StaffPermissionsModal member={makeMember()} onClose={onClose} onSave={onSave} />)
    const productsCheckbox = screen.getByLabelText('สินค้า') as HTMLInputElement
    await userEvent.click(productsCheckbox)
    expect(productsCheckbox.checked).toBe(true)
    await userEvent.click(productsCheckbox)
    expect(productsCheckbox.checked).toBe(false)
  })

  it('กด "เลือกทั้งหมด" ติ๊กทุกช่อง', async () => {
    render(<StaffPermissionsModal member={makeMember({ allowed_pages: [] })} onClose={onClose} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'เลือกทั้งหมด' }))
    for (const label of ['ออเดอร์ & ปฏิทิน', 'สินค้า', 'ลูกค้า', 'ต้นทุน', 'สรุปยอด']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).checked).toBe(true)
    }
  })

  it('กด "ไม่เลือกเลย" ปลดทุกช่อง', async () => {
    render(<StaffPermissionsModal member={makeMember()} onClose={onClose} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'ไม่เลือกเลย' }))
    expect((screen.getByLabelText('ออเดอร์ & ปฏิทิน') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('ลูกค้า') as HTMLInputElement).checked).toBe(false)
  })

  it('กดบันทึก ส่งรายการสิทธิ์ปัจจุบันไปให้ onSave ถูกต้อง', async () => {
    onSave.mockResolvedValue({ error: null })
    render(<StaffPermissionsModal member={makeMember()} onClose={onClose} onSave={onSave} />)
    await userEvent.click(screen.getByLabelText('สินค้า'))
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(onSave).toHaveBeenCalledWith('s1', ['orders', 'customers', 'products'])
  })

  it('บันทึกไม่สำเร็จ แสดง error ไม่ปิดโมดัล', async () => {
    onSave.mockResolvedValue({ error: { message: 'บันทึกไม่สำเร็จ' } })
    render(<StaffPermissionsModal member={makeMember()} onClose={onClose} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('บันทึกไม่สำเร็จ')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('กดยกเลิก เรียก onClose โดยไม่บันทึก', async () => {
    render(<StaffPermissionsModal member={makeMember()} onClose={onClose} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
