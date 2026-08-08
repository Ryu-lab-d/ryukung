import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

/** client ที่ยังไม่ล็อกอิน ใช้ทดสอบว่ากฎความปลอดภัยกันคนนอกได้จริง */
export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } })
}

/** client ที่ล็อกอินแล้ว ใช้ทดสอบการทำงานปกติ */
export async function signedInClient(): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL!,
    password: process.env.TEST_USER_PASSWORD!,
  })
  if (error) throw new Error('ล็อกอินสำหรับเทสต์ไม่สำเร็จ: ' + error.message)
  return client
}

/**
 * client ที่ข้ามกฎความปลอดภัยได้ ใช้เก็บกวาดข้อมูลทดสอบเท่านั้น
 * ห้ามใช้ในโค้ดของแอปเด็ดขาด เพราะ key นี้ทำอะไรก็ได้กับฐานข้อมูล
 */
export function adminClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('ไม่พบ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

/** ลบออเดอร์ทดสอบพร้อมใบเสร็จที่ผูกอยู่ ใช้ปิดท้ายเทสต์ที่มีใบเสร็จ */
export async function purgeOrder(orderId: string): Promise<void> {
  const admin = adminClient()
  await admin.from('receipts').delete().eq('order_id', orderId)
  await admin.from('orders').delete().eq('id', orderId)
}
