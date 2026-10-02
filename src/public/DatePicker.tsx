import { useState } from 'react'

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function parts(dateStr: string) {
  return { y: Number(dateStr.slice(0, 4)), m: Number(dateStr.slice(5, 7)) - 1, d: Number(dateStr.slice(8, 10)) }
}

function formatLong(dateStr: string) {
  const { y, m, d } = parts(dateStr)
  return new Date(y, m, d).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * ปฏิทินเลือกวันที่ของหน้าสั่งซื้อฝั่งลูกค้า แทน <input type="date"> ของเบราว์เซอร์ที่หน้าตาไม่เข้ากับเว็บและ
 * ปิดวันไม่ได้สวยๆ — วันก่อน `min` (รวมวันนี้) เป็นสีเทาขีดฆ่ากดไม่ได้จริง ปีแสดงเป็น พ.ศ. เหมือนทั้งเว็บ
 * วันนี้มีวงแหวนอำพันบอกตำแหน่งแต่เลือกไม่ได้ ปุ่ม "เร็วที่สุด" ข้ามไปเลือกวันแรกที่สั่งได้ทันที
 */
export function DatePicker({
  id,
  value,
  min,
  today,
  onChange,
  error,
}: {
  id: string
  value: string
  min: string
  today: string
  onChange: (dateStr: string) => void
  error?: string | null
}) {
  const [open, setOpen] = useState(false)
  const start = parts(value && value >= min ? value : min)
  const [viewY, setViewY] = useState(start.y)
  const [viewM, setViewM] = useState(start.m)
  const [dir, setDir] = useState<'next' | 'prev'>('next')

  const minParts = parts(min)
  const canGoPrev = viewY > minParts.y || (viewY === minParts.y && viewM > minParts.m)

  function go(delta: 1 | -1) {
    if (delta === -1 && !canGoPrev) return
    setDir(delta === 1 ? 'next' : 'prev')
    const next = new Date(viewY, viewM + delta, 1)
    setViewY(next.getFullYear())
    setViewM(next.getMonth())
  }

  function pick(dateStr: string) {
    onChange(dateStr)
    setOpen(false)
  }

  function pickEarliest() {
    const p = parts(min)
    setDir('next')
    setViewY(p.y)
    setViewM(p.m)
    pick(min)
  }

  const firstWeekday = new Date(viewY, viewM, 1).getDay()
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
  const monthLabel = new Date(viewY, viewM, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-2">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          'w-full flex items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-amber-500/20 ' +
          (error ? 'border-red-400 animate-shake' : open ? 'border-amber-600/60 ring-4 ring-amber-500/20' : 'border-stone-300')
        }
      >
        <span className={value ? 'text-stone-900' : 'text-stone-400'}>
          📅 {value ? formatLong(value) : 'แตะเพื่อเลือกวันที่'}
        </span>
        <span className={'text-stone-400 text-xs transition-transform duration-300 ' + (open ? 'rotate-180' : '')} aria-hidden="true">
          ▼
        </span>
      </button>

      {error && <p className="text-xs text-red-600 animate-field-error">{error}</p>}

      {open && (
        <div
          role="dialog"
          aria-label="เลือกวันที่"
          className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-[0_12px_32px_-12px_rgb(51_32_14_/_0.35)] animate-form-in"
        >
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={!canGoPrev}
              aria-label="เดือนก่อนหน้า"
              className="w-9 h-9 rounded-full bg-stone-100 text-stone-700 font-semibold transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <p key={monthLabel} className="font-display font-semibold text-stone-900 animate-qty-pop">{monthLabel}</p>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="เดือนถัดไป"
              className="w-9 h-9 rounded-full bg-stone-100 text-stone-700 font-semibold transition-all active:scale-90"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={'text-center text-[11px] font-medium ' + (i === 0 ? 'text-red-400' : 'text-stone-400')}>
                {w}
              </span>
            ))}
          </div>

          <div key={`${viewY}-${viewM}`} className={'grid grid-cols-7 gap-1 ' + (dir === 'next' ? 'animate-month-next' : 'animate-month-prev')}>
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const str = toStr(viewY, viewM, day)
              const disabled = str < min
              const selected = str === value
              const isToday = str === today
              return (
                <button
                  key={str}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(str)}
                  aria-label={formatLong(str) + (disabled ? ' (เลือกไม่ได้)' : '')}
                  aria-pressed={selected}
                  title={isToday ? 'วันนี้ (ต้องสั่งล่วงหน้า เลือกไม่ได้)' : undefined}
                  className={
                    'aspect-square rounded-xl text-sm font-medium transition-all duration-150 ' +
                    (disabled
                      ? 'text-stone-300 cursor-not-allowed line-through decoration-stone-200 '
                      : selected
                        ? 'bg-stone-900 text-white shadow-md animate-qty-pop '
                        : 'text-stone-700 hover:bg-amber-50 hover:ring-2 hover:ring-amber-300 active:scale-90 ') +
                    (isToday ? 'ring-2 ring-amber-300' : '')
                  }
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
            <p className="text-xs text-stone-400">วันนี้และวันที่ผ่านมาแล้วเลือกไม่ได้</p>
            <button
              type="button"
              onClick={pickEarliest}
              className="shrink-0 rounded-full bg-stone-900 text-white text-xs font-medium px-3.5 py-1.5 transition-transform active:scale-95"
            >
              เร็วที่สุด
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
