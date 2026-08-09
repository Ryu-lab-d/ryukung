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

export async function assignOrder(orderId: string, staffMemberId: string | null) {
  const { error } = await supabase.from('orders').update({ assigned_to: staffMemberId }).eq('id', orderId)
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
 * สั่งซ้ำออเดอร์เก่า — สร้างร่างใหม่ให้ลูกค้าคนเดิม คัดลอกสินค้า/จำนวน/ข้อมูลจัดส่งจากออเดอร์เก่ามาให้
 * แต่ดึงราคาสินค้า ณ ปัจจุบันจากตาราง products มาใช้แทนราคาเก่า (เผื่อราคาสินค้าเปลี่ยนไปแล้ว) — ถ้าสินค้านั้น
 * ถูกลบ/ปิดใช้งานไปแล้ว จะใช้ราคาเดิมที่บันทึกไว้ในออเดอร์เก่าแทน ไม่ใส่วันที่นัด/ส่วนลดมาให้ ให้พนักงานกรอกใหม่เอง
 */
export async function reorderFromOrder(oldOrderId: string) {
  const [{ data: oldOrder, error: orderError }, { data: oldItems, error: itemsError }] = await Promise.all([
    supabase
      .from('orders')
      .select('customer_id, fulfillment_type, pickup_place, pickup_time, ship_recipient_name, ship_recipient_phone, ship_address_text')
      .eq('id', oldOrderId)
      .single(),
    supabase.from('order_items').select('product_id, product_name, unit_price, unit_cost, qty, note').eq('order_id', oldOrderId),
  ])
  if (orderError) return { id: undefined, error: { message: orderError.message } }
  if (itemsError) return { id: undefined, error: { message: itemsError.message } }

  const productIds = (oldItems ?? []).map((it) => it.product_id).filter((id): id is string => id !== null)
  const { data: currentProducts } = productIds.length > 0
    ? await supabase.from('products').select('id, price, cost').in('id', productIds)
    : { data: [] as { id: string; price: number; cost: number }[] }
  const priceById = new Map((currentProducts ?? []).map((p) => [p.id, p]))

  const { data: draft, error: draftError } = await supabase
    .from('orders')
    .insert({
      is_draft: true,
      customer_id: oldOrder!.customer_id,
      fulfillment_type: oldOrder!.fulfillment_type,
      pickup_place: oldOrder!.pickup_place,
      pickup_time: oldOrder!.pickup_time,
      ship_recipient_name: oldOrder!.ship_recipient_name,
      ship_recipient_phone: oldOrder!.ship_recipient_phone,
      ship_address_text: oldOrder!.ship_address_text,
    })
    .select()
    .single()
  if (draftError) return { id: undefined, error: { message: draftError.message } }

  if (oldItems && oldItems.length > 0) {
    const { error: insertItemsError } = await supabase.from('order_items').insert(
      oldItems.map((it) => {
        const current = it.product_id ? priceById.get(it.product_id) : undefined
        return {
          order_id: draft.id,
          product_id: it.product_id,
          product_name: it.product_name,
          unit_price: current?.price ?? it.unit_price,
          unit_cost: current?.cost ?? it.unit_cost,
          qty: it.qty,
          note: it.note,
        }
      })
    )
    if (insertItemsError) return { id: undefined, error: { message: insertItemsError.message } }
  }

  return { id: draft.id as string, error: null }
}

/**
 * ลบออเดอร์ถาวร — ลบไฟล์สลิปที่แนบไว้ในโฟลเดอร์ของออเดอร์นี้ออกจาก Storage ก่อน (ประหยัดพื้นที่)
 * แล้วค่อยลบแถวออเดอร์ ใบเสร็จที่เคยออกไปแล้วของออเดอร์นี้จะถูกลบไปพร้อมกัน (on delete cascade)
 * เพื่อให้ลบออเดอร์เก่าประหยัดพื้นที่ได้จริงแม้เคยออกใบเสร็จไปแล้ว
 */
export async function deleteOrder(orderId: string) {
  const { data: files } = await supabase.storage.from('slips').list(orderId)
  if (files && files.length > 0) {
    await supabase.storage.from('slips').remove(files.map((f) => `${orderId}/${f.name}`))
  }
  const { error } = await supabase.from('orders').delete().eq('id', orderId)
  return { error: error ? { message: error.message } : null }
}
