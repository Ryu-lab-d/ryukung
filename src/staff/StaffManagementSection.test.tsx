import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaffManagementSection } from './StaffManagementSection'

const invite = vi.fn()
const setStatus = vi.fn()
const remove = vi.fn()
const setAllowedPages = vi.fn()
const setRole = vi.fn()

const members = [
  { id: '1', user_id: 'o1', email: 'owner@ryukung.com', display_name: 'เจ้าของร้าน', role: 'owner' as const, status: 'active' as const, allowed_pages: [], created_at: '2026-01-01' },
  { id: '2', user_id: null, email: 'invited@ryukung.com', display_name: 'เชิญไว้ล่วงหน้า', role: 'staff' as const, status: 'pending' as const, allowed_pages: [], created_at: '2026-01-01' },
  { id: '3', user_id: 's1', email: 'active@ryukung.com', display_name: 'พนักงานใช้งานได้', role: 'staff' as const, status: 'active' as const, allowed_pages: ['orders', 'customers'], created_at: '2026-01-01' },
  { id: '4', user_id: 's2', email: 'pending@ryukung.com', display_name: 'รออนุมัติจริง', role: 'staff' as const, status: 'pending' as const, allowed_pages: [], created_at: '2026-01-01' },
  { id: '5', user_id: 'e1', email: 'exec@ryukung.com', display_name: 'ผู้บริหารทดสอบ', role: 'executive' as const, status: 'active' as const, allowed_pages: [], created_at: '2026-01-01' },
]

vi.mock('./useStaffMembers', () => ({
  useStaffMembers: () => ({ members, loading: false, invite, setStatus, remove, setAllowedPages, setRole, reload: vi.fn() }),
}))

let roleOverride: 'owner' | 'manager' | 'staff' | 'executive' = 'owner'
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ staffStatus: { role: roleOverride } }),
}))

beforeEach(() => {
  roleOverride = 'owner'
})

