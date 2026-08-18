import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { NewWithdrawalPage } from './NewWithdrawalPage'

const products = [
  { id: 'p1', name: 'คุกกี้', sku: null, category_id: null, price: 40, cost: 15, unit: 'ชิ้น', image_path: null, is_active: true, note: null, created_at: '', updated_at: '' },
  { id: 'p2', name: 'บราวนี่', sku: null, category_id: null, price: 60, cost: 25, unit: 'ชิ้น', image_path: null, is_active: true, note: null, created_at: '', updated_at: '' },
]
vi.mock('../products/useProducts', () => ({ useProducts: () => ({ products, loading: false }) }))
vi.mock('../products/useCategories', () => ({ useCategories: () => ({ categories: [], loading: false }) }))

const staffMembers = [
  { id: 's1', user_id: 'u1', email: 'ryu@example.com', display_name: 'น้องริว', role: 'owner', status: 'active', created_at: '' },
  { id: 's2', user_id: 'u2', email: 'staff@example.com', display_name: null, role: 'staff', status: 'active', created_at: '' },
  { id: 's3', user_id: 'u3', email: 'pending@example.com', display_name: 'รอสิทธิ์', role: 'staff', status: 'pending', created_at: '' },
]
vi.mock('../staff/useStaffMembers', () => ({ useStaffMembers: () => ({ members: staffMembers, loading: false }) }))

const createWithdrawal = vi.fn()
vi.mock('./api', () => ({ createWithdrawal: (...args: unknown[]) => createWithdrawal(...args) }))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage() {
  render(
    <MemoryRouter>
      <NewWithdrawalPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  createWithdrawal.mockReset()
  navigate.mockReset()
})

describe('NewWithdrawalPage', () => {
  it('เลือกสินค้าแล้วปรับจำนวน กดเริ่มเบิกของ ส่งข้อมูลถูกต้องแล้วพาไปหน้ารายละเอียด', async () => {
    createWithdrawal.mockResolvedValue({ id: 'w1', error: null })
    renderPage()

    await userEvent.click(screen.getByText('คุกกี้'))
    const qtyInput = screen.getByDisplayValue('1')
    await userEvent.clear(qtyInput)
    await userEvent.type(qtyInput, '20')

    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))

    expect(createWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ product_id: 'p1', product_name: 'คุกกี้', unit_price: 40, unit_cost: 15, qty_out: 20 })],
      })
    )
    expect(navigate).toHaveBeenCalledWith('/withdrawals/w1')
  })

  it('กดเลือกสินค้าเดิมซ้ำ จำนวนบวกเพิ่มแทนที่จะเพิ่มแถวใหม่', async () => {
    renderPage()
    // ตัวแรกในรายการที่ตรงคือการ์ดในช่องเลือกสินค้าเสมอ (ตัวที่สองที่อาจโผล่มาคือแถวในรายการที่เลือกแล้วด้านล่าง)
    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  it('ไม่ได้เลือกสินค้าเลย กดเริ่มเบิกของ ขึ้น error ไม่ยิง createWithdrawal', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))
    expect(await screen.findByText('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')).toBeInTheDocument()
    expect(createWithdrawal).not.toHaveBeenCalled()
  })

  it('ตัวเลือกผู้เบิกแสดงเฉพาะพนักงานที่ status active เท่านั้น ไม่รวมที่ยัง pending', () => {
    renderPage()
    const select = screen.getByLabelText('ผู้เบิกไปขาย (ไม่บังคับ)')
    expect(select).toHaveTextContent('น้องริว (เจ้าของร้าน)')
    expect(select).toHaveTextContent('staff@example.com')
    expect(select).not.toHaveTextContent('รอสิทธิ์')
  })

  it('เลือกผู้เบิกไว้ กดเริ่มเบิกของ ส่ง withdrawnBy ไปด้วย', async () => {
    createWithdrawal.mockResolvedValue({ id: 'w1', error: null })
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    await userEvent.selectOptions(screen.getByLabelText('ผู้เบิกไปขาย (ไม่บังคับ)'), 's2')
    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))
    expect(createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ withdrawnBy: 's2' }))
  })

  it('ไม่เลือกผู้เบิก ส่ง withdrawnBy เป็น null', async () => {
    createWithdrawal.mockResolvedValue({ id: 'w1', error: null })
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))
    expect(createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ withdrawnBy: null }))
  })
})

