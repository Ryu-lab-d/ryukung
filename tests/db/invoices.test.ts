import { describe, it, expect, afterAll } from 'vitest'
import { signedInClient, adminClient, anonClient, purgeOrder } from './helpers'

// Invoice ของหลังบ้าน: เก็บ snapshot 30 วัน ผูกออเดอร์แบบ set null (ออเดอร์ถูกลบแล้วยังดูได้) ครบ 30 วันซ่อน+ลบอัตโนมัติ
const created: { orders: string[]; invoices: string[] } = { orders: [], invoices: [] }

async function makeOrder(db: Awaited<ReturnType<typeof signedInClient>>) {
  const no = await db.rpc('next_order_no')
  const { data } = await db.from('orders').insert({ is_draft: false, order_no: no.data as string }).select().single()
  created.orders.push(data!.id)
  return data!
}

afterAll(async () => {
  const admin = adminClient()
  if (created.invoices.length) await admin.from('invoices').delete().in('id', created.invoices)
  for (const id of created.orders) await purgeOrder(id)
})

describe('Invoice หลังบ้าน', () => {
  it('ออก Invoice ได้ ค้นหาด้วยเลขออเดอร์ได้ และออเดอร์ถูกลบแล้ว Invoice ยังอยู่', async () => {
    const db = await signedInClient()
    const order = await makeOrder(db)
    const ins = await db
      .from('invoices')
      .insert({ order_id: order.id, order_no: order.order_no, invoice_no: 'INV-' + order.order_no, customer_name: 'ทดสอบ', grand_total: 149, snapshot: { shop: { name: 'X' } } })
      .select()
      .single()
    expect(ins.error).toBeNull()
    created.invoices.push(ins.data!.id)

    const found = await db.from('invoices').select('id').ilike('order_no', `%${String(order.order_no).slice(-4)}%`)
    expect(found.data!.some((r) => r.id === ins.data!.id)).toBe(true)

    // ออก Invoice ซ้ำของออเดอร์เดิมไม่ได้ (หนึ่งออเดอร์หนึ่งใบ — อัปเดตแทน)
    const dup = await db.from('invoices').insert({ order_id: order.id, order_no: order.order_no, invoice_no: 'INV-2', snapshot: {} })
    expect(dup.error).not.toBeNull()

    await purgeOrder(order.id)
    created.orders = created.orders.filter((id) => id !== order.id)
    const after = await db.from('invoices').select('id, order_id').eq('id', ins.data!.id).single()
    expect(after.data!.order_id).toBeNull()
  })

  it('ครบ 30 วัน: ซ่อนจากการอ่านทันที และ purge_expired_invoices ลบจริง', async () => {
    const db = await signedInClient()
    const admin = adminClient()
    const old = await admin
      .from('invoices')
      .insert({ order_no: 'OLD-TEST-1', invoice_no: 'INV-OLD-TEST-1', snapshot: {}, issued_at: new Date(Date.now() - 31 * 86400000).toISOString() })
      .select()
      .single()
    expect(old.error).toBeNull()
    created.invoices.push(old.data!.id)
    const fresh = await admin
      .from('invoices')
      .insert({ order_no: 'NEW-TEST-1', invoice_no: 'INV-NEW-TEST-1', snapshot: {}, issued_at: new Date(Date.now() - 29 * 86400000).toISOString() })
      .select()
      .single()
    created.invoices.push(fresh.data!.id)

    const visible = await db.from('invoices').select('id').in('id', [old.data!.id, fresh.data!.id])
    const ids = visible.data!.map((r) => r.id)
    expect(ids).not.toContain(old.data!.id)
    expect(ids).toContain(fresh.data!.id)

    const purge = await db.rpc('purge_expired_invoices')
    expect(purge.error).toBeNull()
    const gone = await admin.from('invoices').select('id').eq('id', old.data!.id)
    expect(gone.data).toHaveLength(0)
    const still = await admin.from('invoices').select('id').eq('id', fresh.data!.id)
    expect(still.data).toHaveLength(1)
  })

  it('คนนอกที่ไม่ได้ล็อกอินอ่าน/ลบ Invoice ไม่ได้', async () => {
    const anon = anonClient()
    const read = await anon.from('invoices').select('id').limit(1)
    expect(read.data ?? []).toHaveLength(0)
    const purge = await anon.rpc('purge_expired_invoices')
    expect(purge.error).not.toBeNull()
  })
})

