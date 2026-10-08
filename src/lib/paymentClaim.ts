import { supabase } from './supabase'

/**
 * ลูกค้ากด "ยืนยันการชำระเงิน" — แค่บันทึกว่าลูกค้าแจ้งมาแล้วเมื่อไหร่ และแจ้งเตือนร้านทางอีเมล
 * ไม่ได้ตัดสถานะจ่ายเงินอัตโนมัติ ยังต้องรอเจ้าหน้าที่ตรวจสอบยอด/สลิปจริงก่อนเสมอ
 */
export async function claimPayment(token: string, verify: string): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke('notify-payment-claim', { body: { token, verify } })
  return { error: error ? error.message : null }
}
