import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginPage } from './LoginPage'

const signIn = vi.fn()
vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ session: null, loading: false, signIn, signOut: vi.fn() }),
}))

beforeEach(() => signIn.mockReset())

describe('หน้าล็อกอิน', () => {
  it('มีช่องอีเมล รหัสผ่าน และปุ่มเข้าสู่ระบบ', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('อีเมล')).toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่าน')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('ไม่มีปุ่มสมัครสมาชิก เพราะร้านนี้มีผู้ใช้คนเดียว', () => {
    render(<LoginPage />)
    expect(screen.queryByText(/สมัคร/)).not.toBeInTheDocument()
  })

  it('กดเข้าสู่ระบบแล้วเรียก signIn ด้วยค่าที่กรอก', async () => {
    signIn.mockResolvedValue({ error: null })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('อีเมล'), 'ryu@example.com')
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))
    expect(signIn).toHaveBeenCalledWith('ryu@example.com', 'secret123')
  })

  it('ล็อกอินไม่ผ่านแล้วขึ้นข้อความบอกเป็นภาษาไทย', async () => {
    signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('อีเมล'), 'ryu@example.com')
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))
    expect(await screen.findByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeInTheDocument()
  })
})