describe('Invoice: เลขต่อเนื่อง + ลิงก์สาธารณะ', () => {
  it('next_invoice_no ออกเลข INV-xxxxx เพิ่มขึ้นเรื่อยๆ และคนนอกเรียกไม่ได้', async () => {
    const db = await signedInClient()
    const a = await db.rpc('next_invoice_no')
    const b = await db.rpc('next_invoice_no')
    expect(a.data).toMatch(/^INV-\d{5,}$/)
    expect(Number(String(b.data).slice(4))).toBeGreaterThan(Number(String(a.data).slice(4)))
    expect((await anonClient().rpc('next_invoice_no')).error).not.toBeNull()
  })

  it('get_public_invoice: ต้องยืนยันตัวตนถึงเปิดดูได้ และเกิน 30 วัน/โทเคนสั้น/โทเคนผิด ไม่คืนอะไร', async () => {
    const admin = adminClient()
    const token = 'test-token-' + Math.random().toString(36).slice(2) + 'abcdefghijkl'
    const row = await admin
      .from('invoices')
      .insert({
        order_no: 'PUB-TEST-1', invoice_no: 'INV-PUBTEST',
        snapshot: { order: { public_token: token }, shop: { name: 'X' }, customer: { name: 'ลูกค้าทดสอบ', phone: '0812223333', email: 'secret-inv@example.com' } },
      })
      .select()
      .single()
    created.invoices.push(row.data!.id)
    const anon = anonClient()

    // ไม่ยืนยัน/ยืนยันผิด: ได้แค่หน้าล็อก ข้อมูลลูกค้าไม่หลุด
    for (const v of [undefined, 'ผิด', '0800000000']) {
      const r = await anon.rpc('get_public_invoice', { p_token: token, ...(v ? { p_verify: v } : {}) })
      expect(r.data.locked).toBe(true)
      expect(JSON.stringify(r.data)).not.toMatch(/ลูกค้าทดสอบ|0812223333|secret-inv/)
    }
    // ยืนยันถูก (ชื่อ หรือ เบอร์): เปิดได้
    for (const v of ['ลูกค้าทดสอบ', '081-222-3333']) {
      const ok = await anon.rpc('get_public_invoice', { p_token: token, p_verify: v })
      expect(ok.error).toBeNull()
      expect(ok.data.invoice_no).toBe('INV-PUBTEST')
      expect(ok.data.snapshot.customer.name).toBe('ลูกค้าทดสอบ')
    }
    expect((await anon.rpc('get_public_invoice', { p_token: 'short', p_verify: 'x' })).data).toBeNull()
    expect((await anon.rpc('get_public_invoice', { p_token: token + 'x', p_verify: 'ลูกค้าทดสอบ' })).data).toBeNull()
    // ฟังก์ชันตรวจภายในเรียกจากภายนอกไม่ได้
    expect((await anon.rpc('verify_invoice_token', { p_token: token, p_verify: 'x' })).error).not.toBeNull()

    // เดาผิดเกิน 10 ครั้ง/ชั่วโมง → ล็อก แม้เดาถูกทีหลัง
    for (let i = 0; i < 12; i++) await anon.rpc('get_public_invoice', { p_token: token, p_verify: 'เดา' + i })
    const locked = await anon.rpc('get_public_invoice', { p_token: token, p_verify: 'ลูกค้าทดสอบ' })
    expect(locked.data.locked).toBe(true)
    expect(locked.data.reason).toBe('locked_out')
    await admin.from('chat_usage').delete().like('usage_key', 'inv-fail:%')

    await admin.from('invoices').update({ issued_at: new Date(Date.now() - 31 * 86400000).toISOString() }).eq('id', row.data!.id)
    expect((await anon.rpc('get_public_invoice', { p_token: token, p_verify: 'ลูกค้าทดสอบ' })).data).toBeNull()
  })
})
