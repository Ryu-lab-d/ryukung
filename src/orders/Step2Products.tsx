import { useMemo, useState } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { useProducts } from '../products/useProducts'
import { useCategories } from '../products/useCategories'
import { ProductCard } from '../products/ProductCard'
import { formatBaht } from '../lib/money'
import type { OrderFormValues } from './schema'

export function Step2Products() {
  const { control, watch } = useFormContext<OrderFormValues>()
  const { fields, append, remove, update } = useFieldArray({ control, name: 'items' })
  const { products } = useProducts()
  const { categories } = useCategories()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.is_active && p.name.toLowerCase().includes(q) && (!categoryId || p.category_id === categoryId)
    )
  }, [products, search, categoryId])

  const items = watch('items')
  const itemsTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)

  function addProduct(p: (typeof products)[number]) {
    const existingIndex = fields.findIndex((f) => f.product_id === p.id)
    if (existingIndex >= 0) {
      update(existingIndex, { ...fields[existingIndex], qty: fields[existingIndex].qty + 1 })
      return
    }
    append({ product_id: p.id, product_name: p.name, unit_price: p.price, unit_cost: p.cost, qty: 1, note: null })
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="ค้นหาสินค้า"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCategoryId(null)} className={'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' + (!categoryId ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')}>
          ทั้งหมด
        </button>
        {categories.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' + (categoryId === c.id ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')}>
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

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-amber-50 grid place-items-center text-sm shrink-0">🧁</span>
          รายการที่เลือก
        </h2>
        {fields.length === 0 && (
          <p className="text-sm text-stone-400 rounded-2xl bg-white border border-stone-200 p-5 text-center">ยังไม่ได้เลือกสินค้า</p>
        )}
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)]"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{field.product_name}</p>
              <p className="text-xs text-stone-500">{formatBaht(field.unit_price)} ต่อชิ้น</p>
            </div>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={items[index]?.qty ?? field.qty}
              onChange={(e) => update(index, { ...field, qty: Number(e.target.value) })}
              className="w-16 rounded-xl border border-stone-300 bg-white px-2 py-2.5 text-sm text-center"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-full border border-red-300 bg-white text-red-600 text-sm font-medium px-3 py-1.5"
            >
              ลบ
            </button>
          </div>
        ))}
      </div>

      <p className="text-right text-sm font-semibold text-stone-900">รวม {formatBaht(itemsTotal)} บาท</p>
    </div>
  )
}
