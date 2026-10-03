import { useState } from 'react'
import { Link } from 'react-router-dom'
import { recordPayment } from './api'
import { formatBaht } from '../lib/money'
import { nextStatus, stageLabel } from './workStatus'

/**
 * "ขั้นต่อไปที่ต้องทำ" — การ์ดเดียวที่บอกว่าตอนนี้ต้องทำอะไรกับออเดอร์นี้ พร้อมปุ่มกดครั้งเดียวจบ
 * ลำดับที่ระบบบังคับอยู่แล้ว: ยืนยันออเดอร์ → รับเงิน → เลื่อนสถานะทีละขั้น (ยังไม่จ่ายเลย = เลื่อนไม่ได้)
 * เลยโชว์เฉพาะ "ขั้นที่ใช่ตอนนี้" ปุ่มเดียวชัดๆ แทนที่ต้องไล่หาในหน้ายาวๆ
 */
export function NextActionCard({
  order,
  balanceDue,
  onPaid,
  onAdvance,
}: {
  order: {
    id: string
    is_draft: boolean
    order_source: string
    work_status: string
    payment_status: string
    fulfillment_type: string
    payment_claimed_at: string | null
  }
  balanceDue: number
  onPaid: (amount: number) => Promise<void> | void
  onAdvance: (status: string) => Promise<void> | void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (order.work_status === 'cancelled') return null

  async function payFull(method: 'transfer' | 'cash') {
    setBusy(method)
    setError(null)
    const { error } = await recordPayment(order.id, {
      amount: balanceDue,
      method,
      paid_at: new Date().toISOString(),
      slip_path: null,
      note: null,
    })
    if (error) {
      setBusy(null)
      setError(error.message)
      return
    }
    await onPaid(balanceDue)
    setBusy(null)
  }

  async function advance(status: string) {
    setBusy('advance')
    await onAdvance(status)
    setBusy(null)
  }

  // 1) ออเดอร์ที่ลูกค้าสั่งเองรอยืนยัน
  if (order.is_draft && order.order_source === 'customer') {
    return (
      <Shell step="ขั้นที่ 1" tone="indigo" icon="🛒" title="ตรวจสอบและยืนยันออเดอร์" hint="ลูกค้าส่งมาเอง — ดูรายการ วันที่ จุดนัดรับ แล้วกดยืนยัน">
        <Link
          to={`/orders/${order.id}/edit`}
          className="block w-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white text-center font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(67_56_202_/_0.8)] active:scale-95"
        >
          ✅ ตรวจสอบ & ยืนยันออเดอร์ →
        </Link>
      </Shell>
    )
  }
  if (order.is_draft) return null

  // 2) ยังมียอดค้าง → รับเงิน
  if (balanceDue > 0) {
    return (
      <Shell
        step={order.payment_claimed_at ? 'ลูกค้าแจ้งโอนแล้ว' : 'ขั้นต่อไป'}
        tone="green"
        icon="💰"
        title={`รับเงิน ${formatBaht(balanceDue)} บาท`}
        hint={order.payment_claimed_at ? 'เช็กยอดเข้าบัญชีแล้วกดรับเงินได้เลย' : 'กดวิธีที่ลูกค้าจ่าย ระบบบันทึกเต็มจำนวนให้ทันที'}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void payFull('transfer')}
            className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(5_122_85_/_0.8)] active:scale-95 disabled:opacity-60"
          >
            {busy === 'transfer' ? 'กำลังบันทึก...' : '🏦 โอนแล้ว'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void payFull('cash')}
            className="rounded-2xl bg-white border-2 border-green-600 text-green-700 font-bold py-3.5 active:scale-95 disabled:opacity-60"
          >
            {busy === 'cash' ? 'กำลังบันทึก...' : '💵 เงินสด'}
          </button>
        </div>
        <p className="text-[11px] text-stone-500 text-center">จ่ายบางส่วน หรือแนบสลิป? ใช้ปุ่ม "บันทึกการชำระเงิน" ในการ์ดการชำระเงินด้านล่าง</p>
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      </Shell>
    )
  }

  // 3) จ่ายครบแล้ว → เลื่อนสถานะขั้นถัดไป
  const next = nextStatus(order.fulfillment_type, order.work_status)
  if (next) {
    return (
      <Shell step="ขั้นต่อไป" tone="amber" icon="➡️" title={`ไปขั้น "${stageLabel(order.fulfillment_type, next)}"`} hint={`ตอนนี้อยู่ขั้น "${stageLabel(order.fulfillment_type, order.work_status)}"`}>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void advance(next)}
          className="w-full rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-white font-bold py-3.5 shadow-[0_12px_24px_-10px_rgb(146_82_12_/_0.8)] active:scale-95 disabled:opacity-60"
        >
          {busy === 'advance' ? 'กำลังเปลี่ยน...' : `ย้ายไป "${stageLabel(order.fulfillment_type, next)}" →`}
        </button>
      </Shell>
    )
  }

  // 4) ครบทุกขั้นแล้ว
  return (
    <Shell step="เสร็จสมบูรณ์" tone="green" icon="🎉" title="ออเดอร์นี้เสร็จเรียบร้อย" hint="จ่ายครบและส่งมอบแล้ว ไม่มีอะไรต้องทำเพิ่ม">
      <span />
    </Shell>
  )
}

const TONES: Record<string, string> = {
  indigo: 'border-indigo-300 from-indigo-50',
  green: 'border-green-300 from-green-50',
  amber: 'border-amber-300 from-amber-50',
}

function Shell({
  step,
  tone,
  icon,
  title,
  hint,
  children,
}: {
  step: string
  tone: 'indigo' | 'green' | 'amber'
  icon: string
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className={'lg:col-span-2 relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br to-white p-4 space-y-3 shadow-[0_14px_30px_-16px_rgb(51_32_14_/_0.5)] ' + TONES[tone]}>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 shrink-0 rounded-2xl bg-white border border-stone-200 shadow-sm grid place-items-center text-2xl animate-icon-pop">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wide text-stone-500">{step}</p>
          <p className="text-lg font-display font-bold text-stone-900 leading-tight">{title}</p>
          <p className="text-xs text-stone-500">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
