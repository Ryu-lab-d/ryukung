import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getPublicMenu, submitCustomerOrder, notifyCustomerOrder, type PublicMenu } from '../lib/publicMenuApi'
import { productImageUrl } from '../products/ProductCard'
import { formatBaht } from '../lib/money'
import { addDays } from '../lib/dates'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { PromptPayQR } from './PromptPayQR'

type Step = 'menu' | 'checkout' | 'payment' | 'done'

type CartItem = { product_id: string; product_name: string; unit_price: number; unit: string; qty: number }

type CheckoutForm = {
  customerName: string
  customerPhone: string
  fulfillmentType: 'pickup' | 'shipping'
  neededDate: string
  pickupPlace: string
  pickupTime: string
  shipRecipientName: string
  shipRecipientPhone: string
  shipAddressText: string
  note: string
}

const CART_DRAFT_KEY = 'public-menu-cart'
const CHECKOUT_DRAFT_KEY = 'public-menu-checkout'

const emptyCheckout: CheckoutForm = {
  customerName: '', customerPhone: '', fulfillmentType: 'pickup', neededDate: '',
  pickupPlace: '', pickupTime: '', shipRecipientName: '', shipRecipientPhone: '', shipAddressText: '', note: '',
}

function todayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** สรุปรายการที่สั่งแบบละเอียด (ชื่อ/จำนวน/ราคาต่อชิ้น/รวม) — ใช้ทั้งหน้ากรอกข้อมูลรับของและหน้าชำระเงิน
 * กันลูกค้ากดสั่งไปโดยไม่เคยเห็นรายการที่เลือกไว้ครบๆ เลยสักครั้ง (หน้าตะกร้าเดิมเห็นทีละชิ้นปนอยู่ในกริดสินค้า) */
function CartSummaryList({ items, grandTotal }: { items: CartItem[]; grandTotal: number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
      <h2 className="text-sm font-semibold text-stone-600">รายการที่สั่ง ({items.length})</h2>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.product_id} className="flex justify-between text-sm">
            <span className="text-stone-700">
              {it.product_name} <span className="text-stone-400">x{it.qty} {it.unit}</span>
            </span>
            <span className="tabular-nums">{formatBaht(it.unit_price * it.qty)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-semibold border-t border-stone-100 pt-2">
        <span>ยอดรวม</span>
        <span className="tabular-nums">{formatBaht(grandTotal)} บาท</span>
      </div>
    </div>
  )
}

