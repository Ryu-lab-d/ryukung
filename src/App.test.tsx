import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequirePage, OwnerOnlyRoute, OwnerOrManagerRoute, NoAccessPage } from './App'

const useAuthMock = vi.fn()
vi.mock('./auth/AuthProvider', () => ({
  useAuth: () => useAuthMock(),
}))

function renderAt(path: string, element: React.ReactElement) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/no-access" element={<NoAccessPage />} />
        <Route path="/" element={<div>หน้าออเดอร์</div>} />
        <Route path="/protected" element={element} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequirePage', () => {
  it('เจ้าของร้านเข้าได้ทุกหน้า แม้ allowedPages จะว่างเปล่า', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'owner', state: 'active', allowedPages: [] } })
    renderAt('/protected', <RequirePage page="expenses"><div>เนื้อหาที่ป้องกันไว้</div></RequirePage>)
    expect(screen.getByText('เนื้อหาที่ป้องกันไว้')).toBeInTheDocument()
  })

  it('พนักงานที่มีสิทธิ์หน้านั้นเข้าได้', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'staff', state: 'active', allowedPages: ['expenses'] } })
    renderAt('/protected', <RequirePage page="expenses"><div>เนื้อหาที่ป้องกันไว้</div></RequirePage>)
    expect(screen.getByText('เนื้อหาที่ป้องกันไว้')).toBeInTheDocument()
  })

  it('พนักงานที่ไม่มีสิทธิ์หน้านั้น เด้งไป /no-access ไม่ใช่ /', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'staff', state: 'active', allowedPages: ['orders'] } })
    renderAt('/protected', <RequirePage page="expenses"><div>เนื้อหาที่ป้องกันไว้</div></RequirePage>)
    expect(screen.queryByText('เนื้อหาที่ป้องกันไว้')).not.toBeInTheDocument()
    expect(screen.getByText('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')).toBeInTheDocument()
  })

  it('พนักงานที่ไม่มีสิทธิ์เข้า "/" (orders) เองด้วย ก็ไม่วนลูปกลับ / — ไปที่ /no-access แทน', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'staff', state: 'active', allowedPages: ['expenses'] } })
    renderAt('/protected', <RequirePage page="orders"><div>หน้าบอร์ดออเดอร์</div></RequirePage>)
    expect(screen.queryByText('หน้าบอร์ดออเดอร์')).not.toBeInTheDocument()
    expect(screen.getByText('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')).toBeInTheDocument()
    expect(screen.queryByText('หน้าออเดอร์')).not.toBeInTheDocument()
  })

  it('ผู้จัดการเข้าได้ทุกหน้าอัตโนมัติ แม้ allowedPages จะว่างเปล่า', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'manager', state: 'active', allowedPages: [] } })
    renderAt('/protected', <RequirePage page="expenses"><div>เนื้อหาที่ป้องกันไว้</div></RequirePage>)
    expect(screen.getByText('เนื้อหาที่ป้องกันไว้')).toBeInTheDocument()
  })
})

describe('OwnerOrManagerRoute', () => {
  it('พนักงานทั่วไปเข้าไม่ได้ เด้งกลับ /', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'staff', state: 'active', allowedPages: [] } })
    renderAt('/protected', <OwnerOrManagerRoute><div>หน้าตั้งค่า</div></OwnerOrManagerRoute>)
    expect(screen.queryByText('หน้าตั้งค่า')).not.toBeInTheDocument()
    expect(screen.getByText('หน้าออเดอร์')).toBeInTheDocument()
  })

  it('ผู้จัดการเข้าได้', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'manager', state: 'active', allowedPages: [] } })
    renderAt('/protected', <OwnerOrManagerRoute><div>หน้าตั้งค่า</div></OwnerOrManagerRoute>)
    expect(screen.getByText('หน้าตั้งค่า')).toBeInTheDocument()
  })

  it('เจ้าของร้านเข้าได้', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'owner', state: 'active', allowedPages: [] } })
    renderAt('/protected', <OwnerOrManagerRoute><div>หน้าตั้งค่า</div></OwnerOrManagerRoute>)
    expect(screen.getByText('หน้าตั้งค่า')).toBeInTheDocument()
  })
})

describe('OwnerOnlyRoute', () => {
  it('พนักงานเข้าไม่ได้ เด้งกลับ /', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'staff', state: 'active', allowedPages: [] } })
    renderAt('/protected', <OwnerOnlyRoute><div>หน้าตั้งค่า</div></OwnerOnlyRoute>)
    expect(screen.queryByText('หน้าตั้งค่า')).not.toBeInTheDocument()
    expect(screen.getByText('หน้าออเดอร์')).toBeInTheDocument()
  })

  it('เจ้าของร้านเข้าได้', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'owner', state: 'active', allowedPages: [] } })
    renderAt('/protected', <OwnerOnlyRoute><div>หน้าตั้งค่า</div></OwnerOnlyRoute>)
    expect(screen.getByText('หน้าตั้งค่า')).toBeInTheDocument()
  })

  it('ผู้จัดการเข้าไม่ได้เหมือนพนักงานทั่วไป (เช่น หน้าแชทบอท ไม่ได้อยู่ใน 3 สิทธิ์ที่ผู้จัดการมี)', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'manager', state: 'active', allowedPages: [] } })
    renderAt('/protected', <OwnerOnlyRoute><div>หน้าตั้งค่า</div></OwnerOnlyRoute>)
    expect(screen.queryByText('หน้าตั้งค่า')).not.toBeInTheDocument()
    expect(screen.getByText('หน้าออเดอร์')).toBeInTheDocument()
  })
})

describe('NoAccessPage', () => {
  it('มีลิงก์กลับไปหน้าแรกที่ตัวเองเข้าได้จริง ไม่ใช่ "/" เสมอไป', () => {
    useAuthMock.mockReturnValue({ staffStatus: { role: 'staff', state: 'active', allowedPages: ['customers'] } })
    render(
      <MemoryRouter>
        <NoAccessPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'กลับหน้าแรก' })).toHaveAttribute('href', '/customers')
  })
})
