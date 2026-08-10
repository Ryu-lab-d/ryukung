import { Link } from 'react-router-dom'
import { useCostRecipes } from './useCostRecipes'
import { computeRecipeCost } from './costMath'
import { formatBaht } from '../lib/money'

export function CostRecipesPage() {
  const { recipes, loading } = useCostRecipes()

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">คำนวณต้นทุน</h1>
        <Link to="/costing/new" className="rounded-lg bg-stone-900 text-white text-sm font-medium px-3.5 py-2">
          + เพิ่มสินค้า
        </Link>
      </div>

      {loading ? (
        <p className="text-stone-500">กำลังโหลด...</p>
      ) : recipes.length === 0 ? (
        <p className="text-sm text-stone-400">ยังไม่มีสูตรที่คำนวณไว้ กด "+ เพิ่มสินค้า" เพื่อเริ่มคำนวณต้นทุนเมนูแรก</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {recipes.map((r) => {
            const calc = computeRecipeCost({
              ingredients: r.ingredients,
              labor: r.labor,
              wasteOverheadPercent: r.waste_overhead_percent,
              yieldQty: r.yield_qty,
              profitPercent: r.profit_percent,
            })
            return (
              <Link
                key={r.id}
                to={`/costing/${r.id}/edit`}
                className="rounded-xl border border-stone-200 bg-white p-4 space-y-1.5"
              >
                <p className="font-medium truncate">{r.name}</p>
                <p className="text-xs text-stone-500">ทำได้ {r.yield_qty} ชิ้น</p>
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-stone-500">ต้นทุน/ชิ้น</span>
                  <span className="font-medium">{formatBaht(calc.costPerUnit)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">ราคาขายแนะนำ</span>
                  <span className="font-semibold text-stone-900">{formatBaht(calc.suggestedPrice)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
