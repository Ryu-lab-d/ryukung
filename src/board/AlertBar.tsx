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
    <div className="grid grid-cols-2 gap-2 p-4 pb-0">
      <button type="button" onClick={onFilterBakeToday} className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-left">
        <p className="text-xs text-orange-700">วันนี้ต้องอบ</p>
        <p className="text-lg font-semibold text-orange-900">{bakeToday.length} ออเดอร์</p>
      </button>
      <button type="button" onClick={onFilterUnpaid} className="rounded-xl bg-red-50 border border-red-200 p-3 text-left">
        <p className="text-xs text-red-700">ค้างเงิน</p>
        <p className="text-lg font-semibold text-red-900">{unpaid.length} ออเดอร์ · {formatBaht(unpaidTotal)}</p>
      </button>
    </div>
  )
}
