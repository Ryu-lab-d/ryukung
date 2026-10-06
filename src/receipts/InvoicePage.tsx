import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import * as htmlToImage from 'html-to-image'
import { saveImage } from '../lib/saveImage'
import { thaiBahtText } from '../lib/thaiBahtText'
import { formatBaht } from '../lib/money'
import { useOrder } from '../orders/useOrder'
import { useSettings } from '../settings/useSettings'
import { productImageUrl } from '../products/ProductCard'
import { stageLabel } from '../orders/workStatus'
import { Barcode128 } from './Barcode128'
import { ShopStamp } from './ShopStamp'

const SHEET_WIDTH = 794 // A4 กว้างที่ 96dpi

const FULFILLMENT: Record<string, string> = {
  pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง',
}
const PAYMENT: Record<string, string> = { unpaid: 'ยังไม่ชำระเงิน', partial: 'ชำระมัดจำแล้ว', paid: 'ชำระเงินครบถ้วน' }
const METHOD: Record<string, string> = { transfer: 'โอนเงิน', promptpay: 'พร้อมเพย์', cash: 'เงินสด', cod: 'เก็บเงินปลายทาง', other: 'อื่นๆ' }

const dateTH = (d: Date | string | null | undefined, long = true) => {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d) : d
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' })
}
const timeTH = (d: Date | string) =>
  new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'

/**
 * เอกสาร Invoice / ใบสรุปคำสั่งซื้อแบบทางการ ขนาด A4 ขาว-ดำล้วน — โลโก้ ร้าน บาร์โค้ดเลขออเดอร์ (+ QR ติดตามสถานะ)
 * วันที่ออกเอกสาร/วันที่สั่ง/วันที่ต้องได้รับของ/เวลานัด ข้อมูลลูกค้าและการรับของครบ รายการสินค้า สรุปยอดพร้อมตัวอักษรไทย
 * ประวัติการชำระเงิน ช่องลงนาม และตราประทับร้าน — สร้างสดจากข้อมูลออเดอร์ ณ ตอนเปิด ไม่ได้บันทึกเป็นเอกสารแยกในฐานข้อมูล
 */
