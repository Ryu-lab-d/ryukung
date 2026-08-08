import { useState } from 'react'
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
  const matches = search
    ? customers.filter((c) => c.name.includes(search) || (c.phone ?? '').includes(search))
    : []

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
          <input
            placeholder="ค้นหาลูกค้าเก่าด้วยชื่อหรือเบอร์"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setValue('customer_id', c.id); setSearch('') }}
              className="block w-full text-left rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              {c.name} · {c.phone}
            </button>
          ))}
          <button type="button" onClick={() => setCreatingNew(true)} className="text-sm text-stone-600 underline">
            + ลูกค้าใหม่
          </button>
        </div>
      )}

      {creatingNew && (
        <div className="space-y-2 rounded-lg border border-stone-200 p-3">
          <p className="text-sm font-medium">ลูกค้าใหม่</p>
          <input
            placeholder="ชื่อลูกค้า"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="เบอร์โทร"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleCreateCustomer} className="rounded-lg bg-stone-900 text-white px-3 py-1.5 text-sm">
              บันทึกลูกค้าใหม่
            </button>
            <button type="button" onClick={() => setCreatingNew(false)} className="text-sm text-stone-500">ยกเลิก</button>
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-xs text-stone-500">{selected.phone}</p>
            </div>
            <button type="button" onClick={() => setValue('customer_id', null)} className="text-xs text-stone-500 underline">
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
                  className="block w-full text-left rounded-lg border border-stone-200 px-3 py-2 text-sm"
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
