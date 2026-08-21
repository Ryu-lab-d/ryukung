import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumericKeypad } from './NumericKeypad'

describe('NumericKeypad', () => {
  it('ยังไม่กดอะไรเลย จอโชว์ 0', () => {
    render(<NumericKeypad value="" onChange={vi.fn()} />)
    expect(screen.getByTestId('payment-amount-display')).toHaveTextContent('0')
  })

  it('กดตัวเลขสะสมทีละหลัก', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<NumericKeypad value="" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '2' }))
    expect(onChange).toHaveBeenCalledWith('2')

    rerender(<NumericKeypad value="2" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '4' }))
    expect(onChange).toHaveBeenCalledWith('24')
  })

  it('กดจุดทศนิยมซ้ำไม่ได้', async () => {
    const onChange = vi.fn()
    render(<NumericKeypad value="1.5" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '.' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ปุ่มลบตัวเลขล่าสุด', async () => {
    const onChange = vi.fn()
    render(<NumericKeypad value="123" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'ลบตัวเลขล่าสุด' }))
    expect(onChange).toHaveBeenCalledWith('12')
  })

  it('ปุ่ม C ล้างค่าทั้งหมด', async () => {
    const onChange = vi.fn()
    render(<NumericKeypad value="999" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
