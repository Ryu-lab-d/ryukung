/**
 * วิเคราะห์ผลการทดสอบความรู้เบเกอรี่ตาม "หมวดความรู้" แล้วเขียนคำวิจารณ์ภาษาไทย 3–4 บรรทัด (จุดแข็ง/จุดที่ควรพัฒนา/คำแนะนำ)
 * ใช้กติกาตายตัวจากคะแนนรายหมวด ไม่ใช้ AI — ผลเหมือนเดิมเสมอสำหรับคำตอบชุดเดียวกัน และทำงานได้ในเบราว์เซอร์ล้วน
 */
export type TopicKey = 'bread' | 'cake' | 'ingredient' | 'temp' | 'technique' | 'science'

type TopicInfo = { name: string; icon: string; strength: string; advice: string }

export const TOPICS: Record<TopicKey, TopicInfo> = {
  bread: {
    name: 'ขนมปังและการหมัก',
    icon: '🍞',
    strength: 'แสดงว่าคุณเข้าใจเรื่องกลูเตน ยีสต์ และการหมักได้ดี ซึ่งเป็นหัวใจของการทำขนมปัง',
    advice:
      'ลองฝึกชั่งส่วนผสมเป็นกรัมและคิดเป็น baker’s percentage แล้วจดเวลา/อุณหภูมิการหมักทุกครั้งที่ทำ จะเห็นความต่างชัดเจนขึ้น',
  },
  cake: {
    name: 'เค้ก คุกกี้ และขนมอบ',
    icon: '🍰',
    strength: 'แสดงว่าคุณเข้าใจหลักการของเค้ก คุกกี้ และขนมอบนุ่มๆ ว่าทำไมสูตรจึงต้องเป็นแบบนั้น',
    advice:
      'ลองอบสูตรเดิมซ้ำโดยเปลี่ยนตัวแปรทีละอย่าง เช่น อุณหภูมิเนยหรือเวลาพักโดว์ เพื่อดูว่าส่งผลต่อเนื้อและรูปทรงอย่างไร',
  },
  ingredient: {
    name: 'วัตถุดิบ',
    icon: '🥚',
    strength: 'แสดงว่าคุณรู้จักคุณสมบัติของแป้ง เนย ไข่ และน้ำตาลดี จึงเลือกใช้ได้ตรงกับงาน',
    advice:
      'ลองอ่านฉลากแป้งแต่ละชนิด (ปริมาณโปรตีน) และทดลองสลับชนิดไขมัน/น้ำตาลในสูตรง่ายๆ เพื่อเรียนรู้ผลต่อเนื้อสัมผัสและรสชาติ',
  },
  temp: {
    name: 'อุณหภูมิ เครื่องมือ และการตวงวัด',
    icon: '🌡️',
    strength: 'แสดงว่าคุณคุมอุณหภูมิ การตวงวัด และเตาอบได้แม่น ซึ่งช่วยให้ผลงานออกมาสม่ำเสมอ',
    advice:
      'ควรมีเทอร์โมมิเตอร์เตาอบและเครื่องชั่งดิจิทัล แล้วฝึกวัดอุณหภูมิจริงของเตาและตรวจอุณหภูมิภายในขนมก่อนนำออก',
  },
  technique: {
    name: 'เทคนิคขั้นสูง',
    icon: '✨',
    strength: 'แสดงว่าคุณรู้จักเทคนิคเฉพาะทาง เช่น แป้งชั้น เมอแรงค์ และการเทมเปอร์ ในระดับที่น่าประทับใจ',
    advice:
      'เลือกเทคนิคหนึ่งอย่างมาฝึกให้ชำนาญก่อน เช่น ทำเมอแรงค์ให้ได้ยอดแข็งตั้ง หรือพับแป้งชั้นสามพับ แล้วค่อยขยับไปเทคนิคถัดไป',
  },
  science: {
    name: 'วิทยาศาสตร์ขนมอบ',
    icon: '🔬',
    strength: 'แสดงว่าคุณเข้าใจเหตุผลทางวิทยาศาสตร์เบื้องหลังขนมอบ เช่น ปฏิกิริยา Maillard และการเจลาติไนซ์ของสตาร์ช',
    advice:
      'ลองหาอ่านเรื่องสตาร์ช เอนไซม์ และปฏิกิริยา Maillard แล้วเชื่อมกับสิ่งที่เห็นตอนอบจริง จะช่วยแก้ปัญหาขนมได้เป็นระบบมากขึ้น',
  },
}

/** หมวดความรู้ของแต่ละข้อ เรียงตามลำดับเดียวกับ QUIZ_LEVELS[ด่าน].questions[ข้อ] ใน quizData.ts */
const TOPIC_MAP: TopicKey[][] = [
  // ด่าน 1 พอได้
  ['ingredient', 'bread', 'temp', 'ingredient', 'ingredient', 'ingredient', 'temp', 'temp', 'cake', 'cake'],
  // ด่าน 2 โอเค
  ['bread', 'bread', 'cake', 'cake', 'bread', 'bread', 'ingredient', 'cake', 'cake', 'bread'],
  // ด่าน 3 ปานกลาง
  ['bread', 'bread', 'bread', 'science', 'cake', 'bread', 'bread', 'technique', 'cake', 'ingredient'],
  // ด่าน 4 เก่ง
  ['technique', 'bread', 'bread', 'technique', 'cake', 'cake', 'bread', 'bread', 'science', 'temp'],
  // ด่าน 5 เก่งมาก
  ['science', 'technique', 'technique', 'science', 'science', 'temp', 'bread', 'cake', 'ingredient', 'technique'],
  // ด่าน 6 เทพเจ้า
  ['science', 'science', 'science', 'bread', 'bread', 'bread', 'science', 'science', 'bread', 'science'],
]

