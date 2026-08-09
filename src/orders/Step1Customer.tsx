import { useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useCustomers } from '../customers/useCustomers'
import { useAddresses } from '../customers/useAddresses'
import type { OrderFormValues } from './schema'

export function Step1Customer() {
  const { watch, setValue } = useFormContext<OrderFormValues>()
  const customerId = watch('customer_id')
  const { customers, save: saveCustomer } = useCustomers()
  const { addresses } = useAddresses(customerId)
  const [search, setSearch] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const selected = customers.find((c) => c.id === customerId)

  // ไม่ต้องพิมพ์อะไรก็เลื่อนดูรายชื่อลูกค้าทั้งหมดได้เลย พิมพ์แล้วค่อยกรองให้แคบลง
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name, 'th'))
    if (!q) return sorted
    return sorted.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
  }, [customers, search])

  function pickAddress(addressId: string) {
    const addr = addresses.find((a) => a.id === addressId)
    if (!addr) return
    setValue('ship_recipient_name', addr.recipient_name ?? selected?.name ?? '')
    setValue('ship_recipient_phone', addr.recipient_phone ?? selected?.phone ?? '')
    setValue('ship_address_text', addr.address_text)
  }

  async function handleCreateCustomer() {
    if (!newName.trim()) return
    const { data, error } = await saveCustomer(null, { name: newName.trim(), phone: newPhone.trim() || null })
    if (!error && data) {
      setValue('customer_id', data.id)
      setCreatingNew(false)
      setNewName('')
      setNewPhone('')
    }
  }

  return (
    <div className="space-y-4">
      {!selected && !creatingNew && (
        <div className="space-y-2">
          <div className="relative">
            <input
              placeholder="ค้นหาลูกค้าเก่าด้วยชื่อหรือเบอร์ (หรือเลื่อนดูรายชื่อด้านล่างได้เลย)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-stone-300 pl-3 pr-9 py-2.5 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="ล้างคำค้นหา"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-stone-400 hover:bg-stone-100 grid place-items-center"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCreatingNew(true)}
            className="flex items-center justify-center gap-1.5 w-full rounded-lg border-2 border-dashed border-stone-300 text-stone-700 font-medium py-2.5 text-sm"
          >
            + เพิ่มลูกค้าใหม่
          </button>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {visible.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setValue('customer_id', c.id); setSearch('') }}
                className="block w-full text-left rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
              >
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="text-stone-500"> · {c.phone}</span>}
              </button>
            ))}
            {search && visible.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-3">ไม่พบลูกค้าชื่อนี้ — กด "+ เพิ่มลูกค้าใหม่" ด้านบนได้เลย</p>
            )}
            {!search && customers.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-3">ยังไม่มีลูกค้าในระบบ</p>
            )}
          </div>
        </div>
      )}

      {creatingNew && (
        <div className="space-y-2 rounded-lg border border-stone-200 p-3">
          <p className="text-sm font-medium">ลูกค้าใหม่</p>
          <input
            placeholder="ชื่อลูกค้า"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
          />
          <input
            placeholder="เบอร์โทร"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
          />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleCreateCustomer} className="flex-1 rounded-lg bg-stone-900 text-white px-3 py-2.5 text-sm font-medium">
              บันทึกลูกค้าใหม่
            </button>
            <button type="button" onClick={() => setCreatingNew(false)} className="rounded-lg border border-stone-300 text-stone-600 px-4 py-2.5 text-sm">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-xs text-stone-500">{selected.phone}</p>
            </div>
            <button type="button" onClick={() => setValue('customer_id', null)} className="text-xs text-stone-500 underline shrink-0">
              เปลี่ยนลูกค้า
            </button>
          </div>

          {selected.note && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              {selected.note}
            </div>
          )}

          {addresses.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-stone-600">ใช้ที่อยู่เดิม?</p>
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pickAddress(a.id)}
                  className="block w-full text-left rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
                >
                  {a.label}: {a.address_text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
