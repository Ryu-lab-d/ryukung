import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProducts } from '../products/useProducts'
import { useCategories } from '../products/useCategories'
import { ProductCard } from '../products/ProductCard'
import { createWithdrawal } from './api'

type SelectedItem = {
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty_out: number
}

function todayDateInputValue(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function NewWithdrawalPage() {
  const navigate = useNavigate()
  const { products } = useProducts()
  const { categories } = useCategories()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [withdrawnAt, setWithdrawnAt] = useState(todayDateInputValue())
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<SelectedItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setItems((rows) => [...rows, { product_id: p.id, product_name: p.name, unit_price: p.price, unit_cost: p.cost, qty_out: 1 }])
  }

  function updateQty(index: number, qty: number) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, qty_out: qty } : r)))
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (items.length === 0) {
      setError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')
      return
    }
    setSaving(true)
    const { id, error: saveError } = await createWithdrawal({
      withdrawnAt,
      location: location.trim() || null,
      note: note.trim() || null,
      items: items.filter((it) => it.qty_out > 0),
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
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
        <h2 className="text-sm font-semibold">รายการที่จะเบิก</h2>
        {items.length === 0 && <p className="text-sm text-stone-400">ยังไม่ได้เลือกสินค้า</p>}
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
            <div className="flex-1">
              <p className="text-sm font-medium">{it.product_name}</p>
            </div>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={it.qty_out}
              onChange={(e) => updateQty(i, Number(e.target.value))}
              className="w-16 rounded-lg border border-stone-300 px-2 py-2.5 text-sm text-center"
            />
            <button type="button" onClick={() => removeItem(i)} className="text-red-600 text-sm px-2 py-2.5">
              ลบ
            </button>
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
