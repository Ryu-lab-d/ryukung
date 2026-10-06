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
const SHEET_HEIGHT = 1123 // A4 สูงที่ 96dpi

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
 * เอกสาร Invoice / ใบสรุปคำสั่งซื้อแบบทางการ ขนาด A4 หนึ่งหน้า ขาว-ดำล้วน — กรอบคู่ ลายน้ำชื่อร้าน โลโก้ บาร์โค้ดเลขออเดอร์
 * (+ QR ติดตามสถานะ พร้อมข้อความเตือนในวงเล็บว่าหลังจัดส่งสำเร็จติดตามไม่ได้) วันที่ออกเอกสาร/สั่งซื้อ/ต้องได้รับของ/เวลานัด
 * ข้อมูลลูกค้าและการรับของครบ รายการสินค้า สรุปยอดพร้อมตัวอักษรไทย ประวัติชำระเงิน ช่องลงนาม และตราประทับร้าน —
 * สร้างสดจากข้อมูลออเดอร์ ณ ตอนเปิด ไม่ได้บันทึกเป็นเอกสารแยกในฐานข้อมูล
 */
export function InvoicePage() {
  const { id } = useParams()
  const { order, items, payments, loading } = useOrder(id ?? null)
  const { settings } = useSettings()
  const sheetRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [sheetH, setSheetH] = useState(SHEET_HEIGHT)
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

  // กระดาษยืดตามเนื้อหาได้ (ออเดอร์สินค้าเยอะ) — วัดความสูงจริงไว้ให้กรอบย่อบนจอเว้นที่พอดี ไม่ตัดท้ายเอกสาร
  useLayoutEffect(() => {
    if (sheetRef.current) setSheetH(Math.max(SHEET_HEIGHT, sheetRef.current.offsetHeight))
  }, [items.length, payments.length, order, settings, qr])

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

  const cell = 'border border-black px-2 py-1'
  const label = 'text-[10px] font-bold tracking-[0.12em] uppercase'
  const bar = 'bg-black text-white text-[11px] font-extrabold tracking-wider px-2.5 py-1'

  const keyDates: [string, string, string][] = [
    ['วันที่สั่งซื้อ', dateTH(order.created_at, false), timeTH(order.created_at)],
    ['วันที่ต้องได้รับสินค้า', dateTH(order.needed_date, false), ''],
    [isPickup ? 'เวลานัดรับ' : 'การส่ง', isPickup ? order.pickup_time || 'ไม่ระบุ' : 'ตามขนส่ง', ''],
    ['วันที่ออกเอกสาร', dateTH(issuedAt, false), timeTH(issuedAt)],
  ]

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
      <div className="invoice-wrap px-2 pb-10 overflow-hidden">
        <div ref={frameRef} className="invoice-frame mx-auto" style={{ width: SHEET_WIDTH * scale, height: sheetH * scale }}>
          <div style={{ width: SHEET_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div
              ref={sheetRef}
              id="invoice-print-area"
              className="relative overflow-hidden bg-white text-black font-warm shadow-[0_10px_40px_-12px_rgb(0_0_0_/_0.35)]"
              style={{ width: SHEET_WIDTH, minHeight: SHEET_HEIGHT, padding: '34px 40px', fontSize: 12.5, lineHeight: 1.4, filter: 'grayscale(1)' }}
            >
              {/* กรอบคู่รอบกระดาษ + ลายน้ำชื่อร้าน */}
              <div className="pointer-events-none absolute inset-[10px] border-[3px] border-black" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[17px] border border-black" aria-hidden="true" />
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap font-extrabold select-none"
                style={{ transform: 'translate(-50%, -50%) rotate(-28deg)', fontSize: 92, letterSpacing: 6, color: 'rgba(0,0,0,0.045)' }}
                aria-hidden="true"
              >
                {settings.shop_name.toUpperCase()}
              </div>

              <div className="relative">
                {/* หัวเอกสาร */}
                <div className="flex items-stretch justify-between gap-5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {settings.logo_path && (
                      <img
                        src={productImageUrl(settings.logo_path)}
                        alt=""
                        crossOrigin="anonymous"
                        className="h-[78px] w-[78px] shrink-0 rounded-full object-cover border-[3px] border-black"
                        style={{ filter: 'grayscale(1) contrast(1.35)' }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-[24px] font-extrabold leading-tight tracking-wide">{settings.shop_name}</p>
                      {settings.address && <p className="text-[11.5px] mt-0.5 whitespace-pre-line leading-snug">{settings.address}</p>}
                      {settings.phone && <p className="text-[11.5px]">โทร. {settings.phone}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 w-[250px] border-2 border-black">
                    <div className="bg-black text-white text-center py-1.5">
                      <p className="text-[26px] font-extrabold leading-none tracking-[0.4em] pl-[0.4em]">INVOICE</p>
                      <p className="text-[12px] mt-0.5 tracking-wider">ใบสรุปคำสั่งซื้อ</p>
                    </div>
                    <div className="px-2.5 py-1.5 text-[11px] leading-snug">
                      <p className="flex justify-between"><span>เลขที่เอกสาร</span><b className="font-mono">INV-{orderNo}</b></p>
                      <p className="flex justify-between"><span>วันที่ออกเอกสาร</span><b>{dateTH(issuedAt, false)}</b></p>
                      <p className="flex justify-between"><span>เวลา</span><b>{timeTH(issuedAt)}</b></p>
                    </div>
                  </div>
                </div>

                {/* บาร์โค้ด + QR ติดตามออเดอร์ */}
                <div className="relative mt-4 border-2 border-black px-4 pt-4 pb-2">
                  <span className="absolute -top-[11px] left-4 bg-black text-white text-[10.5px] font-extrabold tracking-[0.15em] px-2.5 py-[2px]">
                    TRACKING · ติดตามออเดอร์
                  </span>
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className={label}>เลขที่ออเดอร์ / ORDER NO.</p>
                      <div className="mt-1"><Barcode128 value={orderNo} height={46} /></div>
                    </div>
                    {qr && (
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right text-[10.5px] leading-snug">
                          <p className="font-bold text-[11.5px]">สแกนเพื่อติดตามสถานะออเดอร์</p>
                          <p className="tracking-wider">SCAN TO TRACK YOUR ORDER</p>
                        </div>
                        <img src={qr} alt="QR ติดตามออเดอร์" className="h-[78px] w-[78px] border-2 border-black p-[3px]" />
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 border-t border-dashed border-black pt-1 text-center text-[10.5px] font-semibold">
                    ( หลังออเดอร์ขึ้นสถานะ &quot;จัดส่งสำเร็จ&quot; จะไม่สามารถทำการติดตามในหน้านี้ได้ )
                  </p>
                </div>

                {/* วันที่สำคัญ */}
                <div className="grid grid-cols-4 mt-4 border-2 border-black text-[12px]">
                  {keyDates.map(([t, v, sub], i) => (
                    <div key={t} className={'px-2.5 py-1.5 ' + (i > 0 ? 'border-l border-black' : '')}>
                      <p className={label}>{t}</p>
                      <p className="text-[14px] font-extrabold leading-tight mt-0.5">{v}</p>
                      <p className="text-[10.5px] leading-tight min-h-[13px]">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* ลูกค้า + การรับสินค้า */}
                <div className="grid grid-cols-2 mt-4 gap-4 text-[12px]">
                  <div className="border-2 border-black">
                    <p className={bar}>ผู้สั่งซื้อ / CUSTOMER</p>
                    <div className="px-2.5 py-1.5 space-y-px">
                      <p><b>ชื่อ:</b> {order.customers?.name ?? '-'}</p>
                      <p><b>โทร:</b> {order.customers?.phone ?? '-'}</p>
                      <p><b>อีเมล:</b> {order.customers?.email ?? '-'}</p>
                    </div>
                  </div>
                  <div className="border-2 border-black">
                    <p className={bar}>การรับสินค้า / DELIVERY</p>
                    <div className="px-2.5 py-1.5 space-y-px">
                      <p><b>วิธีรับ:</b> {FULFILLMENT[order.fulfillment_type] ?? order.fulfillment_type}</p>
                      {isPickup ? (
                        <p><b>สถานที่นัดรับ:</b> {order.pickup_place || '-'}</p>
                      ) : (
                        <>
                          <p><b>ผู้รับ:</b> {order.ship_recipient_name ?? '-'} {order.ship_recipient_phone ? `(${order.ship_recipient_phone})` : ''}</p>
                          <p className="line-clamp-2"><b>ที่อยู่:</b> {order.ship_address_text || '-'}</p>
                          {order.tracking_no && <p><b>เลขพัสดุ:</b> {order.tracking_no}{order.carrier ? ` (${order.carrier})` : ''}</p>}
                        </>
                      )}
                      <p><b>สถานะงาน:</b> {order.work_status === 'cancelled' ? 'ยกเลิกแล้ว' : stageLabel(order.fulfillment_type, order.work_status)}</p>
                    </div>
                  </div>
                </div>

                {/* รายการสินค้า */}
                <table className="w-full border-collapse mt-4 text-[12px] border-2 border-black">
                  <thead>
                    <tr className="bg-black text-white">
                      <th className="px-2 py-1 w-11 text-center">ลำดับ</th>
                      <th className="px-2 py-1 text-left">รายการสินค้า / DESCRIPTION</th>
                      <th className="px-2 py-1 w-16 text-center">จำนวน</th>
                      <th className="px-2 py-1 w-24 text-right">ราคา/หน่วย</th>
                      <th className="px-2 py-1 w-28 text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, i: number) => (
                      <tr key={it.id} style={{ background: i % 2 ? '#efefef' : '#fff' }}>
                        <td className="border-t border-black px-2 py-1 text-center">{i + 1}</td>
                        <td className="border-t border-l border-black px-2 py-1">{it.product_name}{it.note ? <span className="text-[10.5px]"> ({it.note})</span> : null}</td>
                        <td className="border-t border-l border-black px-2 py-1 text-center tabular-nums">{it.qty}</td>
                        <td className="border-t border-l border-black px-2 py-1 text-right tabular-nums">{formatBaht(it.unit_price)}</td>
                        <td className="border-t border-l border-black px-2 py-1 text-right tabular-nums font-semibold">{formatBaht(it.line_total)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                      <tr key={'e' + i} style={{ background: (items.length + i) % 2 ? '#efefef' : '#fff' }}>
                        <td className="border-t border-black px-2 py-[7px]">&nbsp;</td>
                        <td className="border-t border-l border-black" />
                        <td className="border-t border-l border-black" />
                        <td className="border-t border-l border-black" />
                        <td className="border-t border-l border-black" />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* สรุปยอด */}
                <div className="grid grid-cols-[1fr_250px] gap-4 mt-4 text-[12px]">
                  <div className="border-2 border-black flex flex-col">
                    <p className={bar}>จำนวนเงินตัวอักษร / AMOUNT IN WORDS</p>
                    <p className="font-extrabold text-[14px] px-2.5 pt-2">({thaiBahtText(grand)})</p>
                    <p className="px-2.5 pt-1.5"><b>สถานะการชำระเงิน:</b> {PAYMENT[order.payment_status] ?? order.payment_status}</p>
                    {payments.length > 0 && (
                      <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] leading-snug mt-auto">
                        {payments.map((p: any) => (
                          <p key={p.id}>• {dateTH(p.paid_at, false)} {timeTH(p.paid_at)} · {METHOD[p.method] ?? p.method} · {formatBaht(p.amount)} บาท</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <table className="border-collapse w-full border-2 border-black">
                    <tbody>
                      <tr><td className={cell}>รวมสินค้า</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(order.items_total)}</td></tr>
                      <tr><td className={cell}>ส่วนลด</td><td className={cell + ' text-right tabular-nums'}>{Number(order.discount_amount ?? 0) > 0 ? '-' : ''}{formatBaht(order.discount_amount ?? 0)}</td></tr>
                      <tr><td className={cell}>ค่าจัดส่ง</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(order.shipping_fee ?? 0)}</td></tr>
                      <tr className="font-extrabold text-[14px] bg-black text-white"><td className={cell}>ยอดรวมสุทธิ</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(grand)}</td></tr>
                      <tr><td className={cell}>ชำระแล้ว</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(paid)}</td></tr>
                      <tr className="font-bold"><td className={cell}>คงเหลือ</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(Math.max(0, balance))}</td></tr>
                    </tbody>
                  </table>
                </div>

                {(order.note || settings.receipt_footer) && (
                  <div className="mt-3 text-[11px] border border-black px-2.5 py-1.5 leading-snug">
                    {order.note && <p><b>หมายเหตุออเดอร์:</b> {order.note}</p>}
                    {settings.receipt_footer && <p className="whitespace-pre-line"><b>หมายเหตุจากร้าน:</b> {settings.receipt_footer}</p>}
                  </div>
                )}

                {/* ลงนาม + ตราประทับ */}
                <div className="relative mt-[7.5rem] grid grid-cols-2 gap-14 text-center text-[11.5px] px-4">
                  <div>
                    <div className="h-8" />
                    <div className="border-t border-dotted border-black pt-1 font-semibold">ผู้รับสินค้า / RECEIVED BY</div>
                    <p className="text-[10.5px] mt-0.5">วันที่ ____ / ____ / ________</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -top-[6.3rem] left-1/2 -translate-x-1/2 pointer-events-none">
                      <ShopStamp shopName={settings.shop_name} statusText={stampStatus} dateText={dateTH(issuedAt, false)} size={128} />
                    </div>
                    <div className="h-8" />
                    <div className="border-t border-dotted border-black pt-1 font-semibold">ผู้ออกเอกสาร / AUTHORIZED BY</div>
                    <p className="text-[10.5px] mt-0.5">{settings.shop_name}</p>
                  </div>
                </div>

                <p className="mt-4 text-center text-[10px] tracking-wide border-t-2 border-black pt-1.5">
                  ★ ขอบคุณที่อุดหนุน {settings.shop_name} ★ · เอกสารนี้ออกโดยระบบของร้าน ตรวจสอบสถานะล่าสุดได้ด้วยการสแกน QR หรือบาร์โค้ด
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
