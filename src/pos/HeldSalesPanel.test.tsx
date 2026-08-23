import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeldSalesPanel, type HeldSale } from './HeldSalesPanel'

const heldSales: HeldSale[] = [
  {
    id: 'h1',
    items: [{ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty: 2 }],
    heldAt: '2026-08-23T05:00:00Z',
  },
]

describe('HeldSalesPanel', () => {
  it('ไม่มีบิลพักไว้ ไม่แสดงอะไรเลย', () => {
    const { container } = render(
      <HeldSalesPanel heldSales={[]} canResume={true} onResume={vi.fn()} onDiscard={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('มีบิลพักไว้ แสดงจำนวนรายการและยอดรวมถูกต้อง', () => {
    render(<HeldSalesPanel heldSales={heldSales} canResume={true} onResume={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByText('⏸ บิลที่พักไว้ (1)')).toBeInTheDocument()
    expect(screen.getByText('1 รายการ · 80.00 บาท')).toBeInTheDocument()
  })

  it('ตะกร้าปัจจุบันไม่ว่าง ปุ่มเรียกคืน disabled', () => {
    render(<HeldSalesPanel heldSales={heldSales} canResume={false} onResume={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'เรียกคืน' })).toBeDisabled()
  })

  it('ตะกร้าว่าง กดเรียกคืนเรียก onResume ด้วย id ที่ถูกต้อง', async () => {
    const onResume = vi.fn()
    render(<HeldSalesPanel heldSales={heldSales} canResume={true} onResume={onResume} onDiscard={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'เรียกคืน' }))
    expect(onResume).toHaveBeenCalledWith('h1')
  })

  it('กดลบ เปิดกล่องยืนยัน กด "ลบเลย" แล้วเรียก onDiscard ด้วย id ที่ถูกต้อง', async () => {
    const onDiscard = vi.fn()
    render(<HeldSalesPanel heldSales={heldSales} canResume={true} onResume={vi.fn()} onDiscard={onDiscard} />)
    await userEvent.click(screen.getByRole('button', { name: 'ลบ' }))
    expect(screen.getByText('ลบบิลที่พักไว้นี้?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ลบเลย' }))
    expect(onDiscard).toHaveBeenCalledWith('h1')
  })

  it('กดลบ เปิดกล่องยืนยัน กด "ไม่ทำ" แล้วไม่เรียก onDiscard และกล่องหายไป', async () => {
    const onDiscard = vi.fn()
    render(<HeldSalesPanel heldSales={heldSales} canResume={true} onResume={vi.fn()} onDiscard={onDiscard} />)
    await userEvent.click(screen.getByRole('button', { name: 'ลบ' }))
    await userEvent.click(screen.getByRole('button', { name: 'ไม่ทำ' }))
    expect(onDiscard).not.toHaveBeenCalled()
    expect(screen.queryByText('ลบบิลที่พักไว้นี้?')).not.toBeInTheDocument()
  })
})
