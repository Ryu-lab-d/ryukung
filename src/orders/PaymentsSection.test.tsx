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

/** จำลองการกดปุ่มตัวเลขบนคีย์แพดทีละหลัก เช่น pressDigits('222') = กด 2, 2, 2 ติดต่อกัน */
async function pressDigits(digits: string) {
  for (const d of digits) {
    await userEvent.click(screen.getByRole('button', { name: d }))
  }
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

  it('กด "เต็มจำนวน" เติมยอดคงเหลือขึ้นจอเครื่องคิดเลขให้อัตโนมัติ ไม่ต้องกดตัวเลขเอง', async () => {
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await userEvent.click(screen.getByRole('button', { name: /เต็มจำนวน 240\.00 บาท/ }))
    expect(screen.getByTestId('payment-amount-display')).toHaveTextContent('240')
  })

  it('ยอดคงเหลือเป็น 0 ไม่แสดงปุ่ม "เต็มจำนวน" (ไม่มีอะไรให้เติมพอดี)', async () => {
    renderSection({ balanceDue: 0 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    expect(screen.queryByText(/เต็มจำนวน/)).not.toBeInTheDocument()
  })

  it('กดเลข 2 สามครั้งติดกัน ได้ยอด 222 บนจอ เหมือนเครื่องคิดเลข', async () => {
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await pressDigits('222')
    expect(screen.getByTestId('payment-amount-display')).toHaveTextContent('222')
  })

  it('กดปุ่มลบ (⌫) ลบตัวเลขล่าสุดออกทีละหลัก', async () => {
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await pressDigits('222')
    await userEvent.click(screen.getByRole('button', { name: 'ลบตัวเลขล่าสุด' }))
    expect(screen.getByTestId('payment-amount-display')).toHaveTextContent('22')
  })

  it('กด "C" ล้างตัวเลขทั้งหมดกลับเป็น 0', async () => {
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await pressDigits('222')
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByTestId('payment-amount-display')).toHaveTextContent('0')
  })

  it('บันทึกสำเร็จ: ปิด modal, ยิง onRecorded พร้อมยอดที่ถูกต้อง, และขึ้นป็อปอัพยืนยันสำเร็จ', async () => {
    recordPayment.mockResolvedValue({ error: null })
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await userEvent.click(screen.getByRole('button', { name: /เต็มจำนวน/ }))
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกการชำระเงิน' }))

    expect(recordPayment).toHaveBeenCalledWith('o1', expect.objectContaining({ amount: 240, method: 'transfer' }))
    expect(onRecorded).toHaveBeenCalledWith(240)
    expect(screen.queryByRole('heading', { name: 'บันทึกการชำระเงิน' })).not.toBeInTheDocument() // modal ปิดแล้ว
    expect(await screen.findByText('ยืนยันการชำระเงินสำเร็จ')).toBeInTheDocument()
  })

  it('กดตัวเลขเอง (ไม่ใช้ปุ่มเต็มจำนวน) ก็บันทึกได้ปกติ', async () => {
    recordPayment.mockResolvedValue({ error: null })
    renderSection({ balanceDue: 240 })
    await userEvent.click(screen.getByRole('button', { name: '💳 บันทึกการชำระเงิน' }))
    await pressDigits('100')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกการชำระเงิน' }))
    expect(recordPayment).toHaveBeenCalledWith('o1', expect.objectContaining({ amount: 100 }))
  })

  it('ไม่กดตัวเลขเลยแล้วกดบันทึก ขึ้น error ไม่ยิง recordPayment', async () => {
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
    expect(screen.queryByRole('heading', { name: 'บันทึกการชำระเงิน' })).not.toBeInTheDocument()
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
