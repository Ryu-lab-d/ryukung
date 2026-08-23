import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { stageLabel } from '../src/orders/workStatus'
import { PLATFORM_LABEL, STATUS_LABEL as CONTENT_STATUS_LABEL } from '../src/content/contentMeta'
import { computeRecipeCost, type IngredientLine, type LaborLine } from '../src/costing/costMath'

/**
 * สคริปต์รันเองจากเครื่อง (npm run sync:sheets) — ดึงข้อมูลจาก Supabase (ใช้ service role key เหมือน
 * tests/db/helpers.ts's adminClient() ข้าม RLS ได้หมด) แล้วส่งไปให้ Google Apps Script Web App
 * (scripts/googleAppsScriptSync.gs) เขียนทับแต่ละแท็บใน Google Sheet ให้ครบ 8 แท็บ
 *
 * Supabase ยังเป็นฐานข้อมูลจริงเหมือนเดิมทุกอย่าง — Sheet นี้เป็นแค่สำเนาไว้ดู/ก็อปข้อมูลง่ายๆ ไม่ใช่ระบบสำรอง
 * อัตโนมัติต่อเนื่อง ต้องรันสคริปต์นี้เองทุกครั้งที่อยากรีเฟรชข้อมูลล่าสุด
 *
 * รองรับ --dry-run: ดึงข้อมูล+คำนวณทุกแท็บเหมือนปกติ แต่ไม่ส่งไป Google Sheets จริง (ไม่ต้องตั้งค่า
 * GOOGLE_SHEETS_SYNC_WEBHOOK_URL ก่อนก็รันได้) แค่พิมพ์จำนวนแถวที่จะได้ในแต่ละแท็บ ใช้ตรวจ query ก่อนต่อจริง
 */

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const webhookUrl = process.env.GOOGLE_SHEETS_SYNC_WEBHOOK_URL
const dryRun = process.argv.includes('--dry-run')

const CHANNEL_LABEL: Record<string, string> = { facebook: 'Facebook', line: 'LINE', instagram: 'Instagram', tiktok: 'TikTok', other: 'อื่นๆ' }
const FULFILLMENT_LABEL: Record<string, string> = { pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง' }
const PAYMENT_STATUS_LABEL: Record<string, string> = { unpaid: 'ยังไม่ชำระ', partial: 'มัดจำแล้ว', paid: 'จ่ายครบแล้ว' }
const PAYMENT_METHOD_LABEL: Record<string, string> = { transfer: 'โอนเงิน', promptpay: 'พร้อมเพย์', cash: 'เงินสด', cod: 'เก็บเงินปลายทาง', other: 'อื่นๆ' }
const STAFF_ROLE_LABEL: Record<string, string> = { owner: 'เจ้าของร้าน', executive: 'ผู้บริหาร', manager: 'ผู้จัดการ', staff: 'พนักงาน' }
const STAFF_STATUS_LABEL: Record<string, string> = { pending: 'รออนุมัติ', active: 'ใช้งานได้', revoked: 'ถูกระงับ' }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function thDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('th-TH') : ''
}

function thTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

async function pushSheet(sheetName: string, headers: string[], rows: (string | number)[][]) {
  if (dryRun) {
    console.log(`(dry-run) ${sheetName}: ${rows.length} แถว`)
    return
  }
  if (!webhookUrl) {
    throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_SHEETS_SYNC_WEBHOOK_URL ใน .env.local — ดูวิธีตั้งค่าใน scripts/googleAppsScriptSync.gs')
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ sheetName, headers, rows }),
  })
  if (!res.ok) throw new Error(`ส่งข้อมูลแท็บ "${sheetName}" ไม่สำเร็จ (HTTP ${res.status})`)
  const body = (await res.json()) as { ok: boolean; error?: string; rows?: number }
  if (!body.ok) throw new Error(`ส่งข้อมูลแท็บ "${sheetName}" ไม่สำเร็จ: ${body.error}`)
  console.log(`✓ ${sheetName}: ${body.rows ?? rows.length} แถว`)
}

type CustomerRow = { id: string; name: string; phone: string | null; email: string | null; channel: string | null; note: string | null; created_at: string }
type CustomerStatsRow = { customer_id: string; order_count: number; total_spend: number }

async function syncCustomers() {
  const { data, error } = await supabase.from('customers').select('*').order('name')
  if (error) throw error
  const customers = (data ?? []) as CustomerRow[]

  const { data: statsData, error: statsError } = await supabase.from('customer_order_stats').select('*')
  if (statsError) throw statsError
  const statsByCustomer = new Map<string, CustomerStatsRow>(
    ((statsData ?? []) as CustomerStatsRow[]).map((s) => [s.customer_id, s])
  )

  const rows = customers.map((c) => {
    const stats = statsByCustomer.get(c.id)
    return [
      c.name,
      c.phone ?? '',
      c.email ?? '',
      c.channel ? (CHANNEL_LABEL[c.channel] ?? c.channel) : '',
      stats?.order_count ?? 0,
      round2(Number(stats?.total_spend ?? 0)),
      c.note ?? '',
      thDate(c.created_at),
    ]
  })
  await pushSheet('ลูกค้า', ['ชื่อ', 'เบอร์โทร', 'อีเมล', 'ช่องทาง', 'จำนวนออเดอร์', 'ยอดใช้จ่ายรวม', 'หมายเหตุ', 'วันที่สมัคร'], rows)
}

