import { useNavigate } from 'react-router-dom'
import { useIngredients } from './useIngredients'
import { isLowStock } from './ingredientStatus'

/** แจ้งเตือนวัตถุดิบใกล้หมดบนหน้าบอร์ดออเดอร์ (จุดที่พนักงานเปิดดูบ่อยที่สุด) ไม่โผล่เลยถ้าไม่มีอะไรใกล้หมด */
export function LowStockAlertCard() {
  const { ingredients, loading } = useIngredients()
  const navigate = useNavigate()

  if (loading) return null
  const lowStockCount = ingredients.filter((i) => i.is_active && isLowStock(i)).length
  if (lowStockCount === 0) return null

  return (
    <div className="px-4 pt-3">
      <button
        type="button"
        onClick={() => navigate('/ingredients')}
        className="w-full flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-left hover:border-amber-300 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-amber-100 grid place-items-center text-lg shrink-0">⚠️</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-amber-700">วัตถุดิบใกล้หมด</p>
          <p className="text-lg font-bold text-amber-900 tabular-nums">{lowStockCount} รายการ</p>
        </div>
        <span className="text-amber-400 shrink-0">→</span>
      </button>
    </div>
  )
}
