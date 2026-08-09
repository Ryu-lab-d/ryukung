import { supabase } from './supabase'

/**
 * ส่งอีเมลแจ้งลูกค้าผ่าน Edge Function (ใช้ Gmail SMTP เดียวกับที่ตั้งไว้แล้ว ฟรี ไม่มีค่าใช้จ่าย)
 * เป็น best-effort เสมอ — ถ้าส่งไม่สำเร็จ (ลูกค้าไม่มีอีเมล, SMTP มีปัญหาชั่วคราว ฯลฯ) ไม่ควรทำให้การกระทำหลัก
 * (ยืนยันออเดอร์ / บันทึกชำระเงิน) ล้มเหลวตามไปด้วย ผู้เรียกจึงไม่ต้อง await ผลเพื่อบล็อก flow หลัก
 */
export async function sendCustomerEmail(to: string, subject: string, html: string): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke('send-customer-email', {
    body: { to, subject, html },
  })
  return { error: error ? error.message : null }
}
