import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProductsPage } from './ProductsPage'

vi.mock('./useProducts', () => ({ useProducts: () => ({ products: [], loading: false }) }))
vi.mock('./useCategories', () => ({ useCategories: () => ({ categories: [] }) }))

describe('ProductsPage', () => {
  it('แสดงแท็บ "สินค้า"/"วัตถุดิบ" ที่หัวหน้า โดยไฮไลต์แท็บสินค้าอยู่', () => {
    render(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>
    )
    const productsTab = screen.getByRole('link', { name: '🍪 สินค้า' })
    const ingredientsTab = screen.getByRole('link', { name: '🧂 วัตถุดิบ' })
    expect(productsTab).toHaveAttribute('href', '/products')
    expect(ingredientsTab).toHaveAttribute('href', '/ingredients')
    expect(productsTab.className).toContain('bg-stone-900')
  })
})
