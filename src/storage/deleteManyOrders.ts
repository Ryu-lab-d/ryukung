import { supabase } from '../lib/supabase'
import { deleteOrder } from '../orders/api'
import { archiveOrderToSheets } from '../lib/sheetsArchive'

type ArchiveRow = {
  order_no: string | null
  fulfillment_type: string
  grand_total: number
  payment_status: string
  needed_date: string | null
  delivered_at: string | null
  created_at: string
  customers: { name: string | null; phone: string | null } | null
  order_items: { product_name: string; qty: number }[] | null
}

/**
 * ลบออเดอร์หลายรายการทีละอัน (ใช้ร่วมกันทุกส่วนของหน้าจัดการพื้นที่จัดเก็บ — ออเดอร์เก่าที่ส่งมอบสำเร็จ,
 * ที่ยกเลิกแล้ว, และร่างที่ค้างไว้) — ก่อนลบแต่ละออเดอร์ จะพยายามสำรองไปที่ Google Sheets ก่อนเสมอถ้าร้าน
 * ตั้งค่า webhook ไว้ (ดู sheetsArchive.ts) ถ้าสำรองไม่สำเร็จ จะไม่ลบออเดอร์นั้น กันข้อมูลหายถาวรโดยไม่มีสำเนา
 */
export async function deleteManyOrders(orderIds: string[]) {
  const errors: string[] = []
  for (const id of orderIds) {
    const { data: order } = await supabase
      .from('orders')
      .select(
        'order_no, fulfillment_type, grand_total, payment_status, needed_date, delivered_at, created_at, customers(name, phone), order_items(product_name, qty)'
      )
      .eq('id', id)
      .maybeSingle<ArchiveRow>()

    if (order) {
      const { error: archiveError } = await archiveOrderToSheets({
        order_no: order.order_no,
        customer_name: order.customers?.name ?? null,
        customer_phone: order.customers?.phone ?? null,
        fulfillment_type: order.fulfillment_type,
        items_summary: (order.order_items ?? []).map((it) => `${it.product_name} x${it.qty}`).join(', '),
        grand_total: Number(order.grand_total),
        payment_status: order.payment_status,
        needed_date: order.needed_date,
        delivered_at: order.delivered_at,
        created_at: order.created_at,
      })
      if (archiveError) {
        errors.push(`${order.order_no ?? id}: ${archiveError}`)
        continue
      }
    }

    const { error } = await deleteOrder(id)
    if (error) errors.push(error.message)
  }
  return { errors }
}
