import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatBaht } from '../lib/money'

// type นี้ตั้งใจไม่มีฟิลด์ต้นทุนอยู่เลย ตรงกับสิ่งที่ get_public_order คืนมาจริง
type PublicOrderView = {
  shop_name: string
  order_no: string
  needed_date: string | null
  fulfillment_type: string
  work_status: string
  payment_status: string
  items_total: number
  discount_amount: number
  shipping_fee: number
  grand_total: number
  carrier: string | null
  tracking_no: string | null
  note: string | null
  items: { product_name: string; unit_price: number; qty: number; line_total: number; note: string | null }[]
}

const PAYMENT_LABEL: Record<string, string> = { unpaid: 'ยังไม่ชำระ', partial: 'มัดจำแล้ว', paid: 'ชำระครบแล้ว' }

export function PublicOrderPage() {
  const { token } = useParams()
  const [order, setOrder] = useState<PublicOrderView | null | undefined>(undefined)

  useEffect(() => {
    if (!token) return
    supabase.rpc('get_public_order', { p_token: token }).then(({ data }) => {
      setOrder((data as PublicOrderView | null) ?? null)
    })
  }, [token])

  if (order === undefined) return <div className="p-4 text-stone-500">กำลังโหลด...</div>
  if (order === null) return <div className="p-4 text-stone-500">ไม่พบออเดอร์นี้</div>

  return (
    <div className="min-h-screen bg-stone-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl p-4 space-y-3">
        <h1 className="text-lg font-semibold">{order.shop_name}</h1>
        <p className="text-sm text-stone-500">ออเดอร์ {order.order_no}</p>

        <div className="space-y-1">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{it.product_name} x{it.qty}</span>
              <span>{formatBaht(it.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-100 pt-2 space-y-1 text-sm">
          <div className="flex justify-between"><span>รวมสินค้า</span><span>{formatBaht(order.items_total)}</span></div>
          <div className="flex justify-between"><span>ส่วนลด</span><span>-{formatBaht(order.discount_amount)}</span></div>
          <div className="flex justify-between"><span>ค่าส่ง</span><span>{formatBaht(order.shipping_fee)}</span></div>
          <div className="flex justify-between font-semibold"><span>ยอดรวม</span><span>{formatBaht(order.grand_total)}</span></div>
        </div>

        <p className="text-sm">วันที่ต้องได้ของ: {order.needed_date ?? '-'}</p>
        <p className="text-sm">สถานะการชำระเงิน: {PAYMENT_LABEL[order.payment_status]}</p>
        {order.tracking_no && <p className="text-sm">เลขพัสดุ: {order.tracking_no} ({order.carrier})</p>}
      </div>
    </div>
  )
}
