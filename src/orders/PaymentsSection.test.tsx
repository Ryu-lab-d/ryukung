import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentsSection } from './PaymentsSection'

const recordPayment = vi.fn()
vi.mock('./api', () => ({ recordPayment: (...args: unknown[]) => recordPayment(...args) }))

const onRecorded = vi.fn()

beforeEach(() => {
  recordPayment.mockReset()
  onRecorded.mockReset()
})

function renderSection(props: Partial<React.ComponentProps<typeof PaymentsSection>> = {}) {
  render(
    <PaymentsSection
      orderId="o1"
      payments={[]}
      balanceDue={240}
      paymentClaimedAt={null}
      onRecorded={onRecorded}
      {...props}
    />
  )
}

describe('PaymentsSection', () => {
  it('ยังไม่มีลูกค้าแจ้งชำระ ปุ่มหลักเป็นสีปกติ ไม่มีเอฟเฟกต์แจ้งเตือน', () => {
    renderSection({ paymentClaimedAt: null })
    const button = screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' })
    expect(button.className).not.toContain('animate-pulse')
  })

  it('ลูกค้าแจ้งชำระแล้ว ปุ่มหลักเปลี่ยนเป็นแบบแจ้งเตือน (เขียว+เต้น) และมีข้อความบอกเวลาที่แจ้ง', async () => {
    renderSection({ paymentClaimedAt: '2026-08-10T10:00:00Z' })
    const button = screen.getByRole('button', { name: /ลูกค้าแจ้งชำระแล้ว/ })
    expect(button.className).toContain('animate-pulse')

    await userEvent.click(button)
    expect(screen.getByText(/ลูกค้าแจ้งว่าชำระเงินแล้ว เมื่อ/)).toBeInTheDocument()
  })

  it('กด "รับมาพอดี" เติมยอดคงเหลือให้อัตโนมัติ ไม่ต้องพิมพ์เอง', async () => {
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await userEvent.click(screen.getByRole('button', { name: /รับมาพอดี 240\.00 บาท/ }))
    expect(screen.getByLabelText('หรือใส่จำนวนเงินเอง')).toHaveValue(240)
  })

  it('ยอดคงเหลือเป็น 0 ไม่แสดงปุ่ม "รับมาพอดี" (ไม่มีอะไรให้เติมพอดี)', async () => {
    renderSection({ balanceDue: 0 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    expect(screen.queryByText(/รับมาพอดี/)).not.toBeInTheDocument()
  })

  it('บันทึกสำเร็จ: ปิด modal, ยิง onRecorded พร้อมยอดที่ถูกต้อง, และขึ้นป็อปอัพยืนยันสำเร็จ', async () => {
    recordPayment.mockResolvedValue({ error: null })
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await userEvent.click(screen.getByRole('button', { name: /รับมาพอดี/ }))
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกการชำระเงิน' }))

    expect(recordPayment).toHaveBeenCalledWith('o1', expect.objectContaining({ amount: 240, method: 'transfer' }))
    expect(onRecorded).toHaveBeenCalledWith(240)
    expect(screen.queryByLabelText('หรือใส่จำนวนเงินเอง')).not.toBeInTheDocument() // modal ปิดแล้ว
    expect(await screen.findByText('ยืนยันการชำระเงินสำเร็จ')).toBeInTheDocument()
  })

  it('ใส่จำนวนเงินเอง (ไม่ใช้ปุ่มรับมาพอดี) ก็บันทึกได้ปกติ', async () => {
    recordPayment.mockResolvedValue({ error: null })
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await userEvent.type(screen.getByLabelText('หรือใส่จำนวนเงินเอง'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกการชำระเงิน' }))
    expect(recordPayment).toHaveBeenCalledWith('o1', expect.objectContaining({ amount: 100 }))
  })

  it('ไม่ใส่จำนวนเงินเลยแล้วกดบันทึก ขึ้น error ไม่ยิง recordPayment', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกการชำระเงิน' }))
    expect(await screen.findByText('กรุณาใส่จำนวนเงินที่ถูกต้อง')).toBeInTheDocument()
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('กด "ยกเลิก" ปิด modal โดยไม่บันทึกอะไร', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(screen.queryByLabelText('หรือใส่จำนวนเงินเอง')).not.toBeInTheDocument()
    expect(recordPayment).not.toHaveBeenCalled()
  })

  it('มีประวัติการชำระเงินอยู่แล้ว แสดงรายการที่จ่ายไปก่อนหน้าด้วย', () => {
    renderSection({
      payments: [{ id: 'p1', method: 'cash', paid_at: '2026-08-09T10:00:00Z', amount: 100 }],
    })
    expect(screen.getByText(/เงินสด/)).toBeInTheDocument()
    expect(screen.getByText('100.00')).toBeInTheDocument()
  })
})
