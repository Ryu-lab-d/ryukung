import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { email: 'ryu@example.com' } },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

describe('โครงหน้าเว็บ', () => {
  it('มีลิงก์เมนูครบทุกหน้าหลัก', () => {
    render(
      <MemoryRouter>
        <AppLayout><div>เนื้อหา</div></AppLayout>
      </MemoryRouter>
    )
    for (const label of ['ออเดอร์', 'สินค้า', 'ลูกค้า', 'สรุปยอด', 'ตั้งค่า']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('แสดงเนื้อหาที่ส่งเข้ามา', () => {
    render(
      <MemoryRouter>
        <AppLayout><div>เนื้อหาทดสอบ</div></AppLayout>
      </MemoryRouter>
    )
    expect(screen.getByText('เนื้อหาทดสอบ')).toBeInTheDocument()
  })
})
