import { describe, it, expect } from 'vitest'
import { QUIZ_LEVELS } from './quizData'
import { answerKey, buildCritique, topicOf, topicStats } from './quizCritique'

function allAnswers(fn: (li: number, qi: number) => boolean): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  QUIZ_LEVELS.forEach((lv, li) => lv.questions.forEach((_, qi) => (out[answerKey(li, qi)] = fn(li, qi))))
  return out
}

describe('วิเคราะห์ผลรายหมวดและคำวิจารณ์', () => {
  it('แผนที่หมวดครอบคลุมทุกข้อใน 6 ด่าน และรวมกันได้ 60 ข้อ', () => {
    const stats = topicStats(allAnswers(() => true))
    expect(stats.reduce((s, t) => s + t.total, 0)).toBe(60)
    expect(topicOf(0, 0)).toBe('ingredient')
    expect(topicOf(5, 9)).toBe('science')
  })

  it('ถูกทุกข้อ: คำวิจารณ์ 4 บรรทัด ไม่มีจุดอ่อน', () => {
    const c = buildCritique(allAnswers(() => true))
    expect(c.pct).toBe(100)
    expect(c.lines).toHaveLength(4)
    expect(c.lines[2]).toContain('ไม่มีหัวข้อไหนที่อ่อน')
  })

  it('ถูกเฉพาะหมวดขนมปัง: ชมขนมปัง และแนะนำให้พัฒนาหมวดอื่น', () => {
    const c = buildCritique(allAnswers((li, qi) => topicOf(li, qi) === 'bread'))
    expect(c.lines[1]).toContain('ขนมปังและการหมัก (ถูก 100%)')
    expect(c.lines[2]).toContain('ควรพัฒนาเพิ่มเติมในเรื่อง')
    expect(c.lines[2]).not.toContain('ขนมปังและการหมัก')
    expect(c.lines).toHaveLength(4)
  })

  it('ผิดทุกข้อก็ยังได้คำวิจารณ์ให้กำลังใจ ไม่ error', () => {
    const c = buildCritique(allAnswers(() => false))
    expect(c.pct).toBe(0)
    expect(c.lines.length).toBeGreaterThanOrEqual(3)
    expect(c.lines[3]).toContain('ไม่ต้องท้อ')
  })

  it('ไม่มีคำตอบเลย: ข้อความแจ้งให้เล่นใหม่', () => {
    expect(buildCritique({}).lines[0]).toContain('ยังไม่มีข้อมูลคำตอบ')
  })
})
