import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { generatePromptPayPayload } from '../lib/promptpay'
import { formatBaht } from '../lib/money'
import { saveImage } from '../lib/saveImage'

/** วาดการ์ด QR ความละเอียดสูง (พื้นขาว+หัวข้อ+ยอดเงิน) ไว้สำหรับบันทึกลงเครื่อง — แอปธนาคารสแกนจากแกลเลอรีได้ชัด
 * และเห็นยอดในรูปเลย ต่างจากรูป QR เล็กๆ 240px ที่แสดงบนหน้าเว็บ */
async function renderQrCard(payload: string, amount: number): Promise<Blob> {
  const qrUrl = await QRCode.toDataURL(payload, { width: 600, margin: 1 })
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('โหลดรูป QR ไม่สำเร็จ'))
    img.src = qrUrl
  })

  const W = 720
  const H = 920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('สร้างรูปไม่สำเร็จ')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#1c1917'
  ctx.font = '700 40px sans-serif'
  ctx.fillText('สแกนเพื่อชำระเงิน', W / 2, 80)
  ctx.fillStyle = '#78716c'
  ctx.font = '400 28px sans-serif'
  ctx.fillText('พร้อมเพย์ (PromptPay)', W / 2, 125)
  ctx.drawImage(img, 60, 160, 600, 600)
  ctx.fillStyle = '#1c1917'
  ctx.font = '700 64px sans-serif'
  ctx.fillText(`${formatBaht(amount)} บาท`, W / 2, 850)
  ctx.fillStyle = '#a8a29e'
  ctx.font = '400 24px sans-serif'
  ctx.fillText('ยอดถูกล็อกไว้ในตัว QR แล้ว', W / 2, 895)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png')
  })
}

/** QR พร้อมเพย์ล็อกยอดเงิน — สแกนแล้วแอปธนาคารกรอกยอดให้อัตโนมัติ แก้ไขเองไม่ได้ */
export function PromptPayQR({ promptpayId, amount }: { promptpayId: string; amount: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    let cancelled = false
    const payload = generatePromptPayPayload(promptpayId, amount)
    QRCode.toDataURL(payload, { width: 480, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => { cancelled = true }
  }, [promptpayId, amount])

  async function handleSave() {
    setSaving(true)
    setHint(false)
    try {
      const blob = await renderQrCard(generatePromptPayPayload(promptpayId, amount), amount)
      const result = await saveImage(blob, 'promptpay-qr.png', 'QR พร้อมเพย์')
      // เครื่องที่ไม่มีหน้าต่างแชร์ (เช่นเบราว์เซอร์ในแอปบางตัว) เราไม่รู้ว่าไฟล์ถูกเซฟจริงไหม โชว์วิธีสำรองไว้ก่อนเสมอ
      if (result === 'downloaded') setHint(true)
    } catch {
      setHint(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {dataUrl ? (
        <img src={dataUrl} alt="QR พร้อมเพย์" width={240} height={240} className="rounded-xl border border-stone-200" />
      ) : (
        <div className="w-[240px] h-[240px] rounded-xl border border-stone-200 grid place-items-center text-sm text-stone-400">
          กำลังสร้าง QR...
        </div>
      )}
      <p className="text-sm text-stone-500">สแกนเพื่อชำระ</p>
      <p className="text-2xl font-bold text-stone-900">{formatBaht(amount)} บาท</p>
      <p className="text-xs text-stone-400">ยอดถูกล็อกไว้ในตัว QR แล้ว แก้ไขไม่ได้</p>
      {dataUrl && (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="mt-1 text-sm rounded-full border border-stone-300 bg-white text-stone-700 px-4 py-2 font-medium shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          {saving ? 'กำลังสร้างรูป...' : '💾 บันทึก QR ไว้ในเครื่อง'}
        </button>
      )}
      {hint && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center animate-form-in">
          💡 ถ้าเครื่องไม่ได้บันทึกให้ กดค้างที่รูป QR ด้านบน แล้วเลือก "บันทึกรูปภาพ" (หรือ "เพิ่มลงในรูปภาพ") ได้เลย
        </p>
      )}
    </div>
  )
}
