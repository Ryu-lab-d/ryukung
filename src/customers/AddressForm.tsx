import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAddresses } from './useAddresses'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

type AddressDraft = { label: string; recipientName: string; recipientPhone: string; addressText: string; isDefault: boolean }

const fieldClass =
  'w-full rounded-lg border border-stone-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400'
const plainFieldClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400'

function FieldIcon({ icon }: { icon: string }) {
  return <span className="pointer-events-none absolute left-3 top-[13px] text-stone-400 text-sm">{icon}</span>
}

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
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Link to={`/customers/${customerId}`} className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับ
      </Link>

      <h1 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
        <span className="text-xl">📍</span> {addressId ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">ที่อยู่จัดส่ง</p>

          <div className="space-y-1">
            <label htmlFor="label" className="text-sm text-stone-600">ป้ายกำกับ</label>
            <div className="relative">
              <FieldIcon icon="🏷️" />
              <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="recipientName" className="text-sm text-stone-600">ชื่อผู้รับ (ถ้าต่างจากลูกค้า)</label>
              <input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={plainFieldClass} />
            </div>
            <div className="space-y-1">
              <label htmlFor="recipientPhone" className="text-sm text-stone-600">เบอร์ผู้รับ</label>
              <input id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className={plainFieldClass} />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="addressText" className="text-sm text-stone-600">ที่อยู่เต็ม</label>
            <textarea
              id="addressText" value={addressText} onChange={(e) => setAddressText(e.target.value)}
              rows={3} className={plainFieldClass}
            />
          </div>

          <label className="flex items-center justify-between rounded-lg bg-stone-50 border border-stone-200 px-3 py-2.5 cursor-pointer">
            <span className="text-sm text-stone-700">⭐ ตั้งเป็นที่อยู่หลัก</span>
            <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
              <input
                type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-stone-300 transition-colors peer-checked:bg-stone-900" />
              <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600 animate-field-error">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-stone-900 text-white px-4 py-3 font-medium shadow-sm hover:bg-stone-800 transition-colors disabled:opacity-50"
        >
          {busy ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
      </form>
    </div>
  )
}
