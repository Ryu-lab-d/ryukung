import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
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

  return (
    <div className="min-h-screen bg-stone-50 lg:flex">
      <WelcomeOverlay />

      {/* เมนูข้าง แสดงเฉพาะจอกว้างระดับคอม — ไอแพด (แนวตั้งและแนวนอน) ใช้เมนูล่างแบบมือถือแทน
          เพราะเมนูข้าง+เนื้อหาสองคอลัมน์บีบอัดเกินไปบนจอ ~768-1024px ใช้งานด้วยนิ้วลำบาก */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-col border-r border-stone-200 bg-white">
        <div className="px-4 py-5 font-semibold">RYUKUNG BAKERY</div>
        <nav className="flex-1 px-2 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm ' +
                (isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100')
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="m-2 rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 text-left"
        >
          ออกจากระบบ
        </button>
      </aside>

      {/* เนื้อหา เว้นที่ด้านล่างไว้ให้เมนูมือถือ/ไอแพดไม่ทับ */}
      <main className="flex-1 pb-20 lg:pb-0">{children}</main>

      {/* เมนูล่าง แสดงบนมือถือและไอแพด — จำนวนช่องปรับตามจำนวนเมนูที่มองเห็นจริง (พนักงานไม่เห็น "ตั้งค่า")
          มีไอคอนช่วยให้กวาดตาหาเมนูได้เร็วโดยไม่ต้องอ่านตัวหนังสือเล็กๆ ทีละช่อง และเพิ่มความสูงของพื้นที่กดให้ถึง ~48px
          ตามแนวทาง touch target ขั้นต่ำ เพราะช่องนึงแคบมากตอนมี 7 เมนูพร้อมกันบนจอมือถือทั่วไป */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 grid [padding-bottom:env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              'flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-12 text-center text-[11px] leading-tight ' +
              (isActive ? 'text-stone-900 font-semibold' : 'text-stone-500')
            }
          >
            <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
