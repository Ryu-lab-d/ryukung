import { describe, it, expect } from 'vitest'
import { signedInClient, purgeOrder } from './helpers'

async function makeOrder(db: Awaited<ReturnType<typeof signedInClient>>) {
  const no = await db.rpc('next_order_no')
  const { data } = await db
    .from('orders')
    .insert({ is_draft: false, order_no: no.data as string })
    .select()
    .single()
  return data!
}

describe('ใบเสร็จ', () => {
  it('ออกใบเสร็จได้ และแก้เนื้อหาไม่ได้', async () => {
    const db = await signedInClient()
    const order = await makeOrder(db)
    const no = await db.rpc('next_receipt_no')

    const receipt = await db
      .from('receipts')
      .insert({
        order_id: order.id,
        receipt_no: no.data as string,
        snapshot: { shop_name: 'RYUKUNG BAKERY', grand_total: 149 },
      })
      .select()
      .single()
    expect(receipt.error).toBeNull()
    expect(receipt.data!.status).toBe('issued')

    const edit = await db
      .from('receipts')
      .update({ snapshot: { grand_total: 1 } })
      .eq('id', receipt.data!.id)
    expect(edit.error).not.toBeNull()

    const cancel = await db
      .from('receipts')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', receipt.data!.id)
    expect(cancel.error).toBeNull()

    await purgeOrder(order.id)
  })

  it('ใบเสร็จลบไม่ได้แม้จะล็อกอินแล้ว', async () => {
    const db = await signedInClient()
    const order = await makeOrder(db)
    const no = (await db.rpc('next_receipt_no')).data as string
    const receipt = await db
      .from('receipts')
      .insert({ order_id: order.id, receipt_no: no, snapshot: {} })
      .select()
      .single()

    await db.from('receipts').delete().eq('id', receipt.data!.id)
    const still = await db.from('receipts').select('*').eq('id', receipt.data!.id)
    expect(still.data).toHaveLength(1)

    await purgeOrder(order.id)
  })

  it('เลขใบเสร็จซ้ำไม่ได้', async () => {
    const db = await signedInClient()
    const order = await makeOrder(db)
    const no = (await db.rpc('next_receipt_no')).data as string

    await db.from('receipts').insert({
      order_id: order.id, receipt_no: no, snapshot: {},
    })
    const dup = await db.from('receipts').insert({
      order_id: order.id, receipt_no: no, snapshot: {},
    })
    expect(dup.error).not.toBeNull()

    await purgeOrder(order.id)
  })

  it('จำนวนเงินที่จ่ายต้องมากกว่าศูนย์', async () => {
    const db = await signedInClient()
    const order = await makeOrder(db)
    const { error } = await db
      .from('payments')
      .insert({ order_id: order.id, amount: 0 })
    expect(error).not.toBeNull()
    await purgeOrder(order.id)
  })
})
