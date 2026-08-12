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
    <div className="px-4 pt-2">
      <button
        type="button"
        onClick={() => navigate('/ingredients')}
        className="w-full rounded-xl bg-orange-50 border border-orange-200 p-3 text-left"
      >
        <p className="text-xs text-orange-700">⚠️ วัตถุดิบใกล้หมด</p>
        <p className="text-lg font-semibold text-orange-900">{lowStockCount} รายการ</p>
      </button>
    </div>
  )
}
