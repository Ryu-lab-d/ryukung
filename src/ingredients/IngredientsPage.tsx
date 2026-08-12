import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIngredients } from './useIngredients'
import { isLowStock } from './ingredientStatus'
import { IngredientFormModal } from './IngredientFormModal'
import { CatalogTabs } from '../products/CatalogTabs'

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

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <CatalogTabs active="ingredients" />

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">🧂 วัตถุดิบ</h1>
        <button type="button" onClick={() => setShowAdd(true)} className="rounded-lg bg-stone-900 text-white text-sm font-medium px-3.5 py-2">
          + เพิ่มวัตถุดิบ
        </button>
      </div>

      {lowStockItems.length > 0 && (
        <button
          type="button"
          onClick={() => setLowStockOnly(true)}
          className="w-full rounded-xl bg-orange-50 border border-orange-200 p-3 text-left"
        >
          <p className="text-xs text-orange-700">⚠️ วัตถุดิบใกล้หมด</p>
          <p className="text-lg font-semibold text-orange-900">{lowStockItems.length} รายการ</p>
        </button>
      )}

      <input
        placeholder="ค้นหาวัตถุดิบ"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      {lowStockOnly && (
        <button type="button" onClick={() => setLowStockOnly(false)} className="text-sm text-stone-600 underline">
          ✕ ยกเลิกกรองเฉพาะที่ใกล้หมด
        </button>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400">
          {ingredients.length === 0 ? 'ยังไม่มีวัตถุดิบเลย ลองกด "+ เพิ่มวัตถุดิบ" เพื่อเริ่มต้น' : 'ไม่พบวัตถุดิบที่ตรงเงื่อนไข'}
        </p>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
          {filtered.map((i) => {
            const low = isLowStock(i)
            return (
              <Link key={i.id} to={`/ingredients/${i.id}`} className="flex items-center justify-between gap-2 px-3.5 py-3 hover:bg-stone-50">
                <div className="min-w-0">
                  <p className={'font-medium truncate ' + (!i.is_active ? 'text-stone-400' : '')}>
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
  )
}
