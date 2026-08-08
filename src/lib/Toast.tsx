import { useEffect } from 'react'

/** ป้ายแจ้งผลกลางจอ หายไปเองหลังจากแสดงครู่หนึ่ง ใช้บอกผลลัพธ์ของการกระทำสั้นๆ เช่นเปลี่ยนสถานะสำเร็จ */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 grid place-items-center pointer-events-none z-50 p-4">
      <div className="bg-stone-900 text-white rounded-2xl px-6 py-4 shadow-lg text-center animate-toast-pop max-w-xs">
        <p className="text-2xl mb-1">✅</p>
        <p className="font-medium text-sm">{message}</p>
      </div>
    </div>
  )
}
