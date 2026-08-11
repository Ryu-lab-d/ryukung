import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ContentStatsPage } from './ContentStatsPage'
import type { PostedContentItem } from './contentStats'

let itemsOverride: PostedContentItem[] = []
let loadingOverride = false
vi.mock('./useContentStats', () => ({
  useContentStats: () => ({ items: itemsOverride, loading: loadingOverride }),
}))

function renderPage() {
  render(
    <MemoryRouter>
      <ContentStatsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  itemsOverride = []
  loadingOverride = false
})

describe('ContentStatsPage', () => {
  it('ยังไม่มีคอนเทนต์ที่โพสต์แล้วเลย แสดงข้อความบอกว่ายังไม่มีข้อมูลในทุกกราฟ', () => {
    renderPage()
    expect(screen.getAllByText(/ยังไม่มีคอนเทนต์ที่โพสต์แล้ว/).length).toBeGreaterThan(0)
  })

  it('มีคอนเทนต์โพสต์แล้ว สรุปสัดส่วนแนวตัดต่อ เดือนที่โพสต์เยอะสุด และแพลตฟอร์มที่ใช้บ่อยสุด', () => {
    itemsOverride = [
      { platforms: ['instagram', 'tiktok'], editing_style: 'ตลก', post_date: '2026-08-05' },
      { platforms: ['instagram'], editing_style: 'ตลก', post_date: '2026-08-20' },
      { platforms: ['facebook'], editing_style: 'ให้ความรู้', post_date: '2026-07-01' },
    ]
    renderPage()

    // แนวตัดต่อ: ตลก 2 ใน 3 = 67%
    expect(screen.getByText('ตลก')).toBeInTheDocument()
    expect(screen.getByText(/2 \(67%\)/)).toBeInTheDocument()

    // เดือนที่โพสต์เยอะสุดคือ ส.ค. (2 คอนเทนต์) มากกว่า ก.ค. (1 คอนเทนต์)
    expect(screen.getByText(/เดือนที่โพสต์เยอะที่สุดคือ/)).toBeInTheDocument()

    // แพลตฟอร์ม: instagram ถูกนับ 2 ครั้งเพราะโผล่ใน 2 คอนเทนต์
    expect(screen.getByText(/Instagram/)).toBeInTheDocument()
  })

  it('มีลิงก์กลับไปหน้าแผนคอนเทนต์', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /กลับแผนคอนเทนต์/ })).toHaveAttribute('href', '/content')
  })
})
