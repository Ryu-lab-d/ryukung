import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CartPanel, type CartItem } from './CartPanel'

const items: CartItem[] = [
  { product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty: 2 },
]

describe('CartPanel', () => {
  it('ตะกร้าว่าง แสดงข้อความและปุ่มไปหน้าชำระเงิน disabled', () => {
    render(<CartPanel items={[]} onUpdateQty={vi.fn()} onUpdatePrice={vi.fn()} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    expect(screen.getByText('ยังไม่ได้เลือกสินค้า')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ไปหน้าชำระเงิน →' })).toBeDisabled()
  })

  it('แสดงยอดรวมถูกต้องและปุ่มไปหน้าชำระเงินกดได้', async () => {
    const onCheckout = vi.fn()
    render(<CartPanel items={items} onUpdateQty={vi.fn()} onUpdatePrice={vi.fn()} onRemove={vi.fn()} onCheckout={onCheckout} />)
    expect(screen.getByText('80.00 บาท')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ไปหน้าชำระเงิน →' }))
    expect(onCheckout).toHaveBeenCalled()
  })

  it('กด + / − เปลี่ยนจำนวน', async () => {
    const onUpdateQty = vi.fn()
    render(<CartPanel items={items} onUpdateQty={onUpdateQty} onUpdatePrice={vi.fn()} onRemove={vi.fn()} onCheckout={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'เพิ่มจำนวน คุกกี้' }))
    expect(onUpdateQty).toHaveBeenCalledWith(0, 3)
    await userEvent.click(screen.getByRole('button', { name: 'ลดจำนวน คุกกี้' }))
    expect(onUpdateQty).toHaveBeenCalledWith(0, 1)
  })

  it('จำนวนเหลือ 1 กด − แล้วไม่ต่ำกว่า 1', async () => {
    const onUpdateQty = vi.fn()
    render(
      <CartPanel
        items={[{ ...items[0], qty: 1 }]}
        onUpdateQty={onUpdateQty}
        onUpdatePrice={vi.fn()}
        onRemove={vi.fn()}
        onCheckout={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'ลดจำนวน คุกกี้' }))
    expect(onUpdateQty).toHaveBeenCalledWith(0, 1)
  })

  it('กดลบเรียก onRemove ถูกแถว', async () => {
    const onRemove = vi.fn()
    render(<CartPanel items={items} onUpdateQty={vi.fn()} onUpdatePrice={vi.fn()} onRemove={onRemove} onCheckout={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'ลบ' }))
    expect(onRemove).toHaveBeenCalledWith(0)
  })
})
