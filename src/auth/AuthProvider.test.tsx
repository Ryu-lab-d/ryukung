import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthProvider'

type AuthCallback = (event: string, session: unknown) => void
let authStateCallback: AuthCallback | null = null

const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const from = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: (...args: unknown[]) => from(...args),
    rpc: vi.fn(),
  },
}))

function TestConsumer() {
  const { staffStatus, staffLoading } = useAuth()
  return <div>{staffLoading ? 'กำลังโหลด' : (staffStatus?.role ?? 'ไม่มีสิทธิ์')}</div>
}

function mockStaffMembersTable(role: string) {
  from.mockImplementation((table: string) => {
    if (table === 'staff_members') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role, status: 'active', allowed_pages: [], display_name: null } }) }),
        }),
      }
    }
    throw new Error('unexpected table ' + table)
  })
}

beforeEach(() => {
  authStateCallback = null
  getSession.mockReset()
  onAuthStateChange.mockReset().mockImplementation((cb: AuthCallback) => {
    authStateCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  from.mockReset()
})

describe('AuthProvider — ไม่ fetch สิทธิ์พนักงานซ้ำเวลา token รีเฟรชอัตโนมัติ', () => {
  it('session object ใหม่ (reference ต่างกัน) แต่ user id เดิม ไม่เรียก staff_members ซ้ำ และไม่กลับไปโชว์ loading', async () => {
    const session1 = { user: { id: 'u1' } }
    getSession.mockResolvedValue({ data: { session: session1 } })
    mockStaffMembersTable('staff')

    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('staff')).toBeInTheDocument())
    expect(from).toHaveBeenCalledTimes(1)

    // จำลอง Supabase รีเฟรช token อัตโนมัติตอนแท็บกลับมาโฟกัส — session object ใหม่ (คนละ reference)
    // แต่เป็นคนเดิม (user id เท่ากัน) — ก่อนแก้บั๊ก จุดนี้จะ trigger ให้ fetch สิทธิ์ซ้ำและโชว์ loading อีกรอบ
    // ซึ่งเท่ากับถอด-สร้างแอปทั้งชุดใหม่ ทำให้ฟอร์มที่กรอกค้างไว้หายหมด
    const session2 = { user: { id: 'u1' } }
    act(() => {
      authStateCallback?.('TOKEN_REFRESHED', session2)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(from).toHaveBeenCalledTimes(1)
    expect(screen.getByText('staff')).toBeInTheDocument()
  })

  it('เปลี่ยนเป็นคนละ user id จริง (ล็อกอินใหม่) ยัง fetch สิทธิ์ใหม่ตามปกติ', async () => {
    const session1 = { user: { id: 'u1' } }
    getSession.mockResolvedValue({ data: { session: session1 } })
    mockStaffMembersTable('staff')

    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('staff')).toBeInTheDocument())
    expect(from).toHaveBeenCalledTimes(1)

    mockStaffMembersTable('owner')
    const session2 = { user: { id: 'u2' } }
    act(() => {
      authStateCallback?.('SIGNED_IN', session2)
    })

    await waitFor(() => expect(screen.getByText('owner')).toBeInTheDocument())
    expect(from).toHaveBeenCalledTimes(2)
  })
})
