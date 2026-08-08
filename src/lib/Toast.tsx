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
          'text-white rounded-2xl px-6 py-4 shadow-lg text-center animate-toast-pop max-w-xs ' +
          (isError ? 'bg-red-600' : 'bg-stone-900')
        }
      >
        <p className="text-2xl mb-1">{isError ? '❌' : '✅'}</p>
        <p className="font-medium text-sm">{message}</p>
      </div>
    </div>
  )
}
