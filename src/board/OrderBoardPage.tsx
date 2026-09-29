import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrderBoard } from './useOrderBoard'
import { AlertBar } from './AlertBar'
import { BoardDesktop } from './BoardDesktop'
import { BoardMobile } from './BoardMobile'
import { LowStockAlertCard } from '../ingredients/LowStockAlertCard'

export function OrderBoardPage() {
  const { orders, loading, changeStatus } = useOrderBoard()
  const [mobileFilter, setMobileFilter] = useState('to_bake')

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2.5 text-stone-400">
        <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
        กำลังโหลด...
      </div>
    )
  }

  const activeCount = orders.filter((o) => !o.is_draft && o.work_status !== 'delivered').length

  return (
    <div className="pb-24 bg-stone-50 min-h-screen">
      <div className="px-4 pt-5 pb-1">
        <h1 className="text-xl font-bold text-stone-900">ออเดอร์</h1>
        <p className="text-sm text-stone-500 mt-0.5">{activeCount} ออเดอร์กำลังดำเนินการ — ลากการ์ดเพื่อเปลี่ยนสถานะ</p>
      </div>
      <AlertBar
        orders={orders}
        onFilterBakeToday={() => setMobileFilter('to_bake')}
        onFilterUnpaid={() => setMobileFilter('to_bake')}
      />
      <LowStockAlertCard />
      <BoardDesktop orders={orders} onChangeStatus={changeStatus} />
      <BoardMobile orders={orders} filter={mobileFilter} onChangeStatus={changeStatus} />
      <Link
        to="/orders/new"
        className="fixed bottom-20 lg:bottom-6 right-6 rounded-full bg-stone-900 text-white w-14 h-14 grid place-items-center text-2xl shadow-[0_10px_24px_-8px_rgb(0_0_0_/_0.45)] hover:bg-stone-800 transition-colors"
      >
        +
      </Link>
    </div>
  )
}
