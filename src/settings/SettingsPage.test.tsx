import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SettingsPage } from './SettingsPage'

const save = vi.fn()
const baseSettings = {
  id: '1',
  shop_name: 'RYUKUNG BAKERY',
  logo_path: null as string | null,
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
  line_url: 'https://lin.ee/yscT9fJ',
  faqs: [{ keywords: ['จัดส่ง'], answer: 'ทดสอบคำตอบ' }],
  owner_notification_email: null,
}
// เป็น let ไม่ใช่ const ตั้งใจ — เทสต์บั๊กเดิมด้านล่างต้อง "สลับ reference" ของ settings กลางอากาศ จำลอง
// พฤติกรรมจริงของ useSettings.ts ที่ยิง load() ใหม่ (ได้ object ใหม่) หลังอัปโหลดโลโก้สำเร็จ
let settings = { ...baseSettings }

const uploadLogo = vi.fn()
vi.mock('./useSettings', () => ({
  useSettings: () => ({ settings, loading: false, save, uploadLogo }),
}))

vi.mock('../staff/useStaffMembers', () => ({
  useStaffMembers: () => ({
    members: [],
    loading: false,
    invite: vi.fn(),
    setStatus: vi.fn(),
    remove: vi.fn(),
    setAllowedPages: vi.fn(),
    setRole: vi.fn(),
    reload: vi.fn(),
  }),
}))

let roleOverride: 'owner' | 'manager' | 'staff' | 'executive' = 'owner'
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ staffStatus: { role: roleOverride } }),
  isOwnerOrExecutive: (role: string | null | undefined) => role === 'owner' || role === 'executive',
}))

beforeEach(() => {
  save.mockReset()
  uploadLogo.mockReset()
  roleOverride = 'owner'
  settings = { ...baseSettings }
})

describe('หน้าตั้งค่า', () => {
  it('แสดงค่าที่มีอยู่ในช่องกรอก', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.getByLabelText('ชื่อร้าน')).toHaveValue('RYUKUNG BAKERY')
    expect(screen.getByLabelText('ที่อยู่ร้าน')).toHaveValue('123 ถนนทดสอบ')
  })

  it('แก้ชื่อร้านแล้วกดบันทึก เรียก save ด้วยค่าใหม่', async () => {
    save.mockResolvedValue({ error: null })
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    const input = screen.getByLabelText('ชื่อร้าน')
    await userEvent.clear(input)
    await userEvent.type(input, 'RYUKUNG')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ shop_name: 'RYUKUNG' })
    )
  })

  it('แก้ส่วนนำหน้าเลขออเดอร์แล้วกดบันทึก เรียก save ด้วยค่าใหม่', async () => {
    save.mockResolvedValue({ error: null })
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    const input = screen.getByLabelText('ส่วนนำหน้าเลขออเดอร์')
    await userEvent.clear(input)
    await userEvent.type(input, 'NEWPFX')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ order_no_prefix: 'NEWPFX' })
    )
  })

  it('บั๊กเดิม: กำลังแก้ช่องอื่นค้างอยู่ (ยังไม่กดบันทึก) แล้วอัปโหลดโลโก้ ต้องไม่ทำให้ค่าที่พิมพ์ค้างหายไป', async () => {
    // จำลองพฤติกรรมจริงของ useSettings.ts: อัปโหลดโลโก้สำเร็จแล้ว save()+load() ภายในจะได้ settings เป็น
    // object ใหม่ (reference เปลี่ยน) กลับมา — ต้อง "สลับ" settings จริงๆ ไม่ใช่แค่ mock ค่าที่คืน ไม่งั้นเทสต์
    // จะไม่จับบั๊กเดิมที่เกิดจาก effect sync ทับร่างทั้งก้อนตอน settings reference เปลี่ยนกลางอากาศ
    uploadLogo.mockImplementation(async () => {
      settings = { ...settings, logo_path: 'logo/new-logo.png' }
      return { error: null, path: 'logo/new-logo.png' }
    })
    save.mockResolvedValue({ error: null })
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    const prefixInput = screen.getByLabelText('ส่วนนำหน้าเลขออเดอร์')
    await userEvent.clear(prefixInput)
    await userEvent.type(prefixInput, 'ZZZ')
    expect(prefixInput).toHaveValue('ZZZ')

    // อัปโหลดโลโก้แยก (เซฟทันทีในตัวเอง ไม่ผ่านปุ่ม "บันทึก" หลัก) ระหว่างที่ยังไม่ได้กดบันทึกช่องด้านบน
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('โลโก้ร้าน'), file)
    expect(uploadLogo).toHaveBeenCalledWith(file)

    // ค่าที่พิมพ์ค้างไว้ต้องยังอยู่ครบ ไม่ถูกเขียนทับด้วย settings ที่โหลดใหม่จากการอัปโหลดโลโก้
    expect(prefixInput).toHaveValue('ZZZ')

    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ order_no_prefix: 'ZZZ', logo_path: 'logo/new-logo.png' })
    )
  })

  it('มีสวิตช์เลือกว่าใบเสร็จโชว์อะไรบ้าง', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.getByLabelText('ใบเสร็จแสดงโลโก้')).toBeInTheDocument()
    expect(screen.getByLabelText('ใบเสร็จแสดงที่อยู่')).toBeInTheDocument()
    expect(screen.getByLabelText('ใบเสร็จแสดงเบอร์โทร')).toBeInTheDocument()
  })

  it('มีสวิตช์บังคับกรอกข้อมูลลูกค้าให้ครบ', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(
      screen.getByLabelText('บังคับกรอกข้อมูลลูกค้าให้ครบก่อนยืนยันออเดอร์')
    ).toBeChecked()
  })
})

