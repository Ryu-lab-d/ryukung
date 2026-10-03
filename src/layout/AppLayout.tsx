import { useEffect, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import { NavIcon } from './NavIcon'
import { useAuth, isManagerOrAbove } from '../auth/AuthProvider'
import { WelcomeOverlay } from './WelcomeOverlay'

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, staffStatus } = useAuth()
  // เจ้าของร้าน+ผู้บริหาร+ผู้จัดการเห็นเมนู "ตั้งค่า" ได้ (แต่ละระดับเห็นแค่บางส่วนในหน้านั้นเอง) พนักงานทั่วไปไม่เห็นเลย
  // เมนูอื่นๆ กรองตามสิทธิ์รายหน้าที่เจ้าของร้านตั้งไว้ต่อพนักงานแต่ละคน (allowedPages) — ผู้จัดการขึ้นไปเห็นครบทุกหน้าอัตโนมัติ
  const visibleItems = NAV_ITEMS.filter((item) => {
    if ('ownerOnly' in item && item.ownerOnly) return isManagerOrAbove(staffStatus?.role)
    if ('page' in item && item.page) {
      return isManagerOrAbove(staffStatus?.role) || (staffStatus?.allowedPages?.includes(item.page) ?? false)
    }
    return true
  })

  // วงคลื่นตอนแตะปุ่ม/ลิงก์ทุกอันในหลังบ้าน — ให้ฟีดแบ็กทันทีว่ากดโดนแล้ว (วงขยายแล้วจางหาย ไม่บังและไม่ต้องห่อปุ่มด้วยอะไร)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    function onDown(e: PointerEvent) {
      const t = (e.target as HTMLElement | null)?.closest('button, a, summary')
      if (!t || (t as HTMLButtonElement).disabled) return
      const ring = document.createElement('span')
      ring.className = 'tap-ring'
      ring.style.left = `${e.clientX}px`
      ring.style.top = `${e.clientY}px`
      document.body.appendChild(ring)
      ring.addEventListener('animationend', () => ring.remove())
    }
    document.addEventListener('pointerdown', onDown, { passive: true })
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  return (
    <div className="admin-shell min-h-screen bg-stone-50">
      <WelcomeOverlay />

      {/* แถบนำทางด้านบน กึ่งกลางจอ แสดงเฉพาะจอกว้างระดับคอม (เดิมเป็นแถบข้างซ้าย ย้ายมาไว้บนตามที่ร้านขอ) —
          ไอแพด (แนวตั้งและแนวนอน) ใช้เมนูล่างแบบมือถือแทน เพราะจอ ~768-1024px ใช้งานด้วยนิ้วลำบากกว่า */}
      <header className="hidden lg:flex items-center gap-4 sticky top-0 z-30 border-b border-amber-900/10 bg-white/85 backdrop-blur-md shadow-[0_6px_20px_-14px_rgb(51_32_14_/_0.5)] px-6 py-3">
        <div className="shrink-0 flex items-center gap-2.5 font-display font-semibold text-stone-900">
          <span className="w-9 h-9 rounded-xl bg-brand-shader grid place-items-center text-lg shadow-md" aria-hidden="true">🥐</span>
          RYUKUNG BAKERY
        </div>
        <nav className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&>a:first-child]:ml-auto [&>a:last-child]:mr-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 xl:px-3.5 py-2 text-sm whitespace-nowrap transition-all duration-200 ' +
                (isActive
                  ? 'bg-gradient-to-r from-stone-800 to-stone-900 text-white shadow-[0_8px_16px_-8px_rgb(51_32_14_/_0.8)]'
                  : 'text-stone-700 hover:bg-amber-100/70')
              }
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100"
        >
          ออกจากระบบ
        </button>
      </header>

      {/* เนื้อหา เว้นที่ด้านล่างไว้ให้เมนูมือถือ/ไอแพดไม่ทับ */}
      <main className="pb-20 lg:pb-0">{children}</main>

      {/* เมนูล่าง แสดงบนมือถือและไอแพด — จำนวนช่องปรับตามจำนวนเมนูที่มองเห็นจริง (พนักงานไม่เห็น "ตั้งค่า")
          มีไอคอนช่วยให้กวาดตาหาเมนูได้เร็วโดยไม่ต้องอ่านตัวหนังสือเล็กๆ ทีละช่อง และเพิ่มความสูงของพื้นที่กดให้ถึง ~48px
          ตามแนวทาง touch target ขั้นต่ำ เพราะช่องนึงแคบมากตอนมี 7 เมนูพร้อมกันบนจอมือถือทั่วไป */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-amber-900/10 shadow-[0_-8px_24px_-14px_rgb(51_32_14_/_0.5)] grid [padding-bottom:env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              'relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-12 text-center text-[11px] leading-tight transition-colors ' +
              (isActive
                ? 'text-amber-800 font-semibold bg-gradient-to-b from-amber-100/80 to-transparent before:absolute before:top-0 before:inset-x-3 before:h-[3px] before:rounded-b-full before:bg-gradient-to-r before:from-amber-500 before:to-amber-700'
                : 'text-stone-500')
            }
          >
            <NavIcon name={item.icon} className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