type POSOrderRow = {
  order_no: string | null
  created_at: string
  grand_total: number
  order_items: { product_name: string; qty: number }[]
  payments: { method: string }[]
}

async function syncPOSSales() {
  const { data, error } = await supabase
    .from('orders')
    .select('order_no, created_at, grand_total, order_items(product_name, qty), payments(method)')
    .is('customer_id', null)
    .eq('fulfillment_type', 'pickup')
    .eq('work_status', 'delivered')
    .order('created_at', { ascending: false })
  if (error) throw error
  const orders = (data ?? []) as unknown as POSOrderRow[]

  const rows = orders.map((o) => {
    const items = o.order_items.map((it) => `${it.product_name} x${it.qty}`).join(', ')
    const method = o.payments[0]?.method
    return [o.order_no ?? '', thDate(o.created_at), thTime(o.created_at), items, round2(Number(o.grand_total)), method ? (PAYMENT_METHOD_LABEL[method] ?? method) : '']
  })
  await pushSheet('ขายหน้าร้าน (POS)', ['เลขออเดอร์', 'วันที่', 'เวลา', 'รายการสินค้า', 'ยอดรวม', 'วิธีชำระเงิน'], rows)
}

type OrderRow = {
  order_no: string | null
  created_at: string
  needed_date: string | null
  fulfillment_type: string
  work_status: string
  payment_status: string
  grand_total: number
  note: string | null
  customers: { name: string } | null
  staff_members: { display_name: string | null; email: string } | null
  payments: { amount: number }[]
}

async function syncOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'order_no, created_at, needed_date, fulfillment_type, work_status, payment_status, grand_total, note, customers(name), staff_members(display_name, email), payments(amount)'
    )
    .eq('is_draft', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  const orders = (data ?? []) as unknown as OrderRow[]

  const rows = orders.map((o) => {
    const paid = o.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    return [
      o.order_no ?? '',
      o.customers?.name ?? '',
      thDate(o.created_at),
      thDate(o.needed_date),
      FULFILLMENT_LABEL[o.fulfillment_type] ?? o.fulfillment_type,
      stageLabel(o.fulfillment_type, o.work_status),
      PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status,
      round2(Number(o.grand_total)),
      round2(Math.max(Number(o.grand_total) - paid, 0)),
      o.staff_members?.display_name ?? o.staff_members?.email ?? '',
      o.note ?? '',
    ]
  })
  await pushSheet(
    'ออร์เดอร์',
    ['เลขออเดอร์', 'ชื่อลูกค้า', 'วันที่สั่ง', 'วันที่ต้องการ', 'วิธีรับของ', 'สถานะงาน', 'สถานะชำระเงิน', 'ยอดรวม', 'ยอดคงเหลือ', 'ผู้รับผิดชอบ', 'หมายเหตุ'],
    rows
  )
}

type StaffRow = { display_name: string | null; email: string; role: string; status: string; created_at: string }

async function syncStaff() {
  const { data, error } = await supabase.from('staff_members').select('display_name, email, role, status, created_at').order('created_at')
  if (error) throw error
  const staff = (data ?? []) as StaffRow[]

  const rows = staff.map((s) => [
    s.display_name ?? '',
    s.email,
    STAFF_ROLE_LABEL[s.role] ?? s.role,
    STAFF_STATUS_LABEL[s.status] ?? s.status,
    thDate(s.created_at),
  ])
  await pushSheet('พนักงาน', ['ชื่อ', 'อีเมล', 'ตำแหน่ง', 'สถานะ', 'วันที่เข้าร่วม'], rows)
}

type CalendarRow = {
  order_no: string | null
  bake_date: string | null
  needed_date: string | null
  work_status: string
  fulfillment_type: string
  customers: { name: string } | null
}

async function syncCalendar() {
  const { data, error } = await supabase
    .from('orders')
    .select('order_no, bake_date, needed_date, work_status, fulfillment_type, customers(name)')
    .eq('is_draft', false)
    .neq('work_status', 'cancelled')
    .order('needed_date')
  if (error) throw error
  const orders = (data ?? []) as unknown as CalendarRow[]

  const rows = orders.map((o) => [
    o.order_no ?? '',
    o.customers?.name ?? '',
    thDate(o.bake_date),
    thDate(o.needed_date),
    stageLabel(o.fulfillment_type, o.work_status),
    FULFILLMENT_LABEL[o.fulfillment_type] ?? o.fulfillment_type,
  ])
  await pushSheet('ปฏิทิน', ['เลขออเดอร์', 'ชื่อลูกค้า', 'วันที่อบ', 'วันที่ต้องได้ของ', 'สถานะ', 'วิธีรับของ'], rows)
}

type ContentRow = {
  title: string
  platforms: string[]
  status: string
  idea: string | null
  caption: string | null
  hashtags: string | null
  post_date: string | null
  hook: string | null
  goal: string | null
}

