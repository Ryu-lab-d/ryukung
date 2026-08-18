import { useEffect } from 'react'

/** ป็อปอัพยืนยันสำเร็จแบบวาดเครื่องหมายถูก ใช้กับการกระทำสำคัญที่อยากให้รู้สึกหนักแน่นกว่า toast ทั่วไป ปิดเองอัตโนมัติ */
export function SuccessOverlay({
  message,
  submessage,
  onDone,
  durationMs = 2000,
}: {
  message: string
  submessage?: string
  onDone: () => void
  durationMs?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDone, durationMs)
    return () => clearTimeout(t)
  }, [onDone, durationMs])

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4 animate-overlay-fade">
      <div className="bg-white rounded-2xl p-6 text-center space-y-2 max-w-xs animate-toast-pop">
        <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto">
          <circle cx="32" cy="32" r="29" fill="none" stroke="#16a34a" strokeWidth="4" className="animate-circle-pop" />
          <path
            d="M18 33 L27 42 L46 22"
            fill="none"
            stroke="#16a34a"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-check-draw"
          />
        </svg>
        <p className="font-semibold text-stone-900">{message}</p>
        {submessage && <p className="text-sm text-stone-500">{submessage}</p>}
      </div>
    </div>
  )
}
