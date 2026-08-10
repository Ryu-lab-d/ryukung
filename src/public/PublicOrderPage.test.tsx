import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicOrderPage } from './PublicOrderPage'

const rpc = vi.fn()
const functionsInvoke = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
  },
}))

const baseOrder = {
  shop_name: 'RYUKUNG BAKERY',
  order_no: 'RYB-000001',
  customer_name: 'Somchai ใจดี',
  needed_date: '2026-08-10' as string | null,
  fulfillment_type: 'pickup',
  work_status: 'to_bake' as string,
  payment_status: 'unpaid',
  items_total: 80,
  discount_amount: 0,
  shipping_fee: 0,
  grand_total: 80,
  carrier: null,
  tracking_no: null,
  note: null,
  payment_instructions: null as string | null,
  promptpay: null as string | null,
  balance_due: 80,
  payment_claimed_at: null as string | null,
  faqs: [],
  line_url: null as string | null,
  pickup_place: 'หน้าร้าน',
  pickup_time: '10:00',
  ship_recipient_name: null,
  ship_recipient_phone: null,
  ship_address_text: null,
  address_editable: false,
  items: [{ product_name: 'คุกกี้', unit_price: 40, qty: 2, line_total: 80, note: null }],
}

function renderPage(token = 'abc') {
  render(
    <MemoryRouter initialEntries={[`/o/${token}`]}>
      <Routes><Route path="/o/:token" element={<PublicOrderPage />} /></Routes>
    </MemoryRouter>
  )
}

describe('การยืนยันชื่อในหน้าสรุปออเดอร์สำหรับลูกค้า', () => {
  it('ชื่อผิดจริงๆ เข้าไม่ได้ และมีข้อความเตือน', async () => {
    rpc.mockResolvedValue({ data: baseOrder })
    renderPage()
    const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
    await userEvent.type(input, 'คนละคนกันเลย')
    // ปุ่มเปลี่ยนข้อความและปลดล็อกพร้อมกันตอนข้อมูลจริงโหลดเสร็จ — findByRole รอจนกว่าจะเจอชื่อปุ่มสุดท้ายนี้
    const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
    await userEvent.click(submitButton)
    expect(await screen.findByText(/ชื่อไม่ตรงกับที่แจ้งไว้/)).toBeInTheDocument()
    expect(screen.queryByText('RYUKUNG BAKERY')).not.toBeInTheDocument()
  })

  it('พิมพ์ตัวพิมพ์เล็ก/ใหญ่ต่างกัน (เหมือน autocapitalize บนมือถือ) ยังถือว่าถูก เข้าได้ปกติ', async () => {
    rpc.mockResolvedValue({ data: baseOrder })
    renderPage()
    const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
    // ชื่อจริงคือ "Somchai ใจดี" — พิมพ์เป็น "somchai ใจดี" (s ตัวเล็ก) จำลองผลจาก autocapitalize ที่ต่างเครื่องต่างกัน
    await userEvent.type(input, 'somchai ใจดี')
    // ปุ่มเปลี่ยนข้อความและปลดล็อกพร้อมกันตอนข้อมูลจริงโหลดเสร็จ — findByRole รอจนกว่าจะเจอชื่อปุ่มสุดท้ายนี้
    const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
    await userEvent.click(submitButton)
    expect(await screen.findByText('RYUKUNG BAKERY')).toBeInTheDocument()
  })

  it('ออเดอร์ที่ไม่มีชื่อลูกค้าผูกไว้เลย ปิดกั้นเสมอไม่ว่าจะพิมพ์อะไร', async () => {
    rpc.mockResolvedValue({ data: { ...baseOrder, customer_name: null } })
    renderPage()
    const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
    await userEvent.type(input, 'อะไรก็ได้')
    // ปุ่มเปลี่ยนข้อความและปลดล็อกพร้อมกันตอนข้อมูลจริงโหลดเสร็จ — findByRole รอจนกว่าจะเจอชื่อปุ่มสุดท้ายนี้
    const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
    await userEvent.click(submitButton)
    expect(await screen.findByText('ออเดอร์นี้ไม่มีชื่อลูกค้าผูกไว้ในระบบ')).toBeInTheDocument()
  })
})

async function openOrder(order: typeof baseOrder) {
  rpc.mockResolvedValue({ data: order })
  renderPage()
  const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
  await userEvent.type(input, order.customer_name!)
  const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
  await userEvent.click(submitButton)
  await screen.findByText(order.shop_name)
  // ป็อปอัพเตือนยังไม่ชำระเงินขึ้นอัตโนมัติถ้ายังไม่จ่าย ปิดออกก่อนเสมอที่นี่ กันไม่ให้ element ซ้ำกับตัวการ์ดปกติ
  // ด้านล่าง (มี describe แยกที่ทดสอบป็อปอัพนี้โดยเฉพาะ เปิดออเดอร์เองแบบดิบๆ ไม่ผ่าน helper นี้)
  const closeButton = screen.queryByRole('button', { name: 'ปิด' })
  if (closeButton) await userEvent.click(closeButton)
}

