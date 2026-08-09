import { useEffect } from 'react'
import { STATUS_COLOR, STATUS_ICON } from './workStatus'

/** ป้ายแจ้งเปลี่ยนสถานะ เลื่อนลงมาจากขอบบนพร้อมสีและไอคอนของสถานะใหม่ แทนที่ Toast กลางจอแบบเดิมซึ่งดูจืดเกินไป */
export function StatusChangeToast({
  status,
  label,
  onDone,
}: {
  status: string
  label: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [onDone])

  const color = STATUS_COLOR[status] ?? 'bg-stone-900'
  const icon = STATUS_ICON[status] ?? '✓'

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div className={'pointer-events-auto text-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-3 animate-status-toast ' + color}>
        <span className="text-2xl leading-none">{icon}</span>
        <div>
          <p className="text-xs opacity-80">เปลี่ยนสถานะแล้ว</p>
          <p className="font-semibold leading-tight">{label}</p>
        </div>
      </div>
    </div>
  )
}
