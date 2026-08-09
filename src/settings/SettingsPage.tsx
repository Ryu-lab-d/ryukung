import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings, type Settings } from './useSettings'
import { productImageUrl } from '../products/ProductCard'

type Draft = Omit<Settings, 'id'>

export function SettingsPage() {
  const { settings, loading, save, uploadLogo } = useSettings()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (settings) {
      const { id: _id, ...rest } = settings
      setDraft(rest)
    }
  }, [settings])

  if (loading || !draft) {
    return <div className="p-4 text-stone-500">กำลังโหลด...</div>
  }

  // ผูกไว้เป็นตัวแปรใหม่ที่ TypeScript รู้แน่ชัดว่าไม่ใช่ null เพื่อใช้ใน closure ข้างล่าง
  // (การ narrow จาก if ด้านบนไม่ไหลเข้าไปในฟังก์ชันซ้อนที่ประกาศทีหลัง)
  const values: Draft = draft

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  async function handleSave() {
    setBusy(true)
    const { error } = await save(values)
    setBusy(false)
    setMessage(error ? 'บันทึกไม่สำเร็จ: ' + error.message : 'บันทึกแล้ว')
  }

  async function handleLogoChange(file: File) {
    setBusy(true)
    const { error } = await uploadLogo(file)
    setBusy(false)
    setMessage(error ? 'อัปโหลดโลโก้ไม่สำเร็จ: ' + error.message : 'อัปโหลดโลโก้แล้ว')
  }

  function text(
    label: string,
    key: 'shop_name' | 'phone' | 'address' | 'promptpay' | 'receipt_footer' | 'payment_instructions'
  ) {
    return (
      <div className="space-y-1">
        <label htmlFor={key} className="text-sm text-stone-600">{label}</label>
        {key === 'address' || key === 'receipt_footer' || key === 'payment_instructions' ? (
          <textarea
            id={key}
            value={values[key] ?? ''}
            onChange={(e) => set(key, e.target.value)}
            rows={key === 'payment_instructions' ? 5 : undefined}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        ) : (
          <input
            id={key}
            value={values[key] ?? ''}
            onChange={(e) => set(key, e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        )}
      </div>
    )
  }

  function updateFaq(index: number, patch: Partial<{ keywordsText: string; answer: string }>) {
    setDraft((d) => {
      if (!d) return d
      const faqs = [...d.faqs]
      const current = faqs[index]
      faqs[index] = {
        answer: patch.answer ?? current.answer,
        keywords: patch.keywordsText !== undefined
          ? patch.keywordsText.split(',').map((k) => k.trim()).filter(Boolean)
          : current.keywords,
      }
      return { ...d, faqs }
    })
  }

  function addFaq() {
    setDraft((d) => (d ? { ...d, faqs: [...d.faqs, { keywords: [], answer: '' }] } : d))
  }

  function removeFaq(index: number) {
    setDraft((d) => (d ? { ...d, faqs: d.faqs.filter((_, i) => i !== index) } : d))
  }

  function checkbox(
    label: string,
    key: 'receipt_show_logo' | 'receipt_show_address' | 'receipt_show_phone' | 'receipt_show_promptpay' | 'require_full_customer_info'
  ) {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          id={key}
          type="checkbox"
          checked={values[key]}
          onChange={(e) => set(key, e.target.checked)}
        />
        {label}
      </label>
    )
  }

  return (
    <div className="p-4 max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">ตั้งค่า</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-500">จัดการร้าน</h2>
        <Link
          to="/storage"
          className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
        >
          <span className="flex items-center gap-2 text-sm font-medium">🗑️ จัดการพื้นที่จัดเก็บ</span>
          <span className="text-stone-400">→</span>
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-stone-500">ข้อมูลร้าน</h2>
        {text('ชื่อร้าน', 'shop_name')}
        {text('เบอร์โทร', 'phone')}
        {text('ที่อยู่ร้าน', 'address')}
        {text('พร้อมเพย์', 'promptpay')}

        <div className="space-y-2">
          <label htmlFor="logo" className="text-sm text-stone-600">โลโก้ร้าน</label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-stone-100 border border-stone-200 overflow-hidden grid place-items-center shrink-0">
              {values.logo_path ? (
                <img src={productImageUrl(values.logo_path)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-stone-400">ไม่มีโลโก้</span>
              )}
            </div>
            <div>
              <input
                id="logo"
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleLogoChange(f) }}
                className="block text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-900 file:text-white file:px-3 file:py-2 file:text-sm"
              />
              {busy && <p className="text-xs text-stone-500 mt-1">กำลังอัปโหลด...</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-500">วิธีชำระเงิน (โชว์ให้ลูกค้าเห็นในลิงก์สรุปตอนยังไม่จ่าย)</h2>
        {text('ข้อความวิธีชำระเงิน', 'payment_instructions')}
        <div className="space-y-1">
          <label htmlFor="line_url" className="text-sm text-stone-600">ลิงก์ไลน์ร้าน (ใช้ตอนน้องริวตอบไม่ได้แล้วส่งต่อให้พนักงาน)</label>
          <input
            id="line_url"
            value={values.line_url ?? ''}
            onChange={(e) => set('line_url', e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-500">คำถามที่พบบ่อย (น้องริวตอบให้อัตโนมัติ)</h2>
          <button type="button" onClick={addFaq} className="text-xs text-stone-600 underline">+ เพิ่มคำถาม</button>
        </div>
        {values.faqs.map((faq, i) => (
          <div key={i} className="rounded-lg border border-stone-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500">คำถามที่ {i + 1}</span>
              <button type="button" onClick={() => removeFaq(i)} className="text-xs text-red-600 underline">ลบ</button>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-500">คำสำคัญ (คั่นด้วยจุลภาค)</label>
              <input
                value={faq.keywords.join(', ')}
                onChange={(e) => updateFaq(i, { keywordsText: e.target.value })}
                placeholder="เช่น จัดส่ง, ส่งกี่วัน"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-stone-500">คำตอบ</label>
              <textarea
                value={faq.answer}
                onChange={(e) => updateFaq(i, { answer: e.target.value })}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}
        {values.faqs.length === 0 && <p className="text-sm text-stone-400">ยังไม่มีคำถามที่ตั้งไว้</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-500">ค่าเริ่มต้นใบเสร็จ</h2>
        {text('ข้อความท้ายใบเสร็จ', 'receipt_footer')}
        {checkbox('ใบเสร็จแสดงโลโก้', 'receipt_show_logo')}
        {checkbox('ใบเสร็จแสดงที่อยู่', 'receipt_show_address')}
        {checkbox('ใบเสร็จแสดงเบอร์โทร', 'receipt_show_phone')}
        {checkbox('ใบเสร็จแสดงพร้อมเพย์', 'receipt_show_promptpay')}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-stone-500">เลขที่เอกสารและออเดอร์</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="order_no_prefix" className="text-sm text-stone-600">ส่วนนำหน้าเลขออเดอร์</label>
            <input
              id="order_no_prefix"
              value={draft.order_no_prefix}
              onChange={(e) => set('order_no_prefix', e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="receipt_no_prefix" className="text-sm text-stone-600">ส่วนนำหน้าเลขใบเสร็จ</label>
            <input
              id="receipt_no_prefix"
              value={draft.receipt_no_prefix}
              onChange={(e) => set('receipt_no_prefix', e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="shipping_lead_days" className="text-sm text-stone-600">
            จำนวนวันอบล่วงหน้าเมื่อส่งขนส่ง
          </label>
          <input
            id="shipping_lead_days"
            type="number"
            min="0"
            value={draft.shipping_lead_days}
            onChange={(e) => set('shipping_lead_days', Number(e.target.value))}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>

        {checkbox('บังคับกรอกข้อมูลลูกค้าให้ครบก่อนยืนยันออเดอร์', 'require_full_customer_info')}
      </section>

      {message && <p className="text-sm text-stone-600">{message}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={handleSave}
        className="rounded-lg bg-stone-900 text-white px-4 py-2.5 disabled:opacity-50"
      >
        {busy ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </div>
  )
}
