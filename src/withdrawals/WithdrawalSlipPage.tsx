import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as htmlToImage from 'html-to-image'
import { saveImage } from '../lib/saveImage'
import { thaiBahtText } from '../lib/thaiBahtText'
import { formatBaht } from '../lib/money'
import { productImageUrl } from '../products/ProductCard'
import { useSettings } from '../settings/useSettings'
import { Barcode128 } from '../receipts/Barcode128'
import { ShopStamp } from '../receipts/ShopStamp'
import { useWithdrawal } from './useWithdrawal'
import { computeWithdrawalTotals } from './withdrawalMath'

const SHEET_WIDTH = 794
const SHEET_HEIGHT = 1123

/** เลขที่ใบเบิก: WD- + 8 ตัวแรกของ id (ตัวพิมพ์ใหญ่) — ใช้เป็นบาร์โค้ดบนใบ */
export const withdrawalSlipNo = (id: string) => 'WD-' + id.replace(/-/g, '').slice(0, 8).toUpperCase()

const dateTH = (d: Date | string, long = false) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' })
const timeTH = (d: Date | string) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'

/**
 * ใบเบิกของ A4 หนึ่งหน้า ขาว-ดำล้วน (วาดจากข้อมูลการเบิกปัจจุบัน) — ใช้ id/class เดียวกับ Invoice เพื่อใช้กฎพิมพ์ใน receipt-print.css ร่วมกัน
 * มีช่อง "ผลการขาย" ให้เขียนมือตอนกลับมาปิดรอบ (ถ้ายังไม่ปิดรอบ) และท่อนตัดเก็บสำหรับร้านพร้อมบาร์โค้ดเดียวกัน
 */
