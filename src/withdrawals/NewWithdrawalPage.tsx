import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProducts } from '../products/useProducts'
import { useCategories } from '../products/useCategories'
import { ProductCard } from '../products/ProductCard'
import { createWithdrawal, type WithdrawalWageInput } from './api'
import { formatBaht } from '../lib/money'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { useStaffMembers } from '../staff/useStaffMembers'

type SelectedItem = {
  product_id: string | null
  product_name: string
  original_price: number
  unit_price: number
  unit_cost: number
  qty_out: number
}

type WithdrawalDraft = {
  withdrawnAt: string
  location: string
  note: string
  items: SelectedItem[]
  discountPerUnit: string
  withdrawnBy: string
  wageType: '' | 'cash' | 'product'
  wageCashAmount: string
  wageProductId: string
  wageProductQty: string
}

function todayDateInputValue(): string {
  return new Date().toLocaleDateString('en-CA')
}

const DRAFT_KEY = 'withdrawal-form:new'

export function NewWithdrawalPage() {
  const navigate = useNavigate()
  const { products } = useProducts()
  const { categories } = useCategories()
  const { members } = useStaffMembers()
  const activeStaff = members.filter((m) => m.status === 'active')
  const [draft] = useState(() => loadFormDraft<WithdrawalDraft>(DRAFT_KEY))
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [withdrawnAt, setWithdrawnAt] = useState(draft?.withdrawnAt ?? todayDateInputValue())
  const [location, setLocation] = useState(draft?.location ?? '')
  const [note, setNote] = useState(draft?.note ?? '')
  const [items, setItems] = useState<SelectedItem[]>(draft?.items ?? [])
  const [discountPerUnit, setDiscountPerUnit] = useState(draft?.discountPerUnit ?? '')
  const [withdrawnBy, setWithdrawnBy] = useState(draft?.withdrawnBy ?? '')
  const [wageType, setWageType] = useState<'' | 'cash' | 'product'>(draft?.wageType ?? '')
  const [wageCashAmount, setWageCashAmount] = useState(draft?.wageCashAmount ?? '30')
  const [wageProductId, setWageProductId] = useState(draft?.wageProductId ?? '')
  const [wageProductQty, setWageProductQty] = useState(draft?.wageProductQty ?? '1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useFormDraft(DRAFT_KEY, {
    withdrawnAt,
    location,
    note,
    items,
    discountPerUnit,
    withdrawnBy,
    wageType,
    wageCashAmount,
    wageProductId,
    wageProductQty,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.is_active && p.name.toLowerCase().includes(q) && (!categoryId || p.category_id === categoryId)
    )
  }, [products, search, categoryId])

  function addProduct(p: (typeof products)[number]) {
    const existingIndex = items.findIndex((it) => it.product_id === p.id)
    if (existingIndex >= 0) {
      setItems((rows) => rows.map((r, i) => (i === existingIndex ? { ...r, qty_out: r.qty_out + 1 } : r)))
      return
    }
    const discountedPrice = Math.max(p.price - (Number(discountPerUnit) || 0), 0)
    setItems((rows) => [
      ...rows,
      { product_id: p.id, product_name: p.name, original_price: p.price, unit_price: discountedPrice, unit_cost: p.cost, qty_out: 1 },
    ])
  }

  function updateQty(index: number, qty: number) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, qty_out: qty } : r)))
  }

  function updatePrice(index: number, price: number) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, unit_price: price } : r)))
  }

  function applyDiscountToAll() {
    const discount = Number(discountPerUnit) || 0
    setItems((rows) => rows.map((r) => ({ ...r, unit_price: Math.max(r.original_price - discount, 0) })))
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (items.length === 0) {
      setError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')
      return
    }
    if (withdrawnBy && wageType === 'cash' && (Number(wageCashAmount) < 1 || Number(wageCashAmount) > 30)) {
      setError('ค่าจ้างเงินสดต้องอยู่ระหว่าง 1-30 บาท')
      return
    }
    let wage: WithdrawalWageInput | null = null
    if (withdrawnBy && wageType === 'cash' && Number(wageCashAmount) >= 1 && Number(wageCashAmount) <= 30) {
      wage = { type: 'cash', amount: Number(wageCashAmount) }
    } else if (withdrawnBy && wageType === 'product' && wageProductId) {
      const p = products.find((pr) => pr.id === wageProductId)
      if (p) wage = { type: 'product', productId: p.id, productName: p.name, unitCost: p.cost, qty: Number(wageProductQty) || 1 }
    }

    setSaving(true)
    const { id, error: saveError } = await createWithdrawal({
      withdrawnAt,
      location: location.trim() || null,
      note: note.trim() || null,
      withdrawnBy: withdrawnBy || null,
      wage,
      items: items
        .filter((it) => it.qty_out > 0)
        .map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          unit_price: it.unit_price,
          unit_cost: it.unit_cost,
          qty_out: it.qty_out,
        })),
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    clearFormDraft(DRAFT_KEY)
    navigate(`/withdrawals/${id}`)
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
      <Link to="/withdrawals" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าเบิกของ
      </Link>
      <h1 className="text-lg font-semibold">เบิกของใหม่</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="withdrawn-at" className="text-sm text-stone-600">วันที่เบิก</label>
          <input
            id="withdrawn-at"
            type="date"
            value={withdrawnAt}
            onChange={(e) => setWithdrawnAt(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="location" className="text-sm text-stone-600">สถานที่ (ไม่บังคับ)</label>
          <input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="เช่น โรงเรียน"
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label htmlFor="withdrawn-by" className="text-sm text-stone-600">ผู้เบิกไปขาย (ไม่บังคับ)</label>
          <select
            id="withdrawn-by"
            value={withdrawnBy}
            onChange={(e) => setWithdrawnBy(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            <option value="">ไม่ระบุ</option>
            {activeStaff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name ?? m.email}{m.role === 'owner' ? ' (เจ้าของร้าน)' : ''}
              </option>
            ))}
          </select>
        </div>
        {withdrawnBy && (
          <div className="space-y-2 col-span-2">
            <label className="text-sm text-stone-600">ค่าจ้างผู้เบิก (ไม่บังคับ)</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWageType(wageType === 'cash' ? '' : 'cash')}
                className={'rounded-full px-3 py-1.5 text-sm ' + (wageType === 'cash' ? 'bg-stone-900 text-white' : 'bg-stone-100')}
              >
                💵 เงินสด
              </button>
              <button
                type="button"
                onClick={() => setWageType(wageType === 'product' ? '' : 'product')}
                className={'rounded-full px-3 py-1.5 text-sm ' + (wageType === 'product' ? 'bg-stone-900 text-white' : 'bg-stone-100')}
              >
                🍪 สินค้า
              </button>
            </div>
            {wageType === 'cash' && (
              <div className="space-y-0.5">
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="30"
                  step="1"
                  placeholder="30"
                  value={wageCashAmount}
                  onChange={(e) => setWageCashAmount(e.target.value)}
                  aria-label="จำนวนเงินค่าจ้าง (บาท)"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <p className="text-xs text-stone-400">ตั้งได้ 1-30 บาท</p>
              </div>
            )}
            {wageType === 'product' && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={wageProductId}
                  onChange={(e) => setWageProductId(e.target.value)}
                  aria-label="สินค้าที่จ่ายเป็นค่าจ้าง"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="">เลือกสินค้า</option>
                  {products.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  placeholder="จำนวน"
                  value={wageProductQty}
                  onChange={(e) => setWageProductQty(e.target.value)}
                  aria-label="จำนวนสินค้าที่จ่ายเป็นค่าจ้าง"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        )}
        <div className="space-y-1 col-span-2">
          <label htmlFor="note" className="text-sm text-stone-600">หมายเหตุ (ไม่บังคับ)</label>
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">เลือกสินค้าที่จะเบิก</h2>
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
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-0.5">
            <label htmlFor="discount-per-unit" className="text-sm text-stone-600">
              ลดราคาต่อชิ้น (บาท) — เช่นไม่มีค่าสติกเกอร์/ถุงตอนเอาไปขายนอกร้าน
            </label>
            <input
              id="discount-per-unit"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="เช่น 10"
              value={discountPerUnit}
              onChange={(e) => setDiscountPerUnit(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={applyDiscountToAll}
            disabled={items.length === 0}
            className="rounded-lg border border-stone-300 text-stone-700 text-sm font-medium px-3 py-2 disabled:opacity-40"
          >
            ใช้กับทุกชิ้นที่เลือกแล้ว
          </button>
        </div>
        <p className="text-xs text-stone-400">
          ตั้งไว้ก่อนแล้วค่อยเลือกสินค้า ราคาจะลดให้อัตโนมัติทุกชิ้น หรือกด "ใช้กับทุกชิ้น" เพื่ออัปเดตของที่เลือกไว้แล้ว — แก้ราคาแต่ละชิ้นเองด้านล่างได้เสมอ
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">รายการที่จะเบิก</h2>
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
                <label htmlFor={`item-price-${i}`} className="text-xs text-stone-500">ราคาขาย/ชิ้น (บาท)</label>
                <input
                  id={`item-price-${i}`}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={it.unit_price}
                  onChange={(e) => updatePrice(i, Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                />
              </div>
              <div className="space-y-0.5">
                <label htmlFor={`item-qty-${i}`} className="text-xs text-stone-500">จำนวนที่เบิก</label>
                <input
                  id={`item-qty-${i}`}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={it.qty_out}
                  onChange={(e) => updateQty(i, Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                />
              </div>
            </div>
            {it.unit_price !== it.original_price && (
              <p className="text-xs text-stone-400">
                ราคาปกติ {formatBaht(it.original_price)} → ลดเหลือ {formatBaht(it.unit_price)} ต่อชิ้น
              </p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก...' : 'เริ่มเบิกของ'}
      </button>
    </div>
  )
}