async function syncContent() {
  const { data, error } = await supabase.from('content_items').select('*').order('post_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  const items = (data ?? []) as ContentRow[]

  const rows = items.map((c) => [
    c.title,
    c.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(', '),
    CONTENT_STATUS_LABEL[c.status] ?? c.status,
    c.idea ?? '',
    c.caption ?? '',
    c.hashtags ?? '',
    thDate(c.post_date),
    c.hook ?? '',
    c.goal ?? '',
  ])
  await pushSheet('คอนเทนต์', ['หัวข้อ', 'แพลตฟอร์ม', 'สถานะ', 'ไอเดีย', 'แคปชั่น', 'แฮชแท็ก', 'วันที่โพสต์', 'Hook', 'เป้าหมาย'], rows)
}

type CostRecipeRow = { id: string; name: string; waste_overhead_percent: number; yield_qty: number; profit_percent: number; note: string | null }
type CostIngredientRow = IngredientLine & { recipe_id: string }
type CostLaborRow = LaborLine & { recipe_id: string }

async function syncCosting() {
  const { data: recipeData, error } = await supabase.from('cost_recipes').select('id, name, waste_overhead_percent, yield_qty, profit_percent, note')
  if (error) throw error
  const recipes = (recipeData ?? []) as CostRecipeRow[]

  const { data: ingredientData, error: ingredientError } = await supabase.from('cost_recipe_ingredients').select('recipe_id, purchase_qty, purchase_price, qty_used')
  if (ingredientError) throw ingredientError
  const ingredients = (ingredientData ?? []) as CostIngredientRow[]

  const { data: laborData, error: laborError } = await supabase.from('cost_recipe_labor').select('recipe_id, amount')
  if (laborError) throw laborError
  const labor = (laborData ?? []) as CostLaborRow[]

  const rows = recipes.map((r) => {
    const result = computeRecipeCost({
      ingredients: ingredients.filter((i) => i.recipe_id === r.id),
      labor: labor.filter((l) => l.recipe_id === r.id),
      wasteOverheadPercent: Number(r.waste_overhead_percent),
      yieldQty: Number(r.yield_qty),
      profitPercent: Number(r.profit_percent),
    })
    return [r.name, round2(result.ingredientTotal), round2(result.laborTotal), round2(result.totalCost), round2(result.costPerUnit), round2(result.suggestedPrice), r.note ?? '']
  })
  await pushSheet('ต้นทุน', ['ชื่อสูตร', 'ต้นทุนวัตถุดิบรวม', 'ค่าแรงรวม', 'ต้นทุนรวม', 'ต้นทุนต่อหน่วย', 'ราคาขายแนะนำ', 'หมายเหตุ'], rows)
}

type SummaryOrderRow = { created_at: string; grand_total: number; items_cost_total: number }
type ExpenseRow = { expense_date: string; amount: number }

async function syncSummary() {
  const since = new Date()
  since.setDate(since.getDate() - 90)
  since.setHours(0, 0, 0, 0)

  const { data: orderData, error } = await supabase
    .from('orders')
    .select('created_at, grand_total, items_cost_total')
    .eq('is_draft', false)
    .neq('work_status', 'cancelled')
    .gte('created_at', since.toISOString())
  if (error) throw error
  const orders = (orderData ?? []) as SummaryOrderRow[]

  const { data: expenseData, error: expenseError } = await supabase.from('expenses').select('expense_date, amount').gte('expense_date', since.toISOString().slice(0, 10))
  if (expenseError) throw expenseError
  const expenses = (expenseData ?? []) as ExpenseRow[]

  const byDate = new Map<string, { sales: number; count: number; cost: number; expense: number }>()
  for (const o of orders) {
    const d = o.created_at.slice(0, 10)
    const cur = byDate.get(d) ?? { sales: 0, count: 0, cost: 0, expense: 0 }
    cur.sales += Number(o.grand_total)
    cur.count += 1
    cur.cost += Number(o.items_cost_total)
    byDate.set(d, cur)
  }
  for (const e of expenses) {
    const cur = byDate.get(e.expense_date) ?? { sales: 0, count: 0, cost: 0, expense: 0 }
    cur.expense += Number(e.amount)
    byDate.set(e.expense_date, cur)
  }

  const rows = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, v]) => {
      const profit = v.sales - v.cost
      const netProfit = profit - v.expense
      return [date, round2(v.sales), v.count, round2(v.cost), round2(profit), round2(v.expense), round2(netProfit)]
    })
  await pushSheet('สรุปยอด', ['วันที่', 'ยอดขาย', 'จำนวนออเดอร์', 'ต้นทุนโดยประมาณ', 'กำไรโดยประมาณ', 'ค่าใช้จ่าย', 'กำไรสุทธิ'], rows)
}

async function main() {
  await syncCustomers()
  await syncPOSSales()
  await syncOrders()
  await syncStaff()
  await syncCalendar()
  await syncContent()
  await syncCosting()
  await syncSummary()
  console.log('sync เสร็จแล้ว ✓ ทั้งหมด 8 แท็บ')
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
