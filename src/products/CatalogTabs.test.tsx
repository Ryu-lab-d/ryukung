import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CatalogTabs } from './CatalogTabs'

describe('CatalogTabs', () => {
  it('active="products" ลิงก์ "สินค้า" ไปหน้าสินค้า และ "วัตถุดิบ" ไปหน้าวัตถุดิบ', () => {
    render(
      <MemoryRouter>
        <CatalogTabs active="products" />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: '🍪 สินค้า' })).toHaveAttribute('href', '/products')
    expect(screen.getByRole('link', { name: '🧂 วัตถุดิบ' })).toHaveAttribute('href', '/ingredients')
  })

  it('active="ingredients" ไฮไลต์แท็บวัตถุดิบ', () => {
    render(
      <MemoryRouter>
        <CatalogTabs active="ingredients" />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: '🧂 วัตถุดิบ' }).className).toContain('bg-stone-900')
    expect(screen.getByRole('link', { name: '🍪 สินค้า' }).className).not.toContain('bg-stone-900')
  })
})
