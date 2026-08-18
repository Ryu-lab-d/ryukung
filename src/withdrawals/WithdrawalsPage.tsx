import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWithdrawals } from './useWithdrawals'
import { computeWithdrawalTotals } from './withdrawalMath'
import { formatBaht } from '../lib/money'
import { useAuth } from '../auth/AuthProvider'
import { useStaffMembers } from '../staff/useStaffMembers'

const STATUS_LABEL: Record<string, string> = { open: 'กำลังขาย', settled: 'ปิดรอบแล้ว' }
const STATUS_COLOR: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  settled: 'bg-green-100 text-green-700',
}

export function WithdrawalsPage() {
  const { withdrawals, loading } = useWithdrawals()
  const { session } = useAuth()
  const { members } = useStaffMembers()
  const myStaffId = members.find((m) => m.user_id === session?.user.id)?.id ?? null
  const [mineOnly, setMineOnly] = useState(false)

  const visibleWithdrawals = mineOnly && myStaffId ? withdrawals.filter((w) => w.withdrawn_by === myStaffId) : withdrawals

  const unpaid = withdrawals.filter((w) => w.status === 'settled' && !w.proceeds_received && computeWithdrawalTotals(w.items).revenue > 0)
  const unpaidTotal = unpaid.reduce((sum, w) => sum + computeWithdrawalTotals(w.items).revenue, 0)

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

      {unpaid.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
          <p className="text-sm font-medium text-orange-800">
            💰 ยังไม่เก็บเงิน {unpaid.length} รายการ รวม {formatBaht(unpaidTotal)} บาท
          </p>
          <ul className="space-y-1">
            {unpaid.map((w) => (
              <li key={w.id}>
                <Link to={`/withdrawals/${w.id}`} className="flex justify-between text-sm text-orange-900">
                  <span>
                    👤 {w.staff_members?.display_name ?? w.staff_members?.email ?? 'ไม่ระบุผู้เบิก'}
                    <span className="text-orange-600">
                      {' '}
                      · {new Date(w.withdrawn_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </span>
                  </span>
                  <span className="font-medium">{formatBaht(computeWithdrawalTotals(w.items).revenue)} บาท</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {myStaffId && (
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          className={'rounded-full px-3 py-1.5 text-sm ' + (mineOnly ? 'bg-stone-900 text-white' : 'bg-stone-100')}
        >
          ของฉันเท่านั้น
        </button>
      )}

      {loading ? (
        <p className="text-stone-500">กำลังโหลด...</p>
      ) : visibleWithdrawals.length === 0 ? (
        <p className="text-sm text-stone-400">
          {mineOnly ? 'ยังไม่มีรายการเบิกของของคุณ' : 'ยังไม่เคยเบิกของเลย กด "+ เบิกของใหม่" เพื่อเริ่มรายการแรก'}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleWithdrawals.map((w) => {
            const totals = computeWithdrawalTotals(w.items)
            const isUnpaid = w.status === 'settled' && !w.proceeds_received && totals.revenue > 0
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isUnpaid && (
                      <span className="text-xs rounded-full px-2 py-0.5 bg-red-100 text-red-700">ยังไม่เก็บเงิน</span>
                    )}
                    <span className={'text-xs rounded-full px-2 py-0.5 ' + STATUS_COLOR[w.status]}>
                      {STATUS_LABEL[w.status]}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-stone-400">
                  👤 {w.staff_members?.display_name ?? w.staff_members?.email ?? 'ไม่ระบุผู้เบิก'}
                </p>
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