describe('ปุ่มติดต่อพนักงานผ่านไลน์', () => {
  it('มีปุ่มติดต่อพนักงานที่ลิงก์ไปไลน์ร้าน เมื่อร้านตั้งค่าลิงก์ไว้', async () => {
    await openOrder({ ...baseOrder, line_url: 'https://lin.ee/yscT9fJ' })
    const link = screen.getByRole('link', { name: /ติดต่อพนักงาน/ })
    expect(link).toHaveAttribute('href', 'https://lin.ee/yscT9fJ')
  })

  it('ไม่มีปุ่มติดต่อพนักงาน ถ้าร้านยังไม่ได้ตั้งลิงก์ไลน์ไว้', async () => {
    await openOrder({ ...baseOrder, line_url: null })
    expect(screen.queryByRole('link', { name: /ติดต่อพนักงาน/ })).not.toBeInTheDocument()
  })

  it('สถานะจัดส่งสำเร็จแล้ว มีข้อความ "ไม่ได้รับของ? ติดต่อที่นี่" ลิงก์ไปไลน์', async () => {
    await openOrder({ ...baseOrder, work_status: 'delivered', line_url: 'https://lin.ee/yscT9fJ' })
    const link = screen.getByRole('link', { name: /ไม่ได้รับของ/ })
    expect(link).toHaveAttribute('href', 'https://lin.ee/yscT9fJ')
  })

  it('สถานะยังไม่ถึงจัดส่งสำเร็จ ไม่มีข้อความ "ไม่ได้รับของ"', async () => {
    await openOrder({ ...baseOrder, work_status: 'baking', line_url: 'https://lin.ee/yscT9fJ' })
    expect(screen.queryByText(/ไม่ได้รับของ/)).not.toBeInTheDocument()
  })
})

describe('QR พร้อมเพย์ล็อกยอด', () => {
  it('ร้านตั้งเลขพร้อมเพย์ไว้ กดดูวิธีชำระเงินแล้วเห็น QR พร้อมยอดที่ต้องจ่ายจริง', async () => {
    await openOrder({ ...baseOrder, promptpay: '0812345678', balance_due: 80 })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(await screen.findByAltText('QR พร้อมเพย์')).toBeInTheDocument()
    expect(screen.getByText('80.00 บาท')).toBeInTheDocument()
    expect(screen.getByText(/ยอดถูกล็อกไว้ในตัว QR/)).toBeInTheDocument()
  })

  it('ยังไม่ได้ตั้งเลขพร้อมเพย์ ไม่แสดง QR (โชว์แค่ข้อความวิธีชำระเงินถ้ามี)', async () => {
    await openOrder({ ...baseOrder, promptpay: null, balance_due: 80, payment_instructions: 'โอนเข้าบัญชี...' })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(screen.queryByAltText('QR พร้อมเพย์')).not.toBeInTheDocument()
  })

  it('ยอดคงเหลือเป็นศูนย์ ไม่แสดง QR แม้จะตั้งเลขพร้อมเพย์ไว้', async () => {
    await openOrder({ ...baseOrder, promptpay: '0812345678', balance_due: 0 })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(screen.queryByAltText('QR พร้อมเพย์')).not.toBeInTheDocument()
  })
})

describe('ปุ่มยืนยันการชำระเงิน', () => {
  it('ยังไม่เคยแจ้ง กดปุ่มยืนยันแล้วเรียก edge function พร้อม token แล้วรีเฟรชสถานะเป็นแจ้งแล้ว', async () => {
    functionsInvoke.mockResolvedValue({ data: { ok: true, alreadyClaimed: false }, error: null })
    await openOrder({ ...baseOrder, payment_claimed_at: null })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    const claimButton = await screen.findByRole('button', { name: /ยืนยันการชำระเงิน/ })

    rpc.mockResolvedValue({ data: { ...baseOrder, payment_claimed_at: '2026-08-09T10:00:00Z' } })
    await userEvent.click(claimButton)

    expect(functionsInvoke).toHaveBeenCalledWith('notify-payment-claim', { body: { token: 'abc' } })
    expect(await screen.findByText(/แจ้งการชำระเงินแล้ว/)).toBeInTheDocument()
  })

  it('เคยแจ้งแล้ว แสดงข้อความยืนยันแทนปุ่ม ไม่ให้กดซ้ำ', async () => {
    await openOrder({ ...baseOrder, payment_claimed_at: '2026-08-09T10:00:00Z' })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    expect(await screen.findByText(/แจ้งการชำระเงินแล้ว/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^✅ ยืนยันการชำระเงิน$/ })).not.toBeInTheDocument()
  })

  it('edge function error ขึ้นข้อความ error ให้ลูกค้าเห็น', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { message: 'เครือข่ายมีปัญหา' } })
    await openOrder({ ...baseOrder, payment_claimed_at: null })
    await userEvent.click(screen.getByRole('button', { name: /ดูวิธีชำระเงิน/ }))
    const claimButton = await screen.findByRole('button', { name: /ยืนยันการชำระเงิน/ })
    await userEvent.click(claimButton)
    expect(await screen.findByText('เครือข่ายมีปัญหา')).toBeInTheDocument()
  })
})

