import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SuccessOverlay } from './SuccessOverlay'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SuccessOverlay', () => {
  it('แสดงข้อความที่ส่งเข้ามา', () => {
    render(<SuccessOverlay message="คอนเทนต์ถูกบันทึกแล้ว" onDone={vi.fn()} />)
    expect(screen.getByText('คอนเทนต์ถูกบันทึกแล้ว')).toBeInTheDocument()
  })

  it('เรียก onDone อัตโนมัติเมื่อครบเวลาที่กำหนด ไม่ต้องกดอะไรเอง', () => {
    const onDone = vi.fn()
    render(<SuccessOverlay message="สำเร็จ" onDone={onDone} durationMs={1200} />)
    expect(onDone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1199)
    expect(onDone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('ไม่ระบุ durationMs ใช้ค่าเริ่มต้น 2000ms', () => {
    const onDone = vi.fn()
    render(<SuccessOverlay message="สำเร็จ" onDone={onDone} />)
    vi.advanceTimersByTime(1999)
    expect(onDone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
