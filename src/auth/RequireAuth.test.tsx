import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequireAuth } from './RequireAuth'

const useAuthMock = vi.fn()
vi.mock('./AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('./LoginPage', () => ({
  LoginPage: () => <div>หน้าล็อกอิน</div>,
}))

describe('RequireAuth', () => {
  it('กำลังเช็ค session แสดงหน้าจอ "กำลังโหลด..." แบบมีแบรนด์ร้าน', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true, staffStatus: null, staffLoading: true, signOut: vi.fn() })
    render(<RequireAuth><div>เนื้อหา</div></RequireAuth>)
    expect(screen.getByText('RYUKUNG BAKERY')).toBeInTheDocument()
    expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument()
    expect(screen.queryByText('เนื้อหา')).not.toBeInTheDocument()
  })

  it('มี session แต่ยังเช็คสิทธิ์พนักงานอยู่ ยังแสดงหน้าจอกำลังโหลด', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false, staffStatus: null, staffLoading: true, signOut: vi.fn() })
    render(<RequireAuth><div>เนื้อหา</div></RequireAuth>)
    expect(screen.getByText('กำลังโหลด...')).toBeInTheDocument()
  })

  it('ไม่มี session แสดงหน้าล็อกอิน', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false, staffStatus: null, staffLoading: false, signOut: vi.fn() })
    render(<RequireAuth><div>เนื้อหา</div></RequireAuth>)
    expect(screen.getByText('หน้าล็อกอิน')).toBeInTheDocument()
  })

  it('รออนุมัติอยู่ แสดงหน้าจอแจ้งเตือน', () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      staffStatus: { role: 'staff', state: 'pending', allowedPages: [], displayName: null },
      staffLoading: false,
      signOut: vi.fn(),
    })
    render(<RequireAuth><div>เนื้อหา</div></RequireAuth>)
    expect(screen.getByText('รอเจ้าของร้านอนุมัติ')).toBeInTheDocument()
  })

  it('ถูกระงับสิทธิ์ แสดงหน้าจอแจ้งเตือน', () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      staffStatus: { role: 'staff', state: 'revoked', allowedPages: [], displayName: null },
      staffLoading: false,
      signOut: vi.fn(),
    })
    render(<RequireAuth><div>เนื้อหา</div></RequireAuth>)
    expect(screen.getByText('บัญชีนี้ถูกระงับสิทธิ์แล้ว')).toBeInTheDocument()
  })

  it('ผ่านทุกเงื่อนไข แสดงเนื้อหาที่ส่งเข้ามา', () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      staffStatus: { role: 'staff', state: 'active', allowedPages: [], displayName: null },
      staffLoading: false,
      signOut: vi.fn(),
    })
    render(<RequireAuth><div>เนื้อหา</div></RequireAuth>)
    expect(screen.getByText('เนื้อหา')).toBeInTheDocument()
  })
})
