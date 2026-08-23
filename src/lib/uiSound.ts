let audioCtx: AudioContext | null = null

/** เตรียม AudioContext ที่ใช้ร่วมกันของทุกเสียงในไฟล์นี้ — ต้องเรียกแบบ synchronous ใน click handler เสมอ
 * (ไม่ใช่หลัง await) เพราะ iOS Safari ต้องมี user gesture อยู่ใน call stack เดียวกันตอนสร้าง/resume ครั้งแรก
 * ไม่งั้นจะโดนบล็อกเสียงเงียบๆ (บทเรียนเดียวกับ speakThai.ts ในระบบนี้) */
function getAudioContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) audioCtx = new Ctor()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

/** เสียงติ๊กสั้นๆ ตอนกดเพิ่มสินค้าลงตะกร้า สังเคราะห์เองไม่ต้องโหลดไฟล์เสียง */
export function playAddSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch {
    // เบราว์เซอร์ไม่รองรับ Web Audio หรือถูกบล็อก — เงียบไปเฉยๆ ไม่ทำให้แอปพัง
  }
}

/** เสียง "ชิงชิง~" สามโน้ตไล่ระดับขึ้น ตอนกดยืนยันรับเงิน/ยืนยันชำระเงินสำเร็จ ให้ความรู้สึกเหมือนเก็บเงินเข้า
 * เครื่องคิดเงินจริง — เรียกเป็นบรรทัดแรกสุดของ handler เสมอ (ก่อน await ใดๆ) ด้วยเหตุผลเดียวกับ playAddSound */
export function playPaymentSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const notes = [1046.5, 1318.5, 1568] // C6, E6, G6 — อาร์เพจโจสดใสให้ความรู้สึกเก็บเงินสำเร็จ
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.09
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0.001, start)
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.35)
    })
  } catch {
    // เหมือน playAddSound — เงียบไปเฉยๆ ไม่ทำให้แอปพัง
  }
}
