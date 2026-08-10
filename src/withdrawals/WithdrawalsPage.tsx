import { Link } from 'react-router-dom'
import { useWithdrawals } from './useWithdrawals'
import { computeWithdrawalTotals } from './withdrawalMath'
import { formatBaht } from '../lib/money'

const STATUS_LABEL: Record<string, string> = { open: 'กำลังขาย', settled: 'ปิดรอบแล้ว' }
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  settled: 'bg-green-100 text-green-700',
}

export function WithdrawalsPage() {
  const { withdrawals, loading } = useWithdrawals()

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">เบิกของ</h1>
        <Link to="/withdrawals/new" className="rounded-lg bg-stone-900 text-white text-sm font-medium px-3.5 py-2">
          + เบิกของใหม่
        </Link>
      </div>
      <p className="text-sm text-stone-500">
        บันทึกตอนเอาสินค้าที่ทำไว้ไปขายนอกร้าน (เช่น ที่โรงเรียน) แล้วกลับมาปิดรอบใส่ว่าขายได้กี่ชิ้น ได้เงินเท่าไหร่
      </p>

      {loading ? (
        <p className="text-stone-500">กำลังโหลด...</p>
      ) : withdrawals.length === 0 ? (
        <p className="text-sm text-stone-400">ยังไม่เคยเบิกของเลย กด "+ เบิกของใหม่" เพื่อเริ่มรายการแรก</p>
      ) : (
        <div className="space-y-2">
          {withdrawals.map((w) => {
            const totals = computeWithdrawalTotals(w.items)
            return (
              <Link
                key={w.id}
                to={`/withdrawals/${w.id}`}
                className="block rounded-xl border border-stone-200 bg-white p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">
                    {new Date(w.withdrawn_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {w.location && <span className="text-stone-500"> · {w.location}</span>}
                  </p>
                  <span className={'text-xs rounded-full px-2 py-0.5 shrink-0 ' + STATUS_COLOR[w.status]}>
                    {STATUS_LABEL[w.status]}
                  </span>
                </div>
                {w.status === 'settled' ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">
                      ขายได้ {totals.qtySold}/{totals.qtyOut} ชิ้น ({totals.sellThroughPercent.toFixed(0)}%)
                    </span>
                    <span className={'font-medium ' + (totals.profit >= 0 ? 'text-green-700' : 'text-red-700')}>
                      กำไร {formatBaht(totals.profit)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">เบิกไป {totals.qtyOut} ชิ้น · ยังไม่ปิดรอบ</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
