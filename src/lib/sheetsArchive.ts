export type ArchiveOrderPayload = {
  order_no: string | null
  customer_name: string | null
  customer_phone: string | null
  fulfillment_type: string
  items_summary: string
  grand_total: number
  payment_status: string
  needed_date: string | null
  delivered_at: string | null
  created_at: string
}

/**
 * บันทึกสำเนาออเดอร์ลง Google Sheets ก่อนลบถาวรจาก Supabase (ผ่าน Google Apps Script Web App ที่ร้านตั้งค่าไว้เอง)
 * ถ้ายังไม่ได้ตั้งค่า webhook ไว้ (VITE_SHEETS_ARCHIVE_WEBHOOK_URL ว่าง) ถือว่าร้านยังไม่เปิดใช้ฟีเจอร์นี้ ข้ามไปเฉยๆ
 * ไม่ถือเป็นข้อผิดพลาด — พฤติกรรมเดิมก่อนมีฟีเจอร์นี้ (ลบได้โดยไม่ต้องสำรอง) ยังใช้งานได้ตามปกติ
 */
export async function archiveOrderToSheets(payload: ArchiveOrderPayload): Promise<{ error: string | null }> {
  const webhookUrl = import.meta.env.VITE_SHEETS_ARCHIVE_WEBHOOK_URL as string | undefined
  if (!webhookUrl) return { error: null }

  try {
    // Content-Type: text/plain กันเบราว์เซอร์ส่ง CORS preflight (OPTIONS) ซึ่ง Google Apps Script Web App จัดการไม่ได้
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { error: `บันทึกสำรองลง Google Sheets ไม่สำเร็จ (HTTP ${res.status})` }
    return { error: null }
  } catch (err) {
    return { error: `บันทึกสำรองลง Google Sheets ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export type WithdrawalSheetPayload = {
  event: 'created' | 'settled'
  withdrawal_id: string
  withdrawn_at: string
  location: string | null
  withdrawn_by: string | null
  items_summary: string
  qty_out_total: number
  qty_sold_total: number | null
  revenue: number | null
  cost: number
  profit: number | null
  wage_summary: string | null
  wage_paid: boolean
  status: string
}

/**
 * บันทึกรายการเบิกของไปขายนอกร้านลง Google Sheets — คนละ webhook กับการสำรองออเดอร์ก่อนลบ (archiveOrderToSheets)
 * เพราะข้อมูลคนละชุด และตั้งใจไม่บล็อกการเบิก/ปิดรอบถ้าบันทึกไม่สำเร็จ (ต่างจากอันนั้นที่บล็อกเพื่อกันข้อมูลหายถาวร —
 * ที่นี่แถวใน Supabase ยังอยู่ครบตามปกติ แค่พลาดไปหนึ่งชุดข้อมูลใน Sheets เท่านั้น ไม่ใช่ความเสี่ยงข้อมูลหาย)
 * บันทึกทั้งตอนเริ่มเบิก (event: 'created') และตอนปิดรอบ (event: 'settled') คนละแถวกัน ให้เห็นทั้งสองจังหวะใน Sheets
 */
export async function logWithdrawalToSheets(payload: WithdrawalSheetPayload): Promise<{ error: string | null }> {
  const webhookUrl = import.meta.env.VITE_SHEETS_WITHDRAWAL_WEBHOOK_URL as string | undefined
  if (!webhookUrl) return { error: null }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { error: `บันทึกลง Google Sheets ไม่สำเร็จ (HTTP ${res.status})` }
    return { error: null }
  } catch (err) {
    return { error: `บันทึกลง Google Sheets ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}` }
  }
}
