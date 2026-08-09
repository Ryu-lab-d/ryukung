import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicOrderPage } from './PublicOrderPage'

const rpc = vi.fn()
const functionsInvoke = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
  },
}))

const baseOrder = {
  shop_name: 'RYUKUNG BAKERY',
  order_no: 'RYB-000001',
  customer_name: 'Somchai ใจดี',
  needed_date: '2026-08-10',
  fulfillment_type: 'pickup',
  work_status: 'to_bake' as string,
  payment_status: 'unpaid',
  items_total: 80,
  discount_amount: 0,
  shipping_fee: 0,
  grand_total: 80,
  carrier: null,
  tracking_no: null,
  note: null,
  payment_instructions: null as string | null,
  promptpay: null as string | null,
  balance_due: 80,
  payment_claimed_at: null as string | null,
  faqs: [],
  line_url: null as string | null,
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

async function openOrder(order: typeof baseOrder) {
  rpc.mockResolvedValue({ data: order })
  renderPage()
  const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
  await userEvent.type(input, order.customer_name!)
  const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
  await userEvent.click(submitButton)
  await screen.findByText(order.shop_name)
}

describe('ปุ่มติดต่อพนักงานผ่านไลน์', () => {
  it('มีปุ่มติดต่อพนักงานที่ลิงก์ไปไลน์ร้าน เมื่อร้านตั้งค่าลิงก์ไว้', async () => {
    await openOrder({ ...baseOrder, line_url: 'https://lin.ee/yscT9fJ' })
    const link = screen.getByRole('link', { name: /ติดต่อพนักงาน/ })
    expect(link).toHaveAttribute('href', 'https://lin.ee/yscT9fJ')
  })

  it('ไม่มีปุ่มติดต่อพนักงาน ถ้าร้านยังไม่ได้ตั้งลิงก์ไลน์ไว้', async () => {
    await openOrder({ ...baseOrder, line_url: null })
    expect(screen.queryByRole('link', { name: /ติดต่อพนักงาน/ })).not.toBeInTheDocument()
  })

  it('สถานะจัดส่งสำเร็จแล้ว มีข้อความ "ไม่ได้รับของ? ติดต่อที่นี่" ลิงก์ไปไลน์', async () => {
    await openOrder({ ...baseOrder, work_status: 'delivered', line_url: 'https://lin.ee/yscT9fJ' })
    const link = screen.getByRole('link', { name: /ไม่ได้รับของ/ })
    expect(link).toHaveAttribute('href', 'https://lin.ee/yscT9fJ')
  })

  it('สถานะยังไม่ถึงจัดส่งสำเร็จ ไม่มีข้อความ "ไม่ได้รับของ"', async () => {
    await openOrder({ ...baseOrder, work_status: 'baking', line_url: 'https://lin.ee/yscT9fJ' })
    expect(screen.queryByText(/ไม่ได้รับของ/)).not.toBeInTheDocument()
  })
})

describe('QR พร้อมเพย์ล็อกยอด', () => {
  it('ร้านตั้งเลขพร้อมเพย์ไว้ กดดูวิธีชำระเงินแล้วเห็น QR พร้อมยอดที่ต้องจ่ายจริง', async () => {
    await openOrder({ ...baseOrder, promptpay: '0812345678', balance_due: 80 })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(await screen.findByAltText('QR พร้อมเพย์')).toBeInTheDocument()
    expect(screen.getByText('80.00 บาท')).toBeInTheDocument()
    expect(screen.getByText(/ยอดถูกล็อกไว้ในตัว QR/)).toBeInTheDocument()
  })

  it('ยังไม่ได้ตั้งเลขพร้อมเพย์ ไม่แสดง QR (โชว์แค่ข้อความวิธีชำระเงินถ้ามี)', async () => {
    await openOrder({ ...baseOrder, promptpay: null, balance_due: 80, payment_instructions: 'โอนเข้าบัญชี...' })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(screen.queryByAltText('QR พร้อมเพย์')).not.toBeInTheDocument()
  })

  it('ยอดคงเหลือเป็นศูนย์ ไม่แสดง QR แม้จะตั้งเลขพร้อมเพย์ไว้', async () => {
    await openOrder({ ...baseOrder, promptpay: '0812345678', balance_due: 0 })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(screen.queryByAltText('QR พร้อมเพย์')).not.toBeInTheDocument()
  })
})

describe('ปุ่มยืนยันการชำระเงิน', () => {
  it('ยังไม่เคยแจ้ง กดปุ่มยืนยันแล้วเรียก edge function พร้อม token แล้วรีเฟรชสถานะเป็นแจ้งแล้ว', async () => {
    functionsInvoke.mockResolvedValue({ data: { ok: true, alreadyClaimed: false }, error: null })
    await openOrder({ ...baseOrder, payment_claimed_at: null })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    const claimButton = await screen.findByRole('button', { name: /ยืนยันการชำระเงิน/ })

    rpc.mockResolvedValue({ data: { ...baseOrder, payment_claimed_at: '2026-08-09T10:00:00Z' } })
    await userEvent.click(claimButton)

    expect(functionsInvoke).toHaveBeenCalledWith('notify-payment-claim', { body: { token: 'abc' } })
    expect(await screen.findByText(/แจ้งการชำระเงินแล้ว/)).toBeInTheDocument()
  })

  it('เคยแจ้งแล้ว แสดงข้อความยืนยันแทนปุ่ม ไม่ให้กดซ้ำ', async () => {
    await openOrder({ ...baseOrder, payment_claimed_at: '2026-08-09T10:00:00Z' })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(await screen.findByText(/แจ้งการชำระเงินแล้ว/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^✅ ยืนยันการชำระเงิน$/ })).not.toBeInTheDocument()
  })

  it('edge function error ขึ้นข้อความ error ให้ลูกค้าเห็น', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { message: 'เครือข่ายมีปัญหา' } })
    await openOrder({ ...baseOrder, payment_claimed_at: null })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    const claimButton = await screen.findByRole('button', { name: /ยืนยันการชำระเงิน/ })
    await userEvent.click(claimButton)
    expect(await screen.findByText('เครือข่ายมีปัญหา')).toBeInTheDocument()
  })
})
