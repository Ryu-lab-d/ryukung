import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { archiveOrderToSheets, type ArchiveOrderPayload } from './sheetsArchive'

const payload: ArchiveOrderPayload = {
  order_no: 'RYB-000001',
  customer_name: 'Somchai',
  customer_phone: '0812345678',
  fulfillment_type: 'pickup',
  items_summary: 'คุกกี้ x2',
  grand_total: 80,
  payment_status: 'paid',
  needed_date: '2026-08-10',
  delivered_at: '2026-08-09T10:00:00Z',
  created_at: '2026-08-08T10:00:00Z',
}

describe('archiveOrderToSheets', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('ยังไม่ได้ตั้งค่า webhook ไว้ ข้ามไปเฉยๆ ไม่ถือเป็นข้อผิดพลาด ไม่เรียก fetch เลย', async () => {
    vi.stubEnv('VITE_SHEETS_ARCHIVE_WEBHOOK_URL', '')
    const { error } = await archiveOrderToSheets(payload)
    expect(error).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ตั้งค่า webhook ไว้ ส่ง POST ไปพร้อม payload แบบ text/plain กัน CORS preflight', async () => {
    vi.stubEnv('VITE_SHEETS_ARCHIVE_WEBHOOK_URL', 'https://script.google.com/macros/s/xxx/exec')
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))
    const { error } = await archiveOrderToSheets(payload)
    expect(error).toBeNull()
    expect(fetch).toHaveBeenCalledWith(
      'https://script.google.com/macros/s/xxx/exec',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      })
    )
  })

  it('webhook ตอบกลับ error (HTTP ไม่ok) คืนข้อความ error ที่มีสถานะ', async () => {
    vi.stubEnv('VITE_SHEETS_ARCHIVE_WEBHOOK_URL', 'https://script.google.com/macros/s/xxx/exec')
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }))
    const { error } = await archiveOrderToSheets(payload)
    expect(error).toContain('500')
  })

  it('fetch ล้มเหลว (เช่นเน็ตหลุด) คืนข้อความ error แทนที่จะโยน exception ออกไป', async () => {
    vi.stubEnv('VITE_SHEETS_ARCHIVE_WEBHOOK_URL', 'https://script.google.com/macros/s/xxx/exec')
    vi.mocked(fetch).mockRejectedValue(new Error('network down'))
    const { error } = await archiveOrderToSheets(payload)
    expect(error).toContain('network down')
  })
})
