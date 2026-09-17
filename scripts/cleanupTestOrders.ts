import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

/**
 * สคริปต์รันเองจากเครื่อง (npm run cleanup:test-orders) — ลบออเดอร์ที่ลูกค้าส่งเข้ามาเองจากหน้าเมนู (/menu)
 * ที่ยังไม่ได้รับการยืนยันจากร้าน (is_draft=true, order_source='customer') พร้อมลูกค้าที่ผูกมาด้วยถ้าไม่มี
 * ออเดอร์อื่นเหลืออยู่แล้ว — ใช้ล้างข้อมูลทดสอบหลังลองสั่งของจากหน้าเมนูเอง ไม่แตะออเดอร์ที่ร้านยืนยันแล้ว
 * เด็ดขาด (is_draft=false) กันลบออเดอร์จริงของลูกค้าไปโดยไม่ตั้งใจ
 *
 * ค่าเริ่มต้นเป็น dry-run เสมอ (แค่แสดงรายการที่จะลบ ไม่ลบจริง) ต้องใส่ --confirm ถึงจะลบจริง กันมือลื่นลบ
 * ออเดอร์จริงที่ลูกค้ากำลังรอร้านตรวจสอบอยู่ (ปกติร้านควรกดยืนยัน/ปฏิเสธในระบบแทนการลบทิ้งเงียบๆ)
 */

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const confirmDelete = process.argv.includes('--confirm')

type PendingOrder = {
  id: string
  customer_id: string | null
  created_at: string
  grand_total: number
  customers: { name: string; phone: string | null } | null
  order_items: { product_name: string; qty: number }[]
}

async function main() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_id, created_at, grand_total, customers(name, phone), order_items(product_name, qty)')
    .eq('is_draft', true)
    .eq('order_source', 'customer')
    .order('created_at', { ascending: false })

  if (error) throw error
  const orders = (data ?? []) as unknown as PendingOrder[]

  if (orders.length === 0) {
    console.log('ไม่มีออเดอร์รอยืนยันจากลูกค้าที่สั่งเองเลย ไม่มีอะไรต้องลบ')
    return
  }

  console.log(`พบออเดอร์รอยืนยัน (ลูกค้าสั่งเอง) ${orders.length} รายการ:\n`)
  for (const o of orders) {
    const items = o.order_items.map((it) => `${it.product_name} x${it.qty}`).join(', ')
    console.log(
      `- [${o.id}] ${o.customers?.name ?? '-'} ${o.customers?.phone ? `(${o.customers.phone})` : ''} — ${items || 'ไม่มีสินค้า'} — ${o.grand_total} บาท — สร้างเมื่อ ${o.created_at}`
    )
  }

  if (!confirmDelete) {
    console.log('\nนี่คือ dry-run (แสดงรายการเฉยๆ ยังไม่ได้ลบจริง) — รันใหม่พร้อม --confirm ถ้าต้องการลบทั้งหมดนี้จริง')
    console.log('เช่น: npm run cleanup:test-orders -- --confirm')
    return
  }

  console.log('\nกำลังลบ...')
  let deletedCustomers = 0
  for (const o of orders) {
    await supabase.from('receipts').delete().eq('order_id', o.id)
    const { data: files } = await supabase.storage.from('slips').list(o.id)
    if (files && files.length > 0) {
      await supabase.storage.from('slips').remove(files.map((f) => `${o.id}/${f.name}`))
    }
    await supabase.from('orders').delete().eq('id', o.id)

    if (o.customer_id) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', o.customer_id)
      if ((count ?? 0) === 0) {
        await supabase.from('customers').delete().eq('id', o.customer_id)
        deletedCustomers++
      }
    }
  }
  console.log(`ลบออเดอร์ทดสอบไปทั้งหมด ${orders.length} รายการ (พร้อมลูกค้าที่ไม่มีออเดอร์อื่นเหลืออีก ${deletedCustomers} คน) เรียบร้อยแล้ว`)
}

void main()
