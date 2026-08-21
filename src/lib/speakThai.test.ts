import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { speakThai } from './speakThai'

class FakeUtterance {
  text: string
  lang = ''
  voice: unknown = null
  constructor(text: string) {
    this.text = text
  }
}

describe('speakThai', () => {
  const speak = vi.fn()
  const addEventListener = vi.fn()
  let getVoices: ReturnType<typeof vi.fn>
  const originalUtterance = window.SpeechSynthesisUtterance
  const originalSynthesis = window.speechSynthesis

  beforeEach(() => {
    speak.mockReset()
    addEventListener.mockReset()
    getVoices = vi.fn().mockReturnValue([])
    window.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance
    window.speechSynthesis = { speak, getVoices, addEventListener } as unknown as SpeechSynthesis
  })

  afterEach(() => {
    window.SpeechSynthesisUtterance = originalUtterance
    window.speechSynthesis = originalSynthesis
  })

  it('มีเสียงไทยติดตั้งอยู่ เลือกเสียงไทยมาใช้ตั้งค่า lang เป็น th-TH', () => {
    const thaiVoice = { lang: 'th-TH', name: 'Kanya' }
    const enVoice = { lang: 'en-US', name: 'Samantha' }
    getVoices.mockReturnValue([enVoice, thaiVoice])

    speakThai('เงินทอน 45 บาท')

    expect(speak).toHaveBeenCalledTimes(1)
    const spoken = speak.mock.calls[0][0] as FakeUtterance
    expect(spoken.text).toBe('เงินทอน 45 บาท')
    expect(spoken.lang).toBe('th-TH')
    expect(spoken.voice).toBe(thaiVoice)
  })

  it('ไม่มีเสียงไทยในเครื่องเลย ยังพูดได้ (แค่ไม่มี voice ไทยให้เลือก) lang ยังตั้งเป็น th-TH', () => {
    getVoices.mockReturnValue([{ lang: 'en-US', name: 'Samantha' }])
    speakThai('รับมาพอดี')
    const spoken = speak.mock.calls[0][0] as FakeUtterance
    expect(spoken.lang).toBe('th-TH')
    expect(spoken.voice).toBeNull()
  })

  it('รายชื่อเสียงยังโหลดไม่เสร็จ (getVoices ว่างตอนแรก) รอ voiceschanged แล้วค่อยพูดด้วยเสียงไทยที่เพิ่งโหลดมา', () => {
    const handlers: { onVoicesChanged?: () => void } = {}
    addEventListener.mockImplementation((event: string, handler: () => void) => {
      if (event === 'voiceschanged') handlers.onVoicesChanged = handler
    })
    const thaiVoice = { lang: 'th-TH', name: 'Kanya' }
    getVoices.mockReturnValueOnce([]).mockReturnValue([thaiVoice])

    speakThai('เงินทอน 20 บาท')
    expect(speak).not.toHaveBeenCalled()

    handlers.onVoicesChanged?.()
    expect(speak).toHaveBeenCalledTimes(1)
    const spoken = speak.mock.calls[0][0] as FakeUtterance
    expect(spoken.voice).toBe(thaiVoice)
  })

  it('ไม่มี window.speechSynthesis เลย (เบราว์เซอร์เก่า) ไม่พัง', () => {
    // @ts-expect-error จำลองเบราว์เซอร์ที่ไม่มี API นี้เลย
    window.speechSynthesis = undefined
    expect(() => speakThai('เงินทอน 10 บาท')).not.toThrow()
  })
})
