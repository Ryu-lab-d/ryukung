import { useEffect, useMemo } from 'react'

const CONFETTI_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899']

/** ป็อปอัพยืนยันว่าเริ่มทำงานแล้ว โชว์สั้นๆ ก่อนป็อปอัพต้อนรับจะปิดจริง ให้ความรู้สึกฉลองมากกว่าปิดเงียบๆ */
export function StartWorkOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600)
    return () => clearTimeout(t)
  }, [onDone])

  const confetti = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  )

  return (
    <div className="absolute inset-0 bg-stone-900/90 rounded-3xl grid place-items-center overflow-hidden">
      {confetti.map((c, i) => (
        <span
          key={i}
          className="absolute top-0 w-2 h-2 rounded-sm animate-confetti-fall"
          style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, backgroundColor: c.color }}
        />
      ))}
      <div className="text-center space-y-2 animate-rocket-launch">
        <div className="text-6xl">🚀</div>
        <p className="text-2xl font-bold text-white">เริ่มทำงานแล้ว!</p>
        <p className="text-stone-300 text-sm">ขอให้เป็นวันที่ดีนะคะ 💛</p>
      </div>
    </div>
  )
}