export function InvoicePage() {
  const { id } = useParams()
  const { order, items, payments, loading } = useOrder(id ?? null)
  const { settings } = useSettings()
  const sheetRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [qr, setQr] = useState<string | null>(null)
  const [issuedAt] = useState(() => new Date())

  const trackUrl = order?.public_token ? `${window.location.origin}/o/${order.public_token}` : null

  useEffect(() => {
    if (!trackUrl) return
    void QRCode.toDataURL(trackUrl, { margin: 0, width: 220, color: { dark: '#000000', light: '#ffffff' } }).then(setQr)
  }, [trackUrl])

  // ย่อกระดาษ A4 ให้พอดีหน้าจอมือถือ (ตอนพิมพ์/บันทึกรูปใช้ขนาดจริงเสมอ)
  useLayoutEffect(() => {
    function fit() {
      const w = frameRef.current?.parentElement?.clientWidth ?? window.innerWidth
      setScale(Math.min(1, (w - 8) / SHEET_WIDTH))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [loading])

  async function handleSavePng() {
    if (!sheetRef.current) return
    const blob = await htmlToImage.toBlob(sheetRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
    if (!blob) return
    await saveImage(blob, `INVOICE-${order?.order_no ?? 'order'}.png`, 'Invoice')
  }

  if (loading || !order || !settings) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด...
        </div>
      </div>
    )
  }

  const paid = payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const grand = Number(order.grand_total)
  const balance = grand - paid
  const orderNo: string = order.order_no ?? '-'
  const isPickup = order.fulfillment_type === 'pickup'
  const stampStatus = balance <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'ISSUED'

  const cell = 'border border-black px-2.5 py-1.5'
  const label = 'text-[11px] font-semibold tracking-wide'

  return (
    <div className="invoice-page bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-5xl mx-auto pb-10 no-print">
        <Link
          to={`/orders/${id}`}
          className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
        >
          ← กลับหน้าออเดอร์นี้
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-full bg-stone-900 text-white px-5 py-2.5 text-sm font-semibold">
            🖨️ พิมพ์ / บันทึกเป็น PDF
          </button>
          <button type="button" onClick={() => void handleSavePng()} className="rounded-full bg-white border border-stone-300 text-stone-700 px-5 py-2.5 text-sm font-semibold">
            🖼️ บันทึกเป็นรูป
          </button>
          <p className="text-xs text-stone-500">เอกสารขาว-ดำ ขนาด A4 · ตอนพิมพ์เลือก "ขนาดจริง / 100%" และปิดหัวท้ายกระดาษของเบราว์เซอร์</p>
        </div>
      </div>

      {/* กรอบย่อขนาดบนจอ — ตัวกระดาษจริงอยู่ข้างใน ขนาด 794px เสมอ */}
      <div className="px-2 pb-10 overflow-hidden">
        <div ref={frameRef} className="invoice-frame mx-auto" style={{ width: SHEET_WIDTH * scale, height: 1123 * scale }}>
          <div style={{ width: SHEET_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div
              ref={sheetRef}
              id="invoice-print-area"
              className="relative bg-white text-black font-warm shadow-[0_10px_40px_-12px_rgb(0_0_0_/_0.35)]"
              style={{ width: SHEET_WIDTH, minHeight: 1123, padding: '40px 44px', fontSize: 13, lineHeight: 1.45, filter: 'grayscale(1)' }}
            >
              {/* หัวเอกสาร */}
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-3.5 min-w-0">
                  {settings.logo_path && (
                    <img
                      src={productImageUrl(settings.logo_path)}
                      alt=""
                      crossOrigin="anonymous"
                      className="h-[72px] w-[72px] shrink-0 rounded-full object-cover border-2 border-black"
                      style={{ filter: 'grayscale(1) contrast(1.35)' }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[22px] font-extrabold leading-tight">{settings.shop_name}</p>
                    {settings.address && <p className="text-[12px] mt-0.5 whitespace-pre-line">{settings.address}</p>}
                    {settings.phone && <p className="text-[12px]">โทร. {settings.phone}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[26px] font-extrabold leading-none tracking-wide">ใบสรุปคำสั่งซื้อ</p>
                  <p className="text-[15px] font-bold tracking-[0.35em] mt-1">INVOICE</p>
                  <p className="text-[11px] mt-2">เลขที่เอกสาร <span className="font-mono font-bold">INV-{orderNo}</span></p>
                  <p className="text-[11px]">วันที่ออกเอกสาร {dateTH(issuedAt)} {timeTH(issuedAt)}</p>
                </div>
              </div>

              <div className="border-t-[3px] border-black mt-4" />
              <div className="border-t border-black mt-[3px]" />

              {/* บาร์โค้ด + QR ติดตามออเดอร์ */}
              <div className="flex items-center justify-between gap-6 mt-4 border border-black px-4 py-3">
                <div>
                  <p className={label}>เลขที่ออเดอร์ / ORDER NO. (สแกนบาร์โค้ดเพื่อค้นหาออเดอร์)</p>
                  <div className="mt-1.5"><Barcode128 value={orderNo} /></div>
                </div>
                {qr && (
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-[11px] leading-snug">
                      <p className="font-bold">สแกนเพื่อติดตามสถานะออเดอร์</p>
                      <p>SCAN TO TRACK YOUR ORDER</p>
                    </div>
                    <img src={qr} alt="QR ติดตามออเดอร์" className="h-[84px] w-[84px] border border-black p-[3px]" />
                  </div>
                )}
              </div>

              {/* วันที่สำคัญ */}
              <table className="w-full border-collapse mt-4 text-[12px]">
                <tbody>
                  <tr>
                    <td className={cell + ' w-1/4'}><p className={label}>วันที่สั่งซื้อ</p><p className="font-bold">{dateTH(order.created_at)}</p><p>{timeTH(order.created_at)}</p></td>
                    <td className={cell + ' w-1/4'}><p className={label}>วันที่ต้องได้รับสินค้า</p><p className="font-bold">{dateTH(order.needed_date)}</p></td>
                    <td className={cell + ' w-1/4'}><p className={label}>{isPickup ? 'เวลานัดรับ' : 'ช่วงเวลา'}</p><p className="font-bold">{isPickup ? (order.pickup_time || 'ไม่ระบุ') : 'ตามขนส่ง'}</p></td>
                    <td className={cell + ' w-1/4'}><p className={label}>วันที่ออกเอกสาร</p><p className="font-bold">{dateTH(issuedAt)}</p><p>{timeTH(issuedAt)}</p></td>
                  </tr>
                </tbody>
              </table>

              {/* ลูกค้า + การรับสินค้า */}
              <div className="grid grid-cols-2 mt-4 text-[12px]">
                <div className="border border-black px-3 py-2.5">
                  <p className="text-[12px] font-extrabold border-b border-black pb-1 mb-1.5">ข้อมูลผู้สั่งซื้อ / CUSTOMER</p>
                  <p><b>ชื่อ:</b> {order.customers?.name ?? '-'}</p>
                  <p><b>โทร:</b> {order.customers?.phone ?? '-'}</p>
                  <p><b>อีเมล:</b> {order.customers?.email ?? '-'}</p>
                </div>
                <div className="border border-black border-l-0 px-3 py-2.5">
                  <p className="text-[12px] font-extrabold border-b border-black pb-1 mb-1.5">การรับสินค้า / DELIVERY</p>
                  <p><b>วิธีรับ:</b> {FULFILLMENT[order.fulfillment_type] ?? order.fulfillment_type}</p>
                  {isPickup ? (
                    <p><b>สถานที่นัดรับ:</b> {order.pickup_place || '-'}</p>
                  ) : (
                    <>
                      <p><b>ผู้รับ:</b> {order.ship_recipient_name ?? '-'} {order.ship_recipient_phone ? `(${order.ship_recipient_phone})` : ''}</p>
                      <p><b>ที่อยู่จัดส่ง:</b> {order.ship_address_text || '-'}</p>
                      {order.tracking_no && <p><b>เลขพัสดุ:</b> {order.tracking_no}{order.carrier ? ` (${order.carrier})` : ''}</p>}
                    </>
                  )}
                  <p><b>สถานะงาน:</b> {order.work_status === 'cancelled' ? 'ยกเลิกแล้ว' : stageLabel(order.fulfillment_type, order.work_status)}</p>
                </div>
              </div>

              {/* รายการสินค้า */}
              <table className="w-full border-collapse mt-4 text-[12.5px]">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="border border-black px-2 py-1.5 w-12 text-center">ลำดับ</th>
                    <th className="border border-black px-2 py-1.5 text-left">รายการสินค้า</th>
                    <th className="border border-black px-2 py-1.5 w-20 text-center">จำนวน</th>
                    <th className="border border-black px-2 py-1.5 w-28 text-right">ราคา/หน่วย</th>
                    <th className="border border-black px-2 py-1.5 w-28 text-right">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, i: number) => (
                    <tr key={it.id}>
                      <td className="border border-black px-2 py-1.5 text-center">{i + 1}</td>
                      <td className="border border-black px-2 py-1.5">{it.product_name}{it.note ? <span className="text-[11px]"> ({it.note})</span> : null}</td>
                      <td className="border border-black px-2 py-1.5 text-center tabular-nums">{it.qty}</td>
                      <td className="border border-black px-2 py-1.5 text-right tabular-nums">{formatBaht(it.unit_price)}</td>
                      <td className="border border-black px-2 py-1.5 text-right tabular-nums">{formatBaht(it.line_total)}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                    <tr key={'e' + i}>
                      <td className="border border-black px-2 py-3">&nbsp;</td><td className="border border-black" /><td className="border border-black" /><td className="border border-black" /><td className="border border-black" />
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* สรุปยอด */}
              <div className="grid grid-cols-[1fr_260px] mt-0 text-[12.5px]">
                <div className="border border-black border-t-0 px-3 py-2.5">
                  <p className={label}>จำนวนเงินตัวอักษร / AMOUNT IN WORDS</p>
                  <p className="font-bold text-[14px] mt-0.5">({thaiBahtText(grand)})</p>
                  <p className="mt-2"><b>สถานะการชำระเงิน:</b> {PAYMENT[order.payment_status] ?? order.payment_status}</p>
                </div>
                <table className="border-collapse w-full">
                  <tbody>
                    <tr><td className={cell + ' border-t-0'}>รวมสินค้า</td><td className={cell + ' border-t-0 text-right tabular-nums'}>{formatBaht(order.items_total)}</td></tr>
                    <tr><td className={cell}>ส่วนลด</td><td className={cell + ' text-right tabular-nums'}>{Number(order.discount_amount ?? 0) > 0 ? '-' : ''}{formatBaht(order.discount_amount ?? 0)}</td></tr>
                    <tr><td className={cell}>ค่าจัดส่ง</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(order.shipping_fee ?? 0)}</td></tr>
                    <tr className="font-extrabold text-[14px] bg-black text-white"><td className={cell}>ยอดรวมสุทธิ</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(grand)}</td></tr>
                    <tr><td className={cell}>ชำระแล้ว</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(paid)}</td></tr>
                    <tr className="font-bold"><td className={cell}>คงเหลือ</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(Math.max(0, balance))}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* ประวัติชำระเงิน */}
              {payments.length > 0 && (
                <div className="mt-4 text-[11.5px]">
                  <p className="font-extrabold mb-1">ประวัติการชำระเงิน / PAYMENT HISTORY</p>
                  <table className="w-full border-collapse">
                    <tbody>
                      {payments.map((p: any) => (
                        <tr key={p.id}>
                          <td className="border border-black px-2 py-1 w-40">{dateTH(p.paid_at, false)} {timeTH(p.paid_at)}</td>
                          <td className="border border-black px-2 py-1">{METHOD[p.method] ?? p.method}</td>
                          <td className="border border-black px-2 py-1 w-28 text-right tabular-nums">{formatBaht(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(order.note || settings.receipt_footer) && (
                <div className="mt-4 text-[11.5px] border border-black px-3 py-2">
                  {order.note && <p><b>หมายเหตุออเดอร์:</b> {order.note}</p>}
                  {settings.receipt_footer && <p className="whitespace-pre-line"><b>หมายเหตุจากร้าน:</b> {settings.receipt_footer}</p>}
                </div>
              )}

              {/* ลงนาม + ตราประทับ */}
              <div className="relative mt-24 grid grid-cols-2 gap-10 text-center text-[12px]">
                <div>
                  <div className="h-16" />
                  <div className="border-t border-black pt-1">ผู้รับสินค้า / RECEIVED BY</div>
                  <p className="text-[11px] mt-0.5">วันที่ ____ / ____ / ________</p>
                </div>
                <div className="relative">
                  <div className="absolute -top-[5.5rem] left-1/2 -translate-x-1/2 pointer-events-none">
                    <ShopStamp shopName={settings.shop_name} statusText={stampStatus} dateText={dateTH(issuedAt, false)} size={150} />
                  </div>
                  <div className="h-16" />
                  <div className="border-t border-black pt-1">ผู้ออกเอกสาร / AUTHORIZED BY</div>
                  <p className="text-[11px] mt-0.5">{settings.shop_name}</p>
                </div>
              </div>

              <p className="mt-6 text-center text-[10px] tracking-wide border-t border-black pt-2">
                เอกสารนี้ออกโดยระบบของร้าน {settings.shop_name} · ตรวจสอบสถานะล่าสุดได้ด้วยการสแกน QR หรือบาร์โค้ดด้านบน
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
