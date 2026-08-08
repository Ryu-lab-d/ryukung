import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from './useCustomers'
import { formatBaht } from '../lib/money'

export function CustomersPage() {
  const { customers, loading } = useCustomers()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
  }, [customers, search])

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">ลูกค้า</h1>
        <Link to="/customers/new" className="rounded-lg bg-stone-900 text-white text-sm px-3 py-2">
          + เพิ่มลูกค้า
        </Link>
      </div>

      <input
        placeholder="ค้นหาชื่อหรือเบอร์โทร"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      <ul className="space-y-2">
        {filtered.map((c) => (
          <li key={c.id}>
            <Link to={`/customers/${c.id}`} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-stone-500">{c.phone}</p>
              </div>
              <div className="text-right text-xs text-stone-500">
                <p>{c.order_count} ออเดอร์</p>
                <p>{formatBaht(c.total_spend)} บาท</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="text-sm text-stone-400">ไม่พบลูกค้า</p>}
    </div>
  )
}
