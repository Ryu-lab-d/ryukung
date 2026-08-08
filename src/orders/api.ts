import { supabase } from '../lib/supabase'
import type { OrderDraftInput } from './types'

export async function createDraft() {
  const { data, error } = await supabase
    .from('orders')
    .insert({ is_draft: true, fulfillment_type: 'shipping' })
    .select()
    .single()
  return { id: data?.id as string | undefined, error: error ? { message: error.message } : null }
}

/** บันทึกร่าง — ไม่ต้องอะตอมมิก เพราะร่างยังไม่มีเลขที่และบันทึกซ้ำได้อย่างปลอดภัย */
export async function saveDraft(orderId: string, order: OrderDraftInput) {
  const { error: deleteError } = await supabase.from('order_items').delete().eq('order_id', orderId)
  if (deleteError) return { error: { message: deleteError.message } }

  if (order.items.length > 0) {
    const { error: insertError } = await supabase
      .from('order_items')
      .insert(order.items.map((item) => ({ order_id: orderId, ...item })))
    if (insertError) return { error: { message: insertError.message } }
  }

  const { error } = await supabase
    .from('orders')
    .update({
      customer_id: order.customer_id,
      fulfillment_type: order.fulfillment_type,
      needed_date: order.needed_date,
      bake_date: order.bake_date,
      pickup_place: order.pickup_place,
      pickup_time: order.pickup_time,
      ship_recipient_name: order.ship_recipient_name,
      ship_recipient_phone: order.ship_recipient_phone,
      ship_address_text: order.ship_address_text,
      shipping_fee: order.shipping_fee,
      discount_type: order.discount_type,
      discount_value: order.discount_value,
      note: order.note,
    })
    .eq('id', orderId)
  return { error: error ? { message: error.message } : null }
}

/** ยืนยันออเดอร์ — เรียก RPC อะตอมมิกเท่านั้น ห้ามแยกขอเลขกับบันทึกแถวเป็นสองคำสั่ง */
export async function confirmOrder(orderId: string, order: OrderDraftInput) {
  const { data, error } = await supabase.rpc('confirm_order', {
    p_order_id: orderId,
    p_customer_id: order.customer_id,
    p_fulfillment_type: order.fulfillment_type,
    p_needed_date: order.needed_date,
    p_bake_date: order.bake_date,
    p_pickup_place: order.pickup_place,
    p_pickup_time: order.pickup_time,
    p_ship_recipient_name: order.ship_recipient_name,
    p_ship_recipient_phone: order.ship_recipient_phone,
    p_ship_address_text: order.ship_address_text,
    p_shipping_fee: order.shipping_fee,
    p_discount_type: order.discount_type,
    p_discount_value: order.discount_value,
    p_note: order.note,
    p_items: order.items,
  })
  return { orderNo: data as string | null, error: error ? { message: error.message } : null }
}

export async function cancelOrder(
  orderId: string,
  refundStatus: 'none' | 'pending' | 'refunded',
  reason: string | null
) {
  const { error } = await supabase
    .from('orders')
    .update({ work_status: 'cancelled', refund_status: refundStatus, cancelled_reason: reason })
    .eq('id', orderId)
  return { error: error ? { message: error.message } : null }
}

export async function changeWorkStatus(orderId: string, workStatus: string) {
  const { error } = await supabase.from('orders').update({ work_status: workStatus }).eq('id', orderId)
  return { error: error ? { message: error.message } : null }
}

export async function recordPayment(
  orderId: string,
  payment: { amount: number; method: string; paid_at: string; slip_path: string | null; note: string | null }
) {
  const { error } = await supabase.from('payments').insert({ order_id: orderId, ...payment })
  return { error: error ? { message: error.message } : null }
}

/**
 * ลบออเดอร์ถาวร — ลบไฟล์สลิปที่แนบไว้ในโฟลเดอร์ของออเดอร์นี้ออกจาก Storage ก่อน (ประหยัดพื้นที่)
 * แล้วค่อยลบแถวออเดอร์ ถ้าออเดอร์นี้เคยออกใบเสร็จไปแล้วฐานข้อมูลจะปฏิเสธการลบเสมอ (กฎข้อ 7 ในสเปก
 * ใบเสร็จที่ออกแล้วต้องอยู่ถาวร) ต้องยกเลิกใบเสร็จหรือใช้ "ยกเลิกออเดอร์" แทนในกรณีนั้น
 */
export async function deleteOrder(orderId: string) {
  const { data: files } = await supabase.storage.from('slips').list(orderId)
  if (files && files.length > 0) {
    await supabase.storage.from('slips').remove(files.map((f) => `${orderId}/${f.name}`))
  }
  const { error } = await supabase.from('orders').delete().eq('id', orderId)
  if (error?.code === '23503') {
    return { error: { message: 'ลบไม่ได้เพราะออเดอร์นี้เคยออกใบเสร็จไปแล้ว ใบเสร็จที่ออกแล้วต้องเก็บไว้ถาวร — ใช้ "ยกเลิกออเดอร์" แทน' } }
  }
  return { error: error ? { message: error.message } : null }
}
