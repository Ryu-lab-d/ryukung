import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { POSPage } from './POSPage'

const products = [
  { id: 'p1', name: 'คุกกี้', sku: null, category_id: null, price: 40, cost: 15, unit: 'ชิ้น', image_path: null, is_active: true, note: null, created_at: '', updated_at: '' },
  { id: 'p2', name: 'บราวนี่', sku: null, category_id: null, price: 60, cost: 25, unit: 'ชิ้น', image_path: null, is_active: true, note: null, created_at: '', updated_at: '' },
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

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage() {
  render(
    <MemoryRouter>
      <POSPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  createPOSSale.mockReset()
  issueReceipt.mockReset()
  navigate.mockReset()
})

describe('POSPage — ขายหน้าร้าน', () => {
  it('แตะสินค้าเพิ่มลงตะกร้า แล้วยอดรวมอัปเดตถูกต้อง', async () => {
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    expect(screen.queryByText('ยังไม่ได้เลือกสินค้า')).not.toBeInTheDocument()
    expect(screen.getByText('40.00 บาท')).toBeInTheDocument()
  })

  it('แตะสินค้าเดิมซ้ำ เพิ่มจำนวนแทนที่จะเพิ่มแถวใหม่', async () => {
    renderPage()
    const pickerTile = screen.getAllByText('คุกกี้')[0]
    await userEvent.click(pickerTile)
    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    expect(screen.getByLabelText('จำนวน')).toHaveValue(2)
    expect(screen.getByText('80.00 บาท')).toBeInTheDocument()
  })

  it('ไม่มีสินค้าในตะกร้า กดชำระเงินแล้วแจ้ง error', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))
    expect(screen.getByText('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')).toBeInTheDocument()
    expect(createPOSSale).not.toHaveBeenCalled()
  })

  it('มีสินค้าแล้วแต่ไม่เลือกวิธีรับเงิน กดชำระเงินแล้วเด้ง Toast เตือน', async () => {
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    await userEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))
    expect(await screen.findByText('กรุณาเลือกวิธีรับเงิน')).toBeInTheDocument()
    expect(createPOSSale).not.toHaveBeenCalled()
  })

  it('เลือกสินค้า+วิธีรับเงินครบ กดชำระเงินสำเร็จ ออกใบเสร็จอัตโนมัติแล้วพาไปหน้าใบเสร็จ', async () => {
    createPOSSale.mockResolvedValue({ orderId: 'order-1', error: null })
    issueReceipt.mockResolvedValue({ id: 'receipt-1', error: null })
    renderPage()

    await userEvent.click(screen.getByText('คุกกี้'))
    await userEvent.click(screen.getByRole('button', { name: '💵 เงินสด' }))
    await userEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))

    expect(createPOSSale).toHaveBeenCalledWith(
      [{ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty: 1 }],
      'cash'
    )
    expect(issueReceipt).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ grand_total: 40, items_total: 40, customer_name: null })
    )
    expect(navigate).toHaveBeenCalledWith('/receipts/order-1')
  })

  it('ขายไม่สำเร็จ (RPC error) แสดงข้อความผิดพลาด ไม่พาไปหน้าใบเสร็จ', async () => {
    createPOSSale.mockResolvedValue({ orderId: null, error: { message: 'สินค้าหมด' } })
    renderPage()

    await userEvent.click(screen.getByText('บราวนี่'))
    await userEvent.click(screen.getByRole('button', { name: '💳 พร้อมเพย์ / โอนเงิน' }))
    await userEvent.click(screen.getByRole('button', { name: 'ชำระเงิน' }))

    expect(await screen.findByText('สินค้าหมด')).toBeInTheDocument()
    expect(issueReceipt).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
