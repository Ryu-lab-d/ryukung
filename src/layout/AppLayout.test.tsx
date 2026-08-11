import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'

const useAuthMock = vi.fn()
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}))

describe('โครงหน้าเว็บ', () => {
  it('เจ้าของร้านเห็นลิงก์เมนูครบทุกหน้าหลัก รวมตั้งค่า', () => {
    useAuthMock.mockReturnValue({
      session: { user: { email: 'ryu@example.com' } },
      loading: false,
      staffStatus: { role: 'owner', state: 'active' },
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AppLayout><div>เนื้อหา</div></AppLayout>
      </MemoryRouter>
    )
    for (const label of ['ออเดอร์', 'คอนเทนต์', 'สินค้า', 'ลูกค้า', 'สรุปยอด', 'ตั้งค่า']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it('พนักงานไม่เห็นเมนู "ตั้งค่า" เลย เพราะแก้ไขไม่ได้อยู่แล้ว', () => {
    useAuthMock.mockReturnValue({
      session: { user: { email: 'staff@example.com' } },
      loading: false,
      staffStatus: { role: 'staff', state: 'active' },
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AppLayout><div>เนื้อหา</div></AppLayout>
      </MemoryRouter>
    )
    for (const label of ['ออเดอร์', 'สินค้า', 'ลูกค้า', 'สรุปยอด']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(screen.queryByText('ตั้งค่า')).not.toBeInTheDocument()
  })

  it('แสดงเนื้อหาที่ส่งเข้ามา', () => {
    useAuthMock.mockReturnValue({
      session: { user: { email: 'ryu@example.com' } },
      loading: false,
      staffStatus: { role: 'owner', state: 'active' },
      signIn: vi.fn(),
      signOut: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AppLayout><div>เนื้อหาทดสอบ</div></AppLayout>
      </MemoryRouter>
    )
    expect(screen.getByText('เนื้อหาทดสอบ')).toBeInTheDocument()
  })
})
