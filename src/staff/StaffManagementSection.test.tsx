import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaffManagementSection } from './StaffManagementSection'

const invite = vi.fn()
const setStatus = vi.fn()
const remove = vi.fn()

const members = [
  { id: '1', user_id: 'o1', email: 'owner@ryukung.com', display_name: 'เจ้าของร้าน', role: 'owner' as const, status: 'active' as const, created_at: '2026-01-01' },
  { id: '2', user_id: null, email: 'pending@ryukung.com', display_name: 'รอสมัคร', role: 'staff' as const, status: 'pending' as const, created_at: '2026-01-01' },
  { id: '3', user_id: 's1', email: 'active@ryukung.com', display_name: 'พนักงานใช้งานได้', role: 'staff' as const, status: 'active' as const, created_at: '2026-01-01' },
]

vi.mock('./useStaffMembers', () => ({
  useStaffMembers: () => ({ members, loading: false, invite, setStatus, remove, reload: vi.fn() }),
}))

describe('ส่วนจัดการพนักงานในหน้าตั้งค่า', () => {
  it('แสดงรายชื่อพนักงานพร้อมสถานะที่ถูกต้อง', () => {
    render(<StaffManagementSection />)
    expect(screen.getByText('รออนุมัติ')).toBeInTheDocument()
    expect(screen.getAllByText('ใช้งานได้').length).toBeGreaterThan(0)
  })

  it('เจ้าของร้าน (owner) ไม่มีปุ่มระงับ/ลบ แก้ไม่ได้', () => {
    render(<StaffManagementSection />)
    const ownerRow = screen.getByText('เจ้าของร้าน').closest('div')!.parentElement!
    expect(ownerRow.querySelector('button')).toBeNull()
  })

  it('กรอกฟอร์มเชิญพนักงานแล้วกดเชิญ เรียก invite ด้วยอีเมลที่กรอก', async () => {
    invite.mockResolvedValue({ error: null })
    render(<StaffManagementSection />)
    await userEvent.type(screen.getByPlaceholderText('ชื่อพนักงาน'), 'พนักงานใหม่')
    await userEvent.type(screen.getByPlaceholderText('อีเมลพนักงาน'), 'new@ryukung.com')
    await userEvent.click(screen.getByRole('button', { name: '+ เชิญพนักงาน' }))
    expect(invite).toHaveBeenCalledWith('new@ryukung.com', 'พนักงานใหม่')
  })

  it('กดระงับพนักงานที่ active เรียก setStatus เป็น revoked', async () => {
    render(<StaffManagementSection />)
    const activeRow = screen.getByText('พนักงานใช้งานได้').closest('div')!.parentElement!
    await userEvent.click(within(activeRow).getByRole('button', { name: 'ระงับ' }))
    expect(setStatus).toHaveBeenCalledWith('3', 'revoked')
  })
})
