import { describe, it, expect, afterAll } from 'vitest'
import { signedInClient } from './helpers'

const cleanupIds = { categories: [] as string[], products: [] as string[], ingredients: [] as string[], withdrawals: [] as string[] }

describe('เบิกของ — ค่าจ้างเป็นสินค้า (is_wage) ตัดสต็อกวัตถุดิบจริง', () => {
  it('insert แถว is_wage=true แล้ว ingredients.stock_qty ลดลงตามสูตรจริง เหมือนของที่ขาย', async () => {
    const db = await signedInClient()

    const cat = await db.from('categories').insert({ name: 'ทดสอบ-หมวดค่าจ้าง', sort_order: 1 }).select().single()
    expect(cat.error).toBeNull()
    cleanupIds.categories.push(cat.data!.id)

    const ing = await db
      .from('ingredients')
      .insert({ name: 'ทดสอบ-แป้งค่าจ้าง', unit: 'กรัม', stock_qty: 1000, cost_per_unit: 0.5 })
      .select()
      .single()
    expect(ing.error).toBeNull()
    cleanupIds.ingredients.push(ing.data!.id)

    const prod = await db
      .from('products')
      .insert({ name: 'ทดสอบ-คุกกี้ค่าจ้าง', category_id: cat.data!.id, price: 40, cost: 15 })
      .select()
      .single()
    expect(prod.error).toBeNull()
    cleanupIds.products.push(prod.data!.id)

    const link = await db
      .from('product_ingredients')
      .insert({ product_id: prod.data!.id, ingredient_id: ing.data!.id, qty_per_unit: 20 })
      .select()
      .single()
    expect(link.error).toBeNull()

    const withdrawal = await db
      .from('stock_withdrawals')
      .insert({ location: 'ทดสอบ-ค่าจ้าง', wage_type: 'product' })
      .select()
      .single()
    expect(withdrawal.error).toBeNull()
    cleanupIds.withdrawals.push(withdrawal.data!.id)

    const before = await db.from('ingredients').select('stock_qty').eq('id', ing.data!.id).single()
    expect(Number(before.data!.stock_qty)).toBe(1000)

    // 1 คุกกี้เป็นค่าจ้าง (is_wage=true) — ควรตัดสต็อกแป้งเหมือนของที่เอาไปขายจริง (20 กรัม/ชิ้น)
    const item = await db
      .from('stock_withdrawal_items')
      .insert({
        withdrawal_id: withdrawal.data!.id,
        product_id: prod.data!.id,
        product_name: 'ทดสอบ-คุกกี้ค่าจ้าง',
        unit_price: 0,
        unit_cost: 15,
        qty_out: 1,
        is_wage: true,
      })
      .select()
      .single()
    expect(item.error).toBeNull()
    expect(item.data!.is_wage).toBe(true)

    const after = await db.from('ingredients').select('stock_qty').eq('id', ing.data!.id).single()
    expect(Number(after.data!.stock_qty)).toBe(1000 - 20) // trigger เดิมตัดสต็อกให้อัตโนมัติ

    // ลบแถว wage item — สต็อกต้องคืนกลับ
    await db.from('stock_withdrawal_items').delete().eq('id', item.data!.id)
    const restored = await db.from('ingredients').select('stock_qty').eq('id', ing.data!.id).single()
    expect(Number(restored.data!.stock_qty)).toBe(1000)
  })
})

describe('เบิกของ — จ่ายค่าจ้าง / รับเงินคืนร้าน', () => {
  it('markWagePaid และ markProceedsReceived อัปเดตสถานะ+เวลาได้ถูกต้อง', async () => {
    const db = await signedInClient()
    const withdrawal = await db
      .from('stock_withdrawals')
      .insert({ location: 'ทดสอบ-สถานะจ่าย', wage_type: 'cash', wage_cash_amount: 30 })
      .select()
      .single()
    expect(withdrawal.error).toBeNull()
    cleanupIds.withdrawals.push(withdrawal.data!.id)
    expect(withdrawal.data!.wage_paid).toBe(false)
    expect(withdrawal.data!.proceeds_received).toBe(false)

    const paid = await db
      .from('stock_withdrawals')
      .update({ wage_paid: true, wage_paid_at: new Date().toISOString() })
      .eq('id', withdrawal.data!.id)
      .select()
      .single()
    expect(paid.error).toBeNull()
    expect(paid.data!.wage_paid).toBe(true)
    expect(paid.data!.wage_paid_at).not.toBeNull()

    const received = await db
      .from('stock_withdrawals')
      .update({ proceeds_received: true, proceeds_received_at: new Date().toISOString() })
      .eq('id', withdrawal.data!.id)
      .select()
      .single()
    expect(received.error).toBeNull()
    expect(received.data!.proceeds_received).toBe(true)
    expect(received.data!.proceeds_received_at).not.toBeNull()
  })

  it('wage_type ที่ไม่อยู่ใน enum ใส่ไม่ได้ / wage_cash_amount ติดลบใส่ไม่ได้', async () => {
    const db = await signedInClient()
    const bad1 = await db.from('stock_withdrawals').insert({ wage_type: 'ไม่มีจริง' })
    expect(bad1.error).not.toBeNull()

    const bad2 = await db.from('stock_withdrawals').insert({ wage_type: 'cash', wage_cash_amount: -5 })
    expect(bad2.error).not.toBeNull()
  })
})

afterAll(async () => {
  const db = await signedInClient()
  if (cleanupIds.withdrawals.length) await db.from('stock_withdrawals').delete().in('id', cleanupIds.withdrawals)
  if (cleanupIds.products.length) await db.from('products').delete().in('id', cleanupIds.products)
  if (cleanupIds.ingredients.length) await db.from('ingredients').delete().in('id', cleanupIds.ingredients)
  if (cleanupIds.categories.length) await db.from('categories').delete().in('id', cleanupIds.categories)
})
