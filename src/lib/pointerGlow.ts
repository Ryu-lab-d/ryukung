/**
 * การ์ดเอียง 3 มิติ + แสงสปอตไลต์ตามเมาส์ (เฉพาะอุปกรณ์ที่มีเมาส์) — ใส่ class `glow-card` ให้การ์ดที่อยากให้มีเอฟเฟกต์
 * ใช้ listener ตัวเดียวที่ document (event delegation) ไม่ผูกทีละการ์ด ค่าตำแหน่งส่งเป็น CSS variable ให้ CSS วาดเอง
 * (--mx/--my = ตำแหน่งเมาส์ในการ์ด, --rx/--ry = องศาเอียง) จึงไม่ทำให้ React re-render และปิดเองเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว
 */
export function installPointerGlow(): () => void {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {}
  let active: HTMLElement | null = null
  let raf = 0

  function reset(el: HTMLElement | null) {
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--glow', '0')
  }

  function onMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.glow-card') ?? null
    if (card !== active) {
      reset(active)
      active = card
    }
    if (!card) return
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
      card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
      card.style.setProperty('--ry', `${((px - 0.5) * 9).toFixed(2)}deg`)
      card.style.setProperty('--rx', `${((0.5 - py) * 9).toFixed(2)}deg`)
      card.style.setProperty('--glow', '1')
    })
  }

  function onLeave() {
    reset(active)
    active = null
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerleave', onLeave)
  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
    cancelAnimationFrame(raf)
  }
}
