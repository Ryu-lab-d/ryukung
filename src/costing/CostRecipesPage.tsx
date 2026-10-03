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
                  className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-4 pl-5 space-y-2 shadow-[0_10px_26px_-16px_rgb(51_32_14_/_0.45)]"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-amber-700" aria-hidden="true" />
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display font-semibold text-stone-900 leading-snug">{r.name}</p>
                    <span className="shrink-0 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1">ทำได้ {r.yield_qty} ชิ้น</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-2xl bg-stone-50 border border-stone-100 px-3 py-2">
                      <p className="text-[11px] text-stone-500">ต้นทุน/ชิ้น</p>
                      <p className="text-lg font-bold tabular-nums text-stone-900">{formatBaht(calc.costPerUnit)}</p>
                    </div>
                    <div className="rounded-2xl bg-green-50 border border-green-100 px-3 py-2">
                      <p className="text-[11px] text-green-700">ราคาขายแนะนำ</p>
                      <p className="text-lg font-bold tabular-nums text-green-700">{formatBaht(calc.suggestedPrice)}</p>
                    </div>
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