describe('ปุ่มเพิ่มลงปฏิทินและแชร์ออเดอร์', () => {
  it('มีวันที่ต้องได้ของ กดเพิ่มลงปฏิทินแล้วสร้างไฟล์ .ics ให้ดาวน์โหลด', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await openOrder(baseOrder)
    await userEvent.click(screen.getByRole('button', { name: /เพิ่มลงปฏิทิน/ }))

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('ไม่มีวันที่ต้องได้ของ ไม่แสดงปุ่มเพิ่มลงปฏิทิน', async () => {
    await openOrder({ ...baseOrder, needed_date: null })
    expect(screen.queryByRole('button', { name: /เพิ่มลงปฏิทิน/ })).not.toBeInTheDocument()
  })

  it('กดแชร์ออเดอร์ (ไม่มี navigator.share) คัดลอกลิงก์แทนแล้วขึ้นข้อความยืนยัน', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    await openOrder(baseOrder)
    await userEvent.click(screen.getByRole('button', { name: /แชร์ออเดอร์นี้/ }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href)
    expect(await screen.findByRole('button', { name: /คัดลอกลิงก์แล้ว/ })).toBeInTheDocument()
  })

  describe('เมื่อ navigator.share มีอยู่แต่พฤติกรรมแปลกๆ (เบราว์เซอร์ในแอปไลน์/เฟซบุ๊กที่มักมีปัญหา)', () => {
    afterEach(() => {
      delete (navigator as { share?: unknown }).share
    })

    it('navigator.share สำเร็จ ไม่ต้องคัดลอกซ้ำ ไม่มีข้อความ "คัดลอกลิงก์แล้ว" โผล่มา', async () => {
      const share = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { share, clipboard: { writeText: vi.fn() } })
      await openOrder(baseOrder)
      await userEvent.click(screen.getByRole('button', { name: /แชร์ออเดอร์นี้/ }))
      expect(share).toHaveBeenCalled()
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: /คัดลอกลิงก์แล้ว/ })).not.toBeInTheDocument()
    })

    it('ผู้ใช้กดยกเลิก share sheet เอง (AbortError) ไม่ถือเป็นปัญหา ไม่ fallback ไปคัดลอก', async () => {
      const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' })
      const share = vi.fn().mockRejectedValue(abortError)
      Object.assign(navigator, { share, clipboard: { writeText: vi.fn() } })
      await openOrder(baseOrder)
      await userEvent.click(screen.getByRole('button', { name: /แชร์ออเดอร์นี้/ }))
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    })

    it('navigator.share มีแต่ใช้งานจริงไม่ได้ (reject แบบไม่ใช่ยกเลิกเอง) ต้อง fallback ไปคัดลอกลิงก์แทนอัตโนมัติ — บั๊กเดิมคือจุดนี้เงียบไปเฉยๆ', async () => {
      const share = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, { share, clipboard: { writeText } })
      await openOrder(baseOrder)
      await userEvent.click(screen.getByRole('button', { name: /แชร์ออเดอร์นี้/ }))
      expect(writeText).toHaveBeenCalledWith(window.location.href)
      expect(await screen.findByRole('button', { name: /คัดลอกลิงก์แล้ว/ })).toBeInTheDocument()
    })
  })

  it('ไม่มี navigator.share และ clipboard ใช้ไม่ได้ (เบราว์เซอร์ในแอปบล็อก) fallback ไปใช้ execCommand คัดลอกแบบเก่า', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) } })
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand
    await openOrder(baseOrder)
    await userEvent.click(screen.getByRole('button', { name: /แชร์ออเดอร์นี้/ }))
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(await screen.findByRole('button', { name: /คัดลอกลิงก์แล้ว/ })).toBeInTheDocument()
  })

  it('คัดลอกไม่ได้เลยสักทาง (clipboard และ execCommand ล้มเหลวทั้งคู่) โชว์กล่องลิงก์ให้คัดลอกเอง แทนที่จะเงียบไปเฉยๆ', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) } })
    document.execCommand = vi.fn().mockReturnValue(false)
    await openOrder(baseOrder)
    await userEvent.click(screen.getByRole('button', { name: /แชร์ออเดอร์นี้/ }))
    expect(await screen.findByText(/คัดลอกอัตโนมัติไม่ได้/)).toBeInTheDocument()
    expect(screen.getByDisplayValue(window.location.href)).toBeInTheDocument()
  })
})

