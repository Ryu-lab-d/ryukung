import { describe, it, expect, vi, afterEach } from 'vitest'
import { playAddSound } from './uiSound'

class MockOscillator {
  type = ''
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class MockGain {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn()
}

class MockAudioContext {
  currentTime = 0
  state = 'running'
  resume = vi.fn()
  createOscillator = vi.fn(() => new MockOscillator())
  createGain = vi.fn(() => new MockGain())
  destination = {}
}

describe('playAddSound', () => {
  const originalAudioContext = window.AudioContext

  afterEach(() => {
    window.AudioContext = originalAudioContext
  })

  it('มี AudioContext ในเบราว์เซอร์ เล่นเสียงติ๊กสั้นๆ ได้โดยไม่ throw', () => {
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext
    expect(() => playAddSound()).not.toThrow()
  })

  it('เรียกซ้ำหลายครั้งติดกันไม่ throw (จำลองกดเพิ่มสินค้าหลายชิ้นรัวๆ)', () => {
    window.AudioContext = MockAudioContext as unknown as typeof AudioContext
    expect(() => {
      playAddSound()
      playAddSound()
      playAddSound()
    }).not.toThrow()
  })

  it('ไม่มี AudioContext เลยในเบราว์เซอร์ (เก่ามาก) ไม่ throw แค่เงียบไป', () => {
    // @ts-expect-error จำลองเบราว์เซอร์ที่ไม่รองรับ Web Audio เลย
    window.AudioContext = undefined
    expect(() => playAddSound()).not.toThrow()
  })
})