describe('NewWithdrawalPage — ค่าจ้างผู้เบิก', () => {
  it('ยังไม่เลือกผู้เบิก ไม่แสดงส่วนค่าจ้าง', () => {
    renderPage()
    expect(screen.queryByText('ค่าจ้างผู้เบิก (ไม่บังคับ)')).not.toBeInTheDocument()
  })

  it('เลือกผู้เบิกแล้วเลือกค่าจ้างเงินสด ส่ง wage แบบ cash ไปด้วย', async () => {
    createWithdrawal.mockResolvedValue({ id: 'w1', error: null })
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    await userEvent.selectOptions(screen.getByLabelText('ผู้เบิกไปขาย (ไม่บังคับ)'), 's2')
    await userEvent.click(screen.getByRole('button', { name: '💵 เงินสด' }))
    const amountInput = screen.getByLabelText('จำนวนเงินค่าจ้าง (บาท)')
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '30')
    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))
    expect(createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ wage: { type: 'cash', amount: 30 } }))
  })

  it('เลือกผู้เบิกแล้วเลือกค่าจ้างเป็นสินค้า ส่ง wage แบบ product พร้อมต้นทุนสินค้านั้น', async () => {
    createWithdrawal.mockResolvedValue({ id: 'w1', error: null })
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    await userEvent.selectOptions(screen.getByLabelText('ผู้เบิกไปขาย (ไม่บังคับ)'), 's2')
    await userEvent.click(screen.getByRole('button', { name: '🍪 สินค้า' }))
    await userEvent.selectOptions(screen.getByLabelText('สินค้าที่จ่ายเป็นค่าจ้าง'), 'p1')
    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))
    expect(createWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ wage: { type: 'product', productId: 'p1', productName: 'คุกกี้', unitCost: 15, qty: 1 } })
    )
  })

  it('เลือกผู้เบิกแต่ไม่ได้ตั้งค่าจ้าง ส่ง wage เป็น null', async () => {
    createWithdrawal.mockResolvedValue({ id: 'w1', error: null })
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    await userEvent.selectOptions(screen.getByLabelText('ผู้เบิกไปขาย (ไม่บังคับ)'), 's2')
    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))
    expect(createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({ wage: null }))
  })
})

describe('NewWithdrawalPage — ลดราคาต่อชิ้นสำหรับเบิกไปขายนอกร้าน (เช่นไม่มีค่าสติกเกอร์/ถุง)', () => {
  it('ตั้งส่วนลดไว้ก่อนแล้วค่อยเลือกสินค้า ราคาลดให้อัตโนมัติทันทีที่เพิ่ม', async () => {
    createWithdrawal.mockResolvedValue({ id: 'w1', error: null })
    renderPage()

    await userEvent.type(screen.getByLabelText(/ลดราคาต่อชิ้น/), '10')
    await userEvent.click(screen.getByText('คุกกี้'))

    expect(screen.getByLabelText('ราคาขาย/ชิ้น (บาท)')).toHaveValue(30) // 40 - 10
    expect(screen.getByText(/ราคาปกติ 40\.00 → ลดเหลือ 30\.00/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'เริ่มเบิกของ' }))
    expect(createWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ items: [expect.objectContaining({ unit_price: 30 })] })
    )
  })

  it('เลือกสินค้าไว้ก่อนแล้วตั้งส่วนลดทีหลัง กด "ใช้กับทุกชิ้น" ปรับราคาของที่เลือกไว้แล้วทั้งหมด', async () => {
    renderPage()
    await userEvent.click(screen.getAllByText('คุกกี้')[0])
    await userEvent.click(screen.getByText('บราวนี่'))

    await userEvent.type(screen.getByLabelText(/ลดราคาต่อชิ้น/), '10')
    await userEvent.click(screen.getByRole('button', { name: 'ใช้กับทุกชิ้นที่เลือกแล้ว' }))

    const priceInputs = screen.getAllByLabelText('ราคาขาย/ชิ้น (บาท)')
    expect(priceInputs[0]).toHaveValue(30) // คุกกี้ 40 - 10
    expect(priceInputs[1]).toHaveValue(50) // บราวนี่ 60 - 10
  })

  it('แก้ราคาต่อชิ้นเองตรงๆ ได้เสมอ ไม่ต้องพึ่งช่องส่วนลดกลาง', async () => {
    renderPage()
    await userEvent.click(screen.getByText('คุกกี้'))
    const priceInput = screen.getByLabelText('ราคาขาย/ชิ้น (บาท)')
    await userEvent.clear(priceInput)
    await userEvent.type(priceInput, '25')
    expect(priceInput).toHaveValue(25)
  })
})
