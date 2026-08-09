import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ChatbotManagementPage } from './ChatbotManagementPage'

const save = vi.fn()
const removeQuestion = vi.fn()

const settings = {
  id: '1',
  shop_name: 'RYUKUNG BAKERY',
  logo_path: null,
  phone: null,
  address: null,
  promptpay: null,
  receipt_footer: null,
  receipt_show_logo: true,
  receipt_show_address: true,
  receipt_show_phone: true,
  receipt_show_promptpay: false,
  order_no_prefix: 'RYB',
  receipt_no_prefix: 'RC',
  shipping_lead_days: 1,
  require_full_customer_info: true,
  payment_instructions: null,
  line_url: 'https://lin.ee/yscT9fJ',
  faqs: [{ keywords: ['จัดส่ง'], answer: 'ปกติจัดส่งภายใน 2-3 วันค่ะ' }],
  owner_notification_email: null,
}

const questions = [
  { id: 'q1', question_text: 'มีบริการเค้กวันเกิดไหม', asked_count: 3, last_asked_at: '2026-08-09T00:00:00Z' },
]

vi.mock('../settings/useSettings', () => ({
  useSettings: () => ({ settings, loading: false, save, uploadLogo: vi.fn() }),
}))

vi.mock('./useUnansweredQuestions', () => ({
  useUnansweredQuestions: () => ({ questions, loading: false, remove: removeQuestion, reload: vi.fn() }),
}))

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } }))

beforeEach(() => {
  save.mockReset().mockResolvedValue({ error: null })
  removeQuestion.mockReset().mockResolvedValue({ error: null })
})

describe('หน้าจัดการแชทบอทน้องริว', () => {
  it('แสดง FAQ ที่ตั้งไว้และคำถามที่ตอบไม่ได้', () => {
    render(<MemoryRouter><ChatbotManagementPage /></MemoryRouter>)
    expect(screen.getByDisplayValue('จัดส่ง')).toBeInTheDocument()
    expect(screen.getByText('มีบริการเค้กวันเกิดไหม')).toBeInTheDocument()
  })

  it('มีแชทบอทแบบฝังในหน้าให้ทดสอบคุยได้ทันที (เปิดค้างอยู่แล้ว)', async () => {
    render(<MemoryRouter><ChatbotManagementPage /></MemoryRouter>)
    expect(await screen.findByText(/น้องริว จากร้าน RYUKUNG BAKERY/, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('กด "+ เพิ่มเป็น FAQ" เพิ่มคำถามใหม่พร้อมคำสำคัญ และลบออกจากรายการที่ตอบไม่ได้', async () => {
    render(<MemoryRouter><ChatbotManagementPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มเป็น FAQ' }))
    expect(screen.getByDisplayValue('มีบริการเค้กวันเกิดไหม')).toBeInTheDocument()
    expect(removeQuestion).toHaveBeenCalledWith('q1')
  })

  it('กดบันทึก เรียก save ด้วย faqs และ line_url ปัจจุบัน', async () => {
    render(<MemoryRouter><ChatbotManagementPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ line_url: 'https://lin.ee/yscT9fJ' })
    )
  })
})
