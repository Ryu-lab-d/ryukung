import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import * as htmlToImage from 'html-to-image'
import { saveImage } from '../lib/saveImage'
import { thaiBahtText } from '../lib/thaiBahtText'
import { formatBaht } from '../lib/money'
import { productImageUrl } from '../products/ProductCard'
import { stageLabel } from '../orders/workStatus'
import { Barcode128 } from './Barcode128'
import { ShopStamp } from './ShopStamp'
import { INVOICE_RETENTION_DAYS, type InvoiceSnapshot } from './invoiceApi'

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
 * ตัวเอกสาร Invoice A4 หนึ่งหน้า ขาว-ดำล้วน วาดจาก snapshot ที่บันทึกไว้ (ไม่แตะข้อมูลสดของออเดอร์) พร้อมแถบปุ่มพิมพ์/บันทึกรูป
 * ใช้ร่วมกันทั้งหน้า "ออก Invoice ของออเดอร์" และหน้า "เปิดดู Invoice ย้อนหลัง" — ดูรายละเอียดการออกแบบเอกสารที่ CSS print ใน receipt-print.css
 */
export function InvoiceDocument({
  snapshot: d,
  invoiceNo,
  issuedAt: issuedAtIso,
  backTo,
  backLabel,
  onRefresh,
  onDelete,
  onSendEmail,
  onCopyLink,
  publicView = false,
}: {
  snapshot: InvoiceSnapshot
  invoiceNo: string
  issuedAt: string
  backTo?: string
  backLabel?: string
  onRefresh?: () => void | Promise<void>
  onDelete?: () => void | Promise<void>
  /** ส่งลิงก์ Invoice ให้ลูกค้าทางอีเมล — คืนข้อความผลลัพธ์ */
  onSendEmail?: () => Promise<string>
  onCopyLink?: () => Promise<string>
  /** มุมมองของลูกค้า (หน้าสาธารณะ): ไม่มีปุ่มจัดการและไม่โชว์ข้อความอายุเอกสารของร้าน */
  publicView?: boolean
}) {
  const [notice, setNotice] = useState<string | null>(null)
  async function run(fn: () => Promise<string>) {
    setNotice(null)
    setNotice(await fn())
  }
  const sheetRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [sheetH, setSheetH] = useState(SHEET_HEIGHT)
  const [qr, setQr] = useState<string | null>(null)
  const issuedAt = new Date(issuedAtIso)
  const daysLeft = Math.max(0, INVOICE_RETENTION_DAYS - Math.floor((Date.now() - issuedAt.getTime()) / 86400000))

  const trackUrl = d.order.public_token ? `${window.location.origin}/o/${d.order.public_token}` : null

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
  }, [])

  // กระดาษยืดตามเนื้อหาได้ (ออเดอร์สินค้าเยอะ) — วัดความสูงจริงไว้ให้กรอบย่อบนจอเว้นที่พอดี ไม่ตัดท้ายเอกสาร
  useLayoutEffect(() => {
    if (sheetRef.current) setSheetH(Math.max(SHEET_HEIGHT, sheetRef.current.offsetHeight))
  }, [d, qr])

  async function handleSavePng() {
    if (!sheetRef.current) return
    const blob = await htmlToImage.toBlob(sheetRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
    if (!blob) return
    await saveImage(blob, `INVOICE-${d.order.order_no}.png`, 'Invoice')
  }

  const paid = d.totals.paid
  const grand = d.totals.grand_total
  const balance = grand - paid
  const orderNo = d.order.order_no
  const isPickup = d.order.fulfillment_type === 'pickup'
  const stampStatus = balance <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'ISSUED'

  const cell = 'border border-black px-2 py-1'
  const label = 'text-[10px] font-bold tracking-[0.12em] uppercase'
  const bar = 'bg-black text-white text-[11px] font-extrabold tracking-wider px-2.5 py-1'

  const keyDates: [string, string, string][] = [
    ['วันที่สั่งซื้อ', dateTH(d.order.created_at, false), timeTH(d.order.created_at)],
    ['วันที่ต้องได้รับสินค้า', dateTH(d.order.needed_date, false), ''],
    [isPickup ? 'เวลานัดรับ' : 'การส่ง', isPickup ? d.order.pickup_time || 'ไม่ระบุ' : 'ตามขนส่ง', ''],
    ['วันที่ออกเอกสาร', dateTH(issuedAt, false), timeTH(issuedAt)],
  ]

  return (
    <div className="invoice-page bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-5xl mx-auto pb-10 no-print">
        {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
        >
          {backLabel}
        </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-full bg-stone-900 text-white px-5 py-2.5 text-sm font-semibold">
            🖨️ พิมพ์ / บันทึกเป็น PDF
          </button>
          <button type="button" onClick={() => void handleSavePng()} className="rounded-full bg-white border border-stone-300 text-stone-700 px-5 py-2.5 text-sm font-semibold">
            🖼️ บันทึกเป็นรูป
          </button>
          {onSendEmail && (
            <button type="button" onClick={() => void run(onSendEmail)} className="rounded-full bg-white border border-stone-300 text-stone-700 px-5 py-2.5 text-sm font-semibold">
              ✉️ ส่งอีเมลให้ลูกค้า
            </button>
          )}
          {onCopyLink && (
            <button type="button" onClick={() => void run(onCopyLink)} className="rounded-full bg-white border border-stone-300 text-stone-700 px-5 py-2.5 text-sm font-semibold">
              🔗 คัดลอกลิงก์ให้ลูกค้า
            </button>
          )}
          {onRefresh && (
            <button type="button" onClick={() => void onRefresh()} className="rounded-full bg-white border border-stone-300 text-stone-700 px-5 py-2.5 text-sm font-semibold">
              🔄 อัปเดตข้อมูลจากออเดอร์ล่าสุด
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => void onDelete()} className="rounded-full bg-white border border-red-300 text-red-600 px-5 py-2.5 text-sm font-semibold">
              🗑️ ลบ Invoice ใบนี้
            </button>
          )}
          <p className="text-xs text-stone-500">เอกสารขาว-ดำ ขนาด A4 · ตอนพิมพ์เลือก "ขนาดจริง / 100%" และปิดหัวท้ายกระดาษของเบราว์เซอร์</p>
        </div>
        {notice && <p className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 animate-form-in">{notice}</p>}
        {!publicView && (
        <p className="text-xs text-stone-500">
          ออกเอกสารเมื่อ {dateTH(issuedAt)} {timeTH(issuedAt)} · ระบบเก็บ Invoice นี้ไว้ {INVOICE_RETENTION_DAYS} วัน (เหลืออีก {daysLeft} วัน) แล้วลบอัตโนมัติ
        </p>
        )}
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
                {d.shop.name.toUpperCase()}
              </div>

              {/* แถบลายเฉียงบนสุด + มุมประดับ 4 มุม */}
              <div
                className="pointer-events-none absolute left-[17px] right-[17px] top-[17px] h-[10px]"
                style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #000 0 2px, #fff 2px 6px)' }}
                aria-hidden="true"
              />
              {[
                'left-[23px] top-[33px]',
                'right-[23px] top-[33px] rotate-90',
                'left-[23px] bottom-[23px] -rotate-90',
                'right-[23px] bottom-[23px] rotate-180',
              ].map((pos) => (
                <svg key={pos} className={'pointer-events-none absolute ' + pos} width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                  <path d="M1 25 V1 H25" fill="none" stroke="#000" strokeWidth="2.2" />
                  <path d="M6 25 V6 H25" fill="none" stroke="#000" strokeWidth="0.8" />
                  <rect x="-3" y="-3" width="6" height="6" transform="translate(3 3) rotate(45)" fill="#000" />
                </svg>
              ))}

              <div className="relative pt-3">
                {/* หัวเอกสาร */}
                <div className="flex items-stretch justify-between gap-5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {d.shop.logo_path && (
                      <img
                        src={productImageUrl(d.shop.logo_path)}
                        alt=""
                        crossOrigin="anonymous"
                        className="h-[78px] w-[78px] shrink-0 rounded-full object-cover border-[3px] border-black"
                        style={{ filter: 'grayscale(1) contrast(1.35)' }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-display text-[26px] font-bold leading-tight tracking-wide">{d.shop.name}</p>
                      {d.shop.address && <p className="text-[11.5px] mt-0.5 whitespace-pre-line leading-snug">{d.shop.address}</p>}
                      {d.shop.phone && <p className="text-[11.5px]">โทร. {d.shop.phone}</p>}
                      {d.shop.tax_id && <p className="text-[11.5px]">เลขประจำตัวผู้เสียภาษี {d.shop.tax_id}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 w-[250px] border-2 border-black">
                    <div className="bg-black text-white text-center py-1.5">
                      <p className="font-display text-[27px] font-bold leading-none tracking-[0.4em] pl-[0.4em]">INVOICE</p>
                      <p className="text-[12px] mt-0.5 tracking-wider">ใบสรุปคำสั่งซื้อ</p>
                    </div>
                    <div className="px-2.5 py-1.5 text-[11px] leading-snug">
                      <p className="flex justify-between"><span>เลขที่เอกสาร</span><b className="font-mono">{invoiceNo}</b></p>
                      <p className="flex justify-between"><span>วันที่ออกเอกสาร</span><b>{dateTH(issuedAt, false)}</b></p>
                      <p className="flex justify-between"><span>เวลา</span><b>{timeTH(issuedAt)}</b></p>
                    </div>
                  </div>
                </div>

                {/* บาร์โค้ด + QR ติดตามออเดอร์ */}
                <div className="relative mt-3.5 border-2 border-black px-4 pt-4 pb-2">
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
                <div className="grid grid-cols-4 mt-3 border-2 border-black text-[12px]">
                  {keyDates.map(([t, v, sub], i) => (
                    <div key={t} className={'px-2.5 py-1.5 ' + (i > 0 ? 'border-l border-black' : '')}>
                      <p className={label}>{t}</p>
                      <p className="text-[14px] font-extrabold leading-tight mt-0.5">{v}</p>
                      <p className="text-[10.5px] leading-tight min-h-[13px]">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* ลูกค้า + การรับสินค้า */}
                <div className="grid grid-cols-2 mt-3 gap-4 text-[12px]">
                  <div className="border-2 border-black">
                    <p className={bar}>01 · ผู้สั่งซื้อ / CUSTOMER</p>
                    <div className="px-2.5 py-1.5 space-y-px">
                      <p><b>ชื่อ:</b> {d.customer.name ?? '-'}</p>
                      <p><b>โทร:</b> {d.customer.phone ?? '-'}</p>
                      <p><b>อีเมล:</b> {d.customer.email ?? '-'}</p>
                    </div>
                  </div>
                  <div className="border-2 border-black">
                    <p className={bar}>02 · การรับสินค้า / DELIVERY</p>
                    <div className="px-2.5 py-1.5 space-y-px">
                      <p><b>วิธีรับ:</b> {FULFILLMENT[d.order.fulfillment_type] ?? d.order.fulfillment_type}</p>
                      {isPickup ? (
                        <p><b>สถานที่นัดรับ:</b> {d.order.pickup_place || '-'}</p>
                      ) : (
                        <>
                          <p><b>ผู้รับ:</b> {d.order.ship_recipient_name ?? '-'} {d.order.ship_recipient_phone ? `(${d.order.ship_recipient_phone})` : ''}</p>
                          <p className="line-clamp-2"><b>ที่อยู่:</b> {d.order.ship_address_text || '-'}</p>
                          {d.order.tracking_no && <p><b>เลขพัสดุ:</b> {d.order.tracking_no}{d.order.carrier ? ` (${d.order.carrier})` : ''}</p>}
                        </>
                      )}
                      <p><b>สถานะงาน:</b> {d.order.work_status === 'cancelled' ? 'ยกเลิกแล้ว' : stageLabel(d.order.fulfillment_type, d.order.work_status)}</p>
                    </div>
                  </div>
                </div>

                {/* รายการสินค้า */}
                <table className="w-full border-collapse mt-3 text-[12px] border-2 border-black">
                  <thead>
                    <tr className="bg-black text-white">
                      <th className="px-2 py-1 w-11 text-center">ลำดับ</th>
                      <th className="px-2 py-1 text-left">03 · รายการสินค้า / DESCRIPTION</th>
                      <th className="px-2 py-1 w-16 text-center">จำนวน</th>
                      <th className="px-2 py-1 w-24 text-right">ราคา/หน่วย</th>
                      <th className="px-2 py-1 w-28 text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((it, i: number) => (
                      <tr key={i} style={{ background: i % 2 ? '#f4f4f4' : '#fff' }}>
                        <td className="border-t border-neutral-500 px-2 py-1 text-center">{i + 1}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1">{it.product_name}{it.note ? <span className="text-[10.5px]"> ({it.note})</span> : null}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-center tabular-nums">{it.qty}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-right tabular-nums">{formatBaht(it.unit_price)}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-right tabular-nums font-semibold">{formatBaht(it.line_total)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 2 - d.items.length) }).map((_, i) => (
                      <tr key={'e' + i} style={{ background: (d.items.length + i) % 2 ? '#f4f4f4' : '#fff' }}>
                        <td className="border-t border-neutral-500 px-2 py-[7px]">&nbsp;</td>
                        <td className="border-t border-l border-neutral-500" />
                        <td className="border-t border-l border-neutral-500" />
                        <td className="border-t border-l border-neutral-500" />
                        <td className="border-t border-l border-neutral-500" />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* สรุปยอด */}
                <div className="grid grid-cols-[1fr_250px] gap-4 mt-3 text-[12px]">
                  <div className="border-2 border-black flex flex-col">
                    <p className={bar}>04 · จำนวนเงินตัวอักษร / AMOUNT IN WORDS</p>
                    <p className="font-extrabold text-[14px] px-2.5 pt-2">({thaiBahtText(grand)})</p>
                    <p className="px-2.5 pt-1.5"><b>สถานะการชำระเงิน:</b> {PAYMENT[d.order.payment_status] ?? d.order.payment_status}</p>
                    {d.payments.length > 0 && (
                      <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] leading-snug mt-auto">
                        {d.payments.map((p) => (
                          <p key={p.paid_at + p.amount}>• {dateTH(p.paid_at, false)} {timeTH(p.paid_at)} · {METHOD[p.method] ?? p.method} · {formatBaht(p.amount)} บาท</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <table className="border-collapse w-full border-2 border-black">
                    <tbody>
                      <tr><td className={cell}>รวมสินค้า</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(d.totals.items_total)}</td></tr>
                      <tr><td className={cell}>ส่วนลด</td><td className={cell + ' text-right tabular-nums'}>{Number(d.totals.discount_amount ?? 0) > 0 ? '-' : ''}{formatBaht(d.totals.discount_amount ?? 0)}</td></tr>
                      <tr><td className={cell}>ค่าจัดส่ง</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(d.totals.shipping_fee ?? 0)}</td></tr>
                      <tr className="font-display font-bold text-[16px] bg-black text-white"><td className={cell + ' py-1.5'}>ยอดรวมสุทธิ</td><td className={cell + ' py-1.5 text-right tabular-nums'}>{formatBaht(grand)}</td></tr>
                      <tr><td className={cell}>ชำระแล้ว</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(paid)}</td></tr>
                      <tr className="font-bold"><td className={cell}>คงเหลือ</td><td className={cell + ' text-right tabular-nums'}>{formatBaht(Math.max(0, balance))}</td></tr>
                    </tbody>
                  </table>
                </div>

                {(d.order.note || d.shop.footer) && (
                  <div className="mt-3 text-[11px] border border-black px-2.5 py-1.5 leading-snug">
                    {d.order.note && <p><b>หมายเหตุออเดอร์:</b> {d.order.note}</p>}
                    {d.shop.footer && <p className="whitespace-pre-line"><b>หมายเหตุจากร้าน:</b> {d.shop.footer}</p>}
                  </div>
                )}

                {/* ลงนาม + ตราประทับ */}
                <div className="relative mt-[6.2rem] grid grid-cols-2 gap-14 text-center text-[11.5px] px-4">
                  <div>
                    <div className="h-8" />
                    <div className="border-t border-dotted border-black pt-1 font-semibold">ผู้รับสินค้า / RECEIVED BY</div>
                    <p className="text-[10.5px] mt-0.5">วันที่ ____ / ____ / ________</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -top-[6.3rem] left-1/2 -translate-x-1/2 pointer-events-none">
                      <ShopStamp shopName={d.shop.name} statusText={stampStatus} dateText={dateTH(issuedAt, false)} size={128} />
                    </div>
                    <div className="h-8" />
                    <div className="border-t border-dotted border-black pt-1 font-semibold">ผู้ออกเอกสาร / AUTHORIZED BY</div>
                    <p className="text-[10.5px] mt-0.5">{d.shop.name}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em]">
                    <span className="text-[14px]">✂</span>
                    <div className="flex-1 border-t-2 border-dashed border-black" />
                    <span>ตัดตามรอยปะ · ส่วนสำหรับร้านเก็บ / SHOP COPY</span>
                    <div className="flex-1 border-t-2 border-dashed border-black" />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-4 border-2 border-black px-3 py-1.5">
                    <div className="min-w-0">
                      <p className="font-display text-[15px] font-bold leading-tight">{orderNo}</p>
                      <p className="text-[10.5px] leading-tight truncate">{d.customer.name ?? '-'} · {formatBaht(grand)} บาท · {PAYMENT[d.order.payment_status] ?? ''}</p>
                    </div>
                    <Barcode128 value={orderNo} height={26} compact />
                    <div className="text-right text-[10.5px] leading-snug shrink-0">
                      <p>ออกเมื่อ {dateTH(issuedAt, false)}</p>
                      <p>ผู้รับ ______________</p>
                    </div>
                  </div>
                  <p className="mt-1 text-center text-[9.5px] tracking-wide">
                    ★ ขอบคุณที่อุดหนุน {d.shop.name} ★ ตรวจสอบสถานะได้ด้วยการสแกน QR หรือบาร์โค้ด
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
