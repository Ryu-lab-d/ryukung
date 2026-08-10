import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CostRecipesPage } from './CostRecipesPage'
import type { CostRecipeListItem } from './useCostRecipes'

let recipesOverride: CostRecipeListItem[] = []
let loadingOverride = false
vi.mock('./useCostRecipes', () => ({
  useCostRecipes: () => ({ recipes: recipesOverride, loading: loadingOverride, reload: vi.fn() }),
}))

function renderPage() {
  render(
    <MemoryRouter>
      <CostRecipesPage />
    </MemoryRouter>
  )
}

describe('CostRecipesPage', () => {
  it('ยังไม่มีสูตรเลย แสดงข้อความชวนกดเพิ่มสินค้า', () => {
    recipesOverride = []
    loadingOverride = false
    renderPage()
    expect(screen.getByText(/ยังไม่มีสูตรที่คำนวณไว้/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ คำนวณเมนูใหม่' })).toHaveAttribute('href', '/costing/new')
  })

  it('มีสูตรอยู่แล้ว แสดงต้นทุนต่อชิ้นและราคาขายแนะนำที่คำนวณจากวัตถุดิบจริง', () => {
    recipesOverride = [
      {
        id: 'r1',
        name: 'คุกกี้ช็อกโกแลตชิพ',
        yield_qty: 8,
        waste_overhead_percent: 0,
        profit_percent: 0,
        updated_at: '2026-08-10T00:00:00Z',
        ingredients: [{ purchase_qty: 1000, purchase_price: 160, qty_used: 1000 }],
        labor: [],
      },
    ]
    loadingOverride = false
    renderPage()
    expect(screen.getByText('คุกกี้ช็อกโกแลตชิพ')).toBeInTheDocument()
    expect(screen.getByText('ทำได้ 8 ชิ้น')).toBeInTheDocument()
    // ต้นทุนรวม 160 หาร 8 ชิ้น = 20.00 ต่อชิ้น ปรากฏทั้งแถวต้นทุนและราคาขายแนะนำ (กำไร 0%)
    expect(screen.getAllByText('20.00').length).toBeGreaterThan(0)
    const link = screen.getByRole('link', { name: /คุกกี้ช็อกโกแลตชิพ/ })
    expect(link).toHaveAttribute('href', '/costing/r1/edit')
  })
})
