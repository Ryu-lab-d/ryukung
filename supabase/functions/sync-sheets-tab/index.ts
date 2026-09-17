import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * เรียกจาก Postgres trigger (public.notify_sheets_sync(), ดู migration sheets_sync_trigger.sql) ทันทีที่
 * ตารางหลักเปลี่ยนแปลง — sync แท็บที่เกี่ยวข้องใน Google Sheets ให้ทันที ผ่าน Google Apps Script Web App
 * เดียวกับที่ scripts/syncToSheets.ts ใช้ (GOOGLE_SHEETS_SYNC_WEBHOOK_URL)
 *
 * ตรรกะ query/คำนวณแต่ละแท็บ **พอร์ตมาจาก scripts/syncToSheets.ts ตรงๆ** (คนละ runtime กัน Deno import จาก
 * src/ ข้าม runtime ไม่ได้ เหมือน edge function อื่นในโปรเจกต์นี้ที่ไม่ import จาก src/ เหมือนกัน) — ถ้าแก้
 * label/สูตรคำนวณฝั่งเว็บ (src/orders/workStatus.ts, src/content/contentMeta.ts, src/costing/costMath.ts)
 * ต้องแก้ที่นี่ให้ตรงกันด้วยมือ
 */

const TABLE_TO_TABS: Record<string, string[]> = {
  orders: ['pos', 'orders', 'calendar', 'summary'],
  customers: ['customers', 'orders', 'calendar'],
  staff_members: ['staff', 'orders'],
  content_items: ['content'],
  cost_recipes: ['costing'],
  cost_recipe_ingredients: ['costing'],
  cost_recipe_labor: ['costing'],
  expenses: ['summary'],
}

const CHANNEL_LABEL: Record<string, string> = { facebook: 'Facebook', line: 'LINE', instagram: 'Instagram', tiktok: 'TikTok', other: 'อื่นๆ' }
const FULFILLMENT_LABEL: Record<string, string> = { pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง' }
const PAYMENT_STATUS_LABEL: Record<string, string> = { unpaid: 'ยังไม่ชำระ', partial: 'มัดจำแล้ว', paid: 'จ่ายครบแล้ว' }
const PAYMENT_METHOD_LABEL: Record<string, string> = { transfer: 'โอนเงิน', promptpay: 'พร้อมเพย์', cash: 'เงินสด', cod: 'เก็บเงินปลายทาง', other: 'อื่นๆ' }
const STAFF_ROLE_LABEL: Record<string, string> = { owner: 'เจ้าของร้าน', executive: 'ผู้บริหาร', manager: 'ผู้จัดการ', staff: 'พนักงาน' }
const STAFF_STATUS_LABEL: Record<string, string> = { pending: 'รออนุมัติ', active: 'ใช้งานได้', revoked: 'ถูกระงับ' }
const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' }
const CONTENT_STATUS_LABEL: Record<string, string> = { idea: 'ไอเดีย', script: 'เขียนบท/แคปชั่น', shooting: 'ถ่ายทำ', editing: 'ตัดต่อ', ready: 'พร้อมโพสต์', posted: 'โพสต์แล้ว' }

// พอร์ตมาจาก src/orders/workStatus.ts's stageLabel() ตรงๆ
const SIMPLE_STAGE_LABEL: Record<string, string> = { to_bake: 'รออบ', baking: 'กำลังทำ', ready: 'แพ็คแล้วรอส่งมอบ', delivered: 'ส่งมอบแล้ว' }
const COURIER_STAGE_LABEL: Record<string, string> = {
  to_bake: 'รออบ', baking: 'กำลังทำ', ready: 'แพ็คแล้วรอส่ง', waiting_courier: 'รอขนส่งเข้ารับพัสดุ',
  picked_up: 'ขนส่งเข้ารับพัสดุแล้ว', in_transit: 'พัสดุอยู่ระหว่างจัดส่ง', delivered: 'จัดส่งสำเร็จ',
}
function stageLabel(fulfillmentType: string, status: string): string {
  const labels = fulfillmentType === 'shipping' || fulfillmentType === 'rider' ? COURIER_STAGE_LABEL : SIMPLE_STAGE_LABEL
  return labels[status] ?? status
}

// พอร์ตมาจาก src/costing/costMath.ts's computeRecipeCost() ตรงๆ
type IngredientLine = { purchase_qty: number; purchase_price: number; qty_used: number }
type LaborLine = { amount: number }
function ingredientCost(line: IngredientLine): number {
  if (line.purchase_qty <= 0) return 0
  return (line.purchase_price / line.purchase_qty) * line.qty_used
}
function computeRecipeCost(params: { ingredients: IngredientLine[]; labor: LaborLine[]; wasteOverheadPercent: number; yieldQty: number; profitPercent: number }) {
  const ingredientTotal = params.ingredients.reduce((sum, it) => sum + ingredientCost(it), 0)
  const overhead = ingredientTotal * (params.wasteOverheadPercent / 100)
  const laborTotal = params.labor.reduce((sum, l) => sum + l.amount, 0)
  const totalCost = ingredientTotal + overhead + laborTotal
  const costPerUnit = params.yieldQty > 0 ? totalCost / params.yieldQty : 0
  const profitPerUnit = costPerUnit * (params.profitPercent / 100)
  const suggestedPrice = costPerUnit + profitPerUnit
  return { ingredientTotal, laborTotal, totalCost, costPerUnit, suggestedPrice }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function thDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('th-TH') : ''
}
function thTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

async function pushSheet(webhookUrl: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ sheetName, headers, rows }),
  })
  if (!res.ok) throw new Error(`ส่งข้อมูลแท็บ "${sheetName}" ไม่สำเร็จ (HTTP ${res.status})`)
  const body = (await res.json()) as { ok: boolean; error?: string }
  if (!body.ok) throw new Error(`ส่งข้อมูลแท็บ "${sheetName}" ไม่สำเร็จ: ${body.error}`)
}

