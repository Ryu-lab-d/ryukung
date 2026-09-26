import { describe, it, expect, afterAll } from 'vitest'
import { signedInClient } from './helpers'

const cleanupIds = { categories: [] as string[], products: [] as string[], ingredients: [] as string[], orders: [] as string[] }

describe('ขายหน้าร้าน (POS) — create_pos_sale', () => {
  it('สร้างออเดอร์ไม่มีลูกค้า ปิดจบทันที (delivered/paid) + ตัดสต็อกวัตถุดิบ + บันทึกจ่ายเงินถูกต้อง', async () => {
    const db = await signedInClient()

    const cat = await db.from('categories').insert({ name: 'ทดสอบ-หมวด-pos', sort_order: 1 }).select().single()
    expect(cat.error).toBeNull()
    cleanupIds.categories.push(cat.data!.id)

    const ing = await db
      .from('ingredients')
      .insert({ name: 'ทดสอบ-แป้ง-pos', unit: 'กรัม', stock_qty: 1000, cost_per_unit: 0.5 })
      .select()
      .single()
    expect(ing.error).toBeNull()
    cleanupIds.ingredients.push(ing.data!.id)

    const prod = await db
      .from('products')
      .insert({ name: 'ทดสอบ-คุกกี้-pos', category_id: cat.data!.id, price: 40, cost: 15 })
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

    const rpc = await db.rpc('create_pos_sale', {
      p_items: [{ product_id: prod.data!.id, product_name: 'ทดสอบ-คุกกี้-pos', unit_price: 40, unit_cost: 15, qty: 3 }],
      p_payment_method: 'cash',
    })
    expect(rpc.error).toBeNull()
    const orderId = rpc.data as string
    cleanupIds.orders.push(orderId)

    const order = await db.from('orders').select('*').eq('id', orderId).single()
    expect(order.error).toBeNull()
    expect(order.data!.is_draft).toBe(false)
    expect(order.data!.customer_id).toBeNull()
    expect(order.data!.fulfillment_type).toBe('pickup')
    expect(order.data!.work_status).toBe('delivered')
    expect(order.data!.order_no).not.toBeNull()
    expect(Number(order.data!.grand_total)).toBe(120) // 40*3
    expect(order.data!.payment_status).toBe('paid')

    const items = await db.from('order_items').select('*').eq('order_id', orderId)
    expect(items.data).toHaveLength(1)
    expect(Number(items.data![0].qty)).toBe(3)
    expect(Number(items.data![0].unit_price)).toBe(40)

    const payments = await db.from('payments').select('*').eq('order_id', orderId)
    expect(payments.data).toHaveLength(1)
    expect(Number(payments.data![0].amount)).toBe(120)
    expect(payments.data![0].method).toBe('cash')

    // ตัดสต็อกวัตถุดิบเหมือนออเดอร์ปกติ — 3 ชิ้น x 20 กรัม/ชิ้น = 60 กรัม
    const ingAfter = await db.from('ingredients').select('stock_qty').eq('id', ing.data!.id).single()
    expect(Number(ingAfter.data!.stock_qty)).toBe(1000 - 60)
  })

  it('เลือกวิธีจ่ายพร้อมเพย์ บันทึก method ถูกต้อง', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-บราวนี่-pos', price: 60, cost: 25 }).select().single()
    expect(prod.error).toBeNull()
    cleanupIds.products.push(prod.data!.id)

    const rpc = await db.rpc('create_pos_sale', {
      p_items: [{ product_id: prod.data!.id, product_name: 'ทดสอบ-บราวนี่-pos', unit_price: 60, unit_cost: 25, qty: 1 }],
      p_payment_method: 'promptpay',
    })
    expect(rpc.error).toBeNull()
    const orderId = rpc.data as string
    cleanupIds.orders.push(orderId)

    const payments = await db.from('payments').select('method, amount').eq('order_id', orderId)
    expect(payments.data).toHaveLength(1)
    expect(payments.data![0].method).toBe('promptpay')
    expect(Number(payments.data![0].amount)).toBe(60)
  })

  it('วิธีจ่ายที่ไม่รู้จักถูกปฏิเสธด้วย constraint เดิมของตาราง payments', async () => {
    const db = await signedInClient()
    const prod = await db.from('products').insert({ name: 'ทดสอบ-ของ-pos-ผิด', price: 10, cost: 5 }).select().single()
    expect(prod.error).toBeNull()
    cleanupIds.products.push(prod.data!.id)

    const rpc = await db.rpc('create_pos_sale', {
      p_items: [{ product_id: prod.data!.id, product_name: 'ทดสอบ-ของ-pos-ผิด', unit_price: 10, unit_cost: 5, qty: 1 }],
      p_payment_method: 'ไม่มีจริง',
    })
    expect(rpc.error).not.toBeNull()
  })
})

afterAll(async () => {
  const db = await signedInClient()
  // ลำดับสำคัญ: ต้องลบ receipts ก่อน orders เสมอ (receipts.order_id เป็น on delete RESTRICT) ไม่งั้น
  // orders/products ข้างล่างจะลบไม่ออกเงียบๆ เพราะ create_pos_sale ออก receipt ให้อัตโนมัติทุกครั้ง —
  // ต้องเช็ค .error ทุกจุดด้วย ไม่งั้นจะไม่รู้เลยว่าลบไม่สำเร็จแล้วข้อมูลทดสอบค้างในฐานข้อมูลจริง
  if (cleanupIds.orders.length) {
    const { error } = await db.from('receipts').delete().in('order_id', cleanupIds.orders)
    if (error) console.error('cleanup: ลบ receipts ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.orders.length) {
    const { error } = await db.from('orders').delete().in('id', cleanupIds.orders)
    if (error) console.error('cleanup: ลบ orders ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.products.length) {
    const { error } = await db.from('products').delete().in('id', cleanupIds.products)
    if (error) console.error('cleanup: ลบ products ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.ingredients.length) {
    const { error } = await db.from('ingredients').delete().in('id', cleanupIds.ingredients)
    if (error) console.error('cleanup: ลบ ingredients ไม่สำเร็จ', error.message)
  }
  if (cleanupIds.categories.length) {
    const { error } = await db.from('categories').delete().in('id', cleanupIds.categories)
    if (error) console.error('cleanup: ลบ categories ไม่สำเร็จ', error.message)
  }
})
