import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LowStockAlertCard } from './LowStockAlertCard'
import type { Ingredient } from './useIngredients'

let ingredientsOverride: Ingredient[] = []
let loadingOverride = false
vi.mock('./useIngredients', () => ({
  useIngredients: () => ({ ingredients: ingredientsOverride, loading: loadingOverride }),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'i1',
    name: 'แป้งสาลี',
    unit: 'กรัม',
    stock_qty: 5000,
    low_stock_threshold: 1000,
    cost_per_unit: 0.5,
    note: null,
    is_active: true,
    created_at: '2026-08-11T00:00:00Z',
    updated_at: '2026-08-11T00:00:00Z',
    ...overrides,
  }
}

function renderCard() {
  render(
    <MemoryRouter>
      <LowStockAlertCard />
    </MemoryRouter>
  )
}

beforeEach(() => {
  ingredientsOverride = []
  loadingOverride = false
  navigate.mockReset()
})

describe('LowStockAlertCard', () => {
  it('ไม่มีวัตถุดิบใกล้หมด ไม่แสดงอะไรเลย', () => {
    ingredientsOverride = [makeIngredient({ stock_qty: 5000, low_stock_threshold: 1000 })]
    const { container } = render(
      <MemoryRouter>
        <LowStockAlertCard />
      </MemoryRouter>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('มีวัตถุดิบใกล้หมด แสดงจำนวนรายการที่ใกล้หมด', () => {
    ingredientsOverride = [
      makeIngredient({ id: 'i1', stock_qty: 100, low_stock_threshold: 1000 }),
      makeIngredient({ id: 'i2', stock_qty: 200, low_stock_threshold: 1000 }),
    ]
    renderCard()
    expect(screen.getByText('⚠️ วัตถุดิบใกล้หมด')).toBeInTheDocument()
    expect(screen.getByText('2 รายการ')).toBeInTheDocument()
  })

  it('วัตถุดิบที่ปิดใช้งานแล้วไม่ถูกนับ แม้สต็อกจะต่ำกว่าเกณฑ์', () => {
    ingredientsOverride = [makeIngredient({ stock_qty: 100, low_stock_threshold: 1000, is_active: false })]
    const { container } = render(
      <MemoryRouter>
        <LowStockAlertCard />
      </MemoryRouter>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('กดแบนเนอร์ พาไปหน้าวัตถุดิบ', async () => {
    ingredientsOverride = [makeIngredient({ stock_qty: 100, low_stock_threshold: 1000 })]
    renderCard()
    await userEvent.click(screen.getByText('⚠️ วัตถุดิบใกล้หมด'))
    expect(navigate).toHaveBeenCalledWith('/ingredients')
  })
})
