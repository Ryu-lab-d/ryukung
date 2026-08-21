import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '../products/useProducts'
import { useCategories } from '../products/useCategories'
import { ProductCard } from '../products/ProductCard'
import { useSettings } from '../settings/useSettings'
import { createPOSSale, type POSPaymentMethod } from './api'
import { issueReceipt, type ReceiptSnapshot } from '../receipts/api'
import { formatBaht } from '../lib/money'
import { Toast } from '../lib/Toast'

type CartItem = {
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty: number
}

export function POSPage() {
  const navigate = useNavigate()
  const { products } = useProducts()
  const { categories } = useCategories()
  const { settings } = useSettings()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod | ''>('')
  const [paymentError, setPaymentError] = useState(false)
  const [paymentShake, setPaymentShake] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.is_active && p.name.toLowerCase().includes(q) && (!categoryId || p.category_id === categoryId)
    )
  }, [products, search, categoryId])

  const grandTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)

  function addProduct(p: (typeof products)[number]) {
    const existingIndex = items.findIndex((it) => it.product_id === p.id)
    if (existingIndex >= 0) {
      setItems((rows) => rows.map((r, i) => (i === existingIndex ? { ...r, qty: r.qty + 1 } : r)))
      return
    }
    setItems((rows) => [...rows, { product_id: p.id, product_name: p.name, unit_price: p.price, unit_cost: p.cost, qty: 1 }])
  }

  function updateQty(index: number, qty: number) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, qty } : r)))
  }

  function updatePrice(index: number, price: number) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, unit_price: price } : r)))
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleCheckout() {
    if (items.length === 0) {
      setError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')
      return
    }
    if (!paymentMethod) {
      setPaymentError(true)
      setPaymentShake(true)
      setTimeout(() => setPaymentShake(false), 400)
      return
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

    // ออกใบเสร็จให้อัตโนมัติทันที ไม่ต้องรอพนักงานกดออกเอง — POS ไม่มีส่วนลด/ค่าส่ง คำนวณยอดจากตะกร้าตรงๆ
    // ได้เลย ตรงกับที่ฐานข้อมูลคำนวณแน่นอน ไม่ต้อง fetch ออเดอร์กลับมาซ้ำ
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
      await issueReceipt(orderId, snapshot)
    }

    setSaving(false)
    navigate(`/receipts/${orderId}`)
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-40">
      <h1 className="text-lg font-semibold">ขายหน้าร้าน</h1>
      <p className="text-sm text-stone-500">ลูกค้าเดินเข้ามาซื้อ ไม่ต้องกรอกข้อมูลลูกค้า เลือกสินค้าแล้วรับเงินได้เลย</p>

      <div className="space-y-2">
        <input
          placeholder="ค้นหาสินค้า"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={'rounded-full px-3 py-1.5 text-sm ' + (!categoryId ? 'bg-stone-900 text-white' : 'bg-stone-100')}
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={'rounded-full px-3 py-1.5 text-sm ' + (categoryId === c.id ? 'bg-stone-900 text-white' : 'bg-stone-100')}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <button key={p.id} type="button" onClick={() => addProduct(p)}>
              <ProductCard product={p} mode="picker" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">รายการที่ขาย</h2>
        {items.length === 0 && <p className="text-sm text-stone-400">ยังไม่ได้เลือกสินค้า</p>}
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-stone-200 px-3 py-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{it.product_name}</p>
              <button type="button" onClick={() => removeItem(i)} className="text-red-600 text-sm shrink-0">
                ลบ
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label htmlFor={`pos-item-price-${i}`} className="text-xs text-stone-500">ราคา/ชิ้น (บาท)</label>
                <input
                  id={`pos-item-price-${i}`}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={it.unit_price}
                  onChange={(e) => updatePrice(i, Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                />
              </div>
              <div className="space-y-0.5">
                <label htmlFor={`pos-item-qty-${i}`} className="text-xs text-stone-500">จำนวน</label>
                <input
                  id={`pos-item-qty-${i}`}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={it.qty}
                  onChange={(e) => updateQty(i, Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={'space-y-1.5' + (paymentShake ? ' animate-shake' : '')}>
        <p className="text-sm text-stone-600">รับเงินด้วยวิธีไหน *</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setPaymentMethod('cash'); setPaymentError(false) }}
            className={
              'flex-1 rounded-lg px-3 py-2.5 text-sm font-medium border-2 ' +
              (paymentMethod === 'cash' ? 'bg-stone-900 text-white border-stone-900' : paymentError ? 'border-red-400' : 'border-stone-300')
            }
          >
            💵 เงินสด
          </button>
          <button
            type="button"
            onClick={() => { setPaymentMethod('promptpay'); setPaymentError(false) }}
            className={
              'flex-1 rounded-lg px-3 py-2.5 text-sm font-medium border-2 ' +
              (paymentMethod === 'promptpay' ? 'bg-stone-900 text-white border-stone-900' : paymentError ? 'border-red-400' : 'border-stone-300')
            }
          >
            💳 พร้อมเพย์ / โอนเงิน
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 bg-white border-t border-stone-200 p-3 max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-stone-500">ยอดรวม</p>
            <p className="text-xl font-bold text-stone-900">{formatBaht(grandTotal)} บาท</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={saving}
            className="rounded-xl bg-stone-900 text-white font-semibold px-6 py-3 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'ชำระเงิน'}
          </button>
        </div>
      </div>

      {paymentError && <Toast variant="error" message="กรุณาเลือกวิธีรับเงิน" onDone={() => setPaymentError(false)} />}
    </div>
  )
}
