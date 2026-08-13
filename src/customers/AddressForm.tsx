import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAddresses } from './useAddresses'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

type AddressDraft = { label: string; recipientName: string; recipientPhone: string; addressText: string; isDefault: boolean }

export function AddressForm() {
  const { id: customerId, addressId } = useParams()
  const navigate = useNavigate()
  const { addresses, save } = useAddresses(customerId ?? null)
  const existing = addresses.find((a) => a.id === addressId)

  const draftKey = `address-form:${customerId}:${addressId ?? 'new'}`
  const [draft] = useState(() => loadFormDraft<AddressDraft>(draftKey))

  const [label, setLabel] = useState(draft?.label ?? 'บ้าน')
  const [recipientName, setRecipientName] = useState(draft?.recipientName ?? '')
  const [recipientPhone, setRecipientPhone] = useState(draft?.recipientPhone ?? '')
  const [addressText, setAddressText] = useState(draft?.addressText ?? '')
  const [isDefault, setIsDefault] = useState(draft?.isDefault ?? false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (existing && !draft) {
      setLabel(existing.label)
      setRecipientName(existing.recipient_name ?? '')
      setRecipientPhone(existing.recipient_phone ?? '')
      setAddressText(existing.address_text)
      setIsDefault(existing.is_default)
    }
  }, [existing, draft])

  useFormDraft(draftKey, { label, recipientName, recipientPhone, addressText, isDefault })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!addressText.trim()) { setError('กรุณาใส่ที่อยู่'); return }
    setBusy(true)
    const { error } = await save(addressId ?? null, {
      label: label.trim() || 'บ้าน',
      recipient_name: recipientName.trim() || null,
      recipient_phone: recipientPhone.trim() || null,
      address_text: addressText.trim(),
      is_default: isDefault,
    })
    setBusy(false)
    if (error) { setError('บันทึกไม่สำเร็จ: ' + error.message); return }
    clearFormDraft(draftKey)
    navigate(`/customers/${customerId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">{addressId ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่'}</h1>

      <div className="space-y-1">
        <label htmlFor="label" className="text-sm text-stone-600">ป้ายกำกับ</label>
        <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="recipientName" className="text-sm text-stone-600">ชื่อผู้รับ (ถ้าต่างจากลูกค้า)</label>
          <input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label htmlFor="recipientPhone" className="text-sm text-stone-600">เบอร์ผู้รับ</label>
          <input id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="addressText" className="text-sm text-stone-600">ที่อยู่เต็ม</label>
        <textarea id="addressText" value={addressText} onChange={(e) => setAddressText(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        ตั้งเป็นที่อยู่หลัก
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={busy} className="rounded-lg bg-stone-900 text-white px-4 py-2.5 disabled:opacity-50">
        {busy ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </form>
  )
}
