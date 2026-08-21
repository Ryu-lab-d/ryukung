import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WelcomeOverlay } from './WelcomeOverlay'

let staffStatusOverride: { role: string; state: string; allowedPages: string[]; displayName: string | null } | null = null
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ staffStatus: staffStatusOverride }),
}))

let settingsOverride: { shop_name: string; logo_path: string | null; promptpay: string | null; phone: string | null } | null = null
vi.mock('../settings/useSettings', () => ({
  useSettings: () => ({ settings: settingsOverride, loading: !settingsOverride }),
}))

beforeEach(() => {
  sessionStorage.clear()
  staffStatusOverride = { role: 'staff', state: 'active', allowedPages: [], displayName: 'น้องริว' }
  settingsOverride = { shop_name: 'RYUKUNG BAKERY', logo_path: null, promptpay: '080-080-1181', phone: null }
})

describe('WelcomeOverlay — ป็อปอัพต้อนรับตอนเข้าเว็บ', () => {
  it('ล็อกอินสำเร็จ+โหลดข้อมูลร้านแล้ว แสดงชื่อพนักงาน ชื่อร้าน และข้อมูลร้าน (พร้อมเพย์)', () => {
    render(<WelcomeOverlay />)
    expect(screen.getByText(/ยินดีต้อนรับคุณ น้องริว/)).toBeInTheDocument()
    expect(screen.getByText('RYUKUNG BAKERY')).toBeInTheDocument()
    expect(screen.getByText(/พร้อมเพย์: 080-080-1181/)).toBeInTheDocument()
  })

  it('ไม่มีชื่อพนักงาน แสดงข้อความต้อนรับแบบไม่ระบุชื่อแทน', () => {
    staffStatusOverride = { role: 'staff', state: 'active', allowedPages: [], displayName: null }
    render(<WelcomeOverlay />)
    expect(screen.getByText('ยินดีต้อนรับ')).toBeInTheDocument()
  })

  it('ไม่มีพร้อมเพย์/เบอร์โทรเลย ไม่แสดงกล่องข้อมูลร้าน', () => {
    settingsOverride = { shop_name: 'RYUKUNG BAKERY', logo_path: null, promptpay: null, phone: null }
    render(<WelcomeOverlay />)
    expect(screen.queryByText(/พร้อมเพย์/)).not.toBeInTheDocument()
  })

  it('ยังไม่มี staffStatus หรือ settings (กำลังโหลด) ไม่แสดงอะไรเลย', () => {
    staffStatusOverride = null
    render(<WelcomeOverlay />)
    expect(screen.queryByText('RYUKUNG BAKERY')).not.toBeInTheDocument()
  })

  it('เคยแสดงไปแล้วในเซสชันนี้ (sessionStorage มีค่าอยู่) ไม่แสดงซ้ำอีก', () => {
    sessionStorage.setItem('ryukung-welcomed', '1')
    render(<WelcomeOverlay />)
    expect(screen.queryByText('RYUKUNG BAKERY')).not.toBeInTheDocument()
  })

  it('กดปุ่ม "เริ่มทำงานเลย" ปิดป็อปอัพได้ทันที', async () => {
    render(<WelcomeOverlay />)
    expect(screen.getByText('RYUKUNG BAKERY')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /เริ่มทำงานเลย/ }))
    expect(screen.queryByText('RYUKUNG BAKERY')).not.toBeInTheDocument()
  })
})
