/**
 * พูดข้อความภาษาไทยผ่าน Web Speech API (เสียงในเครื่องผู้ใช้) — แค่ตั้ง utterance.lang = 'th-TH' อย่างเดียวไม่พอ
 * หลายเครื่อง/เบราว์เซอร์ (โดยเฉพาะ Windows) ไม่มีเสียงไทยติดตั้งไว้เป็นค่าเริ่มต้น จะได้เสียงภาษาอังกฤษอ่านคำไทย
 * แทน (ฟังดูเป็นภาษาอังกฤษทั้งที่ตั้ง lang ถูกแล้ว) — ต้องหา voice ที่ lang ขึ้นต้นด้วย "th" จากรายชื่อเสียงที่
 * เครื่องมีจริงแล้วเลือกใช้ตรงๆ ถ้ามี — **ข้อจำกัดที่แก้ด้วยโค้ดฝั่งเว็บไม่ได้เลย**: ถ้าเครื่องไม่มีเสียงไทยติดตั้ง
 * ไว้จริงๆ (พบบ่อยบน Windows) จะยังได้เสียงเริ่มต้นของเครื่องอ่านแทนอยู่ดี ต้องไปเพิ่มเสียงที่ตัวเครื่องเอง —
 * ทางเลือกที่รับประกันเสียงไทยถูกต้องทุกเครื่องคือใช้บริการแปลงเสียงจากเซิร์ฟเวอร์ (เช่น Google Cloud TTS) แทน
 * แต่ต้องผูกบัตรเครดิตยืนยันตัวตนกับผู้ให้บริการ — ตัดสินใจไม่ใช้ทางนั้น ใช้เสียงในเครื่องแบบนี้ต่อไปแทน
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
