import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCalendarOrders, type CalendarOrder } from './useCalendarOrders'
import { useHolidays } from './useHolidays'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

function holidayNoteDraftKey(dateKey: string | null): string | null {
  return dateKey ? `calendar-holiday-note:${dateKey}` : null
}

const WEEKDAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const MONTH_LABELS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const FULFILLMENT_ICON: Record<string, string> = { pickup: '🏠', shipping: '📦', rider: '🛵', self_deliver: '🚲' }

/** วันที่แบบ YYYY-MM-DD ตามเวลาท้องถิ่น — ห้ามใช้ toISOString() เพราะแปลงเป็น UTC จะเลื่อนวันได้ */
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function OrderRow({ order }: { order: CalendarOrder }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
    >
      <span className="flex items-center gap-2 min-w-0">
        <span>{FULFILLMENT_ICON[order.fulfillment_type] ?? '📦'}</span>
        <span className="truncate">
          <span className="font-medium">{order.order_no ?? 'ร่าง'}</span>
          {order.customer_name && <span className="text-stone-500"> · {order.customer_name}</span>}
        </span>
      </span>
      <span className="text-stone-400 shrink-0">แก้ไข →</span>
    </Link>
  )
}

export function CalendarPage() {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [holidayNote, setHolidayNote] = useState('')
  const [confirmRemoveHoliday, setConfirmRemoveHoliday] = useState(false)

  useEffect(() => {
    const key = holidayNoteDraftKey(selectedKey)
    setHolidayNote((key ? loadFormDraft<string>(key) : null) ?? '')
  }, [selectedKey])

  useFormDraft(holidayNoteDraftKey(selectedKey), holidayNote)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1)
    const gridStart = new Date(year, month, 1 - firstOfMonth.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [year, month])

  const rangeStart = toDateKey(gridDays[0])
  const rangeEnd = toDateKey(gridDays[gridDays.length - 1])
  const { byBakeDate, byNeededDate, loading } = useCalendarOrders(rangeStart, rangeEnd)
  const { holidays, addHoliday, removeHoliday } = useHolidays()
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays])

  const todayKey = toDateKey(new Date())
  const selectedHoliday = selectedKey ? holidays.find((h) => h.holiday_date === selectedKey) : undefined
  const selectedBake = selectedKey ? byBakeDate.get(selectedKey) ?? [] : []
  const selectedNeeded = selectedKey ? byNeededDate.get(selectedKey) ?? [] : []

  async function handleAddHoliday() {
    if (!selectedKey) return
    await addHoliday(selectedKey, holidayNote.trim() || null)
    setHolidayNote('')
    clearFormDraft(holidayNoteDraftKey(selectedKey))
  }

  async function handleRemoveHoliday() {
    if (!selectedHoliday) return
    setConfirmRemoveHoliday(false)
    await removeHoliday(selectedHoliday.id)
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">ปฏิทินออเดอร์</h1>
        <button
          type="button"
          onClick={() => setViewDate(new Date())}
          className="text-sm text-stone-600 underline"
        >
          วันนี้
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          aria-label="เดือนก่อนหน้า"
          className="rounded-lg border border-stone-200 w-9 h-9 grid place-items-center text-stone-600"
        >
          ‹
        </button>
        <p className="font-medium">{MONTH_LABELS[month]} {year + 543}</p>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          aria-label="เดือนถัดไป"
          className="rounded-lg border border-stone-200 w-9 h-9 grid place-items-center text-stone-600"
        >
          ›
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-stone-500">
        <span>🥐 = ต้องอบวันนี้</span>
        <span>📦 = ต้องส่งวันนี้</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-200 inline-block" /> วันหยุด</span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-500">
        {WEEKDAY_LABELS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((d) => {
          const key = toDateKey(d)
          const inMonth = d.getMonth() === month
          const isToday = key === todayKey
          const isHoliday = holidaySet.has(key)
          const bakeCount = byBakeDate.get(key)?.length ?? 0
          const neededCount = byNeededDate.get(key)?.length ?? 0

          return (
            <button
              key={key}
              type="button"
              aria-label={key}
              onClick={() => { setSelectedKey(key); setHolidayNote('') }}
              className={
                'aspect-square rounded-lg border p-1 flex flex-col items-center justify-start gap-0.5 text-xs ' +
                (isHoliday ? 'bg-red-50 border-red-200 ' : 'bg-white border-stone-200 ') +
                (!inMonth ? 'opacity-40 ' : '') +
                (isToday ? 'ring-2 ring-stone-900 ' : '')
              }
            >
              <span className={isToday ? 'font-bold' : ''}>{d.getDate()}</span>
              {isHoliday && <span className="text-[10px] text-red-600">หยุด</span>}
              <div className="flex gap-1 mt-auto">
                {bakeCount > 0 && <span className="text-[10px]">🥐{bakeCount}</span>}
                {neededCount > 0 && <span className="text-[10px]">📦{neededCount}</span>}
              </div>
            </button>
          )
        })}
      </div>

      {loading && <p className="text-sm text-stone-400 text-center">กำลังโหลด...</p>}

      {selectedKey && (
        <div className="fixed inset-0 bg-black/50 grid place-items-end sm:place-items-center p-0 sm:p-4 z-50" onClick={() => setSelectedKey(null)}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{selectedKey}</p>
              <button type="button" onClick={() => setSelectedKey(null)} aria-label="ปิด" className="text-2xl leading-none px-1 text-stone-400">×</button>
            </div>

            {selectedHoliday ? (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 space-y-2">
                <p className="text-sm text-red-700 font-medium">🎌 วันหยุดร้าน</p>
                {selectedHoliday.note && <p className="text-sm text-red-600">{selectedHoliday.note}</p>}
                <button
                  type="button"
                  onClick={() => setConfirmRemoveHoliday(true)}
                  className="text-sm rounded-lg bg-white border border-red-300 text-red-700 px-3 py-1.5 font-medium"
                >
                  ยกเลิกวันหยุด
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-stone-200 px-3 py-2.5 space-y-2">
                <p className="text-sm font-medium">ทำเครื่องหมายเป็นวันหยุดร้าน</p>
                <input
                  placeholder="หมายเหตุ (ถ้ามี)"
                  value={holidayNote}
                  onChange={(e) => setHolidayNote(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => void handleAddHoliday()} className="w-full rounded-lg bg-red-600 text-white text-sm font-medium py-2">
                  🎌 ตั้งเป็นวันหยุด
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-stone-600">🥐 ต้องอบวันนี้ ({selectedBake.length})</p>
              {selectedBake.map((o) => <OrderRow key={o.id} order={o} />)}
              {selectedBake.length === 0 && <p className="text-sm text-stone-400">ไม่มีออเดอร์ต้องอบวันนี้</p>}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-stone-600">📦 ต้องส่งวันนี้ ({selectedNeeded.length})</p>
              {selectedNeeded.map((o) => <OrderRow key={o.id} order={o} />)}
              {selectedNeeded.length === 0 && <p className="text-sm text-stone-400">ไม่มีออเดอร์ต้องส่งวันนี้</p>}
            </div>
          </div>
        </div>
      )}

      {confirmRemoveHoliday && (
        <ConfirmDialog
          title="ยกเลิกวันหยุดนี้?"
          confirmLabel="ยกเลิกวันหยุด"
          cancelLabel="ไม่ยกเลิก"
          onConfirm={handleRemoveHoliday}
          onCancel={() => setConfirmRemoveHoliday(false)}
        />
      )}
    </div>
  )
}
