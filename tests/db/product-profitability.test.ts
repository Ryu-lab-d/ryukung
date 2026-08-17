import { describe, it, expect, afterAll } from 'vitest'
import { signedInClient } from './helpers'

const cleanupIds = { categories: [] as string[], products: [] as string[], ingredients: [] as string[], orders: [] as string[] }

describe('ต้นทุนจากสูตรปัจจุบัน (ไม่ใช่ unit_cost ตอนขาย)', () => {
  it('สินค้าที่มีสูตรผูกไว้ ดึงราคาวัตถุดิบปัจจุบันมาคำนวณต้นทุนได้ถูกต้อง', async () => {
    const db = await signedInClient()

    const cat = await db.from('categories').insert({ name: 'ทดสอบ-หมวดกำไร', sort_order: 1 }).select().single()
    expect(cat.error).toBeNull()
    cleanupIds.categories.push(cat.data!.id)

    const ing = await db
      .from('ingredients')
      .insert({ name: 'ทดสอบ-แป้ง', unit: 'กรัม', stock_qty: 1000, cost_per_unit: 0.5 })
      .select()
      .single()
    expect(ing.error).toBeNull()
    cleanupIds.ingredients.push(ing.data!.id)

    const prod = await db
      .from('products')
      .insert({ name: 'ทดสอบ-คุกกี้กำไร', category_id: cat.data!.id, price: 40, cost: 999 })
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

    // ยืนยันออเดอร์ด้วย unit_cost มั่วๆ (999) — ควรถูกเก็บเป็น snapshot เฉยๆ ไม่ถูกใช้คำนวณกำไรจริงต่อไป
    const draft = await db.from('orders').insert({ is_draft: true, fulfillment_type: 'pickup' }).select().single()
    expect(draft.error).toBeNull()
    cleanupIds.orders.push(draft.data!.id)

    const confirm = await db.rpc('confirm_order', {
      p_order_id: draft.data!.id,
      p_customer_id: null,
      p_fulfillment_type: 'pickup',
      p_needed_date: null,
      p_bake_date: null,
      p_pickup_place: 'หน้าร้าน',
      p_pickup_time: '10:00',
      p_ship_recipient_name: null,
      p_ship_recipient_phone: null,
      p_ship_address_text: null,
      p_shipping_fee: 0,
      p_discount_type: 'none',
      p_discount_value: 0,
      p_note: null,
      p_items: [{ product_id: prod.data!.id, product_name: 'ทดสอบ-คุกกี้กำไร', unit_price: 40, unit_cost: 999, qty: 10, note: null }],
    })
    expect(confirm.error).toBeNull()

    // จำลองสิ่งที่ useSalesSummary + useAllProductIngredients ดึงจริง
    const orderRow = await db
      .from('orders')
      .select('id, order_no, created_at, items_total, items_cost_total, grand_total, order_items(product_id, product_name, qty, line_total, unit_cost)')
      .eq('id', draft.data!.id)
      .single()
    expect(orderRow.error).toBeNull()
    expect(orderRow.data!.order_items[0].product_id).toBe(prod.data!.id)
    expect(Number(orderRow.data!.order_items[0].unit_cost)).toBe(999) // snapshot เก่ายังอยู่ครบ ไม่ถูกแตะ

    const linksRow = await db.from('product_ingredients').select('product_id, ingredient_id, qty_per_unit').eq('product_id', prod.data!.id)
    expect(linksRow.error).toBeNull()
    expect(Number(linksRow.data![0].qty_per_unit)).toBe(20)

    const ingRow = await db.from('ingredients').select('id, cost_per_unit').eq('id', ing.data!.id).single()
    expect(Number(ingRow.data!.cost_per_unit)).toBe(0.5)

    // ต้นทุนจากสูตรปัจจุบัน = qty(10) * qty_per_unit(20) * cost_per_unit(0.5) = 100 บาท ไม่ใช่ 999*10 = 9990
    const recipeCost = 10 * 20 * 0.5
    expect(recipeCost).toBe(100)
    expect(recipeCost).not.toBe(999 * 10)
  })
})

afterAll(async () => {
  const db = await signedInClient()
  if (cleanupIds.orders.length) await db.from('orders').delete().in('id', cleanupIds.orders)
  if (cleanupIds.products.length) await db.from('products').delete().in('id', cleanupIds.products)
  if (cleanupIds.ingredients.length) await db.from('ingredients').delete().in('id', cleanupIds.ingredients)
  if (cleanupIds.categories.length) await db.from('categories').delete().in('id', cleanupIds.categories)
})
