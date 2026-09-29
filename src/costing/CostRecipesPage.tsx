import { Link } from 'react-router-dom'
import { useCostRecipes } from './useCostRecipes'
import { computeRecipeCost } from './costMath'
import { formatBaht } from '../lib/money'

export function CostRecipesPage() {
  const { recipes, loading } = useCostRecipes()

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-8">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-stone-900">คำนวณต้นทุน</h1>
            <p className="text-sm text-stone-500 mt-0.5">{recipes.length} สูตรทั้งหมด</p>
          </div>
          <Link
            to="/costing/new"
            className="rounded-full bg-stone-900 text-white text-sm font-medium px-3.5 py-2 shadow-[0_6px_16px_-4px_rgb(0_0_0_/_0.3)] shrink-0"
          >
            + คำนวณเมนูใหม่
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2.5 py-8 text-stone-400">
            <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
            กำลังโหลด...
          </div>
        ) : recipes.length === 0 ? (
          <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
            <p className="text-3xl mb-1.5">🧮</p>
            <p className="text-sm text-stone-400">ยังไม่มีสูตรที่คำนวณไว้ กด "+ คำนวณเมนูใหม่" เพื่อเริ่มคำนวณต้นทุนเมนูแรก</p>
          </div>
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
                  className="rounded-2xl border border-stone-200 bg-white p-4 space-y-1.5 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)] hover:border-stone-300 transition-colors"
                >
                  <p className="font-medium text-stone-900 truncate">{r.name}</p>
                  <p className="text-xs text-stone-500">ทำได้ {r.yield_qty} ชิ้น</p>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-stone-500">ต้นทุน/ชิ้น</span>
                    <span className="font-medium text-stone-900">{formatBaht(calc.costPerUnit)}</span>
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
    </div>
  )
}
