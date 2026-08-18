import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnitConversionModal } from './UnitConversionModal'
import type { RecipeUsageRow } from './api'

const convertIngredientUnit = vi.fn()
vi.mock('./api', () => ({
  convertIngredientUnit: (...args: unknown[]) => convertIngredientUnit(...args),
}))

const onCancel = vi.fn()
const onConfirmed = vi.fn()

const rows: RecipeUsageRow[] = [
  { id: 'pi1', productName: 'คุกกี้ช็อกโกแลต', qtyPerUnit: 200 },
  { id: 'pi2', productName: 'บราวนี่', qtyPerUnit: 150 },
]

function renderModal(props: Partial<React.ComponentProps<typeof UnitConversionModal>> = {}) {
  render(
    <UnitConversionModal
      ingredientId="i1"
      oldUnit="กรัม"
      newUnit="กิโลกรัม"
      rows={rows}
      stockQty={5000}
      costPerUnit={0.5}
      onCancel={onCancel}
      onConfirmed={onConfirmed}
      {...props}
    />
  )
}

beforeEach(() => {
  convertIngredientUnit.mockReset()
  onCancel.mockReset()
  onConfirmed.mockReset()
})

describe('UnitConversionModal — หน่วยในหมวดเดียวกัน (แปลงอัตโนมัติ ไม่ต้องถาม)', () => {
  it('ข้ามไปหน้าตรวจสอบทันที ไม่มีการถามตัวคูณ', () => {
    renderModal({ oldUnit: 'กรัม', newUnit: 'กิโลกรัม' })
    expect(screen.getByText('ตรวจสอบก่อนแปลงหน่วย')).toBeInTheDocument()
    expect(screen.queryByLabelText(/เท่ากับกี่/)).not.toBeInTheDocument()
  })

  it('แสดงตัวเลขก่อน-หลังถูกต้องตามคณิตศาสตร์ (กรัม→กิโลกรัม คูณ 0.001)', () => {
    renderModal({ oldUnit: 'กรัม', newUnit: 'กิโลกรัม', stockQty: 5000, costPerUnit: 0.5 })
    // สต็อก 5000 กรัม -> 5 กิโลกรัม, ต้นทุน 0.50/กรัม -> 500.00/กิโลกรัม
    expect(screen.getByText(/5,000 กรัม → 5 กิโลกรัม/)).toBeInTheDocument()
    expect(screen.getByText(/฿0.50\/กรัม → ฿500.00\/กิโลกรัม/)).toBeInTheDocument()
    // สูตรคุกกี้ 200 กรัม -> 0.2 กิโลกรัม
    expect(screen.getByText(/200 กรัม → 0.2 กิโลกรัม/)).toBeInTheDocument()
  })

  it('กดยืนยัน เรียก convertIngredientUnit ด้วยตัวคูณที่คำนวณถูกต้อง', async () => {
    convertIngredientUnit.mockResolvedValue({ error: null })
    renderModal({ oldUnit: 'กรัม', newUnit: 'กิโลกรัม' })
    await userEvent.click(screen.getByRole('button', { name: 'ยืนยัน แปลงให้อัตโนมัติ' }))
    expect(convertIngredientUnit).toHaveBeenCalledWith('i1', 'กิโลกรัม', 0.001)
  })

  it('แปลงไม่สำเร็จ แสดง error ไม่เรียก onConfirmed', async () => {
    convertIngredientUnit.mockResolvedValue({ error: { message: 'แปลงไม่สำเร็จ' } })
    renderModal({ oldUnit: 'กรัม', newUnit: 'กิโลกรัม' })
    await userEvent.click(screen.getByRole('button', { name: 'ยืนยัน แปลงให้อัตโนมัติ' }))
    expect(await screen.findByText('แปลงไม่สำเร็จ')).toBeInTheDocument()
    expect(onConfirmed).not.toHaveBeenCalled()
  })

  it('กดยกเลิกในหน้าตรวจสอบ (กรณีอัตโนมัติ) เรียก onCancel', async () => {
    renderModal({ oldUnit: 'กรัม', newUnit: 'กิโลกรัม' })
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('UnitConversionModal — ข้ามหมวด (ต้องถามตัวคูณครั้งเดียว)', () => {
  it('แสดงคำถามก่อนเสมอเมื่อข้ามหมวด (เช่น กรัม -> ฟอง)', () => {
    renderModal({ oldUnit: 'กรัม', newUnit: 'ฟอง' })
    expect(screen.getByText('แปลงหน่วยอัตโนมัติ')).toBeInTheDocument()
    expect(screen.getByLabelText('1 ฟอง เท่ากับกี่ กรัม?')).toBeInTheDocument()
  })

  it('ปุ่ม "ถัดไป" กดไม่ได้จนกว่าจะกรอกตัวเลขมากกว่า 0', async () => {
    renderModal({ oldUnit: 'กรัม', newUnit: 'ฟอง' })
    expect(screen.getByRole('button', { name: 'ถัดไป' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('1 ฟอง เท่ากับกี่ กรัม?'), '55')
    expect(screen.getByRole('button', { name: 'ถัดไป' })).not.toBeDisabled()
  })

  it('ตอบคำถามแล้วกดถัดไป ไปหน้าตรวจสอบพร้อมตัวคูณที่คำนวณจากคำตอบถูกต้อง', async () => {
    convertIngredientUnit.mockResolvedValue({ error: null })
    renderModal({ oldUnit: 'กรัม', newUnit: 'ฟอง', stockQty: 550, costPerUnit: 2 })
    await userEvent.type(screen.getByLabelText('1 ฟอง เท่ากับกี่ กรัม?'), '55')
    await userEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))

    expect(screen.getByText('ตรวจสอบก่อนแปลงหน่วย')).toBeInTheDocument()
    // ตัวคูณ = 1/55 -> สต็อก 550 กรัม -> 10 ฟอง
    expect(screen.getByText(/550 กรัม → 10 ฟอง/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ยืนยัน แปลงให้อัตโนมัติ' }))
    expect(convertIngredientUnit).toHaveBeenCalledWith('i1', 'ฟอง', 1 / 55)
  })

  it('กดย้อนกลับในหน้าตรวจสอบ (กรณีต้องถาม) กลับไปหน้าคำถามได้ ไม่ปิดโมดัลทันที', async () => {
    renderModal({ oldUnit: 'กรัม', newUnit: 'ฟอง' })
    await userEvent.type(screen.getByLabelText('1 ฟอง เท่ากับกี่ กรัม?'), '55')
    await userEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
    expect(screen.getByText('ตรวจสอบก่อนแปลงหน่วย')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }))
    expect(screen.getByText('แปลงหน่วยอัตโนมัติ')).toBeInTheDocument()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('กดยกเลิกในหน้าคำถาม เรียก onCancel', async () => {
    renderModal({ oldUnit: 'กรัม', newUnit: 'ฟอง' })
    await userEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
