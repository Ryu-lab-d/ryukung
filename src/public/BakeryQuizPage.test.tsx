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
  const btn = screen.getAllByRole('button').find((b) => b.hasAttribute('data-opt') && b.querySelector('span:last-child')?.textContent === text)
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
      const questionText = (document.querySelector('p.text-xl.font-display') as HTMLElement).textContent!
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
      const questionText = (document.querySelector('p.text-xl.font-display') as HTMLElement).textContent!
      const q = QUIZ_LEVELS[0].questions.find((x) => x.q === questionText)!
      await user.click(optionButton(q.wrong[0]))
      await user.click(screen.getByRole('button', { name: /ข้อต่อไป|ดูผลคะแนน/ }))
    }
    expect(screen.getByText('เกือบแล้ว ลองอีกครั้งนะ')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bakery-quiz-progress')!).passed).toBe(0)
  })

  it('ผ่านครบ 6 ด่าน → คำวิจารณ์ → กรอกชื่อ-นามสกุล → ใบเกียรติบัตร', async () => {
    const user = userEvent.setup()
    renderPage()
    for (let lv = 0; lv < QUIZ_LEVELS.length; lv++) {
      const startBtns = screen.getAllByRole('button', { name: /^(เริ่ม|เล่นอีก)$/ })
      await user.click(startBtns[startBtns.length - 1])
      for (let i = 0; i < 10; i++) {
        const questionText = (document.querySelector('p.text-xl.font-display') as HTMLElement).textContent!
        const q = QUIZ_LEVELS[lv].questions.find((x) => x.q === questionText)!
        await user.click(optionButton(q.a))
        await user.click(screen.getByRole('button', { name: /ข้อต่อไป|ดูผลคะแนน/ }))
      }
      if (lv < QUIZ_LEVELS.length - 1) await user.click(screen.getByRole('button', { name: /เลือกด่านอื่น/ }))
    }
    expect(screen.getByText(/คุณคือเทพเจ้าเบเกอรี่/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ดูคำวิจารณ์ & รับเกียรติบัตร/ }))
    expect(screen.getByText('คำวิจารณ์ผลของคุณ')).toBeInTheDocument()
    expect(screen.getByText(/ตอบถูก 60 จาก 60 ข้อ \(100%\)/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /กรอกชื่อรับเกียรติบัตร/ }))
    const issue = screen.getByRole('button', { name: /ออกใบเกียรติบัตร/ })
    expect(issue).toBeDisabled()
    await user.type(screen.getByLabelText('ชื่อ'), 'สมหญิง')
    expect(issue).toBeDisabled() // ยังไม่กรอกนามสกุล
    await user.type(screen.getByLabelText('นามสกุล'), 'ใจดี')
    await user.click(issue)

    expect(screen.getByText('สมหญิง ใจดี')).toBeInTheDocument()
    expect(screen.getByText('CERTIFICATE OF ACHIEVEMENT')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('bakery-quiz-progress')!).certNo).toMatch(/^BK-/)
  }, 60000)
})
