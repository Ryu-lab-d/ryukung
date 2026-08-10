import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CostRecipeForm } from './CostRecipeForm'

let recipeOverride: any = null
let ingredientsOverride: any[] = []
let laborOverride: any[] = []
let loadingOverride = false
vi.mock('./useCostRecipe', () => ({
  useCostRecipe: () => ({
    recipe: recipeOverride,
    ingredients: ingredientsOverride,
    labor: laborOverride,
    loading: loadingOverride,
    reload: vi.fn(),
  }),
}))

const saveCostRecipe = vi.fn()
const deleteCostRecipe = vi.fn()
vi.mock('./api', () => ({
  saveCostRecipe: (...args: unknown[]) => saveCostRecipe(...args),
  deleteCostRecipe: (...args: unknown[]) => deleteCostRecipe(...args),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderNew() {
  render(
    <MemoryRouter initialEntries={['/costing/new']}>
      <Routes>
        <Route path="/costing/new" element={<CostRecipeForm />} />
        <Route path="/costing/:id/edit" element={<CostRecipeForm />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderEdit(id = 'r1') {
  render(
    <MemoryRouter initialEntries={[`/costing/${id}/edit`]}>
      <Routes>
        <Route path="/costing/new" element={<CostRecipeForm />} />
        <Route path="/costing/:id/edit" element={<CostRecipeForm />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  recipeOverride = null
  ingredientsOverride = []
  laborOverride = []
  loadingOverride = false
  saveCostRecipe.mockReset()
  deleteCostRecipe.mockReset()
  navigate.mockReset()
})

describe('CostRecipeForm — สร้างใหม่', () => {
  it('กรอกวัตถุดิบแล้วตัวเลขต้นทุน/ราคาขายแนะนำอัปเดตทันทีแบบ live โดยไม่ต้องกดอะไรเพิ่ม', async () => {
    renderNew()
    await userEvent.type(screen.getByPlaceholderText('ชื่อวัตถุดิบ เช่น เนย'), 'เนย')
    const [purchaseQty, purchasePrice, qtyUsed] = screen.getAllByRole('spinbutton')
    await userEvent.type(purchaseQty, '5000')
    await userEvent.type(purchasePrice, '1125')
    await userEvent.type(qtyUsed, '200')

    // เนย 5000g ราคา 1125 ใช้ 200g = 45 บาท — ปรากฏทั้งที่แถววัตถุดิบและในสรุปด้านล่าง (ต้นทุนรวม/ต้นทุนต่อชิ้นเท่ากันพอดีเพราะมีชิ้นเดียว 1 หน่วย)
    expect(screen.getAllByText('45.00').length).toBeGreaterThan(0)
  })

  it('กดบันทึก ส่งวัตถุดิบและค่าแรงที่กรอกไปยัง saveCostRecipe ครบถ้วน แล้วพาไปหน้าแก้ไข', async () => {
    saveCostRecipe.mockResolvedValue({ id: 'new-id', error: null })
    renderNew()

    await userEvent.type(screen.getByLabelText('ชื่อเมนู/สินค้า'), 'คุกกี้ทดสอบ')
    await userEvent.type(screen.getByPlaceholderText('ชื่อวัตถุดิบ เช่น เนย'), 'แป้ง')
    const [purchaseQty, purchasePrice, qtyUsed] = screen.getAllByRole('spinbutton')
    await userEvent.type(purchaseQty, '1000')
    await userEvent.type(purchasePrice, '40')
    await userEvent.type(qtyUsed, '500')

    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มรายการ' }))
    await userEvent.type(screen.getByPlaceholderText('เช่น ค่าแรงอบ'), 'ค่าแรงอบ')
    await userEvent.type(screen.getByPlaceholderText('บาท'), '50')

    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(saveCostRecipe).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        name: 'คุกกี้ทดสอบ',
        ingredients: [
          expect.objectContaining({ name: 'แป้ง', purchase_qty: 1000, purchase_unit: 'กรัม', purchase_price: 40, qty_used: 500 }),
        ],
        labor: [expect.objectContaining({ label: 'ค่าแรงอบ', amount: 50 })],
      })
    )
    expect(navigate).toHaveBeenCalledWith('/costing/new-id/edit')
  })

  it('ไม่กรอกชื่อเมนู กดบันทึกแล้วขึ้น error ไม่ยิง saveCostRecipe', async () => {
    renderNew()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('กรุณาใส่ชื่อเมนู')).toBeInTheDocument()
    expect(saveCostRecipe).not.toHaveBeenCalled()
  })
})

describe('CostRecipeForm — แก้ไขของเดิม', () => {
  it('โหลดข้อมูลเดิมมาเติมในฟอร์มให้ครบ (ชื่อ, วัตถุดิบ, ค่าแรง)', async () => {
    recipeOverride = { id: 'r1', name: 'บราวนี่', waste_overhead_percent: 5, profit_percent: 40, yield_qty: 12, note: null }
    ingredientsOverride = [
      { id: 'i1', name: 'ช็อกโกแลต', purchase_qty: 1000, purchase_unit: 'กรัม', purchase_price: 300, qty_used: 400 },
    ]
    laborOverride = [{ id: 'l1', label: 'ค่าแรง', amount: 80 }]

    renderEdit()

    expect(await screen.findByDisplayValue('บราวนี่')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ช็อกโกแลต')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ค่าแรง')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ลบสูตรนี้' })).toBeInTheDocument()
  })

  it('มีปุ่มลบสูตร กดแล้วยืนยันแล้วเรียก deleteCostRecipe', async () => {
    recipeOverride = { id: 'r1', name: 'บราวนี่', waste_overhead_percent: 0, profit_percent: 0, yield_qty: 1, note: null }
    deleteCostRecipe.mockResolvedValue({ error: null })
    renderEdit()

    await screen.findByDisplayValue('บราวนี่')
    await userEvent.click(screen.getByRole('button', { name: 'ลบสูตรนี้' }))
    // ConfirmDialog เป็น overlay ที่ต่อท้าย DOM ทีหลัง ปุ่ม "ลบ" ยืนยันจึงเป็นตัวสุดท้ายเสมอ (แถวเดิมของวัตถุดิบก็มีปุ่ม "ลบ" ของตัวเองด้วย)
    const confirmButtons = screen.getAllByRole('button', { name: 'ลบ' })
    await userEvent.click(confirmButtons[confirmButtons.length - 1])

    expect(deleteCostRecipe).toHaveBeenCalledWith('r1')
    expect(navigate).toHaveBeenCalledWith('/costing')
  })
})
