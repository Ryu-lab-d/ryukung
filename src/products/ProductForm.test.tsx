import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProductForm } from './ProductForm'

let productsOverride: any[] = []
const save = vi.fn()
const remove = vi.fn()
vi.mock('./useProducts', () => ({
  useProducts: () => ({ products: productsOverride, save: (...args: unknown[]) => save(...args), remove: (...args: unknown[]) => remove(...args) }),
}))

vi.mock('./useCategories', () => ({ useCategories: () => ({ categories: [] }) }))

let ingredientsOverride: any[] = []
vi.mock('../ingredients/useIngredients', () => ({
  useIngredients: () => ({ ingredients: ingredientsOverride, loading: false }),
}))

let savedRecipeRowsOverride: { ingredient_id: string; qty_per_unit: number }[] = []
vi.mock('./useProductIngredients', () => ({
  useProductIngredients: () => ({ rows: savedRecipeRowsOverride, loading: false }),
}))

const saveProductIngredients = vi.fn()
vi.mock('./api', () => ({ saveProductIngredients: (...args: unknown[]) => saveProductIngredients(...args) }))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderNew() {
  render(
    <MemoryRouter initialEntries={['/products/new']}>
      <Routes>
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id" element={<ProductForm />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(id = 'p1') {
  render(
    <MemoryRouter initialEntries={[`/products/${id}`]}>
      <Routes>
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id" element={<ProductForm />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  productsOverride = []
  ingredientsOverride = []
  savedRecipeRowsOverride = []
  save.mockReset()
  remove.mockReset()
  saveProductIngredients.mockReset()
  navigate.mockReset()
})

describe('ProductForm — สูตร/วัตถุดิบที่ใช้', () => {
  it('สร้างสินค้าใหม่โดยไม่เพิ่มแถวสูตรเลย บันทึกสินค้าได้ปกติ ไม่เรียก saveProductIngredients ด้วยแถวเปล่า', async () => {
    save.mockResolvedValue({ id: 'new-id', error: null })
    saveProductIngredients.mockResolvedValue({ error: null })
    renderNew()
    await userEvent.type(screen.getByLabelText('ชื่อสินค้า'), 'คุกกี้ทดสอบ')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'คุกกี้ทดสอบ' }))
    expect(saveProductIngredients).toHaveBeenCalledWith('new-id', [])
    expect(navigate).toHaveBeenCalledWith('/products')
  })

  it('เพิ่มแถวสูตรแล้วเลือกวัตถุดิบ+จำนวน กดบันทึก ส่งแถวที่กรอกไปยัง saveProductIngredients ด้วย id ของสินค้าที่เพิ่งสร้าง', async () => {
    ingredientsOverride = [{ id: 'ing1', name: 'แป้งสาลี', unit: 'กรัม', cost_per_unit: 0.5 }]
    save.mockResolvedValue({ id: 'new-id', error: null })
    saveProductIngredients.mockResolvedValue({ error: null })
    renderNew()

    await userEvent.type(screen.getByLabelText('ชื่อสินค้า'), 'คุกกี้ทดสอบ')
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มวัตถุดิบ' }))
    await userEvent.selectOptions(screen.getByLabelText('วัตถุดิบแถวที่ 1'), 'ing1')
    await userEvent.type(screen.getByLabelText('จำนวนที่ใช้แถวที่ 1'), '100')

    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(saveProductIngredients).toHaveBeenCalledWith('new-id', [{ ingredient_id: 'ing1', qty_per_unit: 100 }])
  })

  it('เลือกวัตถุดิบไว้แต่ไม่กรอกจำนวน กดบันทึกขึ้น error ไม่เรียก save', async () => {
    ingredientsOverride = [{ id: 'ing1', name: 'แป้งสาลี', unit: 'กรัม', cost_per_unit: 0.5 }]
    renderNew()
    await userEvent.type(screen.getByLabelText('ชื่อสินค้า'), 'คุกกี้ทดสอบ')
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มวัตถุดิบ' }))
    await userEvent.selectOptions(screen.getByLabelText('วัตถุดิบแถวที่ 1'), 'ing1')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('กรุณาใส่จำนวนที่ใช้ให้ครบทุกแถวสูตรที่เลือกวัตถุดิบไว้')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('คำนวณ "ต้นทุนจากสูตร" แบบสดจากแถวที่กรอก และปุ่ม "ใช้ค่านี้เป็นต้นทุน" เติมลงช่องต้นทุน', async () => {
    ingredientsOverride = [{ id: 'ing1', name: 'แป้งสาลี', unit: 'กรัม', cost_per_unit: 0.5 }]
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มวัตถุดิบ' }))
    await userEvent.selectOptions(screen.getByLabelText('วัตถุดิบแถวที่ 1'), 'ing1')
    await userEvent.type(screen.getByLabelText('จำนวนที่ใช้แถวที่ 1'), '100')

    // 100 กรัม x 0.5 บาท/กรัม = 50.00 บาท
    expect(await screen.findByText(/50\.00/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ใช้ค่านี้เป็นต้นทุน' }))
    expect(screen.getByLabelText('ต้นทุนโดยประมาณ')).toHaveValue(50)
  })

  it('ลบแถวสูตรออกได้', async () => {
    ingredientsOverride = [{ id: 'ing1', name: 'แป้งสาลี', unit: 'กรัม', cost_per_unit: 0.5 }]
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มวัตถุดิบ' }))
    expect(screen.getByLabelText('วัตถุดิบแถวที่ 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ลบ' }))
    expect(screen.queryByLabelText('วัตถุดิบแถวที่ 1')).not.toBeInTheDocument()
  })

  it('แก้ไขสินค้าเดิม โหลดสูตรที่บันทึกไว้แล้วมาเติมในฟอร์มให้', async () => {
    productsOverride = [{ id: 'p1', name: 'บราวนี่', sku: null, category_id: null, price: 50, cost: 20, unit: 'ชิ้น', image_path: null, is_active: true, note: null }]
    ingredientsOverride = [{ id: 'ing1', name: 'แป้งสาลี', unit: 'กรัม', cost_per_unit: 0.5 }]
    savedRecipeRowsOverride = [{ ingredient_id: 'ing1', qty_per_unit: 200 }]
    renderEdit()
    expect(await screen.findByDisplayValue('200')).toBeInTheDocument()
  })
})
