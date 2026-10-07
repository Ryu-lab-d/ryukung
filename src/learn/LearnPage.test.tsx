import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LearnPage } from './LearnPage'
import { generateAccessCode, normalizeAccessCode, parseIngredients, parseSteps } from './learnApi'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const session = {
  student_name: 'น้องฝน',
  courses: [
    {
      id: 'c1', title: 'Soft Cookies', emoji: '🍪', description: 'คุกกี้เนื้อนุ่ม',
      lessons: [{ id: 'l1', title: 'สูตรพื้นฐาน', ingredients: 'แป้งสาลี | 200 กรัม', steps: '1. ตีเนย\n2. ใส่แป้ง', tips: 'อย่าอบนาน', video_url: null }],
    },
    { id: 'c2', title: 'Brownies', emoji: '🍫', description: null, lessons: [] },
  ],
}

beforeEach(() => {
  rpc.mockReset()
  localStorage.clear()
})

function renderPage() {
  render(<MemoryRouter><LearnPage /></MemoryRouter>)
}

describe('learnApi', () => {
  it('สร้างรหัสรูปแบบ COOK-XXXXXXXX และ normalize รหัสที่พิมพ์มาไม่ครบรูปแบบ', () => {
    expect(generateAccessCode()).toMatch(/^COOK-[A-Z2-9]{8}$/)
    expect(normalizeAccessCode(' cook7f3k9qxa ')).toBe('COOK-7F3K9QXA')
    expect(normalizeAccessCode('cook-7f3k9qxa')).toBe('COOK-7F3K9QXA')
  })
  it('แยกส่วนผสมและขั้นตอน', () => {
    expect(parseIngredients('แป้ง | 200 ก.\n\nเนย')).toEqual([{ name: 'แป้ง', qty: '200 ก.' }, { name: 'เนย', qty: '' }])
    expect(parseSteps('1. ตี\n2) อบ')).toEqual(['ตี', 'อบ'])
  })
})

describe('LearnPage', () => {
  it('ใส่รหัสผิดแสดงข้อความ', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    renderPage()
    await userEvent.type(screen.getByLabelText('รหัสเข้าเรียน'), 'COOK-XXXX')
    await userEvent.click(screen.getByRole('button', { name: 'เข้าเรียน' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('รหัสไม่ถูกต้อง')
  })

  it('ใส่รหัสถูก → เลือกคอร์ส → เห็นสูตรและวิธีทำ', async () => {
    rpc.mockResolvedValue({ data: session, error: null })
    renderPage()
    await userEvent.type(screen.getByLabelText('รหัสเข้าเรียน'), 'cook-7f3k9qxa')
    await userEvent.click(screen.getByRole('button', { name: 'เข้าเรียน' }))
    expect(rpc).toHaveBeenCalledWith('learn_open', { p_code: 'COOK-7F3K9QXA' })
    expect(await screen.findByText('เลือกคอร์สที่จะเรียน')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Soft Cookies'))
    expect(await screen.findByText('แป้งสาลี')).toBeInTheDocument()
    expect(screen.getByText('200 กรัม')).toBeInTheDocument()
    expect(screen.getByText('ตีเนย')).toBeInTheDocument()
    expect(screen.getByText(/อย่าอบนาน/)).toBeInTheDocument()
  })
})
