import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaleComplete } from './SaleComplete'
import type { SaleResult } from './PaymentStep'

describe('SaleComplete — เสียงประกาศเงินทอน', () => {
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
    // @ts-expect-error เหตุผลเดียวกัน
    window.speechSynthesis = { speak }
  })

  afterEach(() => {
    window.SpeechSynthesisUtterance = originalUtterance
    window.speechSynthesis = originalSynthesis
  })

  it('จ่ายเงินสดมีเงินทอน พูดประกาศยอดเงินทอน', () => {
    const result: SaleResult = { orderId: 'order-1', method: 'cash', change: 40, receiptIssued: true }
    render(<SaleComplete result={result} grandTotal={100} onNextSale={vi.fn()} />)
    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'เงินทอน 40 บาท' }))
  })

  it('จ่ายพอดี ไม่มีเงินทอน ไม่พูดอะไร', () => {
    const result: SaleResult = { orderId: 'order-2', method: 'cash', change: 0, receiptIssued: true }
    render(<SaleComplete result={result} grandTotal={40} onNextSale={vi.fn()} />)
    expect(speak).not.toHaveBeenCalled()
  })

  it('จ่ายพร้อมเพย์ ไม่พูดเรื่องเงินทอนเลย', () => {
    const result: SaleResult = { orderId: 'order-3', method: 'promptpay', change: null, receiptIssued: true }
    render(<SaleComplete result={result} grandTotal={60} onNextSale={vi.fn()} />)
    expect(speak).not.toHaveBeenCalled()
  })

  it('เบราว์เซอร์ไม่รองรับ Web Speech API ก็ไม่พัง', () => {
    // @ts-expect-error จำลองเบราว์เซอร์ที่ไม่มี API นี้เลย
    window.SpeechSynthesisUtterance = undefined
    const result: SaleResult = { orderId: 'order-4', method: 'cash', change: 20, receiptIssued: true }
    expect(() => render(<SaleComplete result={result} grandTotal={60} onNextSale={vi.fn()} />)).not.toThrow()
  })
})

describe('SaleComplete', () => {
  it('จ่ายเงินสด แสดงยอดขายและเงินทอนถูกต้อง', () => {
    const result: SaleResult = { orderId: 'order-1', method: 'cash', change: 10, receiptIssued: true }
    render(<SaleComplete result={result} grandTotal={40} onNextSale={vi.fn()} />)
    expect(screen.getByText('ยอดขาย 40.00 บาท')).toBeInTheDocument()
    expect(screen.getByText('10.00 บาท')).toBeInTheDocument()
    expect(screen.queryByText(/ออกใบเสร็จอัตโนมัติไม่สำเร็จ/)).not.toBeInTheDocument()
  })

  it('จ่ายพร้อมเพย์ ไม่แสดงกล่องเงินทอน', () => {
    const result: SaleResult = { orderId: 'order-2', method: 'promptpay', change: null, receiptIssued: true }
    render(<SaleComplete result={result} grandTotal={60} onNextSale={vi.fn()} />)
    expect(screen.queryByText('เงินทอน')).not.toBeInTheDocument()
  })

  it('ออกใบเสร็จอัตโนมัติไม่สำเร็จ แสดงคำเตือน', () => {
    const result: SaleResult = { orderId: 'order-3', method: 'cash', change: 0, receiptIssued: false }
    render(<SaleComplete result={result} grandTotal={40} onNextSale={vi.fn()} />)
    expect(screen.getByText(/ออกใบเสร็จอัตโนมัติไม่สำเร็จ/)).toBeInTheDocument()
  })

  it('ปุ่ม "ดูใบเสร็จ" ลิงก์ไปหน้าใบเสร็จของออเดอร์นี้ เปิดแท็บใหม่', () => {
    const result: SaleResult = { orderId: 'order-4', method: 'cash', change: 5, receiptIssued: true }
    render(<SaleComplete result={result} grandTotal={40} onNextSale={vi.fn()} />)
    const link = screen.getByRole('link', { name: /ดูใบเสร็จ/ })
    expect(link).toHaveAttribute('href', '/receipts/order-4')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('กด "ขายรายการต่อไป" เรียก onNextSale', async () => {
    const onNextSale = vi.fn()
    const result: SaleResult = { orderId: 'order-5', method: 'cash', change: 0, receiptIssued: true }
    render(<SaleComplete result={result} grandTotal={40} onNextSale={onNextSale} />)
    await userEvent.click(screen.getByRole('button', { name: 'ขายรายการต่อไป' }))
    expect(onNextSale).toHaveBeenCalled()
  })
})
