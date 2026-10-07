import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CoursePresentPage, buildSlides } from './CoursePresentPage'

const course = { id: 'c1', title: 'Soft Cookies', emoji: '🍪', description: 'คุกกี้นุ่ม', is_published: true, sort_order: 0 }
const lessons: any[] = [
  { id: 'l1', course_id: 'c1', title: 'สูตรพื้นฐาน', ingredients: 'แป้ง | 200 กรัม', steps: '1. ตีเนย\n2. ใส่แป้ง', tips: 'อย่าอบนาน', video_url: null, sort_order: 0 },
]

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (t: string) => ({
      select: () => ({
        eq: () => (t === 'courses' ? { single: async () => ({ data: course }) } : { order: () => ({ order: async () => ({ data: lessons }) }) }),
      }),
    }),
  },
}))

describe('buildSlides', () => {
  it('หน้าปก → ชื่อบท → ส่วนผสม → ขั้นตอนทีละสไลด์ → เคล็ดลับ → จบ', () => {
    const kinds = buildSlides(course, lessons).map((s) => s.kind)
    expect(kinds).toEqual(['cover', 'lesson', 'ingredients', 'step', 'step', 'tips', 'end'])
  })
})

describe('CoursePresentPage', () => {
  it('กดลูกศร/ปุ่มถัดไปเปลี่ยนสไลด์ได้', async () => {
    render(
      <MemoryRouter initialEntries={['/courses/c1/present']}>
        <Routes><Route path="/courses/:id/present" element={<CoursePresentPage />} /></Routes>
      </MemoryRouter>
    )
    expect(await screen.findByRole('heading', { name: 'Soft Cookies' })).toBeInTheDocument()
    expect(screen.getByLabelText('ลำดับสไลด์')).toHaveTextContent('1 / 7')
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByText('แป้ง')).toBeInTheDocument()
    expect(screen.getByLabelText('ลำดับสไลด์')).toHaveTextContent('3 / 7')
    await userEvent.click(screen.getByLabelText('ถัดไป'))
    expect(screen.getByText('ตีเนย')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByText('แป้ง')).toBeInTheDocument()
  })
})
