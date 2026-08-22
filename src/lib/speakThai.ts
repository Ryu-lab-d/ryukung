import { synthesizeThaiSpeech } from './ttsApi'

let activeAudio: HTMLAudioElement | null = null

/** เล่นเสียง MP3 (base64) ที่ได้จากเซิร์ฟเวอร์ (Google Cloud TTS) — ถูกต้องเหมือนกันทุกเครื่องเสมอ ไม่ต้องพึ่ง
 * ว่าอุปกรณ์ผู้ใช้ติดตั้งเสียงไทยไว้หรือเปล่า */
function playBase64Mp3(base64: string) {
  if (activeAudio) activeAudio.pause()
  const audio = new Audio(`data:audio/mp3;base64,${base64}`)
  activeAudio = audio
  void audio.play().catch(() => {
    // เล่นไม่ได้ (เช่นเบราว์เซอร์บล็อกเสียงอัตโนมัติ) — เงียบไปเฉยๆ ไม่ทำให้หน้าพัง
  })
}

/**
 * เสียงในเครื่อง (Web Speech API) — ใช้เป็น fallback เมื่อเรียกเซิร์ฟเวอร์ไม่สำเร็จเท่านั้น (เช่นยังไม่ได้ตั้ง
 * GOOGLE_TTS_API_KEY หรือเน็ตมีปัญหาชั่วคราว) แค่ตั้ง utterance.lang = 'th-TH' อย่างเดียวไม่พอ หลายเครื่อง
 * (โดยเฉพาะ Windows) ไม่มีเสียงไทยติดตั้งไว้เป็นค่าเริ่มต้น จะได้เสียงภาษาอังกฤษอ่านคำไทยแทน — ต้องหา voice ที่
 * lang ขึ้นต้นด้วย "th" จากรายชื่อเสียงที่เครื่องมีจริงแล้วเลือกใช้ตรงๆ ถ้ามี
 */
function speakThaiLocally(text: string): void {
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

// เก็บ reference ของ utterance ล่าสุดไว้ระดับโมดูล (ไม่ใช่ตัวแปร local) ตั้งใจ — Safari/WebKit (โดยเฉพาะ iOS)
// มีบั๊กที่รู้จักกันดี: ถ้า SpeechSynthesisUtterance ถูกเก็บขยะทิ้งก่อนเสียงเล่นจบ จะเงียบเสียงไปเฉยๆ ไม่มี error
let activeUtterance: SpeechSynthesisUtterance | null = null

/**
 * พูดข้อความภาษาไทย — เรียกเสียงจากเซิร์ฟเวอร์ (Google Cloud TTS) ก่อนเสมอ เพราะได้เสียงไทยถูกต้องเหมือนกัน
 * ทุกเครื่อง (Windows/Mac/iPhone/iPad/Android) ไม่ขึ้นกับว่าเครื่องนั้นติดตั้งเสียงไทยไว้หรือเปล่า — เรียกไม่สำเร็จ
 * (ยังไม่ได้ตั้งค่า API key ฝั่งเซิร์ฟเวอร์ หรือเน็ตมีปัญหาชั่วคราว) ค่อย fallback ไปใช้เสียงในเครื่องแทน
 */
export async function speakThai(text: string): Promise<void> {
  try {
    const { audioContent, error } = await synthesizeThaiSpeech(text)
    if (audioContent && !error) {
      playBase64Mp3(audioContent)
      return
    }
  } catch {
    // เรียกเซิร์ฟเวอร์ไม่สำเร็จ — ไปต่อที่ fallback ด้านล่าง
  }
  speakThaiLocally(text)
}
