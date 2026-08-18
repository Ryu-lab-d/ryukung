import { describe, it, expect } from 'vitest'
import { categoryOf, autoConversionFactor } from './unitConversion'

describe('categoryOf', () => {
  it('รู้จักหน่วยน้ำหนักทั้งแบบย่อ/เต็ม/อังกฤษ', () => {
    for (const u of ['กรัม', 'ก.', 'g', 'gram', 'กิโลกรัม', 'กก.', 'kg', 'มิลลิกรัม', 'มก.', 'mg', 'ขีด']) {
      expect(categoryOf(u)).toBe('weight')
    }
  })

  it('รู้จักหน่วยปริมาตรทั้งแบบย่อ/เต็ม/อังกฤษ', () => {
    for (const u of ['มิลลิลิตร', 'มล.', 'ml', 'ลิตร', 'ล.', 'l', 'ซีซี', 'cc']) {
      expect(categoryOf(u)).toBe('volume')
    }
  })

  it('รู้จักหน่วยนับชิ้นเดี่ยว', () => {
    for (const u of ['ชิ้น', 'อัน', 'ลูก', 'ฟอง', 'แผ่น', 'ก้อน', 'หน่วย']) {
      expect(categoryOf(u)).toBe('piece')
    }
  })

  it('หน่วยบรรจุภัณฑ์ (ขนาดไม่คงที่) ไม่รู้จัก ถือเป็น unknown เสมอ', () => {
    for (const u of ['แพ็ค', 'ถุง', 'กล่อง', 'ลัง', 'โหล', 'มัด', 'ห่อ']) {
      expect(categoryOf(u)).toBe('unknown')
    }
  })

  it('ไม่สนตัวพิมพ์เล็กใหญ่ของหน่วยภาษาอังกฤษ และช่องว่างหัวท้าย', () => {
    expect(categoryOf('KG')).toBe('weight')
    expect(categoryOf('  ml  ')).toBe('volume')
  })
})

describe('autoConversionFactor', () => {
  it('น้ำหนัก↔น้ำหนัก คำนวณตัวคูณถูกต้อง', () => {
    expect(autoConversionFactor('กรัม', 'กิโลกรัม')).toBeCloseTo(0.001)
    expect(autoConversionFactor('กิโลกรัม', 'กรัม')).toBeCloseTo(1000)
    expect(autoConversionFactor('กรัม', 'ขีด')).toBeCloseTo(0.01) // 1 กรัม = 0.01 ขีด (1 ขีด = 100 กรัม)
    expect(autoConversionFactor('มิลลิกรัม', 'กรัม')).toBeCloseTo(0.001)
  })

  it('ปริมาตร↔ปริมาตร คำนวณตัวคูณถูกต้อง', () => {
    expect(autoConversionFactor('มิลลิลิตร', 'ลิตร')).toBeCloseTo(0.001)
    expect(autoConversionFactor('ลิตร', 'มิลลิลิตร')).toBeCloseTo(1000)
  })

  it('หน่วยเดียวกันเป๊ะ ได้ตัวคูณ 1 เสมอ', () => {
    expect(autoConversionFactor('กรัม', 'กรัม')).toBe(1)
    expect(autoConversionFactor('ลิตร', 'ลิตร')).toBe(1)
  })

  it('หน่วยนับชิ้นเดี่ยวสลับกันเอง ได้ตัวคูณ 1 เสมอ (แค่เปลี่ยนชื่อเรียก จำนวนเท่าเดิม)', () => {
    expect(autoConversionFactor('ชิ้น', 'อัน')).toBe(1)
    expect(autoConversionFactor('ฟอง', 'ลูก')).toBe(1)
  })

  it('ข้ามหมวด (น้ำหนัก→หน่วยนับ, ปริมาตร→น้ำหนัก ฯลฯ) คืน null เสมอ ห้ามเดา', () => {
    expect(autoConversionFactor('กรัม', 'ฟอง')).toBeNull()
    expect(autoConversionFactor('ฟอง', 'กรัม')).toBeNull()
    expect(autoConversionFactor('มิลลิลิตร', 'กรัม')).toBeNull()
    expect(autoConversionFactor('ชิ้น', 'ลิตร')).toBeNull()
  })

  it('หน่วยบรรจุภัณฑ์ที่ขนาดไม่คงที่ (แพ็ค/ถุง/กล่อง) คืน null เสมอ แม้จะสลับกันเองก็ตาม', () => {
    expect(autoConversionFactor('แพ็ค', 'กล่อง')).toBeNull()
    expect(autoConversionFactor('ถุง', 'ถุง')).toBeNull()
    expect(autoConversionFactor('กรัม', 'แพ็ค')).toBeNull()
  })
})
