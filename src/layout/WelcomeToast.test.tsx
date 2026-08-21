import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WelcomeToast } from './WelcomeToast'

let staffStatusOverride: { role: string; state: string; allowedPages: string[]; displayName: string | null } | null = null
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ staffStatus: staffStatusOverride }),
}))

let settingsOverride: { shop_name: string } | null = null
vi.mock('../settings/useSettings', () => ({
  useSettings: () => ({ settings: settingsOverride, loading: !settingsOverride }),
}))

beforeEach(() => {
  sessionStorage.clear()
  staffStatusOverride = { role: 'staff', state: 'active', allowedPages: [], displayName: 'น้องริว' }
  settingsOverride = { shop_name: 'RYUKUNG BAKERY' }
})

describe('WelcomeToast — ทักทายต้อนรับตอนเข้าเว็บ', () => {
  it('ล็อกอินสำเร็จ+โหลดข้อมูลร้านแล้ว แสดงข้อความต้อนรับพร้อมชื่อและชื่อร้าน', () => {
    render(<WelcomeToast />)
    expect(screen.getByText(/ยินดีต้อนรับคุณ น้องริว เข้าสู่ RYUKUNG BAKERY/)).toBeInTheDocument()
  })

  it('ไม่มีชื่อพนักงาน แสดงข้อความต้อนรับแบบไม่ระบุชื่อแทน', () => {
    staffStatusOverride = { role: 'staff', state: 'active', allowedPages: [], displayName: null }
    render(<WelcomeToast />)
    expect(screen.getByText(/ยินดีต้อนรับเข้าสู่ RYUKUNG BAKERY/)).toBeInTheDocument()
  })

  it('ยังไม่มี staffStatus หรือ settings (กำลังโหลด) ไม่แสดงอะไรเลย', () => {
    staffStatusOverride = null
    render(<WelcomeToast />)
    expect(screen.queryByText(/ยินดีต้อนรับ/)).not.toBeInTheDocument()
  })

  it('เคยแสดงไปแล้วในเซสชันนี้ (sessionStorage มีค่าอยู่) ไม่แสดงซ้ำอีก', () => {
    sessionStorage.setItem('ryukung-welcomed', '1')
    render(<WelcomeToast />)
    expect(screen.queryByText(/ยินดีต้อนรับ/)).not.toBeInTheDocument()
  })
})
