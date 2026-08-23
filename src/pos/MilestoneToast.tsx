import { useEffect } from 'react'

/** ป้ายฉลองสั้นๆ เด้งจากขอบบน ตอนยอดขายวันนี้ครบหลักที่ตั้งไว้ (ทุก 5 บิล) ให้กำลังใจเจ้าของร้าน */
export function MilestoneToast({ count, onDone }: { count: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto text-white rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-3 animate-status-toast bg-gradient-to-r from-amber-500 to-orange-500">
        <span className="text-2xl leading-none">🎉</span>
        <div>
          <p className="text-xs opacity-90">เก่งมาก!</p>
          <p className="font-semibold leading-tight">ขายไปแล้ว {count} บิลวันนี้</p>
        </div>
      </div>
    </div>
  )
}
