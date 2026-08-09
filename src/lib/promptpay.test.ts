import { describe, it, expect } from 'vitest'
import { generatePromptPayPayload, crc16 } from './promptpay'

describe('crc16 (CRC-16/CCITT-FALSE)', () => {
  it('ตรงกับค่าอ้างอิงมาตรฐานของอัลกอริทึมนี้', () => {
    // ค่าอ้างอิงที่รู้จักกันทั่วไปของ CRC-16/CCITT-FALSE (init 0xFFFF, poly 0x1021): "123456789" -> 0x29B1
    expect(crc16('123456789')).toBe('29B1')
  })
})

describe('generatePromptPayPayload', () => {
  it('QR แบบ static (ไม่ใส่ยอด) ต้องมี point-of-initiation เป็น "11" ไม่ใช่ "12"', () => {
    const payload = generatePromptPayPayload('0812345678')
    expect(payload.startsWith('000201010211')).toBe(true)
    expect(payload).not.toContain('54') // ไม่ควรมี tag ยอดเงินเลยถ้าเป็น static
  })

  it('QR แบบ dynamic (ใส่ยอด) ต้องมี point-of-initiation เป็น "12" และฝังยอดเงินไว้', () => {
    const payload = generatePromptPayPayload('0812345678', 30)
    expect(payload.startsWith('000201010212')).toBe(true)
    expect(payload).toContain('540530.00') // tag 54, length 05, ค่า "30.00"
  })

  it('แปลงเบอร์มือถือ 0812345678 เป็นรูปแบบ 0066812345678 ฝังอยู่ในบล็อกร้านค้า', () => {
    const payload = generatePromptPayPayload('081-234-5678', 100)
    expect(payload).toContain('01130066812345678') // tag 01 (มือถือ), length 13, ค่า 0066812345678
  })

  it('เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก ใช้ tag 02 ตามที่เป็น ไม่แปลงเป็นเบอร์มือถือ', () => {
    const payload = generatePromptPayPayload('1234567890123', 100)
    expect(payload).toContain('02131234567890123') // tag 02, length 13
  })

  it('ลงท้ายด้วย CRC 4 หลัก hex ต่อจาก "6304" เสมอ และคำนวณซ้ำได้ค่าเดิม (deterministic)', () => {
    const a = generatePromptPayPayload('0812345678', 30)
    const b = generatePromptPayPayload('0812345678', 30)
    expect(a).toBe(b)
    expect(a.endsWith('6304')).toBe(false) // ต้องมี CRC ต่อท้าย ไม่ใช่จบที่ placeholder เฉยๆ
    expect(/6304[0-9A-F]{4}$/.test(a)).toBe(true)
  })

  it('ยอดเงินต่างกัน ต้องได้ payload/CRC ต่างกัน', () => {
    const a = generatePromptPayPayload('0812345678', 30)
    const b = generatePromptPayPayload('0812345678', 50)
    expect(a).not.toBe(b)
  })
})
