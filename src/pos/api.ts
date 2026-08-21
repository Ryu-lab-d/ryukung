import { supabase } from '../lib/supabase'

export type POSPaymentMethod = 'cash' | 'promptpay'

export type POSSaleItemInput = {
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty: number
}

/** ขายหน้าร้าน — สร้างออเดอร์+รายการสินค้า+ตัดสต็อกวัตถุดิบ+บันทึกจ่ายเงินครบในคำสั่งเดียว (RPC อะตอมมิก) */
export async function createPOSSale(
  items: POSSaleItemInput[],
  paymentMethod: POSPaymentMethod
): Promise<{ orderId: string | null; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc('create_pos_sale', {
    p_items: items,
    p_payment_method: paymentMethod,
  })
  return { orderId: data as string | null, error: error ? { message: error.message } : null }
}
