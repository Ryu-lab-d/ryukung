import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { IngredientsPage } from './IngredientsPage'
import type { Ingredient } from './useIngredients'

let ingredientsOverride: Ingredient[] = []
let loadingOverride = false
const reload = vi.fn()
vi.mock('./useIngredients', () => ({
  useIngredients: () => ({ ingredients: ingredientsOverride, loading: loadingOverride, reload }),
}))

vi.mock('./IngredientFormModal', () => ({
  IngredientFormModal: ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => (
    <div>
      <p>Quick Add Modal</p>
      <button type="button" onClick={onClose}>ปิด (mock)</button>
      <button type="button" onClick={onSaved}>บันทึกแล้ว (mock)</button>
    </div>
  ),
}))

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'i1',
    name: 'แป้งสาลี',
    unit: 'กรัม',
    stock_qty: 5000,
    low_stock_threshold: 1000,
    cost_per_unit: 0.05,
    note: null,
    is_active: true,
    created_at: '2026-08-11T00:00:00Z',
    updated_at: '2026-08-11T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <IngredientsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  ingredientsOverride = []
  loadingOverride = false
  reload.mockReset()
})

describe('IngredientsPage', () => {
  it('ยังไม่มีวัตถุดิบเลย แสดงข้อความชวนเพิ่ม', () => {
    renderPage()
    expect(screen.getByText(/ยังไม่มีวัตถุดิบเลย/)).toBeInTheDocument()
  })

  it('แสดงรายการวัตถุดิบพร้อมสต็อกคงเหลือและต้นทุนเฉลี่ย', () => {
    ingredientsOverride = [makeIngredient()]
    renderPage()
    expect(screen.getByText('แป้งสาลี')).toBeInTheDocument()
    expect(screen.getByText(/5,000/)).toBeInTheDocument()
  })

  it('วัตถุดิบใกล้หมด ขึ้นแบนเนอร์เตือนที่หัวหน้า และมีป้าย "ใกล้หมด" ที่แถวนั้น', () => {
    ingredientsOverride = [makeIngredient({ stock_qty: 500, low_stock_threshold: 1000 })]
    renderPage()
    expect(screen.getByText('⚠️ วัตถุดิบใกล้หมด')).toBeInTheDocument()
    expect(screen.getByText('ใกล้หมด')).toBeInTheDocument()
  })

  it('ไม่มีวัตถุดิบใกล้หมด ไม่ขึ้นแบนเนอร์เตือน', () => {
    ingredientsOverride = [makeIngredient({ stock_qty: 5000, low_stock_threshold: 1000 })]
    renderPage()
    expect(screen.queryByText('⚠️ วัตถุดิบใกล้หมด')).not.toBeInTheDocument()
  })

  it('ค้นหาชื่อวัตถุดิบ กรองรายการที่ไม่ตรงออกไป', async () => {
    ingredientsOverride = [makeIngredient({ id: 'i1', name: 'แป้งสาลี' }), makeIngredient({ id: 'i2', name: 'น้ำตาลทราย' })]
    renderPage()
    await userEvent.type(screen.getByPlaceholderText('ค้นหาวัตถุดิบ'), 'น้ำตาล')
    expect(screen.queryByText('แป้งสาลี')).not.toBeInTheDocument()
    expect(screen.getByText('น้ำตาลทราย')).toBeInTheDocument()
  })

  it('กดแบนเนอร์เตือนใกล้หมด กรองให้เหลือเฉพาะที่ใกล้หมด', async () => {
    ingredientsOverride = [
      makeIngredient({ id: 'i1', name: 'แป้งสาลี', stock_qty: 100, low_stock_threshold: 1000 }),
      makeIngredient({ id: 'i2', name: 'ยังเหลือเยอะ', stock_qty: 5000, low_stock_threshold: 1000 }),
    ]
    renderPage()
    await userEvent.click(screen.getByText('⚠️ วัตถุดิบใกล้หมด'))
    expect(screen.getByText('แป้งสาลี')).toBeInTheDocument()
    expect(screen.queryByText('ยังเหลือเยอะ')).not.toBeInTheDocument()
  })

  it('กดปุ่ม "+ เพิ่มวัตถุดิบ" เปิดป็อปอัพเพิ่มเร็ว บันทึกสำเร็จโหลดรายการใหม่', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มวัตถุดิบ' }))
    expect(screen.getByText('Quick Add Modal')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกแล้ว (mock)' }))
    expect(screen.queryByText('Quick Add Modal')).not.toBeInTheDocument()
    expect(reload).toHaveBeenCalled()
  })
})
