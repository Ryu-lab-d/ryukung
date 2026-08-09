import { describe, it, expect } from 'vitest'
import { buildIcsContent } from './ics'

describe('buildIcsContent', () => {
  it('สร้าง all-day event ตรงวันที่ต้องได้ของ โดย DTEND เป็นวันถัดไป (ตามข้อกำหนด all-day ของ iCal)', () => {
    const ics = buildIcsContent({
      orderNo: 'RYB-000001',
      shopName: 'RYUKUNG BAKERY',
      neededDate: '2026-08-10',
      location: 'หน้าร้าน',
      description: 'เวลานัดรับ: 10:00',
    })
    expect(ics).toContain('DTSTART;VALUE=DATE:20260810')
    expect(ics).toContain('DTEND;VALUE=DATE:20260811')
    expect(ics).toContain('LOCATION:หน้าร้าน')
    expect(ics).toContain('SUMMARY:รับ/ส่งของ RYB-000001 - RYUKUNG BAKERY')
  })

  it('ไม่มีสถานที่ ไม่ใส่บรรทัด LOCATION เลย', () => {
    const ics = buildIcsContent({
      orderNo: 'RYB-000002',
      shopName: 'RYUKUNG BAKERY',
      neededDate: '2026-08-10',
      location: null,
      description: 'จัดส่งทางไปรษณีย์',
    })
    expect(ics).not.toContain('LOCATION:')
  })

  it('escape ตัวอักษรพิเศษในข้อความอธิบายกันไฟล์ .ics พังตอนเปิด', () => {
    const ics = buildIcsContent({
      orderNo: 'RYB-000003',
      shopName: 'RYUKUNG BAKERY',
      neededDate: '2026-08-10',
      location: null,
      description: 'สินค้า: คุกกี้, บราวนี่; หมายเหตุ\nพิเศษ',
    })
    expect(ics).toContain('DESCRIPTION:สินค้า: คุกกี้\\, บราวนี่\\; หมายเหตุ\\nพิเศษ')
  })

  it('ครอบด้วย BEGIN:VCALENDAR/END:VCALENDAR ตามมาตรฐาน iCal', () => {
    const ics = buildIcsContent({
      orderNo: 'RYB-000004',
      shopName: 'RYUKUNG BAKERY',
      neededDate: '2026-08-10',
      location: null,
      description: '-',
    })
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
  })
})
