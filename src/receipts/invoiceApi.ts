import { supabase } from '../lib/supabase'
import { sendCustomerEmail } from '../lib/customerEmail'
import { invoiceLinkEmail } from '../lib/emailTemplates'
import { productImageUrl } from '../products/ProductCard'

/** ข้อมูลทั้งหมดที่ใช้วาดเอกสาร Invoice — บันทึกเป็น snapshot ตอนออกเอกสาร ออเดอร์ถูกลบไปแล้วก็ยังเปิดดูย้อนหลังได้ */
export type InvoiceSnapshot = {
  shop: { name: string; logo_path: string | null; address: string | null; phone: string | null; footer: string | null; tax_id?: string | null }
  order: {
    order_no: string
    created_at: string
    needed_date: string | null
    fulfillment_type: string
    work_status: string
    payment_status: string
    pickup_place: string | null
    pickup_time: string | null
    ship_recipient_name: string | null
    ship_recipient_phone: string | null
    ship_address_text: string | null
    tracking_no: string | null
    carrier: string | null
    note: string | null
    public_token: string | null
  }
  customer: { name: string | null; phone: string | null; email: string | null }
  items: { product_name: string; qty: number; unit_price: number; line_total: number; note: string | null }[]
  totals: { items_total: number; discount_amount: number; shipping_fee: number; grand_total: number; paid: number }
  payments: { paid_at: string; method: string; amount: number }[]
}

export type InvoiceRow = {
  id: string
  order_id: string | null
  order_no: string
  invoice_no: string
  customer_name: string | null
  grand_total: number
  payment_status: string | null
  issued_at: string
  updated_at: string
  snapshot: InvoiceSnapshot
}

export const INVOICE_RETENTION_DAYS = 30

type Loose = any

/** แปลงข้อมูลสดของออเดอร์ + ตั้งค่าร้านเป็น snapshot สำหรับบันทึกใน Invoice */
export function buildInvoiceSnapshot(order: Loose, items: Loose[], payments: Loose[], settings: Loose): InvoiceSnapshot {
  const paid = payments.reduce((s: number, p: Loose) => s + Number(p.amount), 0)
  return {
    shop: {
      name: settings.shop_name,
      logo_path: settings.logo_path ?? null,
      address: settings.address ?? null,
      phone: settings.phone ?? null,
      footer: settings.receipt_footer ?? null,
      tax_id: settings.tax_id ?? null,
    },
    order: {
      order_no: order.order_no ?? '-',
      created_at: order.created_at,
      needed_date: order.needed_date ?? null,
      fulfillment_type: order.fulfillment_type,
      work_status: order.work_status,
      payment_status: order.payment_status,
      pickup_place: order.pickup_place ?? null,
      pickup_time: order.pickup_time ?? null,
      ship_recipient_name: order.ship_recipient_name ?? null,
      ship_recipient_phone: order.ship_recipient_phone ?? null,
      ship_address_text: order.ship_address_text ?? null,
      tracking_no: order.tracking_no ?? null,
      carrier: order.carrier ?? null,
      note: order.note ?? null,
      public_token: order.public_token ?? null,
    },
    customer: { name: order.customers?.name ?? null, phone: order.customers?.phone ?? null, email: order.customers?.email ?? null },
    items: items.map((it: Loose) => ({
      product_name: it.product_name,
      qty: Number(it.qty),
      unit_price: Number(it.unit_price),
      line_total: Number(it.line_total),
      note: it.note ?? null,
    })),
    totals: {
      items_total: Number(order.items_total ?? 0),
      discount_amount: Number(order.discount_amount ?? 0),
      shipping_fee: Number(order.shipping_fee ?? 0),
      grand_total: Number(order.grand_total ?? 0),
      paid,
    },
    payments: payments.map((p: Loose) => ({ paid_at: p.paid_at, method: p.method, amount: Number(p.amount) })),
  }
}

function summaryColumns(snapshot: InvoiceSnapshot) {
  return {
    order_no: snapshot.order.order_no,
    customer_name: snapshot.customer.name,
    grand_total: snapshot.totals.grand_total,
    payment_status: snapshot.order.payment_status,
  }
}

/** Invoice ของออเดอร์นี้ (ถ้าเคยออกไว้และยังไม่ครบ 30 วัน) */
export async function fetchInvoiceByOrder(orderId: string) {
  const { data, error } = await supabase.from('invoices').select('*').eq('order_id', orderId).maybeSingle()
  return { invoice: (data as InvoiceRow | null) ?? null, error: error ? { message: error.message } : null }
}

/** ออก Invoice ใหม่ — วันที่ออกเอกสารถูกตั้งตอนนี้และคงที่ตลอด 30 วัน (หนึ่งออเดอร์หนึ่งใบ) */
export async function issueInvoice(orderId: string, snapshot: InvoiceSnapshot) {
  // เลขที่ Invoice รันต่อเนื่อง INV-00001... จากฐานข้อมูล (ไม่ซ้ำแม้ออกพร้อมกันหลายเครื่อง)
  const no = await supabase.rpc('next_invoice_no')
  if (no.error || !no.data) return { invoice: null, error: { message: no.error?.message ?? 'ขอเลขที่ Invoice ไม่สำเร็จ' } }
  const { data, error } = await supabase
    .from('invoices')
    .insert({ order_id: orderId, snapshot, invoice_no: no.data as string, ...summaryColumns(snapshot) })
    .select()
    .single()
  return { invoice: (data as InvoiceRow | null) ?? null, error: error ? { message: error.message } : null }
}

