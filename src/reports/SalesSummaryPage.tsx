import { useMemo, useState } from 'react'
import { rangeToDates, type RangeKey } from './dateRange'
import { useSalesSummary } from './useSalesSummary'
import { formatBaht } from '../lib/money'

const RANGE_LABELS: Record<RangeKey, string> = { today: 'วันนี้', '7d': '7 วัน', '30d': '30 วัน', custom: 'กำหนดเอง' }

export function SalesSummaryPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { from, to } = useMemo(() => rangeToDates(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo])
  const { orders, loading, sales, cost, profit, profitPercent, avgOrder } = useSalesSummary(from, to)

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">สรุปยอด</h1>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRangeKey(key)}
            className={'rounded-full px-3 py-1.5 text-sm ' + (rangeKey === key ? 'bg-stone-900 text-white' : 'bg-stone-100')}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {rangeKey === 'custom' && (
        <div className="flex gap-2">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">กำลังโหลด...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">ยอดขาย</p><p className="text-lg font-semibold">{formatBaht(sales)}</p></div>
            <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">จำนวนออเดอร์</p><p className="text-lg font-semibold">{orders.length}</p></div>
            <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">ยอดเฉลี่ยต่อออเดอร์</p><p className="text-lg font-semibold">{formatBaht(avgOrder)}</p></div>
            <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">ต้นทุนโดยประมาณ</p><p className="text-lg font-semibold">{formatBaht(cost)}</p></div>
            <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">กำไรโดยประมาณ</p><p className="text-lg font-semibold">{formatBaht(profit)}</p></div>
            <div className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">% กำไร</p><p className="text-lg font-semibold">{profitPercent.toFixed(1)}%</p></div>
          </div>

          <p className="text-xs text-stone-500 bg-amber-50 border border-amber-200 rounded-lg p-2">
            กำไรนี้คำนวณจากต้นทุนที่กรอกเองต่อสินค้า ยังไม่ใช่ต้นทุนจริงจากสูตรและราคาวัตถุดิบ
          </p>

          <div className="space-y-1">
            {orders.map((o) => (
              <div key={o.id} className="flex justify-between text-sm border-b border-stone-100 py-1.5">
                <span>{o.order_no}</span><span>{formatBaht(o.grand_total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
