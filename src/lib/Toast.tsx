import { useEffect } from 'react'

type ToastVariant = 'success' | 'error'

/** ป้ายแจ้งผลกลางจอ หายไปเองหลังจากแสดงครู่หนึ่ง ใช้บอกผลลัพธ์ของการกระทำสั้นๆ
 * เช่นเปลี่ยนสถานะสำเร็จ (success) หรือกรอกข้อมูลผิด (error) */
export function Toast({
  message,
  variant = 'success',
  onDone,
}: {
  message: string
  variant?: ToastVariant
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  const isError = variant === 'error'

  return (
    <div className="fixed inset-0 grid place-items-center pointer-events-none z-50 p-4">
      <div
        className={
          'text-white rounded-2xl px-6 py-4 shadow-lg text-center max-w-xs ' +
          (isError ? 'bg-red-600 animate-toast-pop-shake' : 'bg-stone-900 animate-toast-pop')
        }
      >
        <div className="mx-auto mb-1.5 w-9 h-9 rounded-full bg-white/15 grid place-items-center">
          {isError ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M10 6v5M10 14h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="10" cy="10" r="8.5" stroke="white" strokeWidth="1.5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M5 10l3.5 3.5L15 6.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <p className="font-medium text-sm">{message}</p>
      </div>
    </div>
  )
}
