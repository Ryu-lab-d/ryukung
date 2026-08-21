/**
 * พูดข้อความภาษาไทยผ่าน Web Speech API — แค่ตั้ง utterance.lang = 'th-TH' อย่างเดียวไม่พอ หลายเครื่อง/เบราว์เซอร์
 * ไม่มีเสียงไทยติดตั้งไว้เป็นค่าเริ่มต้น จะได้เสียงภาษาอังกฤษอ่านคำไทยแทน (ฟังดูเป็นภาษาอังกฤษทั้งที่ตั้ง lang ถูกแล้ว)
 * ต้องหา voice ที่ lang ขึ้นต้นด้วย "th" จากรายชื่อเสียงที่เครื่องมีจริงแล้วเลือกใช้ตรงๆ ถ้ามี — ถ้าเครื่องไม่มีเสียง
 * ไทยติดตั้งไว้เลย (พบบ่อยบน Windows ที่ไม่ได้เพิ่มเสียงไทยใน Settings > Time & Language > Speech) จะยังคงได้
 * เสียงเริ่มต้นของเครื่องอ่านแทน — จุดนี้แก้ด้วยโค้ดฝั่งเว็บไม่ได้ ต้องไปเพิ่มเสียงที่ตัวเครื่องเอง
 *
 * รายชื่อเสียง (getVoices) มักโหลดแบบ async ครั้งแรกที่ใช้ TTS ในเซสชันนั้น (คืนอาเรย์ว่างก่อน) ต้องรอ event
 * "voiceschanged" ก่อนถึงจะมีรายชื่อจริงให้เลือก — ใส่ timeout สำรองไว้ด้วยเผื่อบางเบราว์เซอร์ไม่ยิง event นี้เลย
 *
 * เก็บ utterance ไว้ในตัวแปรระดับโมดูล (ไม่ใช่ตัวแปร local ในฟังก์ชัน) ตั้งใจ — Safari/WebKit (โดยเฉพาะ iOS)
 * มีบั๊กที่รู้จักกันดี: ถ้า SpeechSynthesisUtterance ถูกเก็บขยะ (garbage collect) ทิ้งก่อนเสียงเล่นจบ จะเงียบเสียง
 * ไปเฉยๆ ไม่มี error ให้เห็นเลย เก็บ reference ไว้กันไม่ให้โดนเก็บขยะก่อนพูดจบ
 */
let activeUtterance: SpeechSynthesisUtterance | null = null

export function speakThai(text: string): void {
  const synth = window.speechSynthesis
  if (!synth) return

  let spoken = false
  function doSpeak() {
    if (spoken) return
    spoken = true
    try {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'th-TH'
      const thaiVoice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('th'))
      if (thaiVoice) utterance.voice = thaiVoice
      activeUtterance = utterance
      // ปล่อย reference คืนหลังพูดจบ/error — กันโตค้างไม่จำกัดถ้าเรียกซ้ำหลายรอบ (ขายหลายรายการต่อกัน)
      utterance.onend = () => {
        if (activeUtterance === utterance) activeUtterance = null
      }
      utterance.onerror = utterance.onend
      // เคลียร์คิวเก่าก่อนเสมอ — ถ้า synth ค้างอยู่ในสถานะ speaking จากรอบก่อน (พบได้บน Safari) การ speak()
      // ซ้อนเข้าไปจะถูกเงียบเสียงทิ้งเฉยๆ เช่นกัน
      synth.cancel()
      synth.speak(utterance)
    } catch {
      // เบราว์เซอร์ไม่รองรับ Web Speech API — ข้ามไปเงียบๆ ไม่ทำให้หน้าพัง
    }
  }

  try {
    if (synth.getVoices().length > 0) {
      doSpeak()
    } else {
      synth.addEventListener('voiceschanged', doSpeak, { once: true })
      setTimeout(doSpeak, 300)
    }
  } catch {
    // เบราว์เซอร์ไม่รองรับ Web Speech API — ข้ามไปเงียบๆ
  }
}
