import { describe, it, expect, afterAll } from 'vitest'
import { anonClient, signedInClient } from './helpers'

const created: string[] = []

describe('ตารางสินค้า', () => {
  it('สร้างหมวดหมู่และสินค้าได้', async () => {
    const db = await signedInClient()
    const cat = await db
      .from('categories')
      .insert({ name: 'ทดสอบ-Cookie', sort_order: 1 })
      .select()
      .single()
    expect(cat.error).toBeNull()

    const prod = await db
      .from('products')
      .insert({
        name: 'ทดสอบ-คุกกี้ช็อกโกแลต',
        category_id: cat.data!.id,
        price: 40,
        cost: 18.5,
      })
      .select()
      .single()
    expect(prod.error).toBeNull()
    expect(Number(prod.data!.price)).toBe(40)
    expect(prod.data!.is_active).toBe(true)
    created.push(prod.data!.id)

    await db.from('products').delete().eq('id', prod.data!.id)
    await db.from('categories').delete().eq('id', cat.data!.id)
  })

  it('ราคาติดลบใส่ไม่ได้', async () => {
    const db = await signedInClient()
    const { error } = await db
      .from('products')
      .insert({ name: 'ทดสอบ-ราคาติดลบ', price: -5 })
    expect(error).not.toBeNull()
  })

  it('คนที่ยังไม่ล็อกอินอ่านสินค้าไม่ได้', async () => {
    const db = anonClient()
    const { data } = await db.from('products').select('*')
    expect(data).toEqual([])
  })
})

afterAll(async () => {
  if (created.length === 0) return
  const db = await signedInClient()
  await db.from('products').delete().in('id', created)
})