async function syncCustomers(db: SupabaseClient, webhookUrl: string) {
  const { data: customers, error } = await db.from('customers').select('*').order('name')
  if (error) throw error
  const { data: stats, error: statsError } = await db.from('customer_order_stats').select('*')
  if (statsError) throw statsError
  const statsMap = new Map((stats ?? []).map((s: { customer_id: string }) => [s.customer_id, s]))

  const rows = (customers ?? []).map((c) => {
    const s = statsMap.get(c.id) as { order_count: number; total_spend: number } | undefined
    return [
      c.name, c.phone ?? '', c.email ?? '', c.channel ? (CHANNEL_LABEL[c.channel] ?? c.channel) : '',
      s?.order_count ?? 0, round2(Number(s?.total_spend ?? 0)), c.note ?? '', thDate(c.created_at),
    ]
  })
  await pushSheet(webhookUrl, 'ลูกค้า', ['ชื่อ', 'เบอร์โทร', 'อีเมล', 'ช่องทาง', 'จำนวนออเดอร์', 'ยอดใช้จ่ายรวม', 'หมายเหตุ', 'วันที่สมัคร'], rows)
}

async function syncPOSSales(db: SupabaseClient, webhookUrl: string) {
  const { data, error } = await db
    .from('orders')
    .select('order_no, created_at, grand_total, order_items(product_name, qty), payments(method)')
    .is('customer_id', null)
    .eq('fulfillment_type', 'pickup')
    .eq('work_status', 'delivered')
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []).map((o) => {
    const items = (o.order_items as { product_name: string; qty: number }[]).map((it) => `${it.product_name} x${it.qty}`).join(', ')
    const method = (o.payments as { method: string }[])[0]?.method
    return [o.order_no ?? '', thDate(o.created_at), thTime(o.created_at), items, round2(Number(o.grand_total)), method ? (PAYMENT_METHOD_LABEL[method] ?? method) : '']
  })
  await pushSheet(webhookUrl, 'ขายหน้าร้าน (POS)', ['เลขออเดอร์', 'วันที่', 'เวลา', 'รายการสินค้า', 'ยอดรวม', 'วิธีชำระเงิน'], rows)
}

