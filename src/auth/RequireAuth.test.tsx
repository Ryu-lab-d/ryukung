import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequireAuth } from './RequireAuth'

const useAuthMock = vi.fn()
vi.mock('./AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}))

function base(overrides: Partial<ReturnType<typeof useAuthMock>>) {
  return {
    session: { user: { id: 'u1', email: 'x@example.com' } },
    loading: false,
    staffLoading: false,
    staffStatus: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  }
}

describe('RequireAuth คุมสิทธิ์เข้าใช้งานตามสถานะพนักงาน', () => {
  it('ยังไม่มีเซสชันเลย แสดงหน้าล็อกอิน', () => {
    useAuthMock.mockReturnValue(base({ session: null }))
    render(<RequireAuth><div>เนื้อหาลับ</div></RequireAuth>)
    expect(screen.queryByText('เนื้อหาลับ')).not.toBeInTheDocument()
    expect(screen.getByText('เข้าสู่ระบบ')).toBeInTheDocument()
  })

  it('บัญชีที่ยังรออนุมัติ (pending) เข้าเนื้อหาไม่ได้', () => {
    useAuthMock.mockReturnValue(base({ staffStatus: { role: 'staff', state: 'pending' } }))
    render(<RequireAuth><div>เนื้อหาลับ</div></RequireAuth>)
    expect(screen.queryByText('เนื้อหาลับ')).not.toBeInTheDocument()
    expect(screen.getByText('รอเจ้าของร้านอนุมัติ')).toBeInTheDocument()
  })

  it('บัญชีที่ถูกระงับ (revoked) เข้าเนื้อหาไม่ได้', () => {
    useAuthMock.mockReturnValue(base({ staffStatus: { role: 'staff', state: 'revoked' } }))
    render(<RequireAuth><div>เนื้อหาลับ</div></RequireAuth>)
    expect(screen.queryByText('เนื้อหาลับ')).not.toBeInTheDocument()
    expect(screen.getByText('บัญชีนี้ถูกระงับสิทธิ์แล้ว')).toBeInTheDocument()
  })

  it('มีเซสชันแต่ยังไม่รู้สถานะพนักงาน (กำลังเช็กอยู่) ก็ยังเข้าเนื้อหาไม่ได้', () => {
    useAuthMock.mockReturnValue(base({ staffStatus: null, staffLoading: true }))
    render(<RequireAuth><div>เนื้อหาลับ</div></RequireAuth>)
    expect(screen.queryByText('เนื้อหาลับ')).not.toBeInTheDocument()
  })

  it('บัญชี active เข้าเนื้อหาได้ปกติ', () => {
    useAuthMock.mockReturnValue(base({ staffStatus: { role: 'staff', state: 'active' } }))
    render(<RequireAuth><div>เนื้อหาลับ</div></RequireAuth>)
    expect(screen.getByText('เนื้อหาลับ')).toBeInTheDocument()
  })
})
