export type SaveImageResult = 'shared' | 'downloaded' | 'cancelled'

/** แปลง data URL เป็น Blob ตรงๆ ด้วย atob ไม่ใช้ fetch(dataUrl) เพราะ CSP (connect-src ใน public/_headers) อาจบล็อก */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',')
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * บันทึกรูปลงเครื่องผู้ใช้ให้ได้จริงทุกอุปกรณ์ — ลิงก์ <a download href="data:..."> แบบเดิมใช้ไม่ได้บนมือถือส่วนใหญ่
 * (iPhone Safari ไม่รองรับ และเบราว์เซอร์ในแอปอย่าง LINE/Facebook ปิดการดาวน์โหลดไว้) ลำดับที่ลอง:
 *   1) Web Share API แบบแนบไฟล์ — มือถือเปิดหน้าต่างแชร์ของเครื่องที่มีปุ่ม "บันทึกรูปภาพ" ให้เลย
 *   2) ดาวน์โหลดผ่าน blob URL — ใช้ได้บนคอมพิวเตอร์/Android Chrome
 * คืน 'downloaded' เมื่อไม่รู้ว่าเครื่องเซฟให้จริงไหม (ให้หน้าที่เรียกโชว์คำแนะนำสำรอง "กดค้างที่รูป")
 */
export async function saveImage(blob: Blob, filename: string, shareTitle?: string): Promise<SaveImageResult> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })

  if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareTitle ?? filename })
      return 'shared'
    } catch (e) {
      // ผู้ใช้กดปิดหน้าต่างแชร์เอง = ไม่ใช่ข้อผิดพลาด ไม่ต้องลองวิธีสำรองต่อ
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // อย่างอื่น (เช่น NotAllowedError เพราะรอนานเกินจนหมดสิทธิ์ user gesture) ตกไปใช้วิธีดาวน์โหลดแทน
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
