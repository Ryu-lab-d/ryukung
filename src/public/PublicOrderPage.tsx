import { useEffect, useState, type FormEvent } from 'react'
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

const STAGES = [
  { key: 'to_bake', label: 'รับออเดอร์แล้ว' },
  { key: 'baking', label: 'กำลังทำ' },
  { key: 'ready', label: 'แพ็คของแล้ว' },
  { key: 'delivered', label: 'ส่งมอบแล้ว' },
] as const

function StatusTimeline({ status }: { status: string }) {
  const currentIndex = STAGES.findIndex((s) => s.key === status)
  return (
    <div>
      {STAGES.map((stage, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        return (
          <div key={stage.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={
                  'w-7 h-7 rounded-full grid place-items-center text-sm shrink-0 ' +
                  (isDone
                    ? 'bg-stone-900 text-white'
                    : isCurrent
                      ? 'bg-stone-900 text-white ring-4 ring-stone-200 animate-pulse'
                      : 'bg-white text-stone-400 border-2 border-stone-200')
                }
              >
                {isDone ? '✓' : i + 1}
              </div>
              {i < STAGES.length - 1 && (
                <div className={'w-0.5 flex-1 min-h-8 ' + (isDone ? 'bg-stone-900' : 'bg-stone-200')} />
              )}
            </div>
            <div className={'pb-8 -mt-0.5 ' + (isCurrent ? 'text-stone-900' : isDone ? 'text-stone-600' : 'text-stone-400')}>
              <p className={isCurrent ? 'font-semibold' : 'font-medium'}>{stage.label}</p>
              {isCurrent && <p className="text-xs text-stone-500 mt-0.5">สถานะตอนนี้</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function PublicOrderPage() {
  const { token } = useParams()
  const [order, setOrder] = useState<PublicOrderView | null | undefined>(undefined)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [revealing, setRevealing] = useState(false)

  useEffect(() => {
    if (!token) return
    supabase.rpc('get_public_order', { p_token: token }).then(({ data }) => {
      setOrder((data as PublicOrderView | null) ?? null)
    })
  }, [token])

  function handleConfirmName(e: FormEvent) {
    e.preventDefault()
    if (!nameInput.trim()) return
    setCustomerName(nameInput.trim())
    setRevealing(true)
    // หน่วงสั้นๆ ให้รู้สึกเหมือนระบบกำลังเปิดออเดอร์ให้ ข้อมูลจริงโหลดเสร็จรอไว้อยู่แล้วเบื้องหลัง
    setTimeout(() => setRevealing(false), 700)
  }

  // ขั้นที่ 1: ยืนยันชื่อก่อนเสมอ ไม่ว่า token จะถูกหรือผิด เพื่อให้ทุกคนที่เปิดลิงก์เจอหน้าตาเดียวกัน
  if (customerName === null) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4">
        <form onSubmit={handleConfirmName} className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 space-y-4 text-center">
          <div className="text-4xl">🥐</div>
          <h1 className="text-lg font-semibold">ตรวจสอบออเดอร์ของคุณ</h1>
          <p className="text-sm text-stone-500">กรุณากรอกชื่อผู้สั่งซื้อเพื่อยืนยันและดูรายละเอียดออเดอร์</p>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="ชื่อผู้สั่งซื้อ"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-center"
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="w-full rounded-lg bg-stone-900 text-white py-2.5 font-semibold disabled:opacity-40"
          >
            ดูรายละเอียดออเดอร์
          </button>
        </form>
      </div>
    )
  }

  // ขั้นที่ 2: เอฟเฟกต์โหลดกลางจอสั้นๆ
  if (revealing) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-stone-500">กำลังเปิดออเดอร์ของคุณ...</p>
        </div>
      </div>
    )
  }

  // ขั้นที่ 3: ยังโหลดข้อมูลจริงจาก get_public_order ไม่เสร็จ (เคสที่เน็ตช้ากว่า 700ms)
  if (order === undefined) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center">
        <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (order === null) {
    return (
      <div className="min-h-screen bg-stone-50 grid place-items-center p-4 text-center">
        <div>
          <p className="text-4xl mb-2">🔍</p>
          <p className="text-stone-500">ไม่พบออเดอร์นี้ ลิงก์อาจไม่ถูกต้อง</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center pt-2">
          <p className="text-sm text-stone-500">สวัสดีคุณ{customerName} 👋</p>
          <h1 className="text-xl font-bold mt-1">{order.shop_name}</h1>
          <p className="text-sm text-stone-500">ออเดอร์ {order.order_no}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-stone-500 mb-3">สถานะออเดอร์</h2>
          <StatusTimeline status={order.work_status} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
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
            <div className="flex justify-between font-semibold text-base"><span>ยอดรวม</span><span>{formatBaht(order.grand_total)}</span></div>
          </div>

          <div className="border-t border-stone-100 pt-2 space-y-1 text-sm">
            <p>วันที่ต้องได้ของ: {order.needed_date ?? '-'}</p>
            <p>สถานะการชำระเงิน: {PAYMENT_LABEL[order.payment_status]}</p>
            {order.tracking_no && <p>เลขพัสดุ: {order.tracking_no} ({order.carrier})</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
