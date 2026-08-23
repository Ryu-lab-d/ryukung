let audioCtx: AudioContext | null = null

/** เสียงติ๊กสั้นๆ ตอนกดเพิ่มสินค้าลงตะกร้า สังเคราะห์เองไม่ต้องโหลดไฟล์เสียง — ต้องเรียกแบบ synchronous ใน
 * click handler เสมอ (ไม่ใช่หลัง await) เพราะ iOS Safari ต้องมี user gesture อยู่ใน call stack เดียวกันตอน
 * สร้าง AudioContext ครั้งแรก ไม่งั้นจะโดนบล็อกเสียงเงียบๆ (บทเรียนเดียวกับ speakThai.ts ในระบบนี้) */
export function playAddSound(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!audioCtx) audioCtx = new Ctor()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const ctx = audioCtx
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
