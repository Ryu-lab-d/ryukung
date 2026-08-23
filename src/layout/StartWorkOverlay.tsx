import { useEffect } from 'react'

/** ป็อปอัพยืนยันว่าเริ่มทำงานแล้ว โชว์สั้นๆ ก่อนป็อปอัพต้อนรับจะปิดจริง — ระฆังสั่น+คลื่นเสียงกระจายออก */
export function StartWorkOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="absolute inset-0 bg-stone-900/90 rounded-3xl grid place-items-center overflow-hidden">
      <div className="text-center space-y-2">
        <div className="relative w-24 h-24 mx-auto grid place-items-center">
          <span className="absolute inset-0 rounded-full border-2 border-amber-300/70 animate-sound-ring" />
          <span className="absolute inset-0 rounded-full border-2 border-amber-300/70 animate-sound-ring" style={{ animationDelay: '0.35s' }} />
          <span className="absolute inset-0 rounded-full border-2 border-amber-300/70 animate-sound-ring" style={{ animationDelay: '0.7s' }} />
          <div className="text-6xl animate-bell-ring">🔔</div>
        </div>
        <p className="text-2xl font-bold text-white">เริ่มทำงานแล้ว!</p>
        <p className="text-stone-300 text-sm">ขอให้เป็นวันที่ดีนะคะ 💛</p>
      </div>
    </div>
  )
}
