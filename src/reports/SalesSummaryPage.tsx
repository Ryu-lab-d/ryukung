import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { rangeToDates, type RangeKey } from './dateRange'
import { useSalesSummary } from './useSalesSummary'
import { useSalesTrend } from './useSalesTrend'
import { useExpenses } from './useExpenses'
import { useAllProductIngredients } from './useAllProductIngredients'
import { computeProductProfitability } from './productProfitability'
import { useIngredients } from '../ingredients/useIngredients'
import { formatBaht } from '../lib/money'

const RANGE_LABELS: Record<RangeKey, string> = { today: 'วันนี้', '7d': '7 วัน', '30d': '30 วัน', custom: 'กำหนดเอง' }
const TREND_DAYS = 14

export function SalesSummaryPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const { from, to } = useMemo(() => rangeToDates(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo])
  const { orders, loading, sales, cost, profit, profitPercent, avgOrder } = useSalesSummary(from, to)
  const { trend, loading: trendLoading } = useSalesTrend(TREND_DAYS)
  const { expenses, loading: expensesLoading } = useExpenses(from, to)
  const { ingredients } = useIngredients()
  const { links: productIngredients } = useAllProductIngredients()

  const ingredientCostById = useMemo(() => new Map(ingredients.map((i) => [i.id, i.cost_per_unit])), [ingredients])
  const productProfits = useMemo(
    () => computeProductProfitability(orders, productIngredients, ingredientCostById),
    [orders, productIngredients, ingredientCostById]
  )
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netProfit = profit - totalExpenses

  const profitIsPositive = profit >= 0
  const netProfitIsPositive = netProfit >= 0

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold">สรุปยอด</h1>

      {/* ตัวเลือกช่วงเวลาแบบแท็บกลุ่มเดียว ให้เห็นชัดว่าอันไหนถูกเลือกอยู่ */}
      <div className="inline-flex rounded-full bg-stone-100 p-1 gap-1">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRangeKey(key)}
            className={
              'rounded-full px-3 py-1.5 text-sm font-medium ' +
              (rangeKey === key ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600')
            }
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

      {/* แนวโน้มยอดขาย — คงที่จำนวนวันตาม TREND_DAYS เสมอ ไม่ผูกกับตัวเลือกช่วงเวลาด้านบน เพราะจุดประสงค์ต่างกัน
          (อันบนคือ "สรุปยอดของช่วงที่เลือก" ส่วนนี้คือ "ดูเทรนด์เทียบกันข้ามวัน") */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-500">แนวโน้มยอดขาย {TREND_DAYS} วันล่าสุด</h2>
        <SalesTrendChart trend={trend} loading={trendLoading} />
      </div>

      {loading ? (
        <p className="text-stone-500">กำลังโหลด...</p>
      ) : (
        <>
          {/* ตัวเลขหลัก — ยอดขายคือสิ่งที่ร้านอยากเห็นก่อนสุดตอนเปิดหน้านี้ */}
          <div className="rounded-2xl bg-stone-900 text-white p-5 space-y-1">
            <p className="text-xs uppercase tracking-wide text-stone-300">ยอดขาย</p>
            <p className="text-5xl font-bold [font-variant-numeric:normal]">{formatBaht(sales)}</p>
            <p className="text-sm text-stone-300">{orders.length} ออเดอร์ · เฉลี่ย {formatBaht(avgOrder)} บาท/ออเดอร์</p>
          </div>

          {/* กำไรแยกการ์ดต่างหาก ใช้สีเขียว/แดงบอกสถานะ (บวก/ลบ) ให้ต่างจากตัวเลขทั่วไปชัดเจน */}
          <div
            className={
              'rounded-2xl p-4 flex items-center justify-between border ' +
              (profitIsPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
            }
          >
            <div>
              <p className={'text-xs uppercase tracking-wide ' + (profitIsPositive ? 'text-green-700' : 'text-red-700')}>
                กำไรโดยประมาณ
              </p>
              <p className={'text-3xl font-bold ' + (profitIsPositive ? 'text-green-800' : 'text-red-800')}>
                {formatBaht(profit)}
              </p>
            </div>
            <span
              className={
                'text-sm font-semibold rounded-full px-3 py-1 ' +
                (profitIsPositive ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800')
              }
            >
              {profitPercent.toFixed(1)}%
            </span>
          </div>

          {/* สถิติรอง — เป็นพื้นเรียบกลางๆ ไม่แย่งสายตาจากสองก้อนบน */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="text-xs text-stone-500">จำนวนออเดอร์</p>
              <p className="text-xl font-semibold tabular-nums">{orders.length}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="text-xs text-stone-500">ต้นทุนโดยประมาณ</p>
              <p className="text-xl font-semibold">{formatBaht(cost)}</p>
            </div>
          </div>

          <p className="text-xs text-stone-600 bg-stone-100 border border-stone-200 rounded-lg p-2.5">
            กำไรนี้คำนวณจากต้นทุนที่กรอกเองต่อสินค้า ยังไม่ใช่ต้นทุนจริงจากสูตรและราคาวัตถุดิบ
          </p>

          {/* กำไรสุทธิ — หักรายจ่ายอื่นๆ (ค่าเช่า บรรจุภัณฑ์ ฯลฯ) ออกจากกำไรขั้นต้นด้านบน แยกการ์ดต่างหากเพื่อไม่ปนกับตัวเลขที่ผูกกับ spec เดิม */}
          <div
            className={
              'rounded-2xl p-4 space-y-2 border ' +
              (netProfitIsPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')
            }
          >
            <div className="flex items-center justify-between">
              <p className={'text-xs uppercase tracking-wide ' + (netProfitIsPositive ? 'text-emerald-700' : 'text-red-700')}>
                กำไรสุทธิ (หักรายจ่ายอื่นๆ แล้ว)
              </p>
              <Link to="/expenses" className="text-xs text-stone-500 underline shrink-0">
                💸 จัดการรายจ่าย →
              </Link>
            </div>
            <p className={'text-2xl font-bold ' + (netProfitIsPositive ? 'text-emerald-800' : 'text-red-800')}>
              {expensesLoading ? '...' : formatBaht(netProfit)}
            </p>
            <p className="text-xs text-stone-500">
              รายจ่ายอื่นๆ ในช่วงนี้ {expensesLoading ? '...' : formatBaht(totalExpenses)}
            </p>
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-stone-500">สินค้าขายดีในช่วงนี้ (เรียงตามกำไร)</h2>
            {productProfits.length === 0 && <p className="text-sm text-stone-400">ไม่มีสินค้าขายในช่วงที่เลือก</p>}
            <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
              {productProfits.slice(0, 5).map((p, i) => (
                <div key={p.productId ?? p.name} className="flex items-center gap-3 text-sm px-3 py-2.5">
                  <span className="text-stone-400 font-semibold w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-700 truncate">{p.name}</p>
                    <p className="text-xs text-stone-400">
                      {p.qty} ชิ้น · {formatBaht(p.revenue)} บาท ·{' '}
                      <span className={p.costSource === 'recipe' ? 'text-stone-500' : 'text-amber-600'}>
                        {p.costSource === 'recipe' ? 'ต้นทุนจากสูตร' : 'ต้นทุนประมาณการ'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={'font-medium tabular-nums ' + (p.profit >= 0 ? 'text-green-700' : 'text-red-700')}>
                      {formatBaht(p.profit)}
                    </p>
                    <p className="text-xs text-stone-400">{p.marginPercent.toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-stone-500">รายการออเดอร์ในช่วงนี้</h2>
            {orders.length === 0 && <p className="text-sm text-stone-400">ไม่มีออเดอร์ในช่วงที่เลือก</p>}
            <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
              {orders.map((o) => (
                <div key={o.id} className="flex justify-between items-center text-sm px-3 py-2.5 hover:bg-stone-50">
                  <span className="text-stone-700">{o.order_no}</span>
                  <span className="font-medium tabular-nums">{formatBaht(o.grand_total)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** กราฟแท่งง่ายๆ ด้วย div ล้วน ไม่ใช้ไลบรารีกราฟเพิ่ม เพราะมีแค่เส้นเดียวไม่ซับซ้อนพอจะคุ้มโหลดไลบรารีใหม่ */
function SalesTrendChart({ trend, loading }: { trend: { date: string; sales: number }[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-stone-500">กำลังโหลด...</p>
  if (trend.every((t) => t.sales === 0)) {
    return <p className="text-sm text-stone-400">ยังไม่มีออเดอร์ในช่วง {trend.length} วันที่ผ่านมา</p>
  }

  const max = Math.max(...trend.map((t) => t.sales))

  return (
    <div className="flex items-end gap-1 h-28">
      {trend.map((t) => {
        const heightPercent = t.sales > 0 ? Math.max((t.sales / max) * 100, 4) : 1
        const day = new Date(t.date + 'T00:00:00')
        return (
          <div key={t.date} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
            <div
              className={'w-full rounded-t ' + (t.sales > 0 ? 'bg-stone-900' : 'bg-stone-100')}
              style={{ height: `${heightPercent}%` }}
              title={`${day.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}: ${formatBaht(t.sales)} บาท`}
            />
            <span className="text-[10px] text-stone-400 tabular-nums">{day.getDate()}</span>
          </div>
        )
      })}
    </div>
  )
}
