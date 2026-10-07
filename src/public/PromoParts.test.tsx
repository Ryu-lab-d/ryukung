import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromoBanner, PromoBox } from './PromoParts'
import type { PublicPromo } from '../lib/promoApi'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const promo = (over: Partial<PublicPromo> = {}): PublicPromo => ({
  id: 'p1', name: 'ลดเปิดคอร์ส', description: null, kind: 'percent', value: 10, min_subtotal: 0, max_discount: null, ends_at: null, ...over,
})

beforeEach(() => rpc.mockReset())

describe('PromoBanner', () => {
  it('แสดงโปรอัตโนมัติ / ไม่มีโปรไม่แสดงอะไร', () => {
    const { rerender, container } = render(<PromoBanner promos={[promo()]} />)
    expect(screen.getByText('ลดเปิดคอร์ส')).toBeInTheDocument()
    expect(screen.getByText(/ลด 10%/)).toBeInTheDocument()
    rerender(<PromoBanner promos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PromoBox', () => {
  it('โปรอัตโนมัติที่ถึงเงื่อนไขแสดงส่วนลด', () => {
    render(<PromoBox subtotal={300} autoPromo={promo()} nextAuto={null} codePromo={null} onCodeChange={vi.fn()} />)
    expect(screen.getByText(/ลดเปิดคอร์ส · โปรอัตโนมัติ/)).toBeInTheDocument()
    expect(screen.getByText(/ลดให้ 30/)).toBeInTheDocument()
  })

  it('ชวนซื้อเพิ่มเมื่อยังไม่ถึงขั้นต่ำ', () => {
    const next = promo({ min_subtotal: 500 })
    render(<PromoBox subtotal={300} autoPromo={null} nextAuto={next} codePromo={null} onCodeChange={vi.fn()} />)
    expect(screen.getByText(/ซื้อเพิ่มอีก/)).toBeInTheDocument()
  })

  it('กรอกโค้ดถูก → ส่งโปรกลับไปใช้ / โค้ดผิดแสดงข้อความ', async () => {
    const onCodeChange = vi.fn()
    rpc.mockResolvedValueOnce({ data: { valid: false, message: 'โค้ดส่วนลดไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว' }, error: null })
    render(<PromoBox subtotal={300} autoPromo={null} nextAuto={null} codePromo={null} onCodeChange={onCodeChange} />)
    await userEvent.type(screen.getByLabelText('โค้ดส่วนลด'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'ใช้โค้ด' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่ถูกต้อง')
    expect(onCodeChange).not.toHaveBeenCalled()

    rpc.mockResolvedValueOnce({ data: { valid: true, promotion: promo({ code: 'RYU-AAAAA' }) }, error: null })
    await userEvent.clear(screen.getByLabelText('โค้ดส่วนลด'))
    await userEvent.type(screen.getByLabelText('โค้ดส่วนลด'), 'ryu-aaaaa')
    await userEvent.click(screen.getByRole('button', { name: 'ใช้โค้ด' }))
    await vi.waitFor(() => expect(onCodeChange).toHaveBeenCalledWith(expect.objectContaining({ code: 'RYU-AAAAA' })))
  })

  it('โค้ดที่ใช้อยู่ มีปุ่มเอาออก', async () => {
    const onCodeChange = vi.fn()
    render(<PromoBox subtotal={300} autoPromo={null} nextAuto={null} codePromo={promo({ code: 'RYU-AAAAA' })} onCodeChange={onCodeChange} />)
    expect(screen.getByText(/RYU-AAAAA/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'เอาออก' }))
    expect(onCodeChange).toHaveBeenCalledWith(null)
  })
})
