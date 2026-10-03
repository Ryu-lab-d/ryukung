import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrderBoard } from './useOrderBoard'
import { AlertBar } from './AlertBar'
import { BoardDesktop } from './BoardDesktop'
import { BoardMobile, type MobileQuickFilter } from './BoardMobile'
import { LowStockAlertCard } from '../ingredients/LowStockAlertCard'

export function OrderBoardPage() {
  const { orders, loading, changeStatus, reload } = useOrderBoard()
  const [mobileTab, setMobileTab] = useState('to_bake')
  const [quick, setQuick] = useState<MobileQuickFilter>(null)
  const autoPicked = useRef(false)

  // เปิดมาครั้งแรกถ้ามีออเดอร์ลูกค้าสั่งเองรอยืนยัน ให้เด้งไปแท็บ "รอยืนยัน" เลย — เดิมแท็บนี้ซ่อนอยู่จนพนักงานไม่เห็น
  useEffect(() => {
    if (loading || autoPicked.current) return
    autoPicked.current = true
    if (orders.some((o) => o.is_draft && o.order_source === 'customer')) setMobileTab('draft')
  }, [loading, orders])

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
      <div className="px-4 pt-5 pb-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">ออเดอร์</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {activeCount} ออเดอร์กำลังดำเนินการ<span className="hidden lg:inline"> — ลากการ์ดเพื่อเปลี่ยนสถานะ</span>
          </p>
        </div>
        <Link
          to="/orders/new"
          className="hidden lg:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-stone-900 text-white text-sm font-semibold px-4 py-2"
        >
          + สร้างออเดอร์
        </Link>
      </div>
      <AlertBar
        orders={orders}
        activeKey={quick ?? (mobileTab === 'draft' ? 'pending' : null)}
        onPendingConfirm={() => {
          setQuick(null)
          setMobileTab('draft')
        }}
        onBakeToday={() => setQuick((q) => (q === 'bake' ? null : 'bake'))}
        onUnpaid={() => setQuick((q) => (q === 'unpaid' ? null : 'unpaid'))}
      />
      <LowStockAlertCard />
      <BoardDesktop orders={orders} onChangeStatus={changeStatus} />
      <BoardMobile
        orders={orders}
        tab={mobileTab}
        onTabChange={setMobileTab}
        quick={quick}
        onClearQuick={() => setQuick(null)}
        onChangeStatus={changeStatus}
        onPaid={() => void reload()}
      />
      <Link
        to="/orders/new"
        aria-label="สร้างออเดอร์ใหม่"
        className="lg:hidden fixed bottom-20 right-5 z-20 rounded-full bg-gradient-to-br from-amber-500 to-amber-800 text-white w-14 h-14 grid place-items-center text-3xl shadow-[0_14px_28px_-10px_rgb(146_82_12_/_0.8)] active:scale-90"
      >
        +
      </Link>
    </div>
  )
}
