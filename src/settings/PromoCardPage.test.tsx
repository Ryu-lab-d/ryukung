import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PromoCardPage } from './PromoCardPage'

const baseSettings = {
  id: '1',
  shop_name: 'RYUKUNG BAKERY',
  logo_path: null as string | null,
  phone: '0800000000' as string | null,
  address: null,
  promptpay: null,
  receipt_footer: null,
  receipt_show_logo: true,
  receipt_show_address: true,
  receipt_show_phone: true,
  receipt_show_promptpay: false,
  order_no_prefix: 'RYB',
  receipt_no_prefix: 'RC',
  shipping_lead_days: 1,
  require_full_customer_info: true,
  payment_instructions: null,
  line_url: 'https://lin.ee/yscT9fJ' as string | null,
  faqs: [],
  owner_notification_email: null,
}

let settingsOverride = baseSettings
vi.mock('./useSettings', () => ({
  useSettings: () => ({ settings: settingsOverride, loading: false, save: vi.fn(), uploadLogo: vi.fn() }),
}))

const toPng = vi.fn().mockResolvedValue('data:image/png;base64,mock')
vi.mock('html-to-image', () => ({ toPng: (...args: unknown[]) => toPng(...args) }))

function renderPage() {
  render(
    <MemoryRouter>
      <PromoCardPage />
    </MemoryRouter>
  )
}

describe('PromoCardPage', () => {
  it('ตั้งลิงก์ไลน์ไว้แล้ว แสดง QR ให้สแกนแอดไลน์', async () => {
    settingsOverride = baseSettings
    renderPage()
    expect(await screen.findByAltText('QR แอดไลน์')).toBeInTheDocument()
    expect(screen.getByText('RYUKUNG BAKERY')).toBeInTheDocument()
    expect(screen.queryByText(/ยังไม่ได้ตั้งค่าลิงก์ไลน์/)).not.toBeInTheDocument()
  })

  it('ยังไม่ได้ตั้งลิงก์ไลน์ไว้ เตือนให้ไปตั้งค่าก่อน ไม่มี QR', async () => {
    settingsOverride = { ...baseSettings, line_url: null }
    renderPage()
    expect(await screen.findByText(/ยังไม่ได้ตั้งค่าลิงก์ไลน์/)).toBeInTheDocument()
    expect(screen.queryByAltText('QR แอดไลน์')).not.toBeInTheDocument()
  })

  it('กดดาวน์โหลด เรียก htmlToImage.toPng กับการ์ดที่แสดงอยู่', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    settingsOverride = baseSettings
    renderPage()
    await screen.findByAltText('QR แอดไลน์')
    await userEvent.click(screen.getByRole('button', { name: /ดาวน์โหลดเป็นรูปภาพ/ }))
    expect(toPng).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})
