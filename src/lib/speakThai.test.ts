import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { speakThai } from './speakThai'

const synthesizeThaiSpeech = vi.fn()
vi.mock('./ttsApi', () => ({
  synthesizeThaiSpeech: (...args: unknown[]) => synthesizeThaiSpeech(...args),
}))

class FakeUtterance {
  text: string
  lang = ''
  voice: unknown = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

describe('speakThai — เสียงจากเซิร์ฟเวอร์ (Google Cloud TTS) เป็นทางหลัก', () => {
  const play = vi.fn()
  const pause = vi.fn()
  const originalAudio = window.Audio

  beforeEach(() => {
    synthesizeThaiSpeech.mockReset()
    play.mockReset().mockResolvedValue(undefined)
    pause.mockReset()
    window.Audio = vi.fn(function (this: { src?: string; play: typeof play; pause: typeof pause }, src?: string) {
      this.src = src
      this.play = play
      this.pause = pause
    }) as unknown as typeof Audio
  })

  afterEach(() => {
    window.Audio = originalAudio
  })

  it('เรียกเซิร์ฟเวอร์สำเร็จ เล่นเสียง MP3 ที่ได้มาแทนที่จะใช้เสียงในเครื่อง', async () => {
    synthesizeThaiSpeech.mockResolvedValue({ audioContent: 'ZmFrZS1hdWRpbw==', error: null })
    await speakThai('เงินทอน 40 บาท')
    expect(synthesizeThaiSpeech).toHaveBeenCalledWith('เงินทอน 40 บาท')
    expect(window.Audio).toHaveBeenCalledWith('data:audio/mp3;base64,ZmFrZS1hdWRpbw==')
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('เล่นเสียงใหม่ทับเสียงเก่า หยุดเสียงที่เล่นค้างอยู่ก่อนเสมอ', async () => {
    synthesizeThaiSpeech.mockResolvedValue({ audioContent: 'ZmFrZQ==', error: null })
    await speakThai('รับมาพอดี')
    const pauseCallsBefore = pause.mock.calls.length
    await speakThai('เงินทอน 5 บาท')
    expect(pause.mock.calls.length).toBeGreaterThan(pauseCallsBefore)
  })
})

describe('speakThai — fallback เสียงในเครื่องเมื่อเรียกเซิร์ฟเวอร์ไม่สำเร็จ', () => {
  const speak = vi.fn()
  const cancel = vi.fn()
  const addEventListener = vi.fn()
  let getVoices: ReturnType<typeof vi.fn>
  const originalUtterance = window.SpeechSynthesisUtterance
  const originalSynthesis = window.speechSynthesis

  beforeEach(() => {
    synthesizeThaiSpeech.mockReset().mockResolvedValue({ audioContent: null, error: 'ยังไม่ได้ตั้งค่า API key' })
    speak.mockReset()
    cancel.mockReset()
    addEventListener.mockReset()
    getVoices = vi.fn().mockReturnValue([])
    window.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance
    window.speechSynthesis = { speak, cancel, getVoices, addEventListener } as unknown as SpeechSynthesis
  })

  afterEach(() => {
    window.SpeechSynthesisUtterance = originalUtterance
    window.speechSynthesis = originalSynthesis
  })

  it('เซิร์ฟเวอร์เรียกไม่สำเร็จ (ยังไม่ตั้งค่า API key) ใช้เสียงในเครื่องแทน มีเสียงไทยติดตั้งอยู่ เลือกเสียงไทยมาใช้', async () => {
    const thaiVoice = { lang: 'th-TH', name: 'Kanya' }
    getVoices.mockReturnValue([{ lang: 'en-US', name: 'Samantha' }, thaiVoice])

    await speakThai('เงินทอน 45 บาท')

    expect(speak).toHaveBeenCalledTimes(1)
    const spoken = speak.mock.calls[0][0] as FakeUtterance
    expect(spoken.text).toBe('เงินทอน 45 บาท')
    expect(spoken.lang).toBe('th-TH')
    expect(spoken.voice).toBe(thaiVoice)
  })

  it('ไม่มีเสียงไทยในเครื่องเลย ยังพูดได้ (แค่ไม่มี voice ไทยให้เลือก) lang ยังตั้งเป็น th-TH', async () => {
    getVoices.mockReturnValue([{ lang: 'en-US', name: 'Samantha' }])
    await speakThai('รับมาพอดี')
    const spoken = speak.mock.calls[0][0] as FakeUtterance
    expect(spoken.lang).toBe('th-TH')
    expect(spoken.voice).toBeNull()
  })

  it('รายชื่อเสียงยังโหลดไม่เสร็จ (getVoices ว่างตอนแรก) รอ voiceschanged แล้วค่อยพูดด้วยเสียงไทยที่เพิ่งโหลดมา', async () => {
    const handlers: { onVoicesChanged?: () => void } = {}
    addEventListener.mockImplementation((event: string, handler: () => void) => {
      if (event === 'voiceschanged') handlers.onVoicesChanged = handler
    })
    const thaiVoice = { lang: 'th-TH', name: 'Kanya' }
    getVoices.mockReturnValueOnce([]).mockReturnValue([thaiVoice])

    await speakThai('เงินทอน 20 บาท')
    expect(speak).not.toHaveBeenCalled()

    handlers.onVoicesChanged?.()
    expect(speak).toHaveBeenCalledTimes(1)
    const spoken = speak.mock.calls[0][0] as FakeUtterance
    expect(spoken.voice).toBe(thaiVoice)
  })

  it('เคลียร์คิวเก่าด้วย cancel() ก่อนพูดทุกครั้ง กัน Safari ค้างสถานะ speaking แล้วเงียบเสียงทิ้ง', async () => {
    getVoices.mockReturnValue([{ lang: 'th-TH', name: 'Kanya' }])
    await speakThai('เงินทอน 5 บาท')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(speak.mock.invocationCallOrder[0])
  })

  it('เรียกเซิร์ฟเวอร์ throw ตรงๆ (เช่นเน็ตหลุด) ก็ยัง fallback ไปใช้เสียงในเครื่องได้ ไม่พัง', async () => {
    synthesizeThaiSpeech.mockReset().mockRejectedValue(new Error('network error'))
    getVoices.mockReturnValue([{ lang: 'th-TH', name: 'Kanya' }])
    await expect(speakThai('เงินทอน 10 บาท')).resolves.toBeUndefined()
    expect(speak).toHaveBeenCalledTimes(1)
  })

  it('ไม่มี window.speechSynthesis เลย (เบราว์เซอร์เก่า) ไม่พัง', async () => {
    // @ts-expect-error จำลองเบราว์เซอร์ที่ไม่มี API นี้เลย
    window.speechSynthesis = undefined
    await expect(speakThai('เงินทอน 10 บาท')).resolves.toBeUndefined()
  })
})
