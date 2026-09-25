import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from './useCustomers'
import { formatBaht } from '../lib/money'
import { avatarStyle, initials } from './avatar'

export function CustomersPage() {
  const { customers, loading } = useCustomers()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
  }, [customers, search])

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-stone-900">ลูกค้า</h1>
          <span className="rounded-full bg-stone-100 text-stone-500 text-xs font-medium px-2 py-0.5">
            {customers.length} คน
          </span>
        </div>
        <Link
          to="/customers/new"
          className="flex items-center gap-1 rounded-lg bg-stone-900 text-white text-sm px-3 py-2 shadow-sm hover:bg-stone-800 transition-colors"
        >
          <span className="text-base leading-none">+</span> เพิ่มลูกค้า
        </Link>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">🔍</span>
        <input
          placeholder="ค้นหาชื่อหรือเบอร์โทร"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
        />
      </div>

      <ul className="space-y-2">
        {filtered.map((c) => (
          <li key={c.id}>
            <Link
              to={`/customers/${c.id}`}
              className="group flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md"
            >
              <div
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ' + avatarStyle(c.name)
                }
              >
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-900 truncate">{c.name}</p>
                <p className="text-xs text-stone-500">{c.phone || 'ไม่มีเบอร์โทร'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-stone-900 tabular-nums">{formatBaht(c.total_spend)} ฿</p>
                <p className="text-xs text-stone-400">{c.order_count} ออเดอร์</p>
              </div>
              <span className="shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5">›</span>
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white py-10 text-center">
          <p className="text-3xl">🔎</p>
          <p className="mt-2 text-sm text-stone-400">
            {search ? 'ไม่พบลูกค้าที่ตรงกับคำค้นหา' : 'ยังไม่มีลูกค้าในระบบ'}
          </p>
        </div>
      )}
    </div>
  )
}
