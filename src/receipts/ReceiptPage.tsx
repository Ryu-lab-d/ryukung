import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as htmlToImage from 'html-to-image'
import { useOrder } from '../orders/useOrder'
import { useSettings } from '../settings/useSettings'
import { useReceipts } from './useReceipts'
import { issueReceipt, reissueReceipt, type ReceiptSnapshot } from './api'
import { formatBaht } from '../lib/money'
import { productImageUrl } from '../products/ProductCard'

export function ReceiptPage() {
  const { id } = useParams()
  const { order, items, loading: orderLoading } = useOrder(id ?? null)
  const { settings } = useSettings()
  const { receipts, loading: receiptsLoading, reload } = useReceipts(id ?? null)

  const [showLogo, setShowLogo] = useState(settings?.receipt_show_logo ?? true)
  const [showAddress, setShowAddress] = useState(settings?.receipt_show_address ?? true)
  const [showPhone, setShowPhone] = useState(settings?.receipt_show_phone ?? true)
  const [showPromptpay, setShowPromptpay] = useState(settings?.receipt_show_promptpay ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const activeReceipt = receipts.find((r) => r.status === 'issued')

  const draftSnapshot: ReceiptSnapshot | null = useMemo(() => {
    if (!order || !settings) return null
    return {
      shop_name: settings.shop_name,
      logo_path: showLogo ? settings.logo_path : null,
      address: showAddress ? settings.address : null,
      phone: showPhone ? settings.phone : null,
      promptpay: showPromptpay ? settings.promptpay : null,
      receipt_footer: settings.receipt_footer,
      show_logo: showLogo, show_address: showAddress, show_phone: showPhone, show_promptpay: showPromptpay,
      customer_name: order.customers?.name ?? null,
      ship_address_text: order.ship_address_text,
      items: items.map((it: any) => ({ product_name: it.product_name, unit_price: it.unit_price, qty: it.qty, line_total: it.line_total })),
      items_total: order.items_total,
      discount_amount: order.discount_amount,
      shipping_fee: order.shipping_fee,
      grand_total: order.grand_total,
    }
  }, [order, items, settings, showLogo, showAddress, showPhone, showPromptpay])

  async function handleIssue() {
    if (!id || !draftSnapshot) return
    setBusy(true)
    const { error } = await issueReceipt(id, draftSnapshot)
    setBusy(false)
    if (error) { setError(error.message); return }
    await reload()
  }

  async function handleReissue() {
    if (!activeReceipt || !draftSnapshot) return
    setBusy(true)
    const { error } = await reissueReceipt(activeReceipt.id, draftSnapshot)
    setBusy(false)
    if (error) { setError(error.message); return }
    await reload()
  }

  async function handleDownloadPng() {
    if (!printRef.current) return
    const dataUrl = await htmlToImage.toPng(printRef.current)
    const link = document.createElement('a')
    link.download = `${activeReceipt?.receipt_no ?? 'receipt'}.png`
    link.href = dataUrl
    link.click()
  }

  if (orderLoading || receiptsLoading || !order) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  const display: ReceiptSnapshot | null = activeReceipt ? (activeReceipt.snapshot as ReceiptSnapshot) : draftSnapshot

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      {!activeReceipt && (
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1"><input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} /> โลโก้</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} /> ที่อยู่</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} /> เบอร์โทร</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={showPromptpay} onChange={(e) => setShowPromptpay(e.target.checked)} /> พร้อมเพย์</label>
        </div>
      )}

      <div ref={printRef} id="receipt-print-area" className="bg-white border border-stone-200 p-4 space-y-2">
        {display?.show_logo && display.logo_path && <img src={productImageUrl(display.logo_path)} alt="" className="h-12" />}
        <h1 className="font-semibold">{display?.shop_name}</h1>
        {display?.show_address && display.address && <p className="text-sm">{display.address}</p>}
        {display?.show_phone && display.phone && <p className="text-sm">โทร {display.phone}</p>}
        {display?.show_promptpay && display.promptpay && <p className="text-sm">พร้อมเพย์ {display.promptpay}</p>}
        <p className="text-sm">เลขที่ใบเสร็จ: {activeReceipt?.receipt_no ?? '(ยังไม่ออก)'}</p>
        <p className="text-sm">ลูกค้า: {display?.customer_name ?? '-'}</p>
        <div className="border-t border-stone-200 pt-2">
          {display?.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{it.product_name} x{it.qty}</span><span>{formatBaht(it.line_total)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-200 pt-2 text-sm space-y-1">
          <div className="flex justify-between"><span>รวมสินค้า</span><span>{formatBaht(display?.items_total ?? 0)}</span></div>
          <div className="flex justify-between"><span>ส่วนลด</span><span>-{formatBaht(display?.discount_amount ?? 0)}</span></div>
          <div className="flex justify-between"><span>ค่าส่ง</span><span>{formatBaht(display?.shipping_fee ?? 0)}</span></div>
          <div className="flex justify-between font-semibold"><span>ยอดรวม</span><span>{formatBaht(display?.grand_total ?? 0)}</span></div>
        </div>
        {display?.receipt_footer && <p className="text-xs text-stone-500 pt-2">{display.receipt_footer}</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!activeReceipt && (
          <button type="button" disabled={busy} onClick={handleIssue} className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm disabled:opacity-50">
            ออกใบเสร็จ
          </button>
        )}
        {activeReceipt && (
          <>
            <button type="button" onClick={() => window.print()} className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm">
              พิมพ์ / บันทึกเป็น PDF
            </button>
            <button type="button" onClick={handleDownloadPng} className="rounded-lg px-4 py-2 text-sm border border-stone-300">
              บันทึกเป็นรูป
            </button>
            <button type="button" disabled={busy} onClick={handleReissue} className="rounded-lg px-4 py-2 text-sm text-red-600 border border-red-200 disabled:opacity-50">
              ยกเลิกใบนี้แล้วออกใหม่
            </button>
          </>
        )}
      </div>
    </div>
  )
}