/** อัปเดตข้อมูลในใบเดิมให้ตรงกับออเดอร์ล่าสุด (เช่นหลังรับเงินเพิ่ม) — วันที่ออกเอกสารเดิมไม่เปลี่ยน */
export async function refreshInvoice(invoiceId: string, snapshot: InvoiceSnapshot) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ snapshot, updated_at: new Date().toISOString(), ...summaryColumns(snapshot) })
    .eq('id', invoiceId)
    .select()
    .single()
  return { invoice: (data as InvoiceRow | null) ?? null, error: error ? { message: error.message } : null }
}

export async function getInvoice(invoiceId: string) {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
  return { invoice: (data as InvoiceRow | null) ?? null, error: error ? { message: error.message } : null }
}

export async function deleteInvoice(invoiceId: string) {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId)
  return { error: error ? { message: error.message } : null }
}

/** ลบ Invoice ที่ครบ 30 วันจริงๆ — เรียกทุกครั้งที่เปิดหน้ารายการ (นอกเหนือจากที่ซ่อนจากการอ่านอัตโนมัติและตั้งเวลาลบรายวันฝั่งฐานข้อมูล) */
export async function purgeExpiredInvoices() {
  await supabase.rpc('purge_expired_invoices')
}

/**
 * ล้างเลขออเดอร์ที่ได้จากเครื่องสแกนบาร์โค้ด — เครื่องสแกนบางรุ่นส่งอักขระครอบหัวท้ายมาด้วย (เช่น "~RYB-001296^")
 * จึงตัดทุกอย่างที่ไม่ใช่ตัวอักษร/ตัวเลข/ขีดกลางทิ้ง (รวมช่องว่างและอักขระควบคุม) แล้วแปลงเป็นตัวพิมพ์ใหญ่
 */
export function normalizeOrderCode(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}-]/gu, '').toUpperCase()
}

/** ค้นหาจากเลขออเดอร์ (ตัดอักขระพิเศษจากเครื่องสแกน ไม่สนตัวพิมพ์) — ว่าง = ทั้งหมด ใหม่สุดก่อน */
export async function listInvoices(search: string) {
  const q = normalizeOrderCode(search)
  let query = supabase
    .from('invoices')
    .select('id, order_id, order_no, invoice_no, customer_name, grand_total, payment_status, issued_at, updated_at')
    .order('issued_at', { ascending: false })
    .limit(200)
  if (q) query = query.ilike('order_no', `%${q}%`)
  const { data, error } = await query
  return { invoices: (data ?? []) as Omit<InvoiceRow, 'snapshot'>[], error: error ? { message: error.message } : null }
}


/** ลิงก์ Invoice สาธารณะของใบนี้ (ลูกค้าเปิดดู/พิมพ์เองได้ ภายใน 30 วันนับจากวันที่ออก) — ใช้โทเคนเดียวกับลิงก์ติดตามออเดอร์ */
export function invoiceShareUrl(snapshot: InvoiceSnapshot): string | null {
  return snapshot.order.public_token ? `${window.location.origin}/inv/${snapshot.order.public_token}` : null
}

/** ส่งลิงก์ Invoice ให้ลูกค้าทางอีเมล — คืนข้อความผลลัพธ์ให้แสดงเป็นแจ้งเตือน */
export async function emailInvoiceToCustomer(invoice: InvoiceRow): Promise<string> {
  const s = invoice.snapshot
  const url = invoiceShareUrl(s)
  if (!s.customer.email) return 'ลูกค้าคนนี้ไม่มีอีเมล ส่งไม่ได้'
  if (!url) return 'ออเดอร์นี้ไม่มีลิงก์สาธารณะ ส่งไม่ได้'
  const { subject, html } = invoiceLinkEmail({
    shopName: s.shop.name,
    logoUrl: s.shop.logo_path ? productImageUrl(s.shop.logo_path) : null,
    orderNo: s.order.order_no,
    invoiceNo: invoice.invoice_no,
    customerName: s.customer.name ?? 'ลูกค้า',
    grandTotal: s.totals.grand_total,
    invoiceUrl: url,
  })
  const { error } = await sendCustomerEmail(s.customer.email, subject, html)
  return error ? 'ส่งอีเมลไม่สำเร็จ: ' + error : `ส่ง Invoice ไปที่ ${s.customer.email} แล้ว`
}

/** ดึง Invoice ด้วยโทเคนสาธารณะ (ไม่ต้องล็อกอิน) — ไม่พบ/ครบ 30 วัน = null */
export async function fetchPublicInvoice(token: string) {
  const { data } = await supabase.rpc('get_public_invoice', { p_token: token })
  return (data as { invoice_no: string; issued_at: string; snapshot: InvoiceSnapshot } | null) ?? null
}