/** เปิดออเดอร์แบบดิบๆ โดยไม่ปิดป็อปอัพเตือนยังไม่ชำระเงินอัตโนมัติ (ต่างจาก openOrder ปกติ) เพื่อทดสอบป็อปอัพนี้เอง */
async function openOrderKeepPopup(order: typeof baseOrder) {
  rpc.mockResolvedValue({ data: order })
  renderPage()
  const input = await screen.findByPlaceholderText('ชื่อผู้สั่งซื้อ')
  await userEvent.type(input, order.customer_name!)
  const submitButton = await screen.findByRole('button', { name: 'ดูรายละเอียดออเดอร์' })
  await userEvent.click(submitButton)
  await screen.findByText(order.shop_name)
}

describe('ป็อปอัพเตือนยังไม่ชำระเงิน', () => {
  it('ยังไม่จ่ายและยังไม่เคยแจ้งชำระเงิน ขึ้นป็อปอัพทันทีที่เข้าดูออเดอร์', async () => {
    await openOrderKeepPopup({ ...baseOrder, payment_status: 'unpaid', payment_claimed_at: null })
    expect(screen.getByText('คุณลูกค้ายังไม่ได้ชำระเงิน')).toBeInTheDocument()
    expect(screen.getByText(/กรุณารอการตรวจสอบจากเจ้าหน้าที่/)).toBeInTheDocument()
  })

  it('จ่ายครบแล้ว ไม่ขึ้นป็อปอัพ', async () => {
    await openOrderKeepPopup({ ...baseOrder, payment_status: 'paid', payment_claimed_at: null })
    expect(screen.queryByText('คุณลูกค้ายังไม่ได้ชำระเงิน')).not.toBeInTheDocument()
  })

  it('ยังไม่ยืนยันว่าจ่ายครบ แต่เคยกดยืนยันการชำระเงินไปแล้ว (รอตรวจสอบ) ไม่ขึ้นป็อปอัพซ้ำ เพราะข้อความจะขัดกับความจริง', async () => {
    await openOrderKeepPopup({ ...baseOrder, payment_status: 'unpaid', payment_claimed_at: '2026-08-09T10:00:00Z' })
    expect(screen.queryByText('คุณลูกค้ายังไม่ได้ชำระเงิน')).not.toBeInTheDocument()
  })

  it('กด "ดูวิธีการชำระเงิน" ในป็อปอัพแล้วเห็น QR และปุ่มยืนยันการชำระเงินขึ้นในป็อปอัพเลย', async () => {
    await openOrderKeepPopup({ ...baseOrder, promptpay: '0812345678', balance_due: 80 })
    await userEvent.click(screen.getByRole('button', { name: 'ดูวิธีการชำระเงิน' }))
    expect(await screen.findByAltText('QR พร้อมเพย์')).toBeInTheDocument()
    // ปุ่มยืนยันการชำระเงินโผล่สองที่พร้อมกัน (ในป็อปอัพ + การ์ดปกติด้านหลังที่ยังไม่ได้ปิด เพราะ state showPaymentInfo ใช้ร่วมกัน)
    expect(screen.getAllByRole('button', { name: /ยืนยันการชำระเงิน/ }).length).toBeGreaterThan(0)
  })

  it('มีลิงก์ไลน์ตั้งไว้ แสดงปุ่ม "พบปัญหา? ติดต่อที่นี่" ลิงก์ไปไลน์', async () => {
    await openOrderKeepPopup({ ...baseOrder, line_url: 'https://lin.ee/yscT9fJ' })
    const link = screen.getByRole('link', { name: /พบปัญหา/ })
    expect(link).toHaveAttribute('href', 'https://lin.ee/yscT9fJ')
  })

  it('ไม่มีลิงก์ไลน์ตั้งไว้ ไม่แสดงปุ่ม "พบปัญหา"', async () => {
    await openOrderKeepPopup({ ...baseOrder, line_url: null })
    expect(screen.queryByRole('link', { name: /พบปัญหา/ })).not.toBeInTheDocument()
  })

  it('กด "ปิด" แล้วป็อปอัพหายไป เหลือแค่การ์ดปกติด้านล่าง', async () => {
    await openOrderKeepPopup(baseOrder)
    await userEvent.click(screen.getByRole('button', { name: 'ปิด' }))
    expect(screen.queryByText('คุณลูกค้ายังไม่ได้ชำระเงิน')).not.toBeInTheDocument()
  })
})
