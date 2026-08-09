import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatBot } from './ChatBot'

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
  }, 15000)
})
