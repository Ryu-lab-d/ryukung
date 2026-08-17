import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SalesSummaryPage } from './SalesSummaryPage'

let salesSummaryOverride = {
  orders: [] as any[],
  loading: false,
  sales: 0,
  cost: 0,
  profit: 0,
  profitPercent: 0,
  avgOrder: 0,
}
vi.mock('./useSalesSummary', () => ({
  useSalesSummary: () => salesSummaryOverride,
}))

vi.mock('./useSalesTrend', () => ({
  useSalesTrend: () => ({ trend: Array.from({ length: 14 }, (_, i) => ({ date: `2026-08-${i + 1}`, sales: 0 })), loading: false }),
}))

let expensesOverride: any[] = []
let expensesLoadingOverride = false
vi.mock('./useExpenses', () => ({
  useExpenses: () => ({ expenses: expensesOverride, loading: expensesLoadingOverride }),
}))

let ingredientsOverride: any[] = []
vi.mock('../ingredients/useIngredients', () => ({
  useIngredients: () => ({ ingredients: ingredientsOverride, loading: false }),
}))

let productIngredientsOverride: any[] = []
vi.mock('./useAllProductIngredients', () => ({
  useAllProductIngredients: () => ({ links: productIngredientsOverride, loading: false }),
}))

function renderPage() {
  render(
    <MemoryRouter>
      <SalesSummaryPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  salesSummaryOverride = { orders: [], loading: false, sales: 0, cost: 0, profit: 0, profitPercent: 0, avgOrder: 0 }
  expensesOverride = []
  expensesLoadingOverride = false
  ingredientsOverride = []
  productIngredientsOverride = []
})

describe('SalesSummaryPage — กำไรสุทธิ', () => {
  it('ไม่มีรายจ่ายเลย กำไรสุทธิเท่ากับกำไรขั้นต้น', () => {
    salesSummaryOverride = { orders: [], loading: false, sales: 1000, cost: 400, profit: 600, profitPercent: 60, avgOrder: 1000 }
    renderPage()
    expect(screen.getByText('รายจ่ายอื่นๆ ในช่วงนี้ 0.00')).toBeInTheDocument()
  })

  it('มีรายจ่าย หักออกจากกำไรขั้นต้นให้เป็นกำไรสุทธิ', () => {
    salesSummaryOverride = { orders: [], loading: false, sales: 1000, cost: 250, profit: 750, profitPercent: 75, avgOrder: 1000 }
    expensesOverride = [
      { id: 'e1', expense_date: '2026-08-10', category: 'rent_utilities', amount: 150, note: null, created_at: '', updated_at: '' },
      { id: 'e2', expense_date: '2026-08-11', category: 'packaging', amount: 50, note: null, created_at: '', updated_at: '' },
    ]
    renderPage()
    // กำไรขั้นต้น 750 - รายจ่าย 200 = กำไรสุทธิ 550
    expect(screen.getByText('550.00')).toBeInTheDocument()
    expect(screen.getByText('รายจ่ายอื่นๆ ในช่วงนี้ 200.00')).toBeInTheDocument()
  })

  it('มีลิงก์ไปหน้าจัดการรายจ่าย', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /จัดการรายจ่าย/ })).toHaveAttribute('href', '/expenses')
  })
})

describe('SalesSummaryPage — สินค้าขายดีเรียงตามกำไร', () => {
  it('สินค้าที่มีสูตรผูกไว้ ขึ้นป้าย "ต้นทุนจากสูตร"', () => {
    salesSummaryOverride = {
      orders: [
        {
          id: 'o1',
          order_no: 'RYB-000001',
          created_at: '2026-08-10T00:00:00Z',
          items_total: 400,
          items_cost_total: 100,
          grand_total: 400,
          order_items: [{ product_id: 'p1', product_name: 'คุกกี้', qty: 10, line_total: 400, unit_cost: 999 }],
        },
      ],
      loading: false,
      sales: 400,
      cost: 100,
      profit: 300,
      profitPercent: 75,
      avgOrder: 400,
    }
    ingredientsOverride = [{ id: 'ing1', cost_per_unit: 0.5 }]
    productIngredientsOverride = [{ product_id: 'p1', ingredient_id: 'ing1', qty_per_unit: 20 }]
    renderPage()
    expect(screen.getByText('คุกกี้')).toBeInTheDocument()
    expect(screen.getByText(/ต้นทุนจากสูตร/)).toBeInTheDocument()
  })

  it('สินค้าที่ไม่มีสูตรผูกไว้ ขึ้นป้าย "ต้นทุนประมาณการ"', () => {
    salesSummaryOverride = {
      orders: [
        {
          id: 'o1',
          order_no: 'RYB-000001',
          created_at: '2026-08-10T00:00:00Z',
          items_total: 300,
          items_cost_total: 100,
          grand_total: 300,
          order_items: [{ product_id: 'p2', product_name: 'บราวนี่', qty: 5, line_total: 300, unit_cost: 20 }],
        },
      ],
      loading: false,
      sales: 300,
      cost: 100,
      profit: 200,
      profitPercent: 66.7,
      avgOrder: 300,
    }
    renderPage()
    expect(screen.getByText(/ต้นทุนประมาณการ/)).toBeInTheDocument()
  })

  it('ไม่มีสินค้าขายในช่วงที่เลือก แสดงข้อความแจ้ง', () => {
    renderPage()
    expect(screen.getByText('ไม่มีสินค้าขายในช่วงที่เลือก')).toBeInTheDocument()
  })
})
