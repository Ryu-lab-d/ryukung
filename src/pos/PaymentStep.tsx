import { useState } from 'react'
import { NumericKeypad } from '../lib/NumericKeypad'
import { PromptPayQR } from '../public/PromptPayQR'
import { formatBaht, toNumber } from '../lib/money'
import { speakThai } from '../lib/speakThai'
import { createPOSSale, type POSPaymentMethod } from './api'
import { issueReceipt, type ReceiptSnapshot } from '../receipts/api'
import type { Settings } from '../settings/useSettings'
import type { CartItem } from './CartPanel'

export type SaleResult = {
  orderId: string
  method: POSPaymentMethod
  change: number | null
  receiptIssued: boolean
}

export function PaymentStep({
  items,
  settings,
  onBack,
  onComplete,
}: {
  items: CartItem[]
  settings: Settings | null
  onBack: () => void
  onComplete: (result: SaleResult) => void
}) {
  const [method, setMethod] = useState<POSPaymentMethod | ''>('')
  const [tendered, setTendered] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grandTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  const tenderedNum = toNumber(tendered)
  const change = tenderedNum - grandTotal
  const enoughCash = tenderedNum >= grandTotal

  async function finalizeSale(paymentMethod: POSPaymentMethod, changeAmount: number | null) {
    // เริ่มพูดทันทีตรงนี้ ก่อน await เครือข่ายของ createPOSSale/issueReceipt — ยิ่งเริ่มเร็วยิ่งดี (โดยเฉพาะ
    // fallback เสียงในเครื่องที่ต้องเรียกแบบใกล้เคียง user gesture ที่สุดบนมือถือบางรุ่น) ไม่ต้องรอผลเสียง
    // เสร็จก่อนไปทำต่อ (fire-and-forget)
    if (paymentMethod === 'cash' && changeAmount !== null) {
      void speakThai(changeAmount > 0 ? `เงินทอน ${Math.round(changeAmount)} บาท` : 'รับมาพอดี')
    }

    setError(null)
    setSaving(true)
    const { orderId, error: saveError } = await createPOSSale(
      items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        unit_price: it.unit_price,
        unit_cost: it.unit_cost,
        qty: it.qty,
      })),
      paymentMethod
    )
    if (saveError || !orderId) {
      setSaving(false)
      setError(saveError?.message ?? 'ขายไม่สำเร็จ')
      return
    }

    // ออกใบเสร็จอัตโนมัติทันที — ถ้าไม่สำเร็จก็ยังถือว่าขายสำเร็จแล้ว (เก็บเงิน+ตัดสต็อกไปแล้วจริง) แค่แจ้งให้
    // ไปออกใบเสร็จเองทีหลังแทนที่จะกันพนักงานไม่ให้ขายรายการต่อไปได้
    let receiptIssued = false
    if (settings) {
      const snapshot: ReceiptSnapshot = {
        shop_name: settings.shop_name,
        logo_path: settings.receipt_show_logo ? settings.logo_path : null,
        address: settings.receipt_show_address ? settings.address : null,
        phone: settings.receipt_show_phone ? settings.phone : null,
        promptpay: settings.receipt_show_promptpay ? settings.promptpay : null,
        receipt_footer: settings.receipt_footer,
        show_logo: settings.receipt_show_logo,
        show_address: settings.receipt_show_address,
        show_phone: settings.receipt_show_phone,
        show_promptpay: settings.receipt_show_promptpay,
        customer_name: null,
        ship_address_text: null,
        items: items.map((it) => ({ product_name: it.product_name, unit_price: it.unit_price, qty: it.qty, line_total: it.unit_price * it.qty })),
        items_total: grandTotal,
        discount_amount: 0,
        shipping_fee: 0,
        grand_total: grandTotal,
      }
      const { error: receiptError } = await issueReceipt(orderId, snapshot)
      receiptIssued = !receiptError
    }

    setSaving(false)
    onComplete({ orderId, method: paymentMethod, change: changeAmount, receiptIssued })
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm text-stone-600 underline">
        ← กลับไปแก้ตะกร้า
      </button>

      <div className="rounded-2xl bg-stone-900 text-white p-5 text-center">
        <p className="text-sm text-stone-300">ยอดที่ต้องชำระ</p>
        <p className="text-4xl font-bold tabular-nums">{formatBaht(grandTotal)}</p>
        <p className="text-sm text-stone-300">บาท</p>
      </div>

      {!method && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMethod('cash')}
            className="flex-1 rounded-xl border-2 border-stone-300 py-6 text-center font-medium"
          >
            <span className="block text-3xl mb-1">💵</span>{' '}
            เงินสด
          </button>
          {settings?.promptpay ? (
            <button
              type="button"
              onClick={() => setMethod('promptpay')}
              className="flex-1 rounded-xl border-2 border-stone-300 py-6 text-center font-medium"
            >
              <span className="block text-3xl mb-1">💳</span>{' '}
              พร้อมเพย์
            </button>
          ) : (
            <div className="flex-1 rounded-xl border-2 border-dashed border-stone-200 py-6 text-center text-stone-400 text-sm px-2">
              ยังไม่ได้ตั้งเลขพร้อมเพย์ในหน้าตั้งค่า
            </div>
          )}
        </div>
      )}

      {method === 'cash' && (
        <div className="space-y-3">
          <button type="button" onClick={() => setMethod('')} className="text-sm text-stone-600 underline">
            ← เปลี่ยนวิธีจ่าย
          </button>
          <button
            type="button"
            onClick={() => setTendered(String(grandTotal))}
            className={
              'w-full rounded-lg font-semibold py-3 text-sm ' +
              (tendered === String(grandTotal) ? 'bg-green-600 text-white' : 'border-2 border-green-600 text-green-700 bg-green-50')
            }
          >
            ✅ รับพอดี {formatBaht(grandTotal)} บาท
          </button>
          <p className="text-sm text-stone-600">เงินที่ลูกค้ายื่นมา</p>
          {/* ไม่โชว์ยอดเงินทอนล่วงหน้าตอนนี้ตั้งใจ — กดยืนยันรับเงินก่อน แล้วค่อยเห็นเงินทอนในหน้าขายสำเร็จ
              (SaleComplete.tsx) เพื่อให้ขั้นตอนตรงกับการนับเงินจริงหน้าร้าน: รับเงิน → ยืนยัน → ทอน */}
          <NumericKeypad value={tendered} onChange={setTendered} />
          {tendered && !enoughCash && <p className="text-sm text-red-600">เงินที่ยื่นมายังไม่พอ</p>}
          <button
            type="button"
            onClick={() => void finalizeSale('cash', change)}
            disabled={!enoughCash || saving}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-40"
          >
            {saving ? 'กำลังบันทึก...' : 'ยืนยันรับเงิน'}
          </button>
        </div>
      )}

      {method === 'promptpay' && settings?.promptpay && (
        <div className="space-y-3">
          <button type="button" onClick={() => setMethod('')} className="text-sm text-stone-600 underline">
            ← เปลี่ยนวิธีจ่าย
          </button>
          <div className="rounded-xl border border-stone-200 p-4">
            <PromptPayQR promptpayId={settings.promptpay} amount={grandTotal} />
          </div>
          <button
            type="button"
            onClick={() => void finalizeSale('promptpay', null)}
            disabled={saving}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-40"
          >
            {saving ? 'กำลังบันทึก...' : '✅ ยืนยันว่าลูกค้าจ่ายแล้ว'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
