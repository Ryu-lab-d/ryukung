import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertIngredientUnit } from './api'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

beforeEach(() => {
  rpc.mockReset()
})

describe('convertIngredientUnit', () => {
  it('เรียก RPC convert_ingredient_unit ด้วยพารามิเตอร์ถูกต้อง', async () => {
    rpc.mockResolvedValue({ error: null })
    const { error } = await convertIngredientUnit('i1', 'กิโลกรัม', 0.001)
    expect(rpc).toHaveBeenCalledWith('convert_ingredient_unit', { p_ingredient_id: 'i1', p_new_unit: 'กิโลกรัม', p_factor: 0.001 })
    expect(error).toBeNull()
  })

  it('RPC ล้มเหลว คืนข้อความ error', async () => {
    rpc.mockResolvedValue({ error: { message: 'ตัวคูณแปลงหน่วยต้องมากกว่า 0' } })
    const { error } = await convertIngredientUnit('i1', 'ฟอง', -1)
    expect(error).toEqual({ message: 'ตัวคูณแปลงหน่วยต้องมากกว่า 0' })
  })
})
