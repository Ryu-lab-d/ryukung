import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ScanOverlay } from '../lib/ScanOverlay'
import { playScanBeep } from '../lib/uiSound'
import { formatBaht } from '../lib/money'
import { normalizeOrderCode } from '../receipts/invoiceApi'
import { nextStatus, stageLabel } from '../orders/workStatus'

// เลขออเดอร์ที่ครบรูปแบบแล้ว (เช่น RYB-001296) — ใช้ตัดสินว่าเครื่องสแกนยิงเสร็จแม้ไม่ส่ง Enter
const ORDER_CODE_RE = /^[A-Z]{2,6}-\d{4,}$/
const AUTO_KEY = 'board-scan-auto-advance'

type Found = {
  id: string
  order_no: string
  grand_total: number
  payment_status: string
  work_status: string
  fulfillment_type: string
  is_draft: boolean
  customer_name: string | null
}

type Launch = { found: Found; advancedTo: string | null; caption: string }

/**
 * แถบสแกนบาร์โค้ดหน้ากระดานออเดอร์ — ยิงบาร์โค้ดจากใบ Invoice/ใบเบิก แล้วเปิดออเดอร์นั้นให้ทันที (ไม่ต้องกด Enter)
 * มีสวิตช์ "โหมดเลื่อนสถานะอัตโนมัติ": เปิดไว้แล้วยิงบาร์โค้ด = ย้ายออเดอร์ที่ชำระเงินแล้วไปขั้นถัดไปเลย (ยังไม่จ่ายเงินจะเปิดหน้าออเดอร์แทน)
 */
export function OrderScanBar({
  onChangeStatus,
}: {
  onChangeStatus: (orderId: string, status: string) => Promise<{ error: { message: string } | null }>
}) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) === '1'
    } catch {
      return false
    }
  })
  const [launch, setLaunch] = useState<Launch | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_KEY, auto ? '1' : '0')
    } catch {
      // เก็บค่าไม่ได้ก็ใช้แค่ในหน้านี้
    }
  }, [auto])

  const resolve = useCallback(
    async (raw: string) => {
      const q = normalizeOrderCode(raw)
      if (!q || busyRef.current) return
      busyRef.current = true
      setError(null)
      const { data } = await supabase
        .from('orders')
        .select('id, order_no, grand_total, payment_status, work_status, fulfillment_type, is_draft, customers(name)')
        .eq('order_no', q)
        .maybeSingle()
      if (!data) {
        busyRef.current = false
        setNotFound(q)
        setCode('')
        inputRef.current?.focus()
        return
      }
      const o = data as any
      const found: Found = {
        id: o.id,
        order_no: o.order_no,
        grand_total: Number(o.grand_total),
        payment_status: o.payment_status,
        work_status: o.work_status,
        fulfillment_type: o.fulfillment_type,
        is_draft: o.is_draft,
        customer_name: o.customers?.name ?? null,
      }
      playScanBeep()
      const next = !found.is_draft && found.work_status !== 'cancelled' ? nextStatus(found.fulfillment_type, found.work_status) : null
      if (auto && next && found.payment_status !== 'unpaid') {
        // โหมดเลื่อนสถานะอัตโนมัติ: ย้ายไปขั้นถัดไปเลยแล้วอยู่หน้ากระดานต่อ รอสแกนใบถัดไป
        const { error: err } = await onChangeStatus(found.id, next)
        if (err) {
          setError(err.message)
          busyRef.current = false
          return
        }
        setLaunch({ found, advancedTo: stageLabel(found.fulfillment_type, next), caption: 'ย้ายสถานะเรียบร้อย' })
        setTimeout(() => {
          setLaunch(null)
          setCode('')
          busyRef.current = false
          inputRef.current?.focus()
        }, 1500)
        return
      }
      setLaunch({
        found,
        advancedTo: null,
        caption: auto && found.payment_status === 'unpaid' && !found.is_draft ? 'ยังไม่ได้รับเงิน — เปิดหน้าออเดอร์เพื่อรับเงินก่อน' : 'กำลังเปิดออเดอร์...',
      })
      setTimeout(() => navigate(`/orders/${found.id}`), 1300)
    },
    [auto, navigate, onChangeStatus]
  )

  // ยิงเสร็จ (เลขครบรูปแบบ) แล้วรอสั้นๆ ให้เครื่องสแกนพิมพ์ครบ จากนั้นเปิดเอง — พิมพ์ไม่ครบรอกด Enter
  useEffect(() => {
    if (!ORDER_CODE_RE.test(code)) return
    const t = setTimeout(() => void resolve(code), 350)
    return () => clearTimeout(t)
  }, [code, resolve])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void resolve(code)
  }

  return (
    <>
      {launch && (
        <ScanOverlay
          orderNo={launch.found.order_no}
          title={launch.advancedTo ? 'เลื่อนสถานะแล้ว' : 'สแกนสำเร็จ'}
          line1={`${launch.found.customer_name ?? 'ไม่มีชื่อลูกค้า'} · ${formatBaht(launch.found.grand_total)} บาท`}
          line2={launch.advancedTo ? `→ ${launch.advancedTo}` : undefined}
          caption={launch.caption}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg" aria-hidden="true">🔎</span>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => {
              setNotFound(null)
              setCode(normalizeOrderCode(e.target.value))
            }}
            placeholder="ยิงบาร์โค้ด / พิมพ์เลขออเดอร์เพื่อเปิดออเดอร์"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl border-2 border-stone-300 bg-white pl-12 pr-4 py-3 font-mono tracking-wide shadow-sm focus:border-amber-600"
          />
        </div>
        <label className="flex items-center gap-2 px-1 text-xs text-stone-600 select-none">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <span>
            <b>โหมดเลื่อนสถานะอัตโนมัติ</b> — ยิงบาร์โค้ดแล้วย้ายออเดอร์ที่ชำระเงินแล้วไปขั้นถัดไปเลย
          </span>
        </label>
        {notFound && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-form-in">ไม่พบออเดอร์ "{notFound}"</p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
      </form>
    </>
  )
}
