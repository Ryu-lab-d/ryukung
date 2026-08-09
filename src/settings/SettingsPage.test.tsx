import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from './SettingsPage'

const save = vi.fn()
const settings = {
  id: '1',
  shop_name: 'RYUKUNG BAKERY',
  logo_path: null,
  phone: '0800000000',
  address: '123 ถนนทดสอบ',
  promptpay: null,
  receipt_footer: 'ขอบคุณค่ะ',
  receipt_show_logo: true,
  receipt_show_address: true,
  receipt_show_phone: true,
  receipt_show_promptpay: false,
  order_no_prefix: 'RYB',
  receipt_no_prefix: 'RC',
  shipping_lead_days: 1,
  require_full_customer_info: true,
  payment_instructions: 'แจ้งชำระเงินผ่านไลน์ @ryukung_bakery',
}

vi.mock('./useSettings', () => ({
  useSettings: () => ({ settings, loading: false, save, uploadLogo: vi.fn() }),
}))

beforeEach(() => save.mockReset())

describe('หน้าตั้งค่า', () => {
  it('แสดงค่าที่มีอยู่ในช่องกรอก', () => {
    render(<SettingsPage />)
    expect(screen.getByLabelText('ชื่อร้าน')).toHaveValue('RYUKUNG BAKERY')
    expect(screen.getByLabelText('ที่อยู่ร้าน')).toHaveValue('123 ถนนทดสอบ')
  })

  it('แก้ชื่อร้านแล้วกดบันทึก เรียก save ด้วยค่าใหม่', async () => {
    save.mockResolvedValue({ error: null })
    render(<SettingsPage />)
    const input = screen.getByLabelText('ชื่อร้าน')
    await userEvent.clear(input)
    await userEvent.type(input, 'RYUKUNG')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ shop_name: 'RYUKUNG' })
    )
  })

  it('มีสวิตช์เลือกว่าใบเสร็จโชว์อะไรบ้าง', () => {
    render(<SettingsPage />)
    expect(screen.getByLabelText('ใบเสร็จแสดงโลโก้')).toBeInTheDocument()
    expect(screen.getByLabelText('ใบเสร็จแสดงที่อยู่')).toBeInTheDocument()
    expect(screen.getByLabelText('ใบเสร็จแสดงเบอร์โทร')).toBeInTheDocument()
  })

  it('มีสวิตช์บังคับกรอกข้อมูลลูกค้าให้ครบ', () => {
    render(<SettingsPage />)
    expect(
      screen.getByLabelText('บังคับกรอกข้อมูลลูกค้าให้ครบก่อนยืนยันออเดอร์')
    ).toBeChecked()
  })
})