export function topicOf(levelIdx: number, qIdx: number): TopicKey {
  return TOPIC_MAP[levelIdx]?.[qIdx] ?? 'bread'
}

export function answerKey(levelIdx: number, qIdx: number): string {
  return `${levelIdx}-${qIdx}`
}

export type TopicStat = { key: TopicKey; name: string; icon: string; correct: number; total: number; pct: number }

/** คะแนนรายหมวดจากผลตอบล่าสุดของแต่ละข้อ (key = "ด่าน-ข้อ") — ข้ามหมวดที่ยังไม่มีข้อที่ตอบ */
export function topicStats(answers: Record<string, boolean>): TopicStat[] {
  const acc = new Map<TopicKey, { correct: number; total: number }>()
  TOPIC_MAP.forEach((row, li) =>
    row.forEach((topic, qi) => {
      const v = answers[answerKey(li, qi)]
      if (v === undefined) return
      const cur = acc.get(topic) ?? { correct: 0, total: 0 }
      cur.total += 1
      if (v) cur.correct += 1
      acc.set(topic, cur)
    })
  )
  return [...acc.entries()]
    .map(([key, v]) => ({
      key,
      name: TOPICS[key].name,
      icon: TOPICS[key].icon,
      correct: v.correct,
      total: v.total,
      pct: Math.round((v.correct / v.total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total)
}

export type Critique = { lines: string[]; stats: TopicStat[]; correct: number; total: number; pct: number }

export function buildCritique(answers: Record<string, boolean>): Critique {
  const stats = topicStats(answers)
  const correct = stats.reduce((s, t) => s + t.correct, 0)
  const total = stats.reduce((s, t) => s + t.total, 0)
  const pct = total ? Math.round((correct / total) * 100) : 0
  const lines: string[] = []
  if (total === 0) return { lines: ['ยังไม่มีข้อมูลคำตอบให้วิเคราะห์ ลองเล่นให้ครบทุกด่านอีกครั้งนะ'], stats, correct, total, pct }

  const tier =
    pct >= 90 ? 'ถือว่าเก่งมากเลยทีเดียว' : pct >= 75 ? 'อยู่ในระดับดีเยี่ยม' : pct >= 60 ? 'อยู่ในเกณฑ์ดี และยังพัฒนาต่อได้อีกมาก' : 'ผ่านทุกด่านด้วยความพยายาม ยังมีเรื่องให้เรียนรู้อีกเยอะ'
  lines.push(`ภาพรวม: คุณตอบถูก ${correct} จาก ${total} ข้อ (${pct}%) ${tier}`)

  // จุดแข็ง: หมวดที่คะแนน ≥ 80% (สูงสุด 2 หมวด) ถ้าไม่มีเลยก็ชมหมวดที่ดีที่สุด
  const strong = stats.filter((s) => s.pct >= 80).slice(0, 2)
  const best = strong.length ? strong : stats.slice(0, 1)
  const bestText = best.map((s) => `${s.name} (ถูก ${s.pct}%)`).join(' และ ')
  lines.push(`จุดแข็งของคุณคือ ${bestText} — ${TOPICS[best[0].key].strength}`)

  // จุดที่ควรพัฒนา: หมวดที่คะแนนต่ำสุดและต่ำกว่า 80%
  const weak = [...stats].reverse().filter((s) => s.pct < 80 && !best.some((b) => b.key === s.key)).slice(0, 2)
  if (weak.length) {
    const weakText = weak.map((s) => `${s.name} (ถูก ${s.pct}%)`).join(' และ ')
    lines.push(`ควรพัฒนาเพิ่มเติมในเรื่อง ${weakText} — ${TOPICS[weak[0].key].advice}`)
  } else {
    lines.push('ไม่มีหัวข้อไหนที่อ่อนชัดเจนเลย ทุกหมวดความรู้อยู่ในเกณฑ์ดี ลองท้าทายตัวเองด้วยการเปลี่ยนสูตรและบันทึกผลลัพธ์ดูนะ')
  }

  lines.push(
    pct >= 90
      ? 'คุณพร้อมแล้วสำหรับการสร้างสูตรเป็นของตัวเอง ลองดัดแปลงสูตรและจดบันทึกผล แล้วความรู้นี้จะกลายเป็นฝีมือจริง'
      : pct >= 75
        ? 'ฝึกต่ออีกนิดก็จะแม่นทุกหัวข้อ ลองทบทวนข้อที่พลาดแล้วกลับมาเล่นใหม่เพื่อทำคะแนนให้สูงขึ้น'
        : pct >= 60
          ? 'อ่านคำอธิบายของข้อที่พลาดอีกรอบ แล้วลองลงมือทำจริง ความรู้จะจำได้ดีกว่าอ่านอย่างเดียว'
          : 'ไม่ต้องท้อ ทุกคนเริ่มจากจุดนี้ ลองเล่นด่านที่พลาดซ้ำ และลงมือทำขนมสูตรง่ายๆ ควบคู่ไปด้วย'
  )
  return { lines, stats, correct, total, pct }
}
