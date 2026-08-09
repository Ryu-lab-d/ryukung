import { describe, it, expect } from 'vitest'
import { nextStatus, stageLabel, stagesFor } from './workStatus'

describe('ลำดับขั้นสถานะงาน', () => {
  it('นัดรับเอง/ไปส่งเอง ไม่มีสถานะย่อยของขนส่งบริษัท', () => {
    expect(stagesFor('pickup').map((s) => s.status)).toEqual(['to_bake', 'baking', 'ready', 'delivered'])
    expect(stagesFor('self_deliver').map((s) => s.status)).toEqual(['to_bake', 'baking', 'ready', 'delivered'])
  })

  it('ส่งขนส่ง/ไรเดอร์ มีสถานะย่อยระหว่างทางเพิ่ม', () => {
    expect(stagesFor('shipping').map((s) => s.status)).toEqual([
      'to_bake', 'baking', 'ready', 'waiting_courier', 'picked_up', 'in_transit', 'delivered',
    ])
    expect(stagesFor('rider').map((s) => s.status)).toEqual([
      'to_bake', 'baking', 'ready', 'waiting_courier', 'picked_up', 'in_transit', 'delivered',
    ])
  })

  it('nextStatus เดินไปทีละขั้นเท่านั้น และคืน null เมื่อถึงขั้นสุดท้าย', () => {
    expect(nextStatus('pickup', 'to_bake')).toBe('baking')
    expect(nextStatus('pickup', 'ready')).toBe('delivered')
    expect(nextStatus('pickup', 'delivered')).toBeNull()

    expect(nextStatus('shipping', 'ready')).toBe('waiting_courier')
    expect(nextStatus('shipping', 'picked_up')).toBe('in_transit')
    expect(nextStatus('shipping', 'delivered')).toBeNull()
  })

  it('stageLabel คืนป้ายชื่อภาษาไทยที่ถูกต้องตามประเภทการส่ง', () => {
    expect(stageLabel('shipping', 'waiting_courier')).toBe('รอขนส่งเข้ารับพัสดุ')
    expect(stageLabel('pickup', 'delivered')).toBe('ส่งมอบแล้ว')
    expect(stageLabel('shipping', 'delivered')).toBe('จัดส่งสำเร็จ')
  })
})
