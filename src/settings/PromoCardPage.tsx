import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as htmlToImage from 'html-to-image'
import QRCode from 'qrcode'
import { useSettings } from './useSettings'
import { productImageUrl } from '../products/ProductCard'

export function PromoCardPage() {
  const { settings, loading } = useSettings()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!settings?.line_url) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(settings.line_url, { width: 200, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [settings?.line_url])

  async function handleDownload() {
    if (!cardRef.current || !settings) return
    setDownloading(true)
    const dataUrl = await htmlToImage.toPng(cardRef.current, { pixelRatio: 2 })
    setDownloading(false)
    const link = document.createElement('a')
    link.download = `${settings.shop_name}-promo.png`
    link.href = dataUrl
    link.click()
  }

  if (loading || !settings) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าตั้งค่า
      </Link>
      <div>
        <h1 className="text-lg font-semibold">การ์ดโปรโมทร้าน</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          ดาวน์โหลดรูปนี้ไปโพสต์โซเชียล หรือพิมพ์ติดหน้าร้าน ให้ลูกค้าใหม่สแกนแอดไลน์สั่งซื้อได้เลย
        </p>
      </div>

      {!settings.line_url && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ยังไม่ได้ตั้งค่าลิงก์ไลน์ร้านไว้ ไปตั้งค่าที่หน้า "ตั้งค่า" ก่อน ถึงจะมี QR ให้สแกนแอดไลน์ในการ์ดได้
        </p>
      )}

      <div
        ref={cardRef}
        className="rounded-2xl p-8 text-center space-y-4"
        style={{ background: 'linear-gradient(160deg, #3d2b1f, #6b4a35)', color: '#fbf1e4' }}
      >
        {settings.logo_path && (
          <img
            src={productImageUrl(settings.logo_path)}
            alt=""
            className="w-20 h-20 rounded-full mx-auto object-cover border-2"
            style={{ borderColor: 'rgba(255,255,255,0.4)' }}
          />
        )}
        <div>
          <p className="text-2xl font-bold">{settings.shop_name}</p>
          <p className="text-sm mt-1" style={{ opacity: 0.8 }}>
            เบเกอรี่โฮมเมด สั่งง่าย ได้ของสด
          </p>
        </div>
        {qrDataUrl && (
          <div className="bg-white rounded-xl p-3 inline-block">
            <img src={qrDataUrl} alt="QR แอดไลน์" width={160} height={160} />
          </div>
        )}
        {settings.line_url && <p className="text-sm font-medium">📱 สแกนเพื่อแอดไลน์สั่งซื้อ</p>}
        {settings.phone && (
          <p className="text-xs" style={{ opacity: 0.7 }}>
            โทร {settings.phone}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-50"
      >
        {downloading ? 'กำลังสร้างรูป...' : '💾 ดาวน์โหลดเป็นรูปภาพ'}
      </button>
    </div>
  )
}