describe('ส่วนจัดการพนักงานในหน้าตั้งค่า', () => {
  it('แสดงรายชื่อพนักงานพร้อมสถานะที่ถูกต้อง', () => {
    render(<StaffManagementSection />)
    expect(screen.getByText('รออนุมัติ')).toBeInTheDocument()
    expect(screen.getAllByText('ใช้งานได้').length).toBeGreaterThan(0)
  })

  it('เชิญไว้ล่วงหน้าแต่ยังไม่มีใครสมัคร (user_id ยังว่าง) แสดงป้าย "รอพนักงานสมัคร" ไม่ใช่ "รออนุมัติ" และไม่มีปุ่มอนุมัติ', () => {
    render(<StaffManagementSection />)
    const invitedRow = screen.getByText('เชิญไว้ล่วงหน้า').closest('div')!.parentElement!
    expect(within(invitedRow).getByText('รอพนักงานสมัคร')).toBeInTheDocument()
    expect(within(invitedRow).queryByRole('button', { name: 'อนุมัติ' })).not.toBeInTheDocument()
    expect(within(invitedRow).getByRole('button', { name: 'ยกเลิกคำเชิญ' })).toBeInTheDocument()
  })

  it('มีคนสมัครจริงแล้ว (มี user_id) รอเจ้าของร้านอนุมัติ แสดงป้าย "รออนุมัติ" พร้อมปุ่มอนุมัติ', async () => {
    render(<StaffManagementSection />)
    const realPendingRow = screen.getByText('รออนุมัติจริง').closest('div')!.parentElement!
    expect(within(realPendingRow).getByText('รออนุมัติ')).toBeInTheDocument()
    await userEvent.click(within(realPendingRow).getByRole('button', { name: 'อนุมัติ' }))
    expect(setStatus).toHaveBeenCalledWith('4', 'active')
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

  it('เชิญสำเร็จ ข้อความบอกชัดว่าต้องตั้งรหัสผ่านเอง+ยืนยันอีเมล และไม่ต้องกดอนุมัติเพิ่ม', async () => {
    invite.mockResolvedValue({ error: null })
    render(<StaffManagementSection />)
    await userEvent.type(screen.getByPlaceholderText('ชื่อพนักงาน'), 'พนักงานใหม่')
    await userEvent.type(screen.getByPlaceholderText('อีเมลพนักงาน'), 'new@ryukung.com')
    await userEvent.click(screen.getByRole('button', { name: '+ เชิญพนักงาน' }))
    expect(await screen.findByText(/ตั้งรหัสผ่านเอง/)).toBeInTheDocument()
    expect(screen.getByText(/ไม่ต้องกดอนุมัติอะไรเพิ่ม/)).toBeInTheDocument()
  })

  it('กดระงับพนักงานที่ active เรียก setStatus เป็น revoked', async () => {
    render(<StaffManagementSection />)
    const activeRow = screen.getByText('พนักงานใช้งานได้').closest('div')!.parentElement!
    await userEvent.click(within(activeRow).getByRole('button', { name: 'ระงับ' }))
    expect(setStatus).toHaveBeenCalledWith('3', 'revoked')
  })

  it('ปุ่ม "🔑 สิทธิ์" โผล่เฉพาะพนักงานที่ active และไม่ใช่ owner เท่านั้น', () => {
    render(<StaffManagementSection />)
    const activeRow = screen.getByText('พนักงานใช้งานได้').closest('div')!.parentElement!
    expect(within(activeRow).getByRole('button', { name: '🔑 สิทธิ์' })).toBeInTheDocument()

    const pendingRow = screen.getByText('เชิญไว้ล่วงหน้า').closest('div')!.parentElement!
    expect(within(pendingRow).queryByRole('button', { name: '🔑 สิทธิ์' })).not.toBeInTheDocument()

    const ownerRow = screen.getByText('เจ้าของร้าน').closest('div')!.parentElement!
    expect(within(ownerRow).queryByRole('button', { name: '🔑 สิทธิ์' })).not.toBeInTheDocument()
  })

  it('กด "🔑 สิทธิ์" เปิดโมดัลสิทธิ์ของคนนั้น แล้วบันทึกเรียก setAllowedPages ถูกคน', async () => {
    setAllowedPages.mockResolvedValue({ error: null })
    render(<StaffManagementSection />)
    const activeRow = screen.getByText('พนักงานใช้งานได้').closest('div')!.parentElement!
    await userEvent.click(within(activeRow).getByRole('button', { name: '🔑 สิทธิ์' }))

    expect(screen.getByText('สิทธิ์การเข้าถึง')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(setAllowedPages).toHaveBeenCalledWith('3', ['orders', 'customers'])
  })

  it('เจ้าของร้านเห็น dropdown เปลี่ยนระดับตำแหน่งของพนักงานคนอื่น (ยกเว้นแถวของเจ้าของร้านเอง) เปลี่ยนแล้วเรียก setRole', async () => {
    roleOverride = 'owner'
    render(<StaffManagementSection />)
    const activeRow = screen.getByText('พนักงานใช้งานได้').closest('div')!.parentElement!
    const select = within(activeRow).getByLabelText('ระดับตำแหน่งของ พนักงานใช้งานได้')
    await userEvent.selectOptions(select, 'manager')
    expect(setRole).toHaveBeenCalledWith('3', 'manager')

    const ownerRow = screen.getByText('เจ้าของร้าน').closest('div')!.parentElement!
    expect(within(ownerRow).queryByLabelText(/ระดับตำแหน่งของ/)).not.toBeInTheDocument()
  })

  it('เจ้าของร้านเห็นตัวเลือกครบ 3 ระดับในdropdown (พนักงาน/ผู้จัดการ/ผู้บริหาร) และเลือกผู้บริหารได้', async () => {
    roleOverride = 'owner'
    render(<StaffManagementSection />)
    const activeRow = screen.getByText('พนักงานใช้งานได้').closest('div')!.parentElement!
    const select = within(activeRow).getByLabelText('ระดับตำแหน่งของ พนักงานใช้งานได้') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels).toEqual(['พนักงาน', 'ผู้จัดการ', 'ผู้บริหาร'])
    await userEvent.selectOptions(select, 'executive')
    expect(setRole).toHaveBeenCalledWith('3', 'executive')
  })

  it('ผู้จัดการเปิดหน้านี้เอง ไม่เห็น dropdown เปลี่ยนระดับตำแหน่งเลยสักแถว', () => {
    roleOverride = 'manager'
    render(<StaffManagementSection />)
    expect(screen.queryByLabelText(/ระดับตำแหน่งของ/)).not.toBeInTheDocument()
  })

  it('ผู้บริหารเห็น dropdown แค่ 2 ตัวเลือก (พนักงาน/ผู้จัดการ) เฉพาะแถวพนักงาน/ผู้จัดการเท่านั้น ไม่เห็นบนแถวเจ้าของร้านหรือผู้บริหารคนอื่น', async () => {
    roleOverride = 'executive'
    render(<StaffManagementSection />)

    const activeRow = screen.getByText('พนักงานใช้งานได้').closest('div')!.parentElement!
    const select = within(activeRow).getByLabelText('ระดับตำแหน่งของ พนักงานใช้งานได้') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels).toEqual(['พนักงาน', 'ผู้จัดการ'])
    await userEvent.selectOptions(select, 'manager')
    expect(setRole).toHaveBeenCalledWith('3', 'manager')

    const ownerRow = screen.getByText('เจ้าของร้าน').closest('div')!.parentElement!
    expect(within(ownerRow).queryByLabelText(/ระดับตำแหน่งของ/)).not.toBeInTheDocument()

    const execRow = screen.getByText('ผู้บริหารทดสอบ').closest('div')!.parentElement!
    expect(within(execRow).queryByLabelText(/ระดับตำแหน่งของ/)).not.toBeInTheDocument()
  })
})
