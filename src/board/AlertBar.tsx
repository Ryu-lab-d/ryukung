import { isToday } from '../lib/dates'
import { formatBaht } from '../lib/money'
import type { BoardOrder } from './useOrderBoard'

export function AlertBar({
  orders,
  onFilterBakeToday,
  onFilterUnpaid,
}: {
  orders: BoardOrder[]
  onFilterBakeToday: () => void
  onFilterUnpaid: () => void
}) {
  const bakeToday = orders.filter((o) => isToday(o.bake_date) && o.work_status !== 'delivered' && !o.is_draft)
  const unpaid = orders.filter((o) => o.payment_status !== 'paid' && !o.is_draft)
  const unpaidTotal = unpaid.reduce((sum, o) => sum + o.grand_total, 0)

  return (
    <div className="grid grid-cols-2 gap-3 p-4 pb-0">
      <button
        type="button"
        onClick={onFilterBakeToday}
        className="flex items-center gap-3 rounded-2xl bg-white border border-stone-200 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)] p-3.5 text-left hover:border-orange-300 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-orange-50 grid place-items-center text-lg shrink-0">🔥</div>
        <div className="min-w-0">
          <p className="text-xs text-stone-500">วันนี้ต้องอบ</p>
          <p className="text-lg font-bold text-stone-900 tabular-nums">{bakeToday.length} ออเดอร์</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onFilterUnpaid}
        className="flex items-center gap-3 rounded-2xl bg-white border border-stone-200 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)] p-3.5 text-left hover:border-red-300 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-red-50 grid place-items-center text-lg shrink-0">💸</div>
        <div className="min-w-0">
          <p className="text-xs text-stone-500">ค้างเงิน</p>
          <p className="text-lg font-bold text-stone-900 tabular-nums truncate">{unpaid.length} ออเดอร์ · {formatBaht(unpaidTotal)}</p>
        </div>
      </button>
    </div>
  )
}
