import { useState } from 'react'
import { formatBaht } from '../lib/money'
import type { TodaySale } from './useTodaySales'

/** แถบยอดขายวันนี้ — แตะเพื่อดูรายการล่าสุด กดแล้วเปิดใบเสร็จของบิลนั้นในแท็บใหม่ ไม่ต้องออกจากหน้าขาย */
export function TodaySalesPanel({ sales, loading }: { sales: TodaySale[]; loading: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const total = sales.reduce((sum, s) => sum + s.grand_total, 0)

  if (loading) return null

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-xs text-stone-500">ยอดขายวันนี้ ({sales.length} บิล)</p>
          <p className="text-lg font-bold text-stone-900">{formatBaht(total)} บาท</p>
        </div>
        <span className="text-stone-400 text-sm">{expanded ? '▲ ซ่อน' : '▼ ดูรายการ'}</span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 max-h-64 overflow-y-auto">
          {sales.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone-400">ยังไม่มีการขายวันนี้</p>
          ) : (
            sales.map((s) => (
              <a
                key={s.id}
                href={`/orders/${s.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-4 py-2.5 text-sm border-t border-stone-50 first:border-t-0 hover:bg-stone-50"
              >
                <span className="text-stone-600">
                  {new Date(s.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  {s.order_no && <span className="text-stone-400"> · {s.order_no}</span>}
                </span>
                <span className="font-medium text-stone-900">{formatBaht(s.grand_total)} บาท</span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  )
}
