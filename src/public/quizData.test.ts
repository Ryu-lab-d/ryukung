import { describe, it, expect } from 'vitest'
import { PASS_SCORE, QUIZ_LEVELS, TOTAL_QUESTIONS, rankFor } from './quizData'

describe('คลังคำถามทดสอบความรู้เบเกอรี่', () => {
  it('มีอย่างน้อย 50 ข้อ แบ่ง 6 ด่านด่านละ 10 ข้อ', () => {
    expect(QUIZ_LEVELS).toHaveLength(6)
    expect(TOTAL_QUESTIONS).toBeGreaterThanOrEqual(50)
    for (const level of QUIZ_LEVELS) expect(level.questions).toHaveLength(10)
    expect(PASS_SCORE).toBeLessThanOrEqual(10)
  })

  it('ทุกข้อมีตัวเลือก 4 ข้อไม่ซ้ำกัน คำตอบถูกไม่ซ้ำกับตัวเลือกผิด และมีคำอธิบาย', () => {
    const seen = new Set<string>()
    for (const level of QUIZ_LEVELS) {
      for (const q of level.questions) {
        expect(q.q.trim()).not.toBe('')
        expect(q.why.trim()).not.toBe('')
        const options = [q.a, ...q.wrong]
        expect(new Set(options).size).toBe(4)
        for (const o of options) expect(o.trim()).not.toBe('')
        expect(seen.has(q.q)).toBe(false)
        seen.add(q.q)
      }
    }
  })

  it('ยศตามจำนวนด่านที่ผ่าน', () => {
    expect(rankFor(0).name).toBe('มือใหม่หัดอบ')
    expect(rankFor(1).name).toBe('พอได้')
    expect(rankFor(6).name).toBe('เทพเจ้า')
    expect(rankFor(99).name).toBe('เทพเจ้า')
  })
})
