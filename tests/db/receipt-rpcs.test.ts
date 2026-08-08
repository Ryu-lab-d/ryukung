import { describe, it, expect } from 'vitest'
import { signedInClient, purgeOrder } from './helpers'

async function makeOrder(db: Awaited<ReturnType<typeof signedInClient>>) {
  const no = (await db.rpc('next_order_no')).data as string
  const { data } = await db
    .from('orders')
    .insert({ is_draft: false, order_no: no, fulfillment_type: 'pickup' })
    .select()
    .single()
  return data!
}

describe('ออกใบเสร็จแบบอะตอมมิก', () => {
  it('ออกใบเสร็จได้ในครั้งเดียว ได้เลขที่ถูกรูปแบบ', async () => {
    const db = await signedInClient()
    const order = await makeOrder(db)
    const res = await db.rpc('issue_receipt', { p_order_id: order.id, p_snapshot: { grand_total: 100 } })
    expect(res.error).toBeNull()

    const receipt = await db.from('receipts').select('*').eq('id', res.data as string).single()
    expect(receipt.data!.receipt_no).toMatch(/^RC-\d{6}$/)
    expect(receipt.data!.status).toBe('issued')

    await purgeOrder(order.id)
  })

  it('ยกเลิกแล้วออกใหม่ ใบเก่าถูกยกเลิกและเชื่อมไปใบใหม่ เลขไม่ซ้ำกัน', async () => {
    const db = await signedInClient()
    const order = await makeOrder(db)
    const first = await db.rpc('issue_receipt', { p_order_id: order.id, p_snapshot: { grand_total: 100 } })
    const second = await db.rpc('reissue_receipt', { p_old_receipt_id: first.data as string, p_snapshot: { grand_total: 100 } })
    expect(second.error).toBeNull()

    const oldReceipt = await db.from('receipts').select('*').eq('id', first.data as string).single()
    expect(oldReceipt.data!.status).toBe('cancelled')
    expect(oldReceipt.data!.replaced_by_receipt_id).toBe(second.data)

    const newReceipt = await db.from('receipts').select('*').eq('id', second.data as string).single()
    expect(newReceipt.data!.receipt_no).not.toBe(oldReceipt.data!.receipt_no)

    await purgeOrder(order.id)
  })
})
