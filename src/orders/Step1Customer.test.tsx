import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import { Step1Customer } from './Step1Customer'
import type { OrderFormValues } from './schema'

const save = vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null })
const customers = [
  { id: 'c1', name: 'มีอีเมลแล้ว', phone: '0812345678', email: 'has-email@example.com', channel: null, channel_handle: null, note: null, order_count: 0, total_spend: 0, created_at: '', updated_at: '' },
  { id: 'c2', name: 'ยังไม่มีอีเมล', phone: '0898765432', email: null, channel: null, channel_handle: null, note: null, order_count: 0, total_spend: 0, created_at: '', updated_at: '' },
]

vi.mock('../customers/useCustomers', () => ({
  useCustomers: () => ({ customers, save, loading: false, remove: vi.fn(), reload: vi.fn() }),
}))

vi.mock('../customers/useAddresses', () => ({
  useAddresses: () => ({ addresses: [], loading: false }),
}))

function Wrapper({ customerId }: { customerId: string | null }) {
  const methods = useForm<OrderFormValues>({
    defaultValues: {
      customer_id: customerId,
      fulfillment_type: 'pickup',
      needed_date: null,
      bake_date: null,
      pickup_place: null,
      pickup_time: null,
      ship_recipient_name: null,
      ship_recipient_phone: null,
      ship_address_text: null,
      shipping_fee: 0,
      discount_type: 'none',
      discount_value: 0,
      note: null,
      items: [],
    },
  })
  return (
    <FormProvider {...methods}>
      <Step1Customer />
    </FormProvider>
  )
}

describe('ขั้นตอนเลือก/สร้างลูกค้าในฟอร์มออเดอร์', () => {
  it('สร้างลูกค้าใหม่ ปุ่มบันทึกกดไม่ได้จนกว่าจะกรอกทั้งชื่อและอีเมล', async () => {
    render(<Wrapper customerId={null} />)
    await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มลูกค้าใหม่' }))

    const saveButton = screen.getByRole('button', { name: 'บันทึกลูกค้าใหม่' })
    expect(saveButton).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText('ชื่อลูกค้า'), 'ลูกค้าทดสอบ')
    expect(saveButton).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText(/อีเมล/), 'test@example.com')
    expect(saveButton).toBeEnabled()

    await userEvent.click(saveButton)
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'ลูกค้าทดสอบ', email: 'test@example.com' }))
  })

  it('เลือกลูกค้าที่ไม่มีอีเมล ขึ้นเตือนให้กรอกอีเมลก่อน', async () => {
    render(<Wrapper customerId="c2" />)
    expect(screen.getByText(/ยังไม่มีอีเมล \(จำเป็นสำหรับแจ้งเตือนออเดอร์\)/)).toBeInTheDocument()
  })

  it('เลือกลูกค้าที่มีอีเมลแล้ว ไม่ขึ้นเตือน แสดงอีเมลเฉยๆ', async () => {
    render(<Wrapper customerId="c1" />)
    expect(screen.getByText(/has-email@example\.com/)).toBeInTheDocument()
    expect(screen.queryByText(/จำเป็นสำหรับแจ้งเตือนออเดอร์/)).not.toBeInTheDocument()
  })
})
