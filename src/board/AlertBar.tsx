import { isToday } from '../lib/dates'
import { formatBaht } from '../lib/money'
import type { BoardOrder } from './useOrderBoard'

type Tile = { key: string; icon: string; label: string; value: string; sub: string; tone: string; urgent: boolean; onClick: () => void }

/** แผงสรุป "ต้องทำอะไรตอนนี้" — แตะแล้วกรองรายการด้านล่างเลย: รอยืนยัน / อบวันนี้ / ค้างเงิน */
export function AlertBar({
  orders,
  activeKey,
  onPendingConfirm,
  onBakeToday,
  onUnpaid,
}: {
  orders: BoardOrder[]
  activeKey: string | null
  onPendingConfirm: () => void
  onBakeToday: () => void
  onUnpaid: () => void
}) {
  const pending = orders.filter((o) => o.is_draft && o.order_source === 'customer')
  const bakeToday = orders.filter((o) => isToday(o.bake_date) && o.work_status !== 'delivered' && !o.is_draft)
  const unpaid = orders.filter((o) => o.payment_status !== 'paid' && !o.is_draft)
  const unpaidTotal = unpaid.reduce((sum, o) => sum + o.grand_total, 0)

  const tiles: Tile[] = [
    { key: 'pending', icon: '🛒', label: 'รอยืนยัน', value: String(pending.length), sub: 'ลูกค้าสั่งเอง', tone: 'from-indigo-50 border-indigo-200 text-indigo-700', urgent: pending.length > 0, onClick: onPendingConfirm },
    { key: 'bake', icon: '🔥', label: 'อบวันนี้', value: String(bakeToday.length), sub: 'ออเดอร์', tone: 'from-orange-50 border-orange-200 text-orange-700', urgent: false, onClick: onBakeToday },
    { key: 'unpaid', icon: '💸', label: 'ค้างเงิน', value: String(unpaid.length), sub: `${formatBaht(unpaidTotal)} บาท`, tone: 'from-red-50 border-red-200 text-red-700', urgent: false, onClick: onUnpaid },
  ]

  return (
    <div className="grid grid-cols-3 gap-2.5 px-4 pt-3 lg:max-w-3xl">
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={t.onClick}
          className={
            'relative rounded-2xl border bg-gradient-to-br to-white p-3 text-left transition-all duration-200 active:scale-95 ' +
            t.tone + ' ' +
            (activeKey === t.key ? 'ring-2 ring-offset-1 ring-amber-500 shadow-lg' : 'shadow-sm hover:-translate-y-0.5')
          }
        >
          {t.urgent && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" aria-hidden="true" />}
          <p className="text-xs flex items-center gap-1 opacity-90">
            <span className="text-base">{t.icon}</span>
            {t.label}
          </p>
          <p className="text-2xl font-display font-bold tabular-nums leading-tight text-stone-900 mt-0.5">{t.value}</p>
          <p className="text-[11px] text-stone-500 truncate">{t.sub}</p>
        </button>
      ))}
    </div>
  )
}
