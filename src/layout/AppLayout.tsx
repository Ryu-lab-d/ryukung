import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import { useAuth } from '../auth/AuthProvider'

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-stone-50 md:flex">
      {/* เมนูข้าง แสดงเฉพาะบนจอกว้าง */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r border-stone-200 bg-white">
        <div className="px-4 py-5 font-semibold">RYUKUNG BAKERY</div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                'block rounded-lg px-3 py-2 text-sm ' +
                (isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100')
              }
            >
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

      {/* เนื้อหา เว้นที่ด้านล่างไว้ให้เมนูมือถือไม่ทับ */}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      {/* เมนูล่าง แสดงเฉพาะบนมือถือ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 grid grid-cols-5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              'py-2.5 text-center text-xs ' +
              (isActive ? 'text-stone-900 font-semibold' : 'text-stone-500')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
