import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IngredientDetailPage } from './IngredientDetailPage'
import type { Ingredient } from './useIngredients'
import type { IngredientMovement } from './useIngredientMovements'

let ingredientOverride: Ingredient | null = null
let ingredientLoading = false
const reloadIngredient = vi.fn()
vi.mock('./useIngredients', () => ({
  useIngredient: () => ({ ingredient: ingredientOverride, loading: ingredientLoading, reload: reloadIngredient }),
}))

let movementsOverride: IngredientMovement[] = []
let movementsLoading = false
const reloadMovements = vi.fn()
vi.mock('./useIngredientMovements', () => ({
  useIngredientMovements: () => ({ movements: movementsOverride, loading: movementsLoading, reload: reloadMovements }),
}))

const saveIngredient = vi.fn()
const deleteIngredient = vi.fn()
const getRecipeUsageForIngredient = vi.fn()
const updateRecipeQuantities = vi.fn()
vi.mock('./api', () => ({
  saveIngredient: (...args: unknown[]) => saveIngredient(...args),
  deleteIngredient: (...args: unknown[]) => deleteIngredient(...args),
  getRecipeUsageForIngredient: (...args: unknown[]) => getRecipeUsageForIngredient(...args),
  updateRecipeQuantities: (...args: unknown[]) => updateRecipeQuantities(...args),
}))

vi.mock('./RestockModal', () => ({
  RestockModal: ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => (
    <div>
      <p>Restock Modal</p>
      <button type="button" onClick={onClose}>ปิด restock (mock)</button>
      <button type="button" onClick={onSaved}>บันทึก restock (mock)</button>
    </div>
  ),
}))

