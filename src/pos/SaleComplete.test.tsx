import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaleComplete } from './SaleComplete'
import type { SaleResult } from './PaymentStep'

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
