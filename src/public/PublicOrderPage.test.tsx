import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicOrderPage } from './PublicOrderPage'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

const baseOrder = {
  shop_name: 'RYUKUNG BAKERY',
  order_no: 'RYB-000001',
  customer_name: 'Somchai ใจดี',
  needed_date: '2026-08-10',
  fulfillment_type: 'pickup',
  work_status: 'to_bake',
  payment_status: 'unpaid',
  items_total: 80,
  discount_amount: 0,
  shipping_fee: 0,
  grand_total: 80,
  carrier: null,
  tracking_no: null,
  note: null,
  payment_instructions: null,
  faqs: [],
  line_url: null,
  pickup_place: 'หน้าร้าน',
  pickup_time: '10:00',
  ship_recipient_name: null,
  ship_recipient_phone: null,
  ship_address_text: null,
  address_editable: false,
  items: [{ product_name: 'คุกกี้', unit_price: 40, qty: 2, line_total: 80, note: null }],
}

function renderPage(token = 'abc') {
  render(
    <MemoryRouter initialEntries={[`/o/${token}`]}>
      <Routes><Route path="/o/:token" element={<PublicOrderPage />} /></Routes>
    </MemoryRouter>
  )
}

describe('การยืนยันชื่อในหน้าสรุปออเดอร์สำหรับลูกค้า', () => {
  it('ชื่อผิดจริงๆ เข้าไม่ได้ และมีข้อความเตือน', async () => {
    rpc.mockResolvedValue({ data: baseOrder })
    renderPage()
    const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
    await userEvent.type(input, 'คนละคนกันเลย')
    // ปุ่มเปลี่ยนข้อความและปลดล็อกพร้อมกันตอนข้อมูลจริงโหลดเสร็จ — findByRole รอจนกว่าจะเจอชื่อปุ่มสุดท้ายนี้
    const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
    await userEvent.click(submitButton)
    expect(await screen.findByText(/ชื่อไม่ตรงกับที่แจ้งไว้/)).toBeInTheDocument()
    expect(screen.queryByText('RYUKUNG BAKERY')).not.toBeInTheDocument()
  })

  it('พิมพ์ตัวพิมพ์เล็ก/ใหญ่ต่างกัน (เหมือน autocapitalize บนมือถือ) ยังถือว่าถูก เข้าได้ปกติ', async () => {
    rpc.mockResolvedValue({ data: baseOrder })
    renderPage()
    const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
    // ชื่อจริงคือ "Somchai ใจดี" — พิมพ์เป็น "somchai ใจดี" (s ตัวเล็ก) จำลองผลจาก autocapitalize ที่ต่างเครื่องต่างกัน
    await userEvent.type(input, 'somchai ใจดี')
    // ปุ่มเปลี่ยนข้อความและปลดล็อกพร้อมกันตอนข้อมูลจริงโหลดเสร็จ — findByRole รอจนกว่าจะเจอชื่อปุ่มสุดท้ายนี้
    const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
    await userEvent.click(submitButton)
    expect(await screen.findByText('RYUKUNG BAKERY')).toBeInTheDocument()
  })

  it('ออเดอร์ที่ไม่มีชื่อลูกค้าผูกไว้เลย ปิดกั้นเสมอไม่ว่าจะพิมพ์อะไร', async () => {
    rpc.mockResolvedValue({ data: { ...baseOrder, customer_name: null } })
    renderPage()
    const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
    await userEvent.type(input, 'อะไรก็ได้')
    // ปุ่มเปลี่ยนข้อความและปลดล็อกพร้อมกันตอนข้อมูลจริงโหลดเสร็จ — findByRole รอจนกว่าจะเจอชื่อปุ่มสุดท้ายนี้
    const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
    await userEvent.click(submitButton)
    expect(await screen.findByText('ออเดอร์นี้ไม่มีชื่อลูกค้าผูกไว้ในระบบ')).toBeInTheDocument()
  })
})
