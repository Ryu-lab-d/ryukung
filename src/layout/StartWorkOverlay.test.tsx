import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StartWorkOverlay } from './StartWorkOverlay'

describe('StartWorkOverlay — ป็อปอัพฉลองเริ่มทำงาน', () => {
  it('แสดงข้อความฉลองทันที', () => {
    render(<StartWorkOverlay onDone={() => {}} />)
    expect(screen.getByText('เริ่มทำงานแล้ว!')).toBeInTheDocument()
    expect(screen.getByText('🚀')).toBeInTheDocument()
  })

  it('เรียก onDone หลังผ่านไปสักพักโดยไม่ต้องกดอะไร', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<StartWorkOverlay onDone={onDone} />)
    expect(onDone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1600)
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
