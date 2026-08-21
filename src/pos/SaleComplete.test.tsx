import { describe, it, expect, vi } from 'vitest'
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
