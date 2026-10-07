import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyStatusChanged } from '../lib/autoNotify'
import { playPaymentSound } from '../lib/uiSound'

/** ถ้าไม่มี realtime/ตกหล่น กระดานก็ยังรีเฟรชเองทุกกี่ ms ตอนหน้าจอเปิดอยู่ */
const POLL_MS = 20000

export type BoardOrder = {
  id: string
  order_no: string | null
  customer_name: string | null
  items_summary: string
  needed_date: string | null
  bake_date: string | null
  fulfillment_type: string
  work_status: string
  payment_status: string
  grand_total: number
  is_draft: boolean
  order_source: string
  address_edited_at: string | null
  payment_claimed_at: string | null
  pickup_place: string | null
  pickup_time: string | null
  assignee_name: string | null
}

export function useOrderBoard() {
  const [orders, setOrders] = useState<BoardOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [newOrders, setNewOrders] = useState<BoardOrder[]>([])
  const knownIds = useRef<Set<string> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(
        'id, order_no, needed_date, bake_date, fulfillment_type, work_status, payment_status, grand_total, is_draft, order_source, updated_at, address_edited_at, payment_claimed_at, pickup_place, pickup_time, customers(name), order_items(product_name, qty), staff_members(display_name, email)'
      )
      .neq('work_status', 'cancelled')
      .order('bake_date', { ascending: true })

    const sevenDaysAgo = Date.now() - 7 * 86400000
    const rows = (data ?? [])
      .filter((o: any) => o.work_status !== 'delivered' || new Date(o.updated_at).getTime() >= sevenDaysAgo)
      .map((o: any) => ({
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customers?.name ?? null,
        items_summary: (o.order_items ?? []).map((it: any) => `${it.product_name} x${it.qty}`).join(', '),
        needed_date: o.needed_date,
        bake_date: o.bake_date,
        fulfillment_type: o.fulfillment_type,
        work_status: o.work_status,
        payment_status: o.payment_status,
        grand_total: Number(o.grand_total),
        is_draft: o.is_draft,
        order_source: o.order_source,
        address_edited_at: o.address_edited_at,
        payment_claimed_at: o.payment_claimed_at,
        pickup_place: o.pickup_place,
        pickup_time: o.pickup_time,
        assignee_name: o.staff_members?.display_name ?? o.staff_members?.email ?? null,
      }))
    // ออเดอร์ที่ลูกค้าสั่งเองเข้ามาใหม่หลังโหลดครั้งแรก → เตือนพนักงาน (ครั้งแรกแค่จำไว้ ไม่เตือนของเก่า)
    if (knownIds.current) {
      const fresh = rows.filter((r) => r.is_draft && r.order_source === 'customer' && !knownIds.current!.has(r.id))
      if (fresh.length > 0) {
        setNewOrders((prev) => [...prev, ...fresh.filter((f) => !prev.some((p) => p.id === f.id))])
        playPaymentSound()
      }
    }
    knownIds.current = new Set(rows.map((r) => r.id))
    setOrders(rows)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // อัปเดตกระดานเองโดยไม่ต้องกดรีเฟรช: realtime ของตาราง orders (ดีเลย์สั้นๆ รวมหลายเหตุการณ์) + ดึงซ้ำทุก 20 วิ + ตอนกลับมาเปิดแท็บ
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void load(true), 700)
    }
    const channel = supabase.channel?.('orders-board')
    channel?.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh).subscribe()
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true)
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearTimeout(timer)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [load])

  const changeStatus = useCallback(
    async (orderId: string, workStatus: string) => {
      const { error } = await supabase.from('orders').update({ work_status: workStatus }).eq('id', orderId)
      if (!error) {
        void notifyStatusChanged(orderId, workStatus)
        await load(true)
      }
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  const reload = useCallback(() => load(true), [load])
  const dismissNew = useCallback(() => setNewOrders([]), [])

  return { orders, loading, changeStatus, reload, newOrders, dismissNew }
}
