import { Link } from 'react-router-dom'
import { useStorageCleanup } from './useStorageCleanup'
import { useCancelledOrders } from './useCancelledOrders'
import { useAbandonedDrafts } from './useAbandonedDrafts'
import { useHolidays } from '../calendar/useHolidays'
import { useUnansweredQuestions } from '../chatbot/useUnansweredQuestions'
import { CleanupSection } from './CleanupSection'
import { formatBaht } from '../lib/money'

const FULFILLMENT_LABELS: Record<string, string> = {
  pickup: 'นัดรับเอง', shipping: 'ส่งไปรษณีย์/ขนส่ง', rider: 'ไรเดอร์ในเมือง', self_deliver: 'ไปส่งเอง',
}
const REFUND_LABEL: Record<string, string> = { none: '', pending: '⚠️ รอคืนเงิน', refunded: 'คืนเงินแล้ว' }

export function StorageManagementPage() {
  const overdue = useStorageCleanup()
  const cancelled = useCancelledOrders()
  const drafts = useAbandonedDrafts()
  const { holidays, loading: holidaysLoading, removeHoliday } = useHolidays()
  const { questions, loading: questionsLoading, remove: removeQuestion } = useUnansweredQuestions()

  const todayKey = new Date().toISOString().slice(0, 10)
  const pastHolidays = holidays.filter((h) => h.holiday_date < todayKey)

  async function deleteManyHolidays(ids: string[]) {
    const errors: string[] = []
    for (const id of ids) {
      const { error } = await removeHoliday(id)
      if (error) errors.push(error.message)
    }
    return { errors }
  }

  async function deleteManyQuestions(ids: string[]) {
    const errors: string[] = []
    for (const id of ids) {
      const { error } = await removeQuestion(id)
      if (error) errors.push(error.message)
    }
    return { errors }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">← กลับหน้าออเดอร์</Link>
        <h1 className="text-lg font-semibold mt-1">จัดการพื้นที่จัดเก็บ</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          รวมทุกอย่างที่ลบได้เพื่อประหยัดพื้นที่ Supabase ไว้ในหน้าเดียว — ลบแล้วกู้คืนไม่ได้ทุกรายการ
        </p>
        {import.meta.env.VITE_SHEETS_ARCHIVE_WEBHOOK_URL ? (
          <p className="text-xs text-green-700 mt-1">
            📄 ก่อนลบออเดอร์แต่ละรายการ ระบบจะสำรองข้อมูลไปที่ Google Sheets ให้อัตโนมัติก่อนเสมอ
          </p>
        ) : (
          <p className="text-xs text-stone-400 mt-1">
            ยังไม่ได้ตั้งค่าสำรองออเดอร์ไป Google Sheets ก่อนลบ (ตัวเลือกเสริม)
          </p>
        )}
      </div>

      <CleanupSection
        title="ออเดอร์ที่จัดส่ง/ส่งมอบสำเร็จเกิน 1 วัน"
        items={overdue.orders}
        loading={overdue.loading}
        onDeleteMany={overdue.deleteMany}
        emptyMessage="ยังไม่มีออเดอร์ที่ครบกำหนดลบตอนนี้ 🎉"
        confirmMessage={(n) => `ลบแล้วกู้คืนไม่ได้ รวมถึงใบเสร็จที่เคยออกไปแล้วของออเดอร์เหล่านี้ด้วย (${n} รายการ)`}
        renderItem={(o) => (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm truncate">{o.order_no ?? 'ร่าง'} · {o.customer_name ?? 'ไม่มีชื่อลูกค้า'}</p>
              <p className="text-sm text-stone-500 shrink-0">{formatBaht(o.grand_total)}</p>
            </div>
            <p className="text-xs text-stone-400">
              {FULFILLMENT_LABELS[o.fulfillment_type] ?? o.fulfillment_type} · ส่งสำเร็จเมื่อ {new Date(o.delivered_at).toLocaleString('th-TH')}
            </p>
          </>
        )}
      />

      <CleanupSection
        title="ออเดอร์ที่ยกเลิกแล้ว"
        description="ออเดอร์ที่ยกเลิกไปแล้วทั้งหมด ไม่ว่ายกเลิกมานานแค่ไหน"
        items={cancelled.orders}
        loading={cancelled.loading}
        onDeleteMany={cancelled.deleteMany}
        emptyMessage="ไม่มีออเดอร์ที่ยกเลิกอยู่ในระบบ"
        confirmMessage={(n) => `ลบแล้วกู้คืนไม่ได้ รวมถึงใบเสร็จที่เคยออกไปแล้วของออเดอร์เหล่านี้ด้วย (${n} รายการ) — เช็กสถานะคืนเงินให้เรียบร้อยก่อนลบ`}
        renderItem={(o) => (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm truncate">{o.order_no ?? 'ร่าง'} · {o.customer_name ?? 'ไม่มีชื่อลูกค้า'}</p>
              <p className="text-sm text-stone-500 shrink-0">{formatBaht(o.grand_total)}</p>
            </div>
            <p className="text-xs text-stone-400">
              ยกเลิกเมื่อ {new Date(o.updated_at).toLocaleDateString('th-TH')}
              {o.refund_status !== 'none' && <span className="text-amber-600"> · {REFUND_LABEL[o.refund_status]}</span>}
            </p>
          </>
        )}
      />

      <CleanupSection
        title="ออเดอร์ร่างที่ค้างไว้เกิน 7 วัน"
        description="สร้างไว้แต่ไม่เคยยืนยัน มักเป็นร่างที่พิมพ์ค้างไว้เฉยๆ"
        items={drafts.drafts}
        loading={drafts.loading}
        onDeleteMany={drafts.deleteMany}
        emptyMessage="ไม่มีออเดอร์ร่างที่ค้างไว้นานเกินไป"
        confirmMessage={(n) => `ลบแล้วกู้คืนไม่ได้ (${n} รายการ)`}
        renderItem={(d) => (
          <>
            <p className="font-medium text-sm truncate">{d.customer_name ?? 'ยังไม่มีชื่อลูกค้า'}</p>
            <p className="text-xs text-stone-400">
              {d.items_summary || 'ยังไม่มีสินค้า'} · สร้างเมื่อ {new Date(d.created_at).toLocaleDateString('th-TH')}
            </p>
          </>
        )}
      />

      <CleanupSection
        title="วันหยุดในปฏิทินที่ผ่านไปแล้ว"
        description="วันหยุดที่ตั้งไว้แต่วันที่ผ่านไปแล้ว ไม่มีประโยชน์ให้เก็บต่อ"
        items={pastHolidays}
        loading={holidaysLoading}
        onDeleteMany={deleteManyHolidays}
        emptyMessage="ไม่มีวันหยุดเก่าที่ต้องลบ"
        confirmMessage={(n) => `ลบแล้วกู้คืนไม่ได้ (${n} รายการ)`}
        renderItem={(h) => (
          <>
            <p className="font-medium text-sm">{h.holiday_date}</p>
            {h.note && <p className="text-xs text-stone-400">{h.note}</p>}
          </>
        )}
      />

      <CleanupSection
        title="คำถามที่บอทตอบไม่ได้"
        description={<>จัดการทีละคำถามได้ที่ <Link to="/chatbot" className="underline">หน้าจัดการแชทบอท</Link> — ที่นี่ลบทิ้งได้เร็วๆ ถ้าไม่ต้องการเก็บไว้แล้ว</>}
        items={questions}
        loading={questionsLoading}
        onDeleteMany={deleteManyQuestions}
        emptyMessage="ยังไม่มีคำถามที่ตอบไม่ได้"
        confirmMessage={(n) => `ลบแล้วกู้คืนไม่ได้ (${n} รายการ)`}
        renderItem={(q) => (
          <>
            <p className="text-sm truncate">{q.question_text}</p>
            <p className="text-xs text-stone-400">ถาม {q.asked_count} ครั้ง</p>
          </>
        )}
      />
    </div>
  )
}
