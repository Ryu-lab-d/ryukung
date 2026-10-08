import { describe, it, expect } from 'vitest'
import { anonClient, signedInClient } from './helpers'

// ชั้นป้องกัน "ปิดทั้งหมดก่อน เปิดเฉพาะที่ตั้งใจ" (migration 20261008100000_security_lockdown.sql)
// คนที่ยังไม่ล็อกอิน (anon key ที่ฝังอยู่ในหน้าเว็บ ใครก็เปิดดูได้) ต้องเรียกได้เฉพาะฟังก์ชันหน้าสาธารณะเท่านั้น

const STAFF_ONLY_FUNCTIONS: [string, Record<string, unknown>][] = [
  ['confirm_order', { p_order_id: '00000000-0000-0000-0000-000000000000' }],
  ['create_pos_sale', { p_items: [], p_payment_method: 'cash' }],
  ['issue_receipt', { p_order_id: '00000000-0000-0000-0000-000000000000', p_snapshot: {} }],
  ['reissue_receipt', { p_old_receipt_id: '00000000-0000-0000-0000-000000000000', p_snapshot: {} }],
  ['reject_customer_order', { p_order_id: '00000000-0000-0000-0000-000000000000', p_reason: 'x' }],
  ['adjust_ingredient_stock', { p_ingredient_id: '00000000-0000-0000-0000-000000000000', p_qty_delta: 1, p_note: 'x' }],
  ['restock_ingredient', { p_ingredient_id: '00000000-0000-0000-0000-000000000000', p_qty: 1, p_price_per_unit: 1, p_note: 'x' }],
  ['convert_ingredient_unit', { p_ingredient_id: '00000000-0000-0000-0000-000000000000', p_new_unit: 'g', p_factor: 1 }],
  ['claim_staff_invite', { p_display_name: 'x' }],
  ['next_order_no', {}],
  ['next_receipt_no', {}],
  ['next_invoice_no', {}],
  ['purge_expired_invoices', {}],
  ['is_active_member', {}],
  ['is_owner', {}],
  ['current_staff_id', {}],
  ['notify_sheets_sync', {}],
  ['orders_compute', {}],
  ['adjust_stock_for_order', { p_order_id: '00000000-0000-0000-0000-000000000000', p_direction: 'deduct', p_reason: 'x' }],
  ['bump_chat_usage', { p_key: 'x', p_limit: 1 }],
  ['promo_is_live', {}],
]

describe('ล็อกความปลอดภัย — anon', () => {
  it.each(STAFF_ONLY_FUNCTIONS)('anon เรียก %s ไม่ได้ (permission denied)', async (fn, args) => {
    const { error } = await anonClient().rpc(fn, args)
    expect(error).not.toBeNull()
    expect(error!.code === '42501' || /permission denied|could not find the function/i.test(error!.message)).toBe(true)
  })

  it('submit_customer_order เรียกตรงไม่ได้ (ต้องผ่าน Edge Function + Turnstile เท่านั้น)', async () => {
    const { error } = await anonClient().rpc('submit_customer_order', {
      p_customer_name: 'x', p_customer_phone: '0812345678', p_customer_email: 'a@b.co', p_fulfillment_type: 'pickup',
      p_needed_date: '2030-01-01', p_pickup_place: 'x', p_pickup_time: null, p_ship_recipient_name: null,
      p_ship_recipient_phone: null, p_ship_address_text: null, p_note: null, p_items: [],
    })
    expect(error).not.toBeNull()
  })

  it.each(['orders', 'customers', 'payments', 'settings', 'staff_members', 'invoices', 'promotions', 'course_access_codes', 'internal_secrets', 'expenses'])(
    'anon อ่าน/เขียนตาราง %s ตรงๆ ไม่ได้',
    async (table) => {
      const db = anonClient()
      const read = await db.from(table).select('*').limit(1)
      expect(read.error).not.toBeNull()
      expect(read.data ?? []).toEqual([])
      const write = await db.from(table).insert({}).select()
      expect(write.error).not.toBeNull()
      const del = await db.from(table).delete().not('id', 'is', null)
      expect(del.error).not.toBeNull()
    }
  )

  it('ฟังก์ชันหน้าสาธารณะยังเรียกได้ตามปกติ', async () => {
    const db = anonClient()
    expect((await db.rpc('get_public_menu')).error).toBeNull()
    expect((await db.rpc('get_public_promotions')).error).toBeNull()
    expect((await db.rpc('get_disaster_mode')).error).toBeNull()
    expect((await db.rpc('learn_open', { p_code: 'COOK-NOPENOPE' })).error).toBeNull()
    expect((await db.rpc('get_public_order', { p_token: 'x'.repeat(30) })).error).toBeNull()
  })
})

describe('ล็อกความปลอดภัย — คนล็อกอิน (พนักงาน)', () => {
  it('พนักงานยังใช้งานปกติ แต่เรียก trigger/ฟังก์ชันภายในตรงๆ ไม่ได้', async () => {
    const db = await signedInClient()
    expect((await db.rpc('is_active_member')).data).toBe(true)
    expect((await db.from('orders').select('id').limit(1)).error).toBeNull()
    for (const fn of ['notify_sheets_sync', 'orders_compute', 'touch_parent_order', 'bump_chat_usage']) {
      const r = await db.rpc(fn, fn === 'bump_chat_usage' ? { p_key: 'x', p_limit: 1 } : {})
      expect(r.error).not.toBeNull()
    }
    // internal_secrets ไม่ให้สิทธิ์ใครเลยนอกจาก service role
    expect((await db.from('internal_secrets').select('*')).error).not.toBeNull()
  })
})
