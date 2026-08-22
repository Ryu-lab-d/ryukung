import { describe, it, expect, vi, beforeEach } from 'vitest'
import { synthesizeThaiSpeech } from './ttsApi'

const invoke = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}))

beforeEach(() => {
  invoke.mockReset()
})

describe('synthesizeThaiSpeech', () => {
  it('เรียกสำเร็จ คืน audioContent ที่ได้จาก Edge Function', async () => {
    invoke.mockResolvedValue({ data: { audioContent: 'ZmFrZQ==' }, error: null })
    const result = await synthesizeThaiSpeech('เงินทอน 10 บาท')
    expect(invoke).toHaveBeenCalledWith('speak-thai', { body: { text: 'เงินทอน 10 บาท' } })
    expect(result).toEqual({ audioContent: 'ZmFrZQ==', error: null })
  })

  it('Edge Function คืน error (เช่นยังไม่ตั้งค่า API key) ส่ง error กลับไม่มี audioContent', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'ยังไม่ได้ตั้งค่า GOOGLE_TTS_API_KEY' } })
    const result = await synthesizeThaiSpeech('รับมาพอดี')
    expect(result).toEqual({ audioContent: null, error: 'ยังไม่ได้ตั้งค่า GOOGLE_TTS_API_KEY' })
  })
})
