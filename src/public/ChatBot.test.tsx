import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatBot } from './ChatBot'

const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

const faqs = [
  { keywords: ['จัดส่ง', 'ส่งกี่วัน'], answer: 'ปกติจัดส่งภายใน 2-3 วันค่ะ' },
]

function openChat() {
  render(<ChatBot shopName="RYUKUNG BAKERY" faqs={faqs} lineUrl="https://lin.ee/yscT9fJ" />)
}

describe('แชทบอทน้องริว', () => {
  it('เปิดแชทแล้วทักทายอัตโนมัติพร้อมชื่อร้าน', async () => {
    openChat()
    await userEvent.click(screen.getByRole('button', { name: 'คุยกับน้องริว' }))
    expect(await screen.findByText(/น้องริว จากร้าน RYUKUNG BAKERY/, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('คำถามตรงกับ FAQ ที่ตั้งไว้ ตอบคำตอบที่ตั้งไว้', async () => {
    openChat()
    await userEvent.click(screen.getByRole('button', { name: 'คุยกับน้องริว' }))
    await screen.findByText(/น้องริว จากร้าน/, {}, { timeout: 2000 })

    const input = screen.getByPlaceholderText('พิมพ์คำถาม...')
    await userEvent.type(input, 'จัดส่งกี่วันคะ')
    await userEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }))

    expect(await screen.findByText(/ปกติจัดส่งภายใน 2-3 วันค่ะ/, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('คำถามใกล้เคียง (สลับคำ ไม่ตรงเป๊ะ) ก็ยังจับคู่ FAQ ได้', async () => {
    openChat()
    await userEvent.click(screen.getByRole('button', { name: 'คุยกับน้องริว' }))
    await screen.findByText(/น้องริว จากร้าน/, {}, { timeout: 2000 })

    const input = screen.getByPlaceholderText('พิมพ์คำถาม...')
    await userEvent.type(input, 'กี่วันส่งของคะ')
    await userEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }))

    expect(await screen.findByText(/ปกติจัดส่งภายใน 2-3 วันค่ะ/, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('ลิงก์ในคำตอบของบอทกดได้จริง (ไม่ใช่แค่ข้อความเฉยๆ)', async () => {
    openChat()
    await userEvent.click(screen.getByRole('button', { name: 'คุยกับน้องริว' }))
    await screen.findByText(/น้องริว จากร้าน/, {}, { timeout: 2000 })

    const input = screen.getByPlaceholderText('พิมพ์คำถาม...')
    await userEvent.type(input, 'วันนี้อากาศเป็นยังไงบ้าง')
    await userEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }))

    const link = await screen.findByRole('link', { name: /lin\.ee\/yscT9fJ/ }, { timeout: 8000 })
    expect(link).toHaveAttribute('href', 'https://lin.ee/yscT9fJ')
  }, 15000)

  it('คำถามไม่ตรง FAQ ไหนเลย ตอบขอโทษพร้อมลิงก์ไลน์', async () => {
    openChat()
    await userEvent.click(screen.getByRole('button', { name: 'คุยกับน้องริว' }))
    await screen.findByText(/น้องริว จากร้าน/, {}, { timeout: 2000 })

    const input = screen.getByPlaceholderText('พิมพ์คำถาม...')
    await userEvent.type(input, 'วันนี้อากาศเป็นยังไงบ้าง')
    await userEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }))

    // ข้อความตอบยาว + มีเอเฟกต์พิมพ์ทีละตัวอักษร จึงกว่าจะเผยครบต้องรอนานกว่าข้อความสั้นๆ
    expect(await screen.findByText(/น้องริวยังไม่สามารถช่วยตอบคำถามนี้ได้/, {}, { timeout: 8000 })).toBeInTheDocument()
    expect(await screen.findByText(/lin\.ee\/yscT9fJ/, {}, { timeout: 8000 })).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('log_unanswered_chat_question', { p_question: 'วันนี้อากาศเป็นยังไงบ้าง' })
  }, 15000)

  it('โหมด embedded (ทดสอบจากฝั่งร้าน) เปิดค้างอยู่แล้วและไม่บันทึกคำถามที่ตอบไม่ได้', async () => {
    rpc.mockClear()
    render(<ChatBot shopName="RYUKUNG BAKERY" faqs={faqs} lineUrl="https://lin.ee/yscT9fJ" mode="embedded" />)
    expect(await screen.findByText(/น้องริว จากร้าน RYUKUNG BAKERY/, {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'คุยกับน้องริว' })).not.toBeInTheDocument()

    const input = screen.getByPlaceholderText('พิมพ์คำถาม...')
    await userEvent.type(input, 'วันนี้อากาศเป็นยังไงบ้าง')
    await userEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }))
    await screen.findByText(/น้องริวยังไม่สามารถช่วยตอบคำถามนี้ได้/, {}, { timeout: 8000 })

    expect(rpc).not.toHaveBeenCalled()
  }, 15000)
})
