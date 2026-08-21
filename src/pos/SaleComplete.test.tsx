import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SaleComplete } from './SaleComplete'
import type { SaleResult } from './PaymentStep'

function renderSaleComplete(props: Parameters<typeof SaleComplete>[0]) {
  return render(
    <MemoryRouter>
      <SaleComplete {...props} />
    </MemoryRouter>
  )
}

describe('SaleComplete — เสียงประกาศ', () => {
  const speak = vi.fn()
  const originalUtterance = window.SpeechSynthesisUtterance
  const originalSynthesis = window.speechSynthesis

  beforeEach(() => {
    speak.mockReset()
    class FakeUtterance {
      text: string
      lang = ''
      constructor(text: string) {
        this.text = text
      }
    }
    window.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance
    // @ts-expect-error jsdom ไม่มี Web Speech API จริง — mock แค่ส่วนที่ใช้
    window.speechSynthesis = { speak }
  })

  afterEach(() => {
    window.SpeechSynthesisUtterance = originalUtterance
    window.speechSynthesis = originalSynthesis
  })

  it('จ่ายเงินสดมีเงินทอน พูดประกาศยอดเงินทอน', () => {
    const result: SaleResult = { orderId: 'order-1', method: 'cash', change: 40, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 100, onNextSale: vi.fn() })
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'เงินทอน 40 บาท' }))
  })

  it('จ่ายเงินสดพอดี (ไม่มีเงินทอน) พูด "รับมาพอดี"', () => {
    const result: SaleResult = { orderId: 'order-2', method: 'cash', change: 0, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 40, onNextSale: vi.fn() })
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'รับมาพอดี' }))
  })

  it('จ่ายพร้อมเพย์ ไม่พูดเรื่องเงินทอน/รับพอดีเลย', () => {
    const result: SaleResult = { orderId: 'order-3', method: 'promptpay', change: null, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 60, onNextSale: vi.fn() })
    expect(speak).not.toHaveBeenCalled()
  })

  it('เบราว์เซอร์ไม่รองรับ Web Speech API ก็ไม่พัง', () => {
    // @ts-expect-error จำลองเบราว์เซอร์ที่ไม่มี API นี้เลย
    window.SpeechSynthesisUtterance = undefined
    const result: SaleResult = { orderId: 'order-4', method: 'cash', change: 20, receiptIssued: true }
    expect(() => renderSaleComplete({ result, grandTotal: 60, onNextSale: vi.fn() })).not.toThrow()
  })
})

describe('SaleComplete', () => {
  it('จ่ายเงินสดมีเงินทอน แสดงยอดขายและเงินทอนถูกต้อง', () => {
    const result: SaleResult = { orderId: 'order-1', method: 'cash', change: 10, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 40, onNextSale: vi.fn() })
    expect(screen.getByText('ยอดขาย 40.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('10.00 บาท')).toBeInTheDocument()
    expect(screen.queryByText(/ออกใบเสร็จอัตโนมัติไม่สำเร็จ/)).not.toBeInTheDocument()
  })

  it('จ่ายเงินสดพอดี แสดงข้อความ "รับมาพอดี" แทนกล่องเงินทอน', () => {
    const result: SaleResult = { orderId: 'order-1b', method: 'cash', change: 0, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 40, onNextSale: vi.fn() })
    expect(screen.getByText(/รับมาพอดี/)).toBeInTheDocument()
    expect(screen.queryByText('เงินทอน')).not.toBeInTheDocument()
  })

  it('จ่ายพร้อมเพย์ ไม่แสดงกล่องเงินทอนหรือรับมาพอดี', () => {
    const result: SaleResult = { orderId: 'order-2', method: 'promptpay', change: null, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 60, onNextSale: vi.fn() })
    expect(screen.queryByText('เงินทอน')).not.toBeInTheDocument()
    expect(screen.queryByText(/รับมาพอดี/)).not.toBeInTheDocument()
  })

  it('ออกใบเสร็จอัตโนมัติไม่สำเร็จ แสดงคำเตือน', () => {
    const result: SaleResult = { orderId: 'order-3', method: 'cash', change: 0, receiptIssued: false }
    renderSaleComplete({ result, grandTotal: 40, onNextSale: vi.fn() })
    expect(screen.getByText(/ออกใบเสร็จอัตโนมัติไม่สำเร็จ/)).toBeInTheDocument()
  })

  it('ปุ่ม "ดูใบเสร็จ" ลิงก์ไปหน้าใบเสร็จจริงของออเดอร์นี้ (/orders/:id/receipt)', () => {
    const result: SaleResult = { orderId: 'order-4', method: 'cash', change: 5, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 40, onNextSale: vi.fn() })
    const link = screen.getByRole('link', { name: /ดูใบเสร็จ/ })
    expect(link).toHaveAttribute('href', '/orders/order-4/receipt')
  })

  it('กด "ขายรายการต่อไป" เรียก onNextSale', async () => {
    const onNextSale = vi.fn()
    const result: SaleResult = { orderId: 'order-5', method: 'cash', change: 0, receiptIssued: true }
    renderSaleComplete({ result, grandTotal: 40, onNextSale })
    await userEvent.click(screen.getByRole('button', { name: 'ขายรายการต่อไป' }))
    expect(onNextSale).toHaveBeenCalled()
  })
})