describe('หน้าตั้งค่า — มุมมองผู้จัดการ', () => {
  it('ผู้จัดการเห็นแค่ชื่อร้าน/พร้อมเพย์/วิธีชำระเงิน ไม่เห็นส่วนที่จำกัดไว้เฉพาะเจ้าของร้าน', () => {
    roleOverride = 'manager'
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.getByLabelText('ชื่อร้าน')).toBeInTheDocument()
    expect(screen.getByText('วิธีชำระเงิน (โชว์ให้ลูกค้าเห็นในลิงก์สรุปตอนยังไม่จ่าย)')).toBeInTheDocument()
    expect(screen.queryByLabelText('เบอร์โทร')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('ที่อยู่ร้าน')).not.toBeInTheDocument()
    expect(screen.queryByText('จัดการร้าน')).not.toBeInTheDocument()
    expect(screen.queryByText('แจ้งเตือนออเดอร์ใหม่')).not.toBeInTheDocument()
    expect(screen.queryByText('ค่าเริ่มต้นใบเสร็จ')).not.toBeInTheDocument()
    expect(screen.queryByText('เลขที่เอกสารและออเดอร์')).not.toBeInTheDocument()
  })

  it('เจ้าของร้านยังเห็นทุกส่วนเหมือนเดิม', () => {
    roleOverride = 'owner'
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.getByLabelText('เบอร์โทร')).toBeInTheDocument()
    expect(screen.getByLabelText('ที่อยู่ร้าน')).toBeInTheDocument()
    expect(screen.getByText('จัดการร้าน')).toBeInTheDocument()
    expect(screen.getByText('แจ้งเตือนออเดอร์ใหม่')).toBeInTheDocument()
    expect(screen.getByText('ค่าเริ่มต้นใบเสร็จ')).toBeInTheDocument()
    expect(screen.getByText('เลขที่เอกสารและออเดอร์')).toBeInTheDocument()
  })
})

describe('หน้าตั้งค่า — มุมมองผู้บริหาร', () => {
  it('ผู้บริหารเห็นข้อมูลร้านครบทุกช่องเหมือนเจ้าของร้าน แต่ไม่เห็น "จัดการร้าน" (ลิงก์ลัด)', () => {
    roleOverride = 'executive'
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.getByLabelText('เบอร์โทร')).toBeInTheDocument()
    expect(screen.getByLabelText('ที่อยู่ร้าน')).toBeInTheDocument()
    expect(screen.getByText('แจ้งเตือนออเดอร์ใหม่')).toBeInTheDocument()
    expect(screen.getByText('ค่าเริ่มต้นใบเสร็จ')).toBeInTheDocument()
    expect(screen.getByText('เลขที่เอกสารและออเดอร์')).toBeInTheDocument()
    expect(screen.queryByText('จัดการร้าน')).not.toBeInTheDocument()
  })
})
