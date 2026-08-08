import { supabase } from '../lib/supabase'

export type ReceiptSnapshot = {
  shop_name: string
  logo_path: string | null
  address: string | null
  phone: string | null
  promptpay: string | null
  receipt_footer: string | null
  show_logo: boolean
  show_address: boolean
  show_phone: boolean
  show_promptpay: boolean
  customer_name: string | null
  ship_address_text: string | null
  items: { product_name: string; unit_price: number; qty: number; line_total: number }[]
  items_total: number
  discount_amount: number
  shipping_fee: number
  grand_total: number
}

export async function issueReceipt(orderId: string, snapshot: ReceiptSnapshot) {
  const { data, error } = await supabase.rpc('issue_receipt', { p_order_id: orderId, p_snapshot: snapshot })
  return { id: data as string | null, error: error ? { message: error.message } : null }
}

export async function reissueReceipt(oldReceiptId: string, snapshot: ReceiptSnapshot) {
  const { data, error } = await supabase.rpc('reissue_receipt', { p_old_receipt_id: oldReceiptId, p_snapshot: snapshot })
  return { id: data as string | null, error: error ? { message: error.message } : null }
}