export function WithdrawalSlipPage() {
  const { id } = useParams()
  const { withdrawal: w, items, loading } = useWithdrawal(id ?? null)
  const { settings } = useSettings()
  const sheetRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [sheetH, setSheetH] = useState(SHEET_HEIGHT)

  useLayoutEffect(() => {
    function fit() {
      const width = frameRef.current?.parentElement?.clientWidth ?? window.innerWidth
      setScale(Math.min(1, (width - 8) / SHEET_WIDTH))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [loading])

  useLayoutEffect(() => {
    if (sheetRef.current) setSheetH(Math.max(SHEET_HEIGHT, sheetRef.current.offsetHeight))
  }, [w, items, settings])

  if (loading) return <p className="p-6 text-stone-500">กำลังโหลด…</p>
  if (!w) return <p className="p-6 text-stone-500">ไม่พบรายการเบิกนี้</p>

  const slipNo = withdrawalSlipNo(w.id)
  const shopName = settings?.shop_name ?? 'RYUKUNG BAKERY'
  const totals = computeWithdrawalTotals(items)
  const settled = w.status === 'settled'
  const sale = items.filter((it) => !it.is_wage)
  const wage = items.filter((it) => it.is_wage)
  const worth = sale.reduce((s, it) => s + it.unit_price * it.qty_out, 0)
  const who = w.staff_members?.display_name ?? w.staff_members?.email ?? 'ไม่ระบุ'
  const creator = w.creator?.display_name ?? w.creator?.email ?? '-'

  const cell = 'border border-black px-2 py-1'
  const label = 'text-[10px] font-bold tracking-[0.12em] uppercase'
  const bar = 'bg-black text-white text-[11px] font-extrabold tracking-wider px-2.5 py-1'

  async function handleSavePng() {
    if (!sheetRef.current) return
    const blob = await htmlToImage.toBlob(sheetRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' })
    if (blob) await saveImage(blob, `${slipNo}.png`, 'ใบเบิกของ')
  }

  const btn = 'rounded-full bg-white border border-stone-300 text-stone-700 px-5 py-2.5 text-sm font-semibold'

  const keyBoxes: [string, string, string][] = [
    ['วันที่เบิก', dateTH(w.withdrawn_at), ''],
    ['เวลาบันทึก', timeTH(w.created_at), dateTH(w.created_at)],
    ['สถานที่นำไปขาย', w.location || 'ไม่ระบุ', ''],
    ['สถานะ', settled ? 'ปิดรอบแล้ว' : 'รอปิดรอบ', settled && w.settled_at ? dateTH(w.settled_at) : ''],
  ]

  return (
    <div className="invoice-page bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-5xl mx-auto pb-10 no-print">
        <Link to={`/withdrawals/${w.id}`} className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm">
          ← กลับรายละเอียดการเบิก
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-full bg-stone-900 text-white px-5 py-2.5 text-sm font-semibold">
            🖨️ พิมพ์ / บันทึกเป็น PDF
          </button>
          <button type="button" onClick={() => void handleSavePng()} className={btn}>🖼️ บันทึกเป็นรูป</button>
          <p className="text-xs text-stone-500">เอกสารขาว-ดำ ขนาด A4 · ตอนพิมพ์เลือก "ขนาดจริง / 100%" และปิดหัวท้ายกระดาษของเบราว์เซอร์</p>
        </div>
      </div>

      <div className="invoice-wrap px-2 pb-10 overflow-hidden">
        <div ref={frameRef} className="invoice-frame mx-auto" style={{ width: SHEET_WIDTH * scale, height: sheetH * scale }}>
          <div style={{ width: SHEET_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <div
              ref={sheetRef}
              id="invoice-print-area"
              className="relative overflow-hidden bg-white text-black font-warm shadow-[0_10px_40px_-12px_rgb(0_0_0_/_0.35)]"
              style={{ width: SHEET_WIDTH, minHeight: SHEET_HEIGHT, padding: '34px 40px', fontSize: 12.5, lineHeight: 1.4, filter: 'grayscale(1)' }}
            >
              <div className="pointer-events-none absolute inset-[10px] border-[3px] border-black" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-[17px] border border-black" aria-hidden="true" />
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap font-extrabold select-none"
                style={{ transform: 'translate(-50%, -50%) rotate(-28deg)', fontSize: 92, letterSpacing: 6, color: 'rgba(0,0,0,0.045)' }}
                aria-hidden="true"
              >
                {shopName.toUpperCase()}
              </div>
              <div
                className="pointer-events-none absolute left-[17px] right-[17px] top-[17px] h-[10px]"
                style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #000 0 2px, #fff 2px 6px)' }}
                aria-hidden="true"
              />
              {['left-[23px] top-[33px]', 'right-[23px] top-[33px] rotate-90', 'left-[23px] bottom-[23px] -rotate-90', 'right-[23px] bottom-[23px] rotate-180'].map((pos) => (
                <svg key={pos} className={'pointer-events-none absolute ' + pos} width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                  <path d="M1 25 V1 H25" fill="none" stroke="#000" strokeWidth="2.2" />
                  <path d="M6 25 V6 H25" fill="none" stroke="#000" strokeWidth="0.8" />
                  <rect x="-3" y="-3" width="6" height="6" transform="translate(3 3) rotate(45)" fill="#000" />
                </svg>
              ))}

              <div className="relative pt-3">
                <div className="flex items-stretch justify-between gap-5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {settings?.logo_path && (
                      <img
                        src={productImageUrl(settings.logo_path)}
                        alt=""
                        crossOrigin="anonymous"
                        className="h-[78px] w-[78px] shrink-0 rounded-full object-cover border-[3px] border-black"
                        style={{ filter: 'grayscale(1) contrast(1.35)' }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-display text-[26px] font-bold leading-tight tracking-wide">{shopName}</p>
                      {settings?.address && <p className="text-[11.5px] mt-0.5 whitespace-pre-line leading-snug">{settings.address}</p>}
                      {settings?.phone && <p className="text-[11.5px]">โทร. {settings.phone}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 w-[250px] border-2 border-black">
                    <div className="bg-black text-white text-center py-1.5">
                      <p className="font-display text-[25px] font-bold leading-none tracking-[0.25em] pl-[0.25em]">ใบเบิกของ</p>
                      <p className="text-[12px] mt-0.5 tracking-wider">STOCK WITHDRAWAL SLIP</p>
                    </div>
                    <div className="px-2.5 py-1.5 text-[11px] leading-snug">
                      <p className="flex justify-between"><span>เลขที่ใบเบิก</span><b className="font-mono">{slipNo}</b></p>
                      <p className="flex justify-between"><span>วันที่เบิก</span><b>{dateTH(w.withdrawn_at)}</b></p>
                      <p className="flex justify-between"><span>ผู้เบิก</span><b className="truncate ml-2">{who}</b></p>
                    </div>
                  </div>
                </div>

                <div className="relative mt-3.5 border-2 border-black px-4 pt-4 pb-2">
                  <span className="absolute -top-[11px] left-4 bg-black text-white text-[10.5px] font-extrabold tracking-[0.15em] px-2.5 py-[2px]">
                    WITHDRAWAL · เลขที่ใบเบิก
                  </span>
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className={label}>เลขที่ใบเบิก / SLIP NO.</p>
                      <div className="mt-1"><Barcode128 value={slipNo} height={46} /></div>
                    </div>
                    <div className="text-right text-[10.5px] leading-snug">
                      <p className="font-bold text-[12px]">สินค้าที่เบิกทั้งหมด {totals.qtyOut + wage.reduce((s, it) => s + it.qty_out, 0)} ชิ้น</p>
                      <p>มูลค่าตามราคาขาย {formatBaht(worth)} บาท</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 mt-3 border-2 border-black text-[12px]">
                  {keyBoxes.map(([t, v, sub], i) => (
                    <div key={t} className={'px-2.5 py-1.5 ' + (i > 0 ? 'border-l border-black' : '')}>
                      <p className={label}>{t}</p>
                      <p className="text-[14px] font-extrabold leading-tight mt-0.5 break-words">{v}</p>
                      <p className="text-[10.5px] leading-tight min-h-[13px]">{sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 mt-3 gap-4 text-[12px]">
                  <div className="border-2 border-black">
                    <p className={bar}>01 · ผู้เบิก / WITHDRAWN BY</p>
                    <div className="px-2.5 py-1.5 space-y-px">
                      <p><b>ชื่อ:</b> {who}</p>
                      <p><b>บันทึกรายการโดย:</b> {creator}</p>
                    </div>
                  </div>
                  <div className="border-2 border-black">
                    <p className={bar}>02 · ค่าจ้าง / WAGE</p>
                    <div className="px-2.5 py-1.5 space-y-px">
                      <p>
                        <b>รูปแบบ:</b>{' '}
                        {w.wage_type === 'cash' ? `เงินสด ${formatBaht(w.wage_cash_amount ?? 0)} บาท` : w.wage_type === 'product' ? `เป็นสินค้า ${wage.map((it) => `${it.product_name} × ${it.qty_out}`).join(', ')}` : 'ไม่มีค่าจ้าง'}
                      </p>
                      {w.wage_type && <p><b>การจ่าย:</b> {w.wage_paid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย'}</p>}
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse mt-3 text-[12px] border-2 border-black">
                  <thead>
                    <tr className="bg-black text-white">
                      <th className="px-2 py-1 w-10 text-center">ลำดับ</th>
                      <th className="px-2 py-1 text-left">03 · รายการที่เบิก / ITEMS</th>
                      <th className="px-2 py-1 w-14 text-center">เบิก</th>
                      <th className="px-2 py-1 w-20 text-right">ราคา/หน่วย</th>
                      <th className="px-2 py-1 w-24 text-right">มูลค่า</th>
                      <th className="px-2 py-1 w-16 text-center">ขายได้</th>
                      <th className="px-2 py-1 w-24 text-right">เงินที่ได้</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={it.id} style={{ background: i % 2 ? '#f4f4f4' : '#fff' }}>
                        <td className="border-t border-neutral-500 px-2 py-1 text-center">{i + 1}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1">{it.product_name}{it.is_wage ? <span className="text-[10.5px]"> (ค่าจ้าง)</span> : null}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-center tabular-nums font-semibold">{it.qty_out}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-right tabular-nums">{it.is_wage ? '-' : formatBaht(it.unit_price)}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-right tabular-nums">{it.is_wage ? '-' : formatBaht(it.unit_price * it.qty_out)}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-center tabular-nums">{settled && !it.is_wage ? (it.qty_sold ?? 0) : ''}</td>
                        <td className="border-t border-l border-neutral-500 px-2 py-1 text-right tabular-nums">{settled && !it.is_wage ? formatBaht(it.amount_collected ?? 0) : ''}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                      <tr key={'e' + i} style={{ background: (items.length + i) % 2 ? '#f4f4f4' : '#fff' }}>
                        <td className="border-t border-neutral-500 px-2 py-[7px]">&nbsp;</td>
                        {Array.from({ length: 6 }).map((__, k) => <td key={k} className="border-t border-l border-neutral-500" />)}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="grid grid-cols-[1fr_250px] gap-4 mt-3 text-[12px]">
                  <div className="border-2 border-black flex flex-col">
                    <p className={bar}>04 · มูลค่าสินค้าที่เบิก / VALUE IN WORDS</p>
                    <p className="font-extrabold text-[14px] px-2.5 pt-2">({thaiBahtText(worth)})</p>
                    {w.note && <p className="px-2.5 pt-1.5 text-[11px]"><b>หมายเหตุ:</b> {w.note}</p>}
                    <p className="px-2.5 pb-1.5 pt-1.5 text-[10.5px] mt-auto">
                      {settled ? 'ปิดรอบแล้ว — ผลการขายตามช่องด้านบน' : 'ยังไม่ปิดรอบ — เขียนจำนวนที่ขายได้และเงินที่ได้ในช่องด้านบนตอนกลับมา'}
                    </p>
                  </div>
                  <table className="border-collapse w-full border-2 border-black">
                    <tbody>
                      <tr><td className={cell}>จำนวนเบิก (ไม่รวมค่าจ้าง)</td><td className={cell + ' text-right tabular-nums'}>{totals.qtyOut}</td></tr>
                      <tr className="font-display font-bold text-[16px] bg-black text-white"><td className={cell + ' py-1.5'}>มูลค่าตามราคาขาย</td><td className={cell + ' py-1.5 text-right tabular-nums'}>{formatBaht(worth)}</td></tr>
                      <tr><td className={cell}>ขายได้</td><td className={cell + ' text-right tabular-nums'}>{settled ? `${totals.qtySold} ชิ้น` : '________'}</td></tr>
                      <tr className="font-bold"><td className={cell}>เงินที่ได้รับ</td><td className={cell + ' text-right tabular-nums'}>{settled ? formatBaht(totals.revenue) : '________'}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="relative mt-[6.2rem] grid grid-cols-2 gap-14 text-center text-[11.5px] px-4">
                  <div>
                    <div className="h-8" />
                    <div className="border-t border-dotted border-black pt-1 font-semibold">ผู้เบิก / WITHDRAWN BY</div>
                    <p className="text-[10.5px] mt-0.5">วันที่ ____ / ____ / ________</p>
                  </div>
                  <div className="relative">
                    <div className="absolute -top-[6.3rem] left-1/2 -translate-x-1/2 pointer-events-none">
                      <ShopStamp shopName={shopName} statusText={settled ? 'CLOSED' : 'ISSUED'} dateText={dateTH(w.withdrawn_at)} size={128} />
                    </div>
                    <div className="h-8" />
                    <div className="border-t border-dotted border-black pt-1 font-semibold">ผู้อนุมัติ/จ่ายของ / APPROVED BY</div>
                    <p className="text-[10.5px] mt-0.5">{shopName}</p>
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
                      <p className="font-display text-[15px] font-bold leading-tight">{slipNo}</p>
                      <p className="text-[10.5px] leading-tight truncate">{who} · {totals.qtyOut} ชิ้น · {formatBaht(worth)} บาท</p>
                    </div>
                    <Barcode128 value={slipNo} height={26} compact />
                    <div className="text-right text-[10.5px] leading-snug shrink-0">
                      <p>เบิกเมื่อ {dateTH(w.withdrawn_at)}</p>
                      <p>ผู้เบิก ______________</p>
                    </div>
                  </div>
                  <p className="mt-1 text-center text-[9.5px] tracking-wide">★ {shopName} · ใบเบิกของภายในร้าน ★</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