async function syncOrders(db: SupabaseClient, webhookUrl: string) {
  const { data, error } = await db
    .from('orders')
    .select(
      'order_no, created_at, needed_date, fulfillment_type, work_status, payment_status, grand_total, note, customers(name), staff_members(display_name, email), payments(amount)'
    )
    .eq('is_draft', false)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []).map((o) => {
    const customer = o.customers as { name: string } | null
    const staff = o.staff_members as { display_name: string | null; email: string } | null
    const paid = (o.payments as { amount: number }[]).reduce((sum, p) => sum + Number(p.amount), 0)
    return [
      o.order_no ?? '', customer?.name ?? '', thDate(o.created_at), thDate(o.needed_date),
      FULFILLMENT_LABEL[o.fulfillment_type] ?? o.fulfillment_type,
      stageLabel(o.fulfillment_type, o.work_status),
      PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status,
      round2(Number(o.grand_total)), round2(Math.max(Number(o.grand_total) - paid, 0)),
      staff?.display_name ?? staff?.email ?? '', o.note ?? '',
    ]
  })
  await pushSheet(
    webhookUrl, 'ออร์เดอร์',
    ['เลขออเดอร์', 'ชื่อลูกค้า', 'วันที่สั่ง', 'วันที่ต้องการ', 'วิธีรับของ', 'สถานะงาน', 'สถานะชำระเงิน', 'ยอดรวม', 'ยอดคงเหลือ', 'ผู้รับผิดชอบ', 'หมายเหตุ'],
    rows
  )
}

async function syncStaff(db: SupabaseClient, webhookUrl: string) {
  const { data, error } = await db.from('staff_members').select('display_name, email, role, status, created_at').order('created_at')
  if (error) throw error
  const rows = (data ?? []).map((s) => [s.display_name ?? '', s.email, STAFF_ROLE_LABEL[s.role] ?? s.role, STAFF_STATUS_LABEL[s.status] ?? s.status, thDate(s.created_at)])
  await pushSheet(webhookUrl, 'พนักงาน', ['ชื่อ', 'อีเมล', 'ตำแหน่ง', 'สถานะ', 'วันที่เข้าร่วม'], rows)
}

async function syncCalendar(db: SupabaseClient, webhookUrl: string) {
  const { data, error } = await db
    .from('orders')
    .select('order_no, bake_date, needed_date, work_status, fulfillment_type, customers(name)')
    .eq('is_draft', false)
    .neq('work_status', 'cancelled')
    .order('needed_date')
  if (error) throw error

  const rows = (data ?? []).map((o) => {
    const customer = o.customers as { name: string } | null
    return [o.order_no ?? '', customer?.name ?? '', thDate(o.bake_date), thDate(o.needed_date), stageLabel(o.fulfillment_type, o.work_status), FULFILLMENT_LABEL[o.fulfillment_type] ?? o.fulfillment_type]
  })
  await pushSheet(webhookUrl, 'ปฏิทิน', ['เลขออเดอร์', 'ชื่อลูกค้า', 'วันที่อบ', 'วันที่ต้องได้ของ', 'สถานะ', 'วิธีรับของ'], rows)
}

async function syncContent(db: SupabaseClient, webhookUrl: string) {
  const { data, error } = await db.from('content_items').select('*').order('post_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  const rows = (data ?? []).map((c) => [
    c.title,
    (c.platforms as string[]).map((p) => PLATFORM_LABEL[p] ?? p).join(', '),
    CONTENT_STATUS_LABEL[c.status] ?? c.status,
    c.idea ?? '', c.caption ?? '', c.hashtags ?? '', thDate(c.post_date), c.hook ?? '', c.goal ?? '',
  ])
  await pushSheet(webhookUrl, 'คอนเทนต์', ['หัวข้อ', 'แพลตฟอร์ม', 'สถานะ', 'ไอเดีย', 'แคปชั่น', 'แฮชแท็ก', 'วันที่โพสต์', 'Hook', 'เป้าหมาย'], rows)
}

async function syncCosting(db: SupabaseClient, webhookUrl: string) {
  const { data: recipes, error } = await db.from('cost_recipes').select('id, name, waste_overhead_percent, yield_qty, profit_percent, note')
  if (error) throw error
  const { data: ingredients, error: ingredientError } = await db.from('cost_recipe_ingredients').select('recipe_id, purchase_qty, purchase_price, qty_used')
  if (ingredientError) throw ingredientError
  const { data: labor, error: laborError } = await db.from('cost_recipe_labor').select('recipe_id, amount')
  if (laborError) throw laborError

  const rows = (recipes ?? []).map((r) => {
    const result = computeRecipeCost({
      ingredients: (ingredients ?? []).filter((i) => i.recipe_id === r.id).map((i) => ({ purchase_qty: Number(i.purchase_qty), purchase_price: Number(i.purchase_price), qty_used: Number(i.qty_used) })),
      labor: (labor ?? []).filter((l) => l.recipe_id === r.id).map((l) => ({ amount: Number(l.amount) })),
      wasteOverheadPercent: Number(r.waste_overhead_percent), yieldQty: Number(r.yield_qty), profitPercent: Number(r.profit_percent),
    })
    return [r.name, round2(result.ingredientTotal), round2(result.laborTotal), round2(result.totalCost), round2(result.costPerUnit), round2(result.suggestedPrice), r.note ?? '']
  })
  await pushSheet(webhookUrl, 'ต้นทุน', ['ชื่อสูตร', 'ต้นทุนวัตถุดิบรวม', 'ค่าแรงรวม', 'ต้นทุนรวม', 'ต้นทุนต่อหน่วย', 'ราคาขายแนะนำ', 'หมายเหตุ'], rows)
}

