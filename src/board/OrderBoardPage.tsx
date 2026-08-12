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

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="pb-24">
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
        className="fixed bottom-20 lg:bottom-6 right-6 rounded-full bg-stone-900 text-white w-14 h-14 grid place-items-center text-2xl shadow-lg"
      >
        +
      </Link>
    </div>
  )
}
