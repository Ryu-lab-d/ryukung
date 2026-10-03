import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIngredients } from './useIngredients'
import { isLowStock } from './ingredientStatus'
import { IngredientFormModal } from './IngredientFormModal'
import { CatalogTabs } from '../products/CatalogTabs'
import { PageHero } from '../layout/PageHero'

export function IngredientsPage() {
  const { ingredients, loading, reload } = useIngredients()
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const lowStockItems = useMemo(() => ingredients.filter((i) => i.is_active && isLowStock(i)), [ingredients])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return ingredients.filter((i) => {
      const matchesSearch = !q || i.name.toLowerCase().includes(q)
      const matchesLowStock = !lowStockOnly || isLowStock(i)
      return matchesSearch && matchesLowStock
    })
  }, [ingredients, search, lowStockOnly])

  if (loading) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-8">
        <CatalogTabs active="ingredients" />

        <PageHero icon="🧂" title="วัตถุดิบ" subtitle={`${ingredients.length} รายการทั้งหมด`}>
          <button type="button" onClick={() => setShowAdd(true)}>+ เพิ่มวัตถุดิบ</button>
        </PageHero>

        {lowStockItems.length > 0 && (
          <button
            type="button"
            onClick={() => setLowStockOnly(true)}
            className="w-full rounded-2xl bg-orange-50 border border-orange-200 p-3.5 text-left shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]"
          >
            <p className="text-xs text-orange-700">⚠️ วัตถุดิบใกล้หมด</p>
            <p className="text-lg font-semibold text-orange-900">{lowStockItems.length} รายการ</p>
          </button>
        )}

        <input
          placeholder="ค้นหาวัตถุดิบ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
        />

        {lowStockOnly && (
          <button
            type="button"
            onClick={() => setLowStockOnly(false)}
            className="rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
          >
            ✕ ยกเลิกกรองเฉพาะที่ใกล้หมด
          </button>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
            <p className="text-3xl mb-1.5">🧂</p>
            <p className="text-sm text-stone-400">
              {ingredients.length === 0 ? 'ยังไม่มีวัตถุดิบเลย ลองกด "+ เพิ่มวัตถุดิบ" เพื่อเริ่มต้น' : 'ไม่พบวัตถุดิบที่ตรงเงื่อนไข'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((i) => {
              const low = isLowStock(i)
              return (
                <Link
                  key={i.id}
                  to={`/ingredients/${i.id}`}
                  className={
                    'glow-card relative overflow-hidden flex items-center justify-between gap-2 rounded-2xl border bg-white pl-5 pr-3.5 py-3 shadow-[0_6px_18px_-12px_rgb(51_32_14_/_0.45)] ' +
                    (low ? 'border-orange-300 bg-orange-50/50' : 'border-stone-200')
                  }
                >
                  <span className={'absolute left-0 top-0 bottom-0 w-1.5 ' + (low ? 'bg-orange-500' : i.is_active ? 'bg-green-500' : 'bg-stone-300')} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className={'font-medium truncate ' + (!i.is_active ? 'text-stone-400' : 'text-stone-900')}>
                      {i.name}
                      {!i.is_active && ' (ปิดใช้งาน)'}
                    </p>
                    <p className="text-xs text-stone-500">฿{i.cost_per_unit.toFixed(2)} / {i.unit}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={'font-semibold tabular-nums ' + (low ? 'text-orange-700' : 'text-stone-900')}>
                      {i.stock_qty.toLocaleString('th-TH')} {i.unit}
                    </p>
                    {low && <p className="text-xs text-orange-600">ใกล้หมด</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {showAdd && (
          <IngredientFormModal
            onClose={() => setShowAdd(false)}
            onSaved={() => {
              setShowAdd(false)
              void reload()
            }}
          />
        )}
      </div>
    </div>
  )
}