export function CustomerOrderPage() {
  const [menu, setMenu] = useState<PublicMenu | null | undefined>(undefined)
  const [step, setStep] = useState<Step>('menu')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>(() => loadFormDraft<CartItem[]>(CART_DRAFT_KEY) ?? [])
  const [form, setForm] = useState<CheckoutForm>(() => loadFormDraft<CheckoutForm>(CHECKOUT_DRAFT_KEY) ?? emptyCheckout)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedTotal, setSubmittedTotal] = useState(0)

  useFormDraft(CART_DRAFT_KEY, items)
  useFormDraft(CHECKOUT_DRAFT_KEY, form)

  useEffect(() => {
    getPublicMenu().then(({ menu, error }) => setMenu(error ? null : menu))
  }, [])

  const filtered = useMemo(() => {
    if (!menu) return []
    const q = search.toLowerCase()
    return menu.products.filter((p) => p.name.toLowerCase().includes(q) && (!categoryId || p.category_id === categoryId))
  }, [menu, search, categoryId])

  const grandTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  const minNeededDate = menu ? addDays(todayStr(), menu.shipping_lead_days) : todayStr()

  function addProduct(p: PublicMenu['products'][number]) {
    const existingIndex = items.findIndex((it) => it.product_id === p.id)
    if (existingIndex >= 0) {
      setItems((rows) => rows.map((r, i) => (i === existingIndex ? { ...r, qty: r.qty + 1 } : r)))
      return
    }
    setItems((rows) => [...rows, { product_id: p.id, product_name: p.name, unit_price: p.price, unit: p.unit, qty: 1 }])
  }

  function updateQty(index: number, qty: number) {
    if (qty <= 0) {
      setItems((rows) => rows.filter((_, i) => i !== index))
      return
    }
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, qty } : r)))
  }

  function handleCheckoutSubmit(e: FormEvent) {
    e.preventDefault()
    setStep('payment')
  }

  async function handleConfirmPayment() {
    setSubmitting(true)
    setError(null)
    const { orderId, error: submitError } = await submitCustomerOrder({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      fulfillmentType: form.fulfillmentType,
      neededDate: form.neededDate,
      pickupPlace: form.fulfillmentType === 'pickup' ? form.pickupPlace || null : null,
      pickupTime: form.fulfillmentType === 'pickup' ? form.pickupTime || null : null,
      shipRecipientName: form.fulfillmentType === 'shipping' ? form.shipRecipientName || null : null,
      shipRecipientPhone: form.fulfillmentType === 'shipping' ? form.shipRecipientPhone || null : null,
      shipAddressText: form.fulfillmentType === 'shipping' ? form.shipAddressText || null : null,
      note: form.note || null,
      items: items.map((it) => ({ product_id: it.product_id, qty: it.qty })),
    })
    if (submitError || !orderId) {
      setSubmitting(false)
      setError(submitError ?? 'ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่')
      return
    }
    void notifyCustomerOrder(orderId)
    // ออเดอร์ที่ลูกค้าส่งเองยังเป็น is_draft=true อยู่จนกว่าร้านจะกดยืนยัน — หน้า /o/:token (get_public_order)
    // แสดงเฉพาะออเดอร์ที่ยืนยันแล้วเท่านั้น พาไปที่นั่นตอนนี้เลยจะเจอ "ไม่พบออเดอร์" ทั้งที่ส่งสำเร็จจริง
    // จึงจบ flow นี้ด้วยหน้าขอบคุณในตัวแทน ร้านจะติดต่อกลับ/ส่งลิงก์ติดตามให้ทีหลังตอนยืนยันออเดอร์แล้ว
    setSubmittedTotal(grandTotal)
    clearFormDraft(CART_DRAFT_KEY)
    clearFormDraft(CHECKOUT_DRAFT_KEY)
    setItems([])
    setForm(emptyCheckout)
    setSubmitting(false)
    setStep('done')
  }

  if (menu === undefined) {
    return <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-stone-500">กำลังโหลดเมนู...</div>
  }
  if (menu === null) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center">
        <p className="text-stone-500">โหลดเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
      </div>
    )
  }

  if (step === 'checkout') {
    return (
      <div className="min-h-screen bg-stone-50 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <button type="button" onClick={() => setStep('menu')} className="text-sm text-stone-600 underline">
            ← กลับไปแก้ตะกร้า
          </button>
          <h1 className="text-lg font-bold">กรอกข้อมูลรับของ</h1>
          <CartSummaryList items={items} grandTotal={grandTotal} />
          <form onSubmit={handleCheckoutSubmit} className="space-y-4 bg-white rounded-2xl shadow-sm p-5">
            <div className="space-y-1">
              <label htmlFor="customerName" className="text-sm text-stone-600">ชื่อผู้สั่งซื้อ</label>
              <input
                id="customerName" required value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="customerPhone" className="text-sm text-stone-600">เบอร์โทรศัพท์</label>
              <input
                id="customerPhone" required type="tel" value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="fulfillmentType" className="text-sm text-stone-600">วิธีรับของ</label>
              <select
                id="fulfillmentType" value={form.fulfillmentType}
                onChange={(e) => setForm((f) => ({ ...f, fulfillmentType: e.target.value as 'pickup' | 'shipping' }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              >
                <option value="pickup">นัดรับเอง</option>
                <option value="shipping">ส่งไปรษณีย์/ขนส่ง</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="neededDate" className="text-sm text-stone-600">วันที่ต้องการ</label>
              <input
                id="neededDate" required type="date" min={minNeededDate} value={form.neededDate}
                onChange={(e) => setForm((f) => ({ ...f, neededDate: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
              />
              <p className="text-xs text-stone-400">สั่งล่วงหน้าอย่างน้อย {menu.shipping_lead_days} วัน</p>
            </div>

            {form.fulfillmentType === 'pickup' ? (
              <div className="space-y-1">
                <label htmlFor="pickupTime" className="text-sm text-stone-600">เวลาที่สะดวกมารับ (ถ้ามี)</label>
                <input
                  id="pickupTime" value={form.pickupTime}
                  onChange={(e) => setForm((f) => ({ ...f, pickupTime: e.target.value }))}
                  placeholder="เช่น 10:00" className="w-full rounded-lg border border-stone-300 px-3 py-2.5"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label htmlFor="shipAddressText" className="text-sm text-stone-600">ที่อยู่จัดส่ง</label>
                <textarea
                  id="shipAddressText" required value={form.shipAddressText}
                  onChange={(e) => setForm((f) => ({ ...f, shipAddressText: e.target.value }))}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2.5" rows={3}
                />
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="note" className="text-sm text-stone-600">หมายเหตุ (ถ้ามี)</label>
              <textarea
                id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5" rows={2}
              />
            </div>

            {menu.promptpay ? (
              <button type="submit" className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3">
                ไปหน้าชำระเงิน →
              </button>
            ) : (
              <p className="text-sm text-red-600 text-center">ร้านยังไม่เปิดรับสั่งซื้อออนไลน์ตอนนี้ กรุณาติดต่อร้านโดยตรง</p>
            )}
          </form>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <h1 className="text-lg font-bold">ส่งคำสั่งซื้อเรียบร้อยแล้ว!</h1>
          <p className="text-sm text-stone-500">
            ยอดที่แจ้งชำระ {formatBaht(submittedTotal)} บาท — ร้านได้รับคำสั่งซื้อของคุณแล้ว และจะตรวจสอบ/ยืนยันออเดอร์โดยเร็วที่สุด
            กรุณารอการติดต่อกลับทางเบอร์โทรที่ให้ไว้
          </p>
          <button
            type="button"
            onClick={() => setStep('menu')}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3"
          >
            กลับไปหน้าเมนู
          </button>
        </div>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-stone-50 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <button type="button" onClick={() => setStep('checkout')} className="text-sm text-stone-600 underline">
            ← กลับไปแก้ข้อมูล
          </button>
          <div className="rounded-2xl bg-stone-900 text-white p-5 text-center">
            <p className="text-sm text-stone-300">ยอดที่ต้องชำระ</p>
            <p className="text-4xl font-bold tabular-nums">{formatBaht(grandTotal)}</p>
            <p className="text-sm text-stone-300">บาท</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            {menu.promptpay && <PromptPayQR promptpayId={menu.promptpay} amount={grandTotal} />}
          </div>
          <p className="text-xs text-stone-500 text-center">
            สแกนจ่ายเงินก่อน แล้วกดปุ่มด้านล่างเพื่อส่งคำสั่งซื้อ — ร้านจะตรวจสอบและยืนยันออเดอร์ให้เร็วที่สุด
          </p>
          <CartSummaryList items={items} grandTotal={grandTotal} />
          <button
            type="button"
            onClick={() => void handleConfirmPayment()}
            disabled={submitting}
            className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-40"
          >
            {submitting ? 'กำลังส่งคำสั่งซื้อ...' : '✅ ฉันโอนเงินแล้ว ส่งคำสั่งซื้อ'}
          </button>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 pb-28">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="text-center pt-2 space-y-1">
          {menu.logo_path && (
            <img src={productImageUrl(menu.logo_path)} alt="" className="w-16 h-16 rounded-full object-cover mx-auto border border-stone-200" />
          )}
          <h1 className="text-xl font-bold">{menu.shop_name}</h1>
          <p className="text-sm text-stone-500">เลือกสินค้าแล้วกดสั่งได้เลย</p>
        </div>

        <input
          placeholder="ค้นหาสินค้า" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={() => setCategoryId(null)}
            className={'rounded-full px-3 py-1.5 text-sm ' + (!categoryId ? 'bg-stone-900 text-white' : 'bg-stone-100')}
          >
            ทั้งหมด
          </button>
          {menu.categories.map((c) => (
            <button
              key={c.id} type="button" onClick={() => setCategoryId(c.id)}
              className={'rounded-full px-3 py-1.5 text-sm ' + (categoryId === c.id ? 'bg-stone-900 text-white' : 'bg-stone-100')}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const inCart = items.find((it) => it.product_id === p.id)
            return (
              <div key={p.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                <div className="aspect-square bg-stone-100 grid place-items-center text-stone-300 text-xs">
                  {p.image_path ? (
                    <img src={productImageUrl(p.image_path)} alt={p.name} className="w-full h-full object-cover" />
                  ) : 'ไม่มีรูป'}
                </div>
                <div className="p-2 space-y-1.5">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-sm text-stone-900">{formatBaht(p.price)} บาท <span className="text-xs text-stone-400">/{p.unit}</span></p>
                  {inCart ? (
                    <div className="flex items-center justify-between">
                      <button
                        type="button" onClick={() => updateQty(items.indexOf(inCart), inCart.qty - 1)}
                        className="w-7 h-7 rounded-full bg-stone-100 font-semibold"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium tabular-nums">{inCart.qty}</span>
                      <button
                        type="button" onClick={() => updateQty(items.indexOf(inCart), inCart.qty + 1)}
                        className="w-7 h-7 rounded-full bg-stone-100 font-semibold"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button" onClick={() => addProduct(p)}
                      className="w-full rounded-lg bg-stone-900 text-white text-sm py-1.5"
                    >
                      เพิ่มลงตะกร้า
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <p className="col-span-full text-center text-sm text-stone-400 py-8">ไม่พบสินค้า</p>}
        </div>
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 p-3">
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <div>
              <p className="text-xs text-stone-500">ยอดรวม ({items.length} รายการ)</p>
              <p className="text-xl font-bold text-stone-900">{formatBaht(grandTotal)} บาท</p>
            </div>
            <button
              type="button" onClick={() => setStep('checkout')}
              className="rounded-xl bg-stone-900 text-white font-semibold px-6 py-3"
            >
              สั่งเลย →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