async function syncSummary(db: SupabaseClient, webhookUrl: string) {
  const since = new Date()
  since.setDate(since.getDate() - 90)
  since.setHours(0, 0, 0, 0)

  const { data: orders, error } = await db
    .from('orders')
    .select('created_at, grand_total, items_cost_total')
    .eq('is_draft', false)
    .neq('work_status', 'cancelled')
    .gte('created_at', since.toISOString())
  if (error) throw error
  const { data: expenses, error: expenseError } = await db.from('expenses').select('expense_date, amount').gte('expense_date', since.toISOString().slice(0, 10))
  if (expenseError) throw expenseError

  const byDate = new Map<string, { sales: number; count: number; cost: number; expense: number }>()
  for (const o of orders ?? []) {
    const d = o.created_at.slice(0, 10)
    const cur = byDate.get(d) ?? { sales: 0, count: 0, cost: 0, expense: 0 }
    cur.sales += Number(o.grand_total)
    cur.count += 1
    cur.cost += Number(o.items_cost_total)
    byDate.set(d, cur)
  }
  for (const e of expenses ?? []) {
    const cur = byDate.get(e.expense_date) ?? { sales: 0, count: 0, cost: 0, expense: 0 }
    cur.expense += Number(e.amount)
    byDate.set(e.expense_date, cur)
  }

  const rows = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, v]) => {
      const profit = v.sales - v.cost
      return [date, round2(v.sales), v.count, round2(v.cost), round2(profit), round2(v.expense), round2(profit - v.expense)]
    })
  await pushSheet(webhookUrl, 'สรุปยอด', ['วันที่', 'ยอดขาย', 'จำนวนออเดอร์', 'ต้นทุนโดยประมาณ', 'กำไรโดยประมาณ', 'ค่าใช้จ่าย', 'กำไรสุทธิ'], rows)
}

const SYNC_FN: Record<string, (db: SupabaseClient, webhookUrl: string) => Promise<void>> = {
  customers: syncCustomers,
  pos: syncPOSSales,
  orders: syncOrders,
  staff: syncStaff,
  calendar: syncCalendar,
  content: syncContent,
  costing: syncCosting,
  summary: syncSummary,
}

Deno.serve(async (req: Request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { table } = await req.json()
    const tabs = [...new Set(TABLE_TO_TABS[table] ?? [])]
    if (tabs.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: [] }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const webhookUrl = Deno.env.get('GOOGLE_SHEETS_SYNC_WEBHOOK_URL')
    if (!webhookUrl) throw new Error('ไม่ได้ตั้งค่า GOOGLE_SHEETS_SYNC_WEBHOOK_URL')

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    // sync ทุกแท็บที่เกี่ยวข้องพร้อมกัน (ไม่ใช่ทีละแท็บ) — ต้นเหตุจริงที่เจอตอนทดสอบ: pg_net รอ response แค่
    // 5 วินาที (ค่าเริ่มต้น) ถ้า sync ทีละแท็บแบบต่อคิว (แต่ละแท็บมีทั้ง query Supabase + POST ไป Apps Script)
    // รวมกันเกิน 5 วินาทีง่ายมากตั้งแต่ 2 แท็บขึ้นไป ทำให้ trigger timeout ก่อนจะรู้ผลจริง
    await Promise.all(tabs.map((tab) => SYNC_FN[tab](db, webhookUrl)))

    return new Response(JSON.stringify({ ok: true, synced: tabs }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    // ตั้งใจไม่ throw ให้ trigger ฝั่ง DB เห็นว่า fail — sync พลาดแค่รอบเดียวไม่ควรกระทบธุรกรรมจริงเด็ดขาด
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
