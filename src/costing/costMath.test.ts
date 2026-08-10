import { describe, it, expect } from 'vitest'
import { ingredientCost, computeRecipeCost } from './costMath'

describe('ingredientCost', () => {
  it('เนย 5000 กรัม ราคา 1125 บาท ใช้ 200 กรัม = 45 บาท', () => {
    expect(ingredientCost({ purchase_qty: 5000, purchase_price: 1125, qty_used: 200 })).toBeCloseTo(45)
  })

  it('ซื้อมา 0 หน่วย (ยังไม่กรอก) ไม่หารด้วยศูนย์ คืน 0', () => {
    expect(ingredientCost({ purchase_qty: 0, purchase_price: 100, qty_used: 5 })).toBe(0)
  })

  it('ไม่ได้ใช้เลย (qty_used = 0) ต้นทุนเป็น 0', () => {
    expect(ingredientCost({ purchase_qty: 1000, purchase_price: 500, qty_used: 0 })).toBe(0)
  })
})

describe('computeRecipeCost', () => {
  it('ตัวอย่างจากโจทย์จริง: ทำได้ 8 ชิ้น ต้นทุนควรออกมาต่อชิ้นถูกต้อง', () => {
    const result = computeRecipeCost({
      ingredients: [{ purchase_qty: 1000, purchase_price: 160, qty_used: 1000 }],
      labor: [],
      wasteOverheadPercent: 0,
      yieldQty: 8,
      profitPercent: 0,
    })
    expect(result.ingredientTotal).toBeCloseTo(160)
    expect(result.costPerUnit).toBeCloseTo(20)
  })

  it('รวม waste/overhead % จากต้นทุนวัตถุดิบเข้าไปในต้นทุนรวม', () => {
    const result = computeRecipeCost({
      ingredients: [{ purchase_qty: 100, purchase_price: 100, qty_used: 100 }],
      labor: [],
      wasteOverheadPercent: 10,
      yieldQty: 1,
      profitPercent: 0,
    })
    expect(result.overhead).toBeCloseTo(10)
    expect(result.totalCost).toBeCloseTo(110)
  })

  it('รวมค่าแรงหลายรายการเข้าไปในต้นทุนรวม', () => {
    const result = computeRecipeCost({
      ingredients: [],
      labor: [{ amount: 50 }, { amount: 30 }],
      wasteOverheadPercent: 0,
      yieldQty: 1,
      profitPercent: 0,
    })
    expect(result.laborTotal).toBe(80)
    expect(result.totalCost).toBe(80)
  })

  it('คิดกำไรแบบ markup จากต้นทุนต่อชิ้น ไม่ใช่ margin จากราคาขาย', () => {
    const result = computeRecipeCost({
      ingredients: [{ purchase_qty: 100, purchase_price: 100, qty_used: 100 }],
      labor: [],
      wasteOverheadPercent: 0,
      yieldQty: 1,
      profitPercent: 50,
    })
    expect(result.costPerUnit).toBeCloseTo(100)
    expect(result.profitPerUnit).toBeCloseTo(50)
    expect(result.suggestedPrice).toBeCloseTo(150)
  })

  it('ยังไม่กรอกจำนวนที่ทำได้ (yieldQty = 0) ไม่หารด้วยศูนย์ ต้นทุนต่อชิ้นเป็น 0', () => {
    const result = computeRecipeCost({
      ingredients: [{ purchase_qty: 100, purchase_price: 100, qty_used: 100 }],
      labor: [],
      wasteOverheadPercent: 0,
      yieldQty: 0,
      profitPercent: 20,
    })
    expect(result.costPerUnit).toBe(0)
    expect(result.suggestedPrice).toBe(0)
  })

  it('รวมทุกอย่างพร้อมกัน (วัตถุดิบหลายรายการ + overhead + ค่าแรง + กำไร)', () => {
    const result = computeRecipeCost({
      ingredients: [
        { purchase_qty: 5000, purchase_price: 1125, qty_used: 200 }, // เนย = 45
        { purchase_qty: 1000, purchase_price: 40, qty_used: 500 }, // แป้ง = 20
      ],
      labor: [{ amount: 100 }],
      wasteOverheadPercent: 10,
      yieldQty: 10,
      profitPercent: 30,
    })
    expect(result.ingredientTotal).toBeCloseTo(65)
    expect(result.overhead).toBeCloseTo(6.5)
    expect(result.laborTotal).toBe(100)
    expect(result.totalCost).toBeCloseTo(171.5)
    expect(result.costPerUnit).toBeCloseTo(17.15)
    expect(result.suggestedPrice).toBeCloseTo(22.295)
  })
})