vi.mock('./AdjustStockModal', () => ({
  AdjustStockModal: ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => (
    <div>
      <p>Adjust Modal</p>
      <button type="button" onClick={onClose}>ปิด adjust (mock)</button>
      <button type="button" onClick={onSaved}>บันทึก adjust (mock)</button>
    </div>
  ),
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function baseIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
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

function renderPage(id = 'i1') {
  render(
    <MemoryRouter initialEntries={[`/ingredients/${id}`]}>
      <Routes>
        <Route path="/ingredients/:id" element={<IngredientDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  ingredientOverride = null
  ingredientLoading = false
  movementsOverride = []
  movementsLoading = false
  reloadIngredient.mockReset()
  reloadMovements.mockReset()
  saveIngredient.mockReset()
  deleteIngredient.mockReset()
  getRecipeUsageForIngredient.mockReset()
  getRecipeUsageForIngredient.mockResolvedValue({ rows: [] })
  updateRecipeQuantities.mockReset()
  navigate.mockReset()
})

describe('IngredientDetailPage', () => {
  it('แสดงสต็อกคงเหลือและต้นทุนเฉลี่ยของวัตถุดิบ', () => {
    ingredientOverride = baseIngredient({ stock_qty: 5000, cost_per_unit: 0.5 })
    renderPage()
    expect(screen.getByText(/5,000/)).toBeInTheDocument()
    expect(screen.getByText(/฿0.50 \/ กรัม/)).toBeInTheDocument()
  })

  it('เติมฟอร์มแก้ไขด้วยข้อมูลเดิมของวัตถุดิบ', () => {
    ingredientOverride = baseIngredient({ name: 'แป้งสาลี', unit: 'กรัม', low_stock_threshold: 1000, note: 'เก็บในที่แห้ง' })
    renderPage()
    expect(screen.getByDisplayValue('แป้งสาลี')).toBeInTheDocument()
    expect(screen.getByDisplayValue('เก็บในที่แห้ง')).toBeInTheDocument()
  })

  it('แก้ไขแล้วกดบันทึก เรียก saveIngredient ด้วยค่าที่แก้', async () => {
    ingredientOverride = baseIngredient()
    saveIngredient.mockResolvedValue({ id: 'i1', error: null })
    renderPage()
    const nameInput = screen.getByLabelText('ชื่อวัตถุดิบ')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'แป้งเค้ก')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(saveIngredient).toHaveBeenCalledWith('i1', expect.objectContaining({ name: 'แป้งเค้ก' }))
  })

  it('แสดงประวัติเข้า-ออกสต็อกพร้อมป้ายเหตุผลภาษาไทยและเครื่องหมาย +/-', () => {
    ingredientOverride = baseIngredient()
    movementsOverride = [
      { id: 'm1', qty_delta: 1000, reason: 'purchase_in', ref_order_id: null, ref_withdrawal_id: null, note: null, created_at: '2026-08-11T00:00:00Z' },
      { id: 'm2', qty_delta: -200, reason: 'order_confirm', ref_order_id: 'o1', ref_withdrawal_id: null, note: null, created_at: '2026-08-11T00:00:00Z' },
    ]
    renderPage()
    expect(screen.getByText('เติมสต็อก')).toBeInTheDocument()
    expect(screen.getByText('ยืนยันออเดอร์')).toBeInTheDocument()
    expect(screen.getByText(/\+1,000/)).toBeInTheDocument()
    expect(screen.getByText(/-200/)).toBeInTheDocument()
  })

  it('ยังไม่มีประวัติ แสดงข้อความว่ายังไม่มีประวัติ', () => {
    ingredientOverride = baseIngredient()
    movementsOverride = []
    renderPage()
    expect(screen.getByText('ยังไม่มีประวัติ')).toBeInTheDocument()
  })

  it('กด "เติมสต็อก" เปิด RestockModal บันทึกสำเร็จโหลดข้อมูลใหม่ทั้งสต็อกและประวัติ', async () => {
    ingredientOverride = baseIngredient()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '➕ เติมสต็อก' }))
    expect(screen.getByText('Restock Modal')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก restock (mock)' }))
    expect(screen.queryByText('Restock Modal')).not.toBeInTheDocument()
    expect(reloadIngredient).toHaveBeenCalled()
    expect(reloadMovements).toHaveBeenCalled()
  })

  it('กด "ปรับสต็อก" เปิด AdjustStockModal บันทึกสำเร็จโหลดข้อมูลใหม่', async () => {
    ingredientOverride = baseIngredient()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '⚖️ ปรับสต็อก' }))
    expect(screen.getByText('Adjust Modal')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก adjust (mock)' }))
    expect(reloadIngredient).toHaveBeenCalled()
    expect(reloadMovements).toHaveBeenCalled()
  })

  it('กดลบแล้วยืนยัน เรียก deleteIngredient แล้วพากลับไปหน้ารายการ', async () => {
    ingredientOverride = baseIngredient()
    deleteIngredient.mockResolvedValue({ error: null })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '🗑️ ลบวัตถุดิบนี้' }))
    await userEvent.click(screen.getByRole('button', { name: 'ลบถาวร' }))
    expect(deleteIngredient).toHaveBeenCalledWith('i1')
    expect(navigate).toHaveBeenCalledWith('/ingredients')
  })

  it('ลบไม่สำเร็จเพราะถูกใช้ในสูตรสินค้าแล้ว แสดง error ไม่พาไปไหน', async () => {
    ingredientOverride = baseIngredient()
    deleteIngredient.mockResolvedValue({ error: { message: 'วัตถุดิบนี้ถูกใช้ในสูตรสินค้าแล้ว ลบไม่ได้ ให้ปิดใช้งานแทน' } })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: '🗑️ ลบวัตถุดิบนี้' }))
    await userEvent.click(screen.getByRole('button', { name: 'ลบถาวร' }))
    expect(await screen.findByText('วัตถุดิบนี้ถูกใช้ในสูตรสินค้าแล้ว ลบไม่ได้ ให้ปิดใช้งานแทน')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('IngredientDetailPage — เปลี่ยนหน่วยวัตถุดิบที่ใช้ในสูตรอยู่แล้ว', () => {
  it('เปลี่ยนหน่วยของวัตถุดิบที่ไม่มีสูตรไหนใช้ บันทึกได้เลยไม่มีคำเตือน', async () => {
    ingredientOverride = baseIngredient({ unit: 'กรัม' })
    getRecipeUsageForIngredient.mockResolvedValue({ rows: [] })
    saveIngredient.mockResolvedValue({ id: 'i1', error: null })
    renderPage()
    const unitInput = screen.getByLabelText('หน่วย')
    await userEvent.clear(unitInput)
    await userEvent.type(unitInput, 'ฟอง')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(getRecipeUsageForIngredient).toHaveBeenCalledWith('i1')
    expect(await screen.findByText('บันทึกแล้ว')).toBeInTheDocument()
    expect(saveIngredient).toHaveBeenCalledWith('i1', expect.objectContaining({ unit: 'ฟอง' }))
  })

  it('เปลี่ยนหน่วยของวัตถุดิบที่ถูกใช้ในสูตรแล้ว ขึ้นฟอร์มให้กรอกจำนวนใหม่ก่อน ไม่บันทึกทันที', async () => {
    ingredientOverride = baseIngredient({ unit: 'กรัม' })
    getRecipeUsageForIngredient.mockResolvedValue({
      rows: [
        { id: 'pi1', productName: 'คุกกี้ช็อกโกแลต', qtyPerUnit: 200 },
        { id: 'pi2', productName: 'บราวนี่', qtyPerUnit: 150 },
      ],
    })
    renderPage()
    const unitInput = screen.getByLabelText('หน่วย')
    await userEvent.clear(unitInput)
    await userEvent.type(unitInput, 'ฟอง')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(await screen.findByText('⚠️ แก้จำนวนที่ใช้ให้ตรงหน่วยใหม่')).toBeInTheDocument()
    expect(screen.getByText('คุกกี้ช็อกโกแลต')).toBeInTheDocument()
    expect(screen.getByText('บราวนี่')).toBeInTheDocument()
    // เติมค่าเดิม (ตามหน่วยเก่า) มาให้ก่อน เผื่อกรณีตัวเลขบังเอิญตรงกันพอดี ให้แก้เองต่อได้เลย
    expect(screen.getByLabelText('จำนวนที่ใช้ใหม่สำหรับ คุกกี้ช็อกโกแลต')).toHaveValue(200)
    expect(saveIngredient).not.toHaveBeenCalled()
  })

  it('กรอกจำนวนใหม่ครบแล้วกด "บันทึกทั้งหมด" แก้สูตรก่อนแล้วค่อยบันทึกหน่วยใหม่', async () => {
    ingredientOverride = baseIngredient({ unit: 'กรัม' })
    getRecipeUsageForIngredient.mockResolvedValue({ rows: [{ id: 'pi1', productName: 'คุกกี้ช็อกโกแลต', qtyPerUnit: 200 }] })
    updateRecipeQuantities.mockResolvedValue({ error: null })
    saveIngredient.mockResolvedValue({ id: 'i1', error: null })
    renderPage()
    const unitInput = screen.getByLabelText('หน่วย')
    await userEvent.clear(unitInput)
    await userEvent.type(unitInput, 'ฟอง')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    await screen.findByText('⚠️ แก้จำนวนที่ใช้ให้ตรงหน่วยใหม่')

    const qtyInput = screen.getByLabelText('จำนวนที่ใช้ใหม่สำหรับ คุกกี้ช็อกโกแลต')
    await userEvent.clear(qtyInput)
    await userEvent.type(qtyInput, '2')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกทั้งหมด' }))

    expect(updateRecipeQuantities).toHaveBeenCalledWith([{ id: 'pi1', qty_per_unit: 2 }])
    expect(saveIngredient).toHaveBeenCalledWith('i1', expect.objectContaining({ unit: 'ฟอง' }))
  })

  it('แก้จำนวนในสูตรไม่สำเร็จ ไม่บันทึกหน่วยใหม่ให้ แสดง error', async () => {
    ingredientOverride = baseIngredient({ unit: 'กรัม' })
    getRecipeUsageForIngredient.mockResolvedValue({ rows: [{ id: 'pi1', productName: 'คุกกี้ช็อกโกแลต', qtyPerUnit: 200 }] })
    updateRecipeQuantities.mockResolvedValue({ error: { message: 'แก้ไม่สำเร็จ' } })
    renderPage()
    const unitInput = screen.getByLabelText('หน่วย')
    await userEvent.clear(unitInput)
    await userEvent.type(unitInput, 'ฟอง')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    await screen.findByText('⚠️ แก้จำนวนที่ใช้ให้ตรงหน่วยใหม่')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึกทั้งหมด' }))

    expect(await screen.findByText(/แก้จำนวนในสูตรไม่สำเร็จ/)).toBeInTheDocument()
    expect(saveIngredient).not.toHaveBeenCalled()
  })

  it('ปุ่ม "บันทึกทั้งหมด" กดไม่ได้ถ้ามีแถวที่จำนวนไม่ถูกต้อง (0 หรือว่าง)', async () => {
    ingredientOverride = baseIngredient({ unit: 'กรัม' })
    getRecipeUsageForIngredient.mockResolvedValue({ rows: [{ id: 'pi1', productName: 'คุกกี้ช็อกโกแลต', qtyPerUnit: 200 }] })
    renderPage()
    const unitInput = screen.getByLabelText('หน่วย')
    await userEvent.clear(unitInput)
    await userEvent.type(unitInput, 'ฟอง')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    await screen.findByText('⚠️ แก้จำนวนที่ใช้ให้ตรงหน่วยใหม่')

    const qtyInput = screen.getByLabelText('จำนวนที่ใช้ใหม่สำหรับ คุกกี้ช็อกโกแลต')
    await userEvent.clear(qtyInput)
    expect(screen.getByRole('button', { name: 'บันทึกทั้งหมด' })).toBeDisabled()
  })

  it('กด "ยกเลิก" ในฟอร์มแก้สูตร ไม่บันทึกอะไรเลย', async () => {
    ingredientOverride = baseIngredient({ unit: 'กรัม' })
    getRecipeUsageForIngredient.mockResolvedValue({ rows: [{ id: 'pi1', productName: 'คุกกี้ช็อกโกแลต', qtyPerUnit: 200 }] })
    renderPage()
    const unitInput = screen.getByLabelText('หน่วย')
    await userEvent.clear(unitInput)
    await userEvent.type(unitInput, 'ฟอง')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    await screen.findByText('⚠️ แก้จำนวนที่ใช้ให้ตรงหน่วยใหม่')

    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(screen.queryByText('⚠️ แก้จำนวนที่ใช้ให้ตรงหน่วยใหม่')).not.toBeInTheDocument()
    expect(updateRecipeQuantities).not.toHaveBeenCalled()
    expect(saveIngredient).not.toHaveBeenCalled()
  })

  it('ไม่ได้แก้หน่วยเลย ไม่ต้องเช็คการใช้งานเลย บันทึกได้ปกติ', async () => {
    ingredientOverride = baseIngredient({ unit: 'กรัม', name: 'แป้งสาลี' })
    saveIngredient.mockResolvedValue({ id: 'i1', error: null })
    renderPage()
    const nameInput = screen.getByLabelText('ชื่อวัตถุดิบ')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'แป้งเค้ก')
    await userEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(getRecipeUsageForIngredient).not.toHaveBeenCalled()
    expect(saveIngredient).toHaveBeenCalledWith('i1', expect.objectContaining({ unit: 'กรัม' }))
  })
})
