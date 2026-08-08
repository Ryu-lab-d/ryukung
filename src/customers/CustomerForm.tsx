import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCustomers } from './useCustomers'
import { ConfirmDialog } from '../lib/ConfirmDialog'

const CHANNELS = [
  { value: '', label: 'ไม่ระบุ' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'line', label: 'LINE' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'อื่นๆ' },
] as const

export function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { customers, save, remove } = useCustomers()
  const existing = customers.find((c) => c.id === id)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState('')
  const [channelHandle, setChannelHandle] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setPhone(existing.phone ?? '')
      setChannel(existing.channel ?? '')
      setChannelHandle(existing.channel_handle ?? '')
      setNote(existing.note ?? '')
    }
  }, [existing])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('กรุณาใส่ชื่อลูกค้า'); return }
    setBusy(true)
    const { data, error } = await save(id ?? null, {
      name: name.trim(),
      phone: phone.trim() || null,
      channel: channel || null,
      channel_handle: channelHandle.trim() || null,
      note: note.trim() || null,
    })
    setBusy(false)
    if (error) { setError('บันทึกไม่สำเร็จ: ' + error.message); return }
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
    <form onSubmit={handleSubmit} className="p-4 max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">{id ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า'}</h1>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm text-stone-600">ชื่อลูกค้า</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      </div>

      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm text-stone-600">เบอร์โทร</label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="channel" className="text-sm text-stone-600">ช่องทาง</label>
          <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2">
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="handle" className="text-sm text-stone-600">ชื่อในแชท</label>
          <input id="handle" value={channelHandle} onChange={(e) => setChannelHandle(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="note" className="text-sm text-stone-600">หมายเหตุ (แพ้อาหาร คำขอพิเศษ)</label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-stone-900 text-white px-4 py-2.5 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        {id && (
          <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={busy} className="rounded-lg px-4 py-2.5 text-red-600 hover:bg-red-50 disabled:opacity-50">
            ลบลูกค้า
          </button>
        )}
      </div>

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
    </form>
  )
}
