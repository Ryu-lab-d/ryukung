import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposeEmailModal } from './ComposeEmailModal'

const sendCustomerEmail = vi.fn()
vi.mock('../lib/customerEmail', () => ({ sendCustomerEmail: (...args: unknown[]) => sendCustomerEmail(...args) }))

const onClose = vi.fn()
const onSent = vi.fn()

beforeEach(() => {
  sendCustomerEmail.mockReset()
  onClose.mockReset()
  onSent.mockReset()
})

function renderModal(props: Partial<React.ComponentProps<typeof ComposeEmailModal>> = {}) {
  render(
    <ComposeEmailModal
      shopName="RYUKUNG BAKERY"
      logoUrl={null}
      orderNo="RYB-000123"
      customerName="สมชาย"
      customerEmail="somchai@example.com"
      grandTotal={250}
      balanceDue={150}
      fulfillmentType="pickup"
      workStatus="baking"
      paymentInstructions="โอนเข้าพร้อมเพย์ 08x-xxx-xxxx"
      publicUrl="https://ryukung-pos.pages.dev/o/abc123"
      onClose={onClose}
      onSent={onSent}
      {...props}
    />
  )
}

describe('ComposeEmailModal', () => {
  it('เปิดมาเลือกเทมเพลต "ยังไม่ชำระเงิน" ไว้เป็นค่าเริ่มต้น พร้อมเติมยอดคงเหลือให้อัตโนมัติ', () => {
    renderModal()
    expect((screen.getByLabelText('หัวข้อ') as HTMLInputElement).value).toContain('RYB-000123')
    expect((screen.getByLabelText('ข้อความ') as HTMLTextAreaElement).value).toContain('150.00')
  })

  it('สลับไปเทมเพลต "ชำระเงินแล้ว" เปลี่ยนหัวข้อและข้อความให้ตรงกับสถานการณ์', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ชำระเงินแล้ว' }))
    expect((screen.getByLabelText('ข้อความ') as HTMLTextAreaElement).value).toContain('ได้รับการชำระเงิน')
  })

  it('สลับไปเทมเพลต "ของถึงไหนแล้ว" ใส่สถานะงานปัจจุบันลงในข้อความอัตโนมัติ', async () => {
    renderModal({ fulfillmentType: 'pickup', workStatus: 'baking' })
    await userEvent.click(screen.getByRole('button', { name: 'ของถึงไหนแล้ว' }))
    expect((screen.getByLabelText('ข้อความ') as HTMLTextAreaElement).value).toContain('กำลังทำ')
  })

  it('แก้ไขข้อความเองได้ก่อนส่ง', async () => {
    renderModal()
    const body = screen.getByLabelText('ข้อความ')
    await userEvent.clear(body)
    await userEvent.type(body, 'ข้อความที่พนักงานพิมพ์เอง')
    expect(body).toHaveValue('ข้อความที่พนักงานพิมพ์เอง')
  })

  it('กดส่งสำเร็จ เรียก sendCustomerEmail ด้วยอีเมลลูกค้า แล้วแจ้ง onSent', async () => {
    sendCustomerEmail.mockResolvedValue({ error: null })
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ส่งอีเมล' }))
    expect(sendCustomerEmail).toHaveBeenCalledWith(
      'somchai@example.com',
      expect.stringContaining('RYB-000123'),
      expect.stringContaining('150.00')
    )
    expect(onSent).toHaveBeenCalledWith(expect.stringContaining('somchai@example.com'))
  })

  it('ลบข้อความจนว่างเปล่าแล้วกดส่ง ขึ้น error ไม่ยิง sendCustomerEmail', async () => {
    renderModal()
    await userEvent.clear(screen.getByLabelText('ข้อความ'))
    await userEvent.click(screen.getByRole('button', { name: 'ส่งอีเมล' }))
    expect(await screen.findByText('กรุณากรอกหัวข้อและข้อความ')).toBeInTheDocument()
    expect(sendCustomerEmail).not.toHaveBeenCalled()
  })

  it('ส่งไม่สำเร็จ แสดง error จาก sendCustomerEmail ไม่เรียก onSent', async () => {
    sendCustomerEmail.mockResolvedValue({ error: 'SMTP ล่ม' })
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ส่งอีเมล' }))
    expect(await screen.findByText(/ส่งอีเมลไม่สำเร็จ/)).toBeInTheDocument()
    expect(onSent).not.toHaveBeenCalled()
  })

  it('กด "ยกเลิก" ปิด modal โดยไม่ส่งอะไร', async () => {
    renderModal()
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalled()
    expect(sendCustomerEmail).not.toHaveBeenCalled()
  })
})
