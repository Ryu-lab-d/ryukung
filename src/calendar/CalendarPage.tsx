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
      className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm hover:border-stone-300 hover:bg-stone-50 transition-colors"
    >
      <span className="flex items-center gap-2 min-w-0">
        <span>{FULFILLMENT_ICON[order.fulfillment_type] ?? '📦'}</span>
        <span className="truncate">
          <span className="font-medium text-stone-900">{order.order_no ?? 'ร่าง'}</span>
          {order.customer_name && <span className="text-stone-500"> · {order.customer_name}</span>}
        </span>
      </span>
      <span className="text-stone-400 text-xs font-medium shrink-0">แก้ไข →</span>
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
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">ปฏิทินออเดอร์</h1>
            <p className="text-sm text-stone-500 mt-0.5">กดวันที่เพื่อดูออเดอร์ หรือตั้งเป็นวันหยุดร้าน</p>
          </div>
          <button
            type="button"
            onClick={() => setViewDate(new Date())}
            className="shrink-0 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
          >
            วันนี้
          </button>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-white border border-stone-200 shadow-[0_14px_32px_-18px_rgb(51_32_14_/_0.5)] p-3 pt-4 space-y-3">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-300 via-amber-600 to-amber-300" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              aria-label="เดือนก่อนหน้า"
              className="rounded-full border border-stone-200 bg-white w-10 h-10 grid place-items-center text-xl text-stone-700 shadow-sm active:scale-90 hover:bg-amber-50"
            >
              ‹
            </button>
            <p key={`${year}-${month}`} className="text-lg font-display font-bold text-stone-900 animate-form-in">{MONTH_LABELS[month]} {year + 543}</p>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              aria-label="เดือนถัดไป"
              className="rounded-full border border-stone-200 bg-white w-10 h-10 grid place-items-center text-xl text-stone-700 shadow-sm active:scale-90 hover:bg-amber-50"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-stone-500 flex-wrap">
            <span>🥐 ต้องอบวันนี้</span>
            <span>📦 ต้องส่งวันนี้</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" /> วันหยุด</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-stone-400">
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
                  style={{ animationDelay: `${Math.min(gridDays.indexOf(d), 41) * 0.012}s` }}
                  className={
                    'cal-cell aspect-square rounded-2xl border p-1 flex flex-col items-center justify-start gap-0.5 text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-90 ' +
                    (isHoliday
                      ? 'bg-red-50 border-red-200 '
                      : bakeCount + neededCount > 0
                        ? 'bg-gradient-to-b from-amber-50 to-white border-amber-300 '
                        : 'bg-white border-stone-200 hover:border-amber-300 ') +
                    (!inMonth ? 'opacity-40 ' : '') +
                    (isToday ? 'ring-2 ring-amber-600 ring-offset-1 shadow-[0_8px_16px_-8px_rgb(146_82_12_/_0.8)] ' : '')
                  }
                >
                  <span className={isToday ? 'font-bold text-white bg-gradient-to-br from-amber-500 to-amber-800 rounded-full w-6 h-6 grid place-items-center' : 'text-stone-700'}>{d.getDate()}</span>
                  {isHoliday && <span className="text-[10px] font-medium text-red-600">หยุด</span>}
                  <div className="flex gap-1 mt-auto">
                    {bakeCount > 0 && <span className="text-[10px]">🥐{bakeCount}</span>}
                    {neededCount > 0 && <span className="text-[10px]">📦{neededCount}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-stone-400 py-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
            กำลังโหลด...
          </div>
        )}

      {selectedKey && (
        <div className="fixed inset-0 bg-black/50 grid place-items-end sm:place-items-center p-0 sm:p-4 z-50 animate-overlay-fade" onClick={() => setSelectedKey(null)}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-3 animate-toast-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-bold text-stone-900">{selectedKey}</p>
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                aria-label="ปิด"
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 grid place-items-center text-lg leading-none"
              >
                ×
              </button>
            </div>

            {selectedHoliday ? (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-3 space-y-2">
                <p className="text-sm text-red-700 font-medium">🎌 วันหยุดร้าน</p>
                {selectedHoliday.note && <p className="text-sm text-red-600">{selectedHoliday.note}</p>}
                <button
                  type="button"
                  onClick={() => setConfirmRemoveHoliday(true)}
                  className="text-sm rounded-full bg-white border border-red-300 text-red-700 px-3.5 py-1.5 font-medium shadow-sm"
                >
                  ยกเลิกวันหยุด
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3 space-y-2">
                <p className="text-sm font-medium text-stone-700">ทำเครื่องหมายเป็นวันหยุดร้าน</p>
                <input
                  placeholder="หมายเหตุ (ถ้ามี)"
                  value={holidayNote}
                  onChange={(e) => setHolidayNote(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddHoliday()}
                  className="w-full rounded-xl bg-red-600 text-white text-sm font-medium py-2.5 shadow-sm"
                >
                  🎌 ตั้งเป็นวันหยุด
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
                🥐 ต้องอบวันนี้
                <span className="text-xs font-medium text-stone-400">({selectedBake.length})</span>
              </p>
              {selectedBake.map((o) => <OrderRow key={o.id} order={o} />)}
              {selectedBake.length === 0 && <p className="text-sm text-stone-400 py-1">ไม่มีออเดอร์ต้องอบวันนี้</p>}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-stone-600 flex items-center gap-1.5">
                📦 ต้องส่งวันนี้
                <span className="text-xs font-medium text-stone-400">({selectedNeeded.length})</span>
              </p>
              {selectedNeeded.map((o) => <OrderRow key={o.id} order={o} />)}
              {selectedNeeded.length === 0 && <p className="text-sm text-stone-400 py-1">ไม่มีออเดอร์ต้องส่งวันนี้</p>}
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
    </div>
  )
}
