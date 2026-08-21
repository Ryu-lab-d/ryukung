import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentStep } from './PaymentStep'
import type { CartItem } from './CartPanel'
import type { Settings } from '../settings/useSettings'

const items: CartItem[] = [{ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty: 1 }]

const baseSettings: Settings = {
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

const createPOSSale = vi.fn()
vi.mock('./api', () => ({
  createPOSSale: (...args: unknown[]) => createPOSSale(...args),
}))

const issueReceipt = vi.fn()
vi.mock('../receipts/api', () => ({
  issueReceipt: (...args: unknown[]) => issueReceipt(...args),
}))

vi.mock('../public/PromptPayQR', () => ({
  PromptPayQR: ({ amount }: { amount: number }) => <div>QR ปลอม ยอด {amount}</div>,
}))

beforeEach(() => {
  createPOSSale.mockReset()
  issueReceipt.mockReset()
})

describe('PaymentStep — เงินสด', () => {
  it('กรอกเงินยื่นมาน้อยกว่ายอด ปุ่มยืนยันรับเงิน disabled', async () => {
    render(<PaymentStep items={items} settings={baseSettings} onBack={vi.fn()} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '💵 เงินสด' }))
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByRole('button', { name: 'ยืนยันรับเงิน' })).toBeDisabled()
    expect(screen.getByText('เงินที่ยื่นมายังไม่พอ')).toBeInTheDocument()
  })

  it('ปุ่ม "รับพอดี" เติมยอดเต็มให้อัตโนมัติ คำนวณเงินทอน 0', async () => {
    render(<PaymentStep items={items} settings={baseSettings} onBack={vi.fn()} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '💵 เงินสด' }))
    await userEvent.click(screen.getByRole('button', { name: /รับพอดี/ }))
    expect(screen.getByTestId('payment-amount-display')).toHaveTextContent('40')
    expect(screen.getByRole('button', { name: 'ยืนยันรับเงิน' })).not.toBeDisabled()
  })

  it('กรอกเงินเกินยอด คำนวณเงินทอนถูกต้อง แล้วยืนยันสำเร็จเรียก createPOSSale + issueReceipt ตามลำดับ', async () => {
    createPOSSale.mockResolvedValue({ orderId: 'order-1', error: null })
    issueReceipt.mockResolvedValue({ id: 'receipt-1', error: null })
    const onComplete = vi.fn()
    render(<PaymentStep items={items} settings={baseSettings} onBack={vi.fn()} onComplete={onComplete} />)

    await userEvent.click(screen.getByRole('button', { name: '💵 เงินสด' }))
    await userEvent.click(screen.getByRole('button', { name: '5' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    // ไม่โชว์เงินทอนล่วงหน้าตอนนี้ตั้งใจ — เห็นได้หลังกดยืนยันเท่านั้น (ผ่าน onComplete ด้านล่าง)
    expect(screen.queryByText(/เงินทอน/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ยืนยันรับเงิน' }))

    expect(createPOSSale).toHaveBeenCalledWith(
      [{ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty: 1 }],
      'cash'
    )
    expect(issueReceipt).toHaveBeenCalledWith('order-1', expect.objectContaining({ grand_total: 40 }))
    expect(onComplete).toHaveBeenCalledWith({ orderId: 'order-1', method: 'cash', change: 10, receiptIssued: true })
  })

  it('ขายไม่สำเร็จ (RPC error) แสดงข้อความผิดพลาด ไม่เรียก onComplete', async () => {
    createPOSSale.mockResolvedValue({ orderId: null, error: { message: 'สินค้าหมด' } })
    const onComplete = vi.fn()
    render(<PaymentStep items={items} settings={baseSettings} onBack={vi.fn()} onComplete={onComplete} />)
    await userEvent.click(screen.getByRole('button', { name: '💵 เงินสด' }))
    await userEvent.click(screen.getByRole('button', { name: /รับพอดี/ }))
    await userEvent.click(screen.getByRole('button', { name: 'ยืนยันรับเงิน' }))
    expect(await screen.findByText('สินค้าหมด')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })
})

describe('PaymentStep — พร้อมเพย์', () => {
  it('ยังไม่ได้ตั้งเลขพร้อมเพย์ในหน้าตั้งค่า ปุ่มเลือกพร้อมเพย์ไม่โผล่ มีคำเตือนแทน', () => {
    render(<PaymentStep items={items} settings={{ ...baseSettings, promptpay: null }} onBack={vi.fn()} onComplete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /พร้อมเพย์/ })).not.toBeInTheDocument()
    expect(screen.getByText('ยังไม่ได้ตั้งเลขพร้อมเพย์ในหน้าตั้งค่า')).toBeInTheDocument()
  })

  it('ตั้งพร้อมเพย์ไว้แล้ว เลือกได้ แสดง QR และยืนยันสำเร็จเรียก createPOSSale ด้วย method promptpay', async () => {
    createPOSSale.mockResolvedValue({ orderId: 'order-2', error: null })
    issueReceipt.mockResolvedValue({ id: 'receipt-2', error: null })
    const onComplete = vi.fn()
    render(<PaymentStep items={items} settings={baseSettings} onBack={vi.fn()} onComplete={onComplete} />)

    await userEvent.click(screen.getByRole('button', { name: '💳 พร้อมเพย์' }))
    expect(screen.getByText('QR ปลอม ยอด 40')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '✅ ยืนยันว่าลูกค้าจ่ายแล้ว' }))
    expect(createPOSSale).toHaveBeenCalledWith(expect.anything(), 'promptpay')
    expect(onComplete).toHaveBeenCalledWith({ orderId: 'order-2', method: 'promptpay', change: null, receiptIssued: true })
  })
})

describe('PaymentStep — ปุ่มกลับ', () => {
  it('กด "กลับไปแก้ตะกร้า" เรียก onBack', async () => {
    const onBack = vi.fn()
    render(<PaymentStep items={items} settings={baseSettings} onBack={onBack} onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '← กลับไปแก้ตะกร้า' }))
    expect(onBack).toHaveBeenCalled()
  })
})
