import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { generatePromptPayPayload } from '../lib/promptpay'
import { formatBaht } from '../lib/money'

/** QR พร้อมเพย์ล็อกยอดเงิน — สแกนแล้วแอปธนาคารกรอกยอดให้อัตโนมัติ แก้ไขเองไม่ได้ */
export function PromptPayQR({ promptpayId, amount }: { promptpayId: string; amount: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const payload = generatePromptPayPayload(promptpayId, amount)
    QRCode.toDataURL(payload, { width: 240, margin: 1 }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => { cancelled = true }
  }, [promptpayId, amount])

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
        <a
          href={dataUrl}
          download="promptpay-qr.png"
          className="mt-1 text-sm rounded-lg border border-stone-300 text-stone-700 px-3 py-1.5 font-medium"
        >
          💾 บันทึก QR ไว้ในเครื่อง
        </a>
      )}
    </div>
  )
}
