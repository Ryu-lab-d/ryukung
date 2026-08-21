import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { POSPage } from './POSPage'

function renderPOSPage() {
  return render(
    <MemoryRouter>
      <POSPage />
    </MemoryRouter>
  )
}

const products = [
  { id: 'p1', name: 'คุกกี้', sku: null, category_id: null, price: 40, cost: 15, unit: 'ชิ้น', image_path: null, is_active: true, note: null, created_at: '', updated_at: '' },
]
vi.mock('../products/useProducts', () => ({ useProducts: () => ({ products, loading: false }) }))
vi.mock('../products/useCategories', () => ({ useCategories: () => ({ categories: [], loading: false }) }))

const settings = {
  id: '1',
  shop_name: 'RYUKUNG BAKERY',
  logo_path: null,
  phone: null,
  address: null,
  promptpay: '080-080-1181',
  receipt_footer: null,
  receipt_show_logo: true,
  receipt_show_address: true,
  receipt_show_phone: true,
  receipt_show_promptpay: true,
  order_no_prefix: 'RYB',
  receipt_no_prefix: 'RC',
  shipping_lead_days: 1,
  require_full_customer_info: true,
  payment_instructions: null,
  line_url: null,
  faqs: [],
  owner_notification_email: null,
}
vi.mock('../settings/useSettings', () => ({ useSettings: () => ({ settings, loading: false }) }))

const createPOSSale = vi.fn()
vi.mock('./api', () => ({
  createPOSSale: (...args: unknown[]) => createPOSSale(...args),
}))

const issueReceipt = vi.fn()
vi.mock('../receipts/api', () => ({
  issueReceipt: (...args: unknown[]) => issueReceipt(...args),
}))

beforeEach(() => {
  createPOSSale.mockReset()
  issueReceipt.mockReset()
})

describe('POSPage — flow เต็ม', () => {
  it('เลือกสินค้า → ไปหน้าชำระเงิน → จ่ายเงินสดครบ → เห็นหน้าสำเร็จ+เงินทอนถูก → กด "ขายรายการต่อไป" → กลับมาตะกร้าว่าง', async () => {
    createPOSSale.mockResolvedValue({ orderId: 'order-1', error: null })
    issueReceipt.mockResolvedValue({ id: 'receipt-1', error: null })
    renderPOSPage()

    // เลือกสินค้า — jsdom ไม่รู้จัก media query lg: จึงเห็นทั้งตะกร้าฝั่งขวาและแถบสรุปมือถือพร้อมกัน (ปกติจริง
    // ในเบราว์เซอร์จะเห็นแค่อันเดียวตามขนาดจอ) ใช้ getAllByText แทน getByText เพื่อไม่ให้ชนกันเอง
    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    expect(screen.getAllByText('40.00 บาท').length).toBeGreaterThan(0)

    // ไปหน้าชำระเงิน
    await userEvent.click(screen.getByRole('button', { name: 'ไปหน้าชำระเงิน →' }))
    expect(screen.getByText('ยอดที่ต้องชำระ')).toBeInTheDocument()

    // จ่ายเงินสดพอดี
    await userEvent.click(screen.getByRole('button', { name: /💵/ }))
    await userEvent.click(screen.getByRole('button', { name: /รับพอดี/ }))
    await userEvent.click(screen.getByRole('button', { name: 'ยืนยันรับเงิน' }))

    // เห็นหน้าสำเร็จ — จ่ายพอดีไม่มีเงินทอน แสดง "รับมาพอดี"
    expect(await screen.findByText('ขายสำเร็จ! 🎉')).toBeInTheDocument()
    expect(screen.getByText(/รับมาพอดี/)).toBeInTheDocument()

    // ขายรายการต่อไป — กลับมาตะกร้าว่างเหมือนเปิดหน้าใหม่
    await userEvent.click(screen.getByRole('button', { name: 'ขายรายการต่อไป' }))
    expect(screen.getByText('ยังไม่ได้เลือกสินค้า')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ไปหน้าชำระเงิน →' })).toBeDisabled()
  })

  it('กด "กลับไปแก้ตะกร้า" จากหน้าชำระเงิน กลับมาเห็นตะกร้าเดิม (ไม่หายไป)', async () => {
    renderPOSPage()
    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    await userEvent.click(screen.getByRole('button', { name: 'ไปหน้าชำระเงิน →' }))
    await userEvent.click(screen.getByRole('button', { name: '← กลับไปแก้ตะกร้า' }))
    expect(screen.getAllByText('40.00 บาท').length).toBeGreaterThan(0)
  })
})

describe('POSPage — ตะกร้ากันหายตอนสลับแท็บ/แอปแล้วกลับมา', () => {
  it('เลือกสินค้าไว้แล้ว unmount+remount หน้า (จำลองแอปถูกรีโหลด) ตะกร้ายังอยู่ครบ', async () => {
    const { unmount } = renderPOSPage()
    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    expect(screen.getAllByText('40.00 บาท').length).toBeGreaterThan(0)
    unmount()

    renderPOSPage()
    expect(screen.getAllByText('40.00 บาท').length).toBeGreaterThan(0)
    expect(screen.queryByText('ยังไม่ได้เลือกสินค้า')).not.toBeInTheDocument()
  })

  it('ขายสำเร็จแล้ว ร่างตะกร้าที่บันทึกไว้ถูกเคลียร์ทิ้ง (unmount กลางทางก็ไม่มีของเก่าค้าง)', async () => {
    createPOSSale.mockResolvedValue({ orderId: 'order-9', error: null })
    issueReceipt.mockResolvedValue({ id: 'receipt-9', error: null })
    const { unmount } = renderPOSPage()

    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    await userEvent.click(screen.getByRole('button', { name: 'ไปหน้าชำระเงิน →' }))
    await userEvent.click(screen.getByRole('button', { name: /💵/ }))
    await userEvent.click(screen.getByRole('button', { name: /รับพอดี/ }))
    await userEvent.click(screen.getByRole('button', { name: 'ยืนยันรับเงิน' }))
    await screen.findByText('ขายสำเร็จ! 🎉')
    unmount()

    renderPOSPage()
    expect(screen.getByText('ยังไม่ได้เลือกสินค้า')).toBeInTheDocument()
  })
})
