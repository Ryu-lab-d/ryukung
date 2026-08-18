import { describe, it, expect, afterAll } from 'vitest'
import { anonClient, signedInClient } from './helpers'

const cleanupIds = { categories: [] as string[], products: [] as string[], ingredients: [] as string[] }

describe('แปลงหน่วยวัตถุดิบอัตโนมัติ (convert_ingredient_unit RPC)', () => {
  it('แปลงในหมวดเดียวกัน (กรัม -> กิโลกรัม) คำนวณ qty_per_unit/stock_qty/cost_per_unit ถูกต้องตามคณิตศาสตร์จริง', async () => {
    const db = await signedInClient()

    const cat = await db.from('categories').insert({ name: 'ทดสอบ-หมวดแปลงหน่วย', sort_order: 1 }).select().single()
    expect(cat.error).toBeNull()
    cleanupIds.categories.push(cat.data!.id)

    const ing = await db
      .from('ingredients')
      .insert({ name: 'ทดสอบ-แป้งแปลงหน่วย', unit: 'กรัม', stock_qty: 5000, cost_per_unit: 0.5 })
      .select()
      .single()
    expect(ing.error).toBeNull()
    cleanupIds.ingredients.push(ing.data!.id)

    const prod = await db
      .from('products')
      .insert({ name: 'ทดสอบ-คุกกี้แปลงหน่วย', category_id: cat.data!.id, price: 40, cost: 15 })
      .select()
      .single()
    expect(prod.error).toBeNull()
    cleanupIds.products.push(prod.data!.id)

    const link = await db
      .from('product_ingredients')
      .insert({ product_id: prod.data!.id, ingredient_id: ing.data!.id, qty_per_unit: 200 })
      .select()
      .single()
    expect(link.error).toBeNull()

    // กรัม -> กิโลกรัม: 1 กรัม = 0.001 กิโลกรัม
    const rpc = await db.rpc('convert_ingredient_unit', {
      p_ingredient_id: ing.data!.id,
      p_new_unit: 'กิโลกรัม',
      p_factor: 0.001,
    })
    expect(rpc.error).toBeNull()

    const updatedIng = await db.from('ingredients').select('unit, stock_qty, cost_per_unit').eq('id', ing.data!.id).single()
    expect(updatedIng.data!.unit).toBe('กิโลกรัม')
    expect(Number(updatedIng.data!.stock_qty)).toBeCloseTo(5) // 5000 * 0.001
    expect(Number(updatedIng.data!.cost_per_unit)).toBeCloseTo(500) // 0.5 / 0.001

    const updatedLink = await db.from('product_ingredients').select('qty_per_unit').eq('id', link.data!.id).single()
    expect(Number(updatedLink.data!.qty_per_unit)).toBeCloseTo(0.2) // 200 * 0.001
  })

  it('แปลงข้ามหมวดด้วยตัวคูณที่กรอกเอง (กรัม -> ฟอง) คำนวณถูกต้องตามตัวคูณที่ส่งไป', async () => {
    const db = await signedInClient()

    const ing = await db
      .from('ingredients')
      .insert({ name: 'ทดสอบ-ไข่แปลงหน่วย', unit: 'กรัม', stock_qty: 550, cost_per_unit: 2 })
      .select()
      .single()
    expect(ing.error).toBeNull()
    cleanupIds.ingredients.push(ing.data!.id)

    // เจ้าของร้านตอบว่า 1 ฟอง = 55 กรัม -> factor (กรัม -> ฟอง) = 1/55
    const factor = 1 / 55
    const rpc = await db.rpc('convert_ingredient_unit', { p_ingredient_id: ing.data!.id, p_new_unit: 'ฟอง', p_factor: factor })
    expect(rpc.error).toBeNull()

    const updated = await db.from('ingredients').select('unit, stock_qty, cost_per_unit').eq('id', ing.data!.id).single()
    expect(updated.data!.unit).toBe('ฟอง')
    expect(Number(updated.data!.stock_qty)).toBeCloseTo(10) // 550 กรัม / 55 = 10 ฟอง
    expect(Number(updated.data!.cost_per_unit)).toBeCloseTo(110) // 2 บาท/กรัม * 55 = 110 บาท/ฟอง
  })

  it('ตัวคูณเป็น 0 หรือติดลบ ใส่ไม่ได้', async () => {
    const db = await signedInClient()
    const ing = await db.from('ingredients').insert({ name: 'ทดสอบ-ตัวคูณผิด', unit: 'กรัม' }).select().single()
    expect(ing.error).toBeNull()
    cleanupIds.ingredients.push(ing.data!.id)

    const zero = await db.rpc('convert_ingredient_unit', { p_ingredient_id: ing.data!.id, p_new_unit: 'กิโลกรัม', p_factor: 0 })
    expect(zero.error).not.toBeNull()

    const negative = await db.rpc('convert_ingredient_unit', { p_ingredient_id: ing.data!.id, p_new_unit: 'กิโลกรัม', p_factor: -1 })
    expect(negative.error).not.toBeNull()
  })

  it('คนที่ยังไม่ล็อกอินเรียก RPC นี้ไม่ได้', async () => {
    const db = anonClient()
    const { error } = await db.rpc('convert_ingredient_unit', { p_ingredient_id: '00000000-0000-0000-0000-000000000000', p_new_unit: 'กิโลกรัม', p_factor: 0.001 })
    expect(error).not.toBeNull()
  })
})

afterAll(async () => {
  const db = await signedInClient()
  if (cleanupIds.products.length) await db.from('products').delete().in('id', cleanupIds.products)
  if (cleanupIds.ingredients.length) await db.from('ingredients').delete().in('id', cleanupIds.ingredients)
  if (cleanupIds.categories.length) await db.from('categories').delete().in('id', cleanupIds.categories)
})
