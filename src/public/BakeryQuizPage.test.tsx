import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BakeryQuizPage } from './BakeryQuizPage'
import { QUIZ_LEVELS } from './quizData'

vi.mock('../lib/publicMenuApi', () => ({
  getPublicMenu: vi.fn().mockResolvedValue({ menu: null, error: 'x' }),
}))
vi.mock('../lib/uiSound', () => ({ playAddSound: vi.fn(), playPaymentSound: vi.fn() }))

function optionButton(text: string): HTMLElement {
  const btn = screen.getAllByRole('button').find((b) => b.hasAttribute('data-opt') && b.textContent?.includes(text))
  if (!btn) throw new Error('ไม่พบตัวเลือก: ' + text)
  return btn
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BakeryQuizPage />
    </MemoryRouter>
  )
}

describe('หน้าทดสอบความรู้เบเกอรี่ /test', () => {
  beforeEach(() => {
    localStorage.clear()
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })

  it('เริ่มต้นมีด่านเดียวที่เล่นได้ ด่านอื่นล็อกอยู่', () => {
    renderPage()
    expect(screen.getByText('ทดสอบความรู้เบเกอรี่')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'เริ่ม' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'ล็อก' })).toHaveLength(QUIZ_LEVELS.length - 1)
  })

  it('เล่นผ่านด่านแรกด้วยการตอบถูกทุกข้อ แล้วปลดล็อกด่านถัดไปและจำไว้', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'เริ่ม' }))

    for (let i = 0; i < 10; i++) {
      const prompt = screen.getByText(/ข้อ \d+\/10/)
      expect(prompt).toBeInTheDocument()
      const questionText = (document.querySelector('p.text-lg.font-display') as HTMLElement).textContent!
      const q = QUIZ_LEVELS[0].questions.find((x) => x.q === questionText)!
      await user.click(optionButton(q.a))
      await user.click(screen.getByRole('button', { name: /ข้อต่อไป|ดูผลคะแนน/ }))
    }

    expect(screen.getByText('ผ่านด่านแล้ว!')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bakery-quiz-progress')!).passed).toBe(1)
  })

  it('ตอบผิดเกือบหมด ไม่ผ่านด่านและไม่ปลดล็อกด่านถัดไป', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'เริ่ม' }))
    for (let i = 0; i < 10; i++) {
      const questionText = (document.querySelector('p.text-lg.font-display') as HTMLElement).textContent!
      const q = QUIZ_LEVELS[0].questions.find((x) => x.q === questionText)!
      await user.click(optionButton(q.wrong[0]))
      await user.click(screen.getByRole('button', { name: /ข้อต่อไป|ดูผลคะแนน/ }))
    }
    expect(screen.getByText('เกือบแล้ว ลองอีกครั้งนะ')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bakery-quiz-progress')!).passed).toBe(0)
  })
})
