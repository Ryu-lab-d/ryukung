/**
 * พูดข้อความภาษาไทยผ่าน Web Speech API — แค่ตั้ง utterance.lang = 'th-TH' อย่างเดียวไม่พอ หลายเครื่อง/เบราว์เซอร์
 * ไม่มีเสียงไทยติดตั้งไว้เป็นค่าเริ่มต้น จะได้เสียงภาษาอังกฤษอ่านคำไทยแทน (ฟังดูเป็นภาษาอังกฤษทั้งที่ตั้ง lang ถูกแล้ว)
 * ต้องหา voice ที่ lang ขึ้นต้นด้วย "th" จากรายชื่อเสียงที่เครื่องมีจริงแล้วเลือกใช้ตรงๆ ถ้ามี
 *
 * รายชื่อเสียง (getVoices) มักโหลดแบบ async ครั้งแรกที่ใช้ TTS ในเซสชันนั้น (คืนอาเรย์ว่างก่อน) ต้องรอ event
 * "voiceschanged" ก่อนถึงจะมีรายชื่อจริงให้เลือก — ใส่ timeout สำรองไว้ด้วยเผื่อบางเบราว์เซอร์ไม่ยิง event นี้เลย
 */
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
