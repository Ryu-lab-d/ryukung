import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCustomers } from './useCustomers'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

const CHANNELS = [
  { value: '', label: 'ไม่ระบุ' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'line', label: 'LINE' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'อื่นๆ' },
] as const

type CustomerDraft = { name: string; phone: string; email: string; channel: string; channelHandle: string; note: string }

const fieldClass =
  'w-full rounded-lg border border-stone-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400'
const plainFieldClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400'

function FieldIcon({ icon }: { icon: string }) {
  return <span className="pointer-events-none absolute left-3 top-[13px] text-stone-400 text-sm">{icon}</span>
}

export function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { customers, save, remove } = useCustomers()
  const existing = customers.find((c) => c.id === id)

  const draftKey = `customer-form:${id ?? 'new'}`
  const [draft] = useState(() => loadFormDraft<CustomerDraft>(draftKey))

  const [name, setName] = useState(draft?.name ?? '')
  const [phone, setPhone] = useState(draft?.phone ?? '')
  const [email, setEmail] = useState(draft?.email ?? '')
  const [channel, setChannel] = useState(draft?.channel ?? '')
  const [channelHandle, setChannelHandle] = useState(draft?.channelHandle ?? '')
  const [note, setNote] = useState(draft?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (existing && !draft) {
      setName(existing.name)
      setPhone(existing.phone ?? '')
      setEmail(existing.email ?? '')
      setChannel(existing.channel ?? '')
      setChannelHandle(existing.channel_handle ?? '')
      setNote(existing.note ?? '')
    }
  }, [existing, draft])

  useFormDraft(draftKey, { name, phone, email, channel, channelHandle, note })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('กรุณาใส่ชื่อลูกค้า'); return }
    setBusy(true)
    const { data, error } = await save(id ?? null, {
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      channel: channel || null,
      channel_handle: channelHandle.trim() || null,
      note: note.trim() || null,
    })
    setBusy(false)
    if (error) { setError('บันทึกไม่สำเร็จ: ' + error.message); return }
    clearFormDraft(draftKey)
    navigate(`/customers/${id ?? data?.id}`)
  }

  async function handleDelete() {
    if (!id) return
    setShowDeleteConfirm(false)
    setBusy(true)
    const { error } = await remove(id)
    setBusy(false)
    if (error) { setError(error.message); return }
    navigate('/customers')
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Link to={id ? `/customers/${id}` : '/customers'} className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับ
      </Link>

      <h1 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
        <span className="text-xl">👤</span> {id ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">ข้อมูลส่วนตัว</p>

          <div className="space-y-1">
            <label htmlFor="name" className="text-sm text-stone-600">ชื่อลูกค้า</label>
            <div className="relative">
              <FieldIcon icon="👤" />
              <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="phone" className="text-sm text-stone-600">เบอร์โทร</label>
            <div className="relative">
              <FieldIcon icon="📞" />
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-stone-600">อีเมล (ใช้แจ้งรับออเดอร์/แจ้งชำระเงิน)</label>
            <div className="relative">
              <FieldIcon icon="✉️" />
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="channel" className="text-sm text-stone-600">ช่องทาง</label>
              <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={plainFieldClass}>
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="handle" className="text-sm text-stone-600">ชื่อในแชท</label>
              <input id="handle" value={channelHandle} onChange={(e) => setChannelHandle(e.target.value)} className={plainFieldClass} />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="note" className="text-sm text-stone-600">หมายเหตุ (แพ้อาหาร คำขอพิเศษ)</label>
            <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={plainFieldClass} />
          </div>
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

      {id && (
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={busy}
            className="w-full rounded-lg bg-red-600 text-white font-medium py-2.5 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            🗑️ ลบลูกค้าถาวร
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title={`ลบลูกค้า "${existing?.name}" ถาวร?`}
          message="ออเดอร์เก่าจะยังอยู่ครบ แค่ไม่ผูกกับลูกค้าคนนี้แล้ว"
          confirmLabel="ลบถาวร"
          cancelLabel="ไม่ลบ"
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
