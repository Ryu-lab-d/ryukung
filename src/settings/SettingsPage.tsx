import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings, type Settings } from './useSettings'
import { productImageUrl } from '../products/ProductCard'
import { StaffManagementSection } from '../staff/StaffManagementSection'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { useAuth, isOwnerOrExecutive } from '../auth/AuthProvider'

type Draft = Omit<Settings, 'id'>

const DRAFT_KEY = 'settings-form'

export function SettingsPage() {
  const { staffStatus } = useAuth()
  const isOwner = staffStatus?.role === 'owner'
  const isOwnerOrExec = isOwnerOrExecutive(staffStatus?.role)
  const { settings, loading, save, uploadLogo } = useSettings()
  const [restoredDraft] = useState(() => loadFormDraft<Draft>(DRAFT_KEY))
  const [draft, setDraft] = useState<Draft | null>(restoredDraft)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // hydrate ค่าเริ่มต้นของฟอร์มจาก settings แค่ครั้งแรกครั้งเดียวเท่านั้น (ข้ามไปเลยถ้ามีร่างค้างอยู่แล้ว) —
  // กันไม่ให้การกระทำอื่นในหน้านี้ที่ทำให้ settings รีโหลดใหม่ระหว่างทาง (เช่นอัปโหลดโลโก้ ซึ่งเซฟทันทีแยก
  // จากปุ่ม "บันทึก" หลัก) มาเขียนทับข้อมูลช่องอื่นที่ผู้ใช้กำลังแก้ไขอยู่แต่ยังไม่ได้กดบันทึกทิ้งไปเฉยๆ —
  // นี่คือสาเหตุจริงที่แก้ "ส่วนนำหน้าเลขออเดอร์" แล้วดูเหมือนไม่มีผล ถ้าหน้านี้เคยอัปโหลดโลโก้ไปด้วยก่อนกดบันทึก
  const hydratedRef = useRef(restoredDraft !== null)

  useEffect(() => {
    if (settings && !hydratedRef.current) {
      hydratedRef.current = true
      const { id: _id, ...rest } = settings
      setDraft(rest)
    }
  }, [settings])

  useFormDraft(draft ? DRAFT_KEY : null, draft)

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
    if (!error) clearFormDraft(DRAFT_KEY)
    setMessage(error ? 'บันทึกไม่สำเร็จ: ' + error.message : 'บันทึกแล้ว')
  }

  async function handleLogoChange(file: File) {
    setBusy(true)
    const { error, path } = await uploadLogo(file)
    setBusy(false)
    // แก้เฉพาะช่อง logo_path ในร่างท้องถิ่น ไม่ใช่เขียนทับร่างทั้งก้อนด้วย settings ที่โหลดใหม่ทั้งชุด
    // เพราะจะทำให้ช่องอื่นที่ผู้ใช้กำลังพิมพ์ค้างอยู่ (เช่นส่วนนำหน้าเลขออเดอร์) หายไปก่อนกดบันทึกจริง
    if (!error && path) set('logo_path', path)
    setMessage(error ? 'อัปโหลดโลโก้ไม่สำเร็จ: ' + error.message : 'อัปโหลดโลโก้แล้ว')
  }

  function text(
    label: string,
    key: 'shop_name' | 'phone' | 'address' | 'promptpay' | 'receipt_footer' | 'payment_instructions' | 'owner_notification_email'
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

      {isOwner && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-500">จัดการร้าน</h2>
          <Link
            to="/storage"
            className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">🗑️ จัดการพื้นที่จัดเก็บ</span>
            <span className="text-stone-400">→</span>
          </Link>
          <Link
            to="/chatbot"
            className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">💬 จัดการแชทบอทน้องริว</span>
            <span className="text-stone-400">→</span>
          </Link>
          <Link
            to="/withdrawals"
            className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">📦 เบิกของ</span>
            <span className="text-stone-400">→</span>
          </Link>
          <Link
            to="/expenses"
            className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">💸 รายจ่าย</span>
            <span className="text-stone-400">→</span>
          </Link>
          <Link
            to="/promo"
            className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">🎨 การ์ดโปรโมทร้าน</span>
            <span className="text-stone-400">→</span>
          </Link>
        </section>
      )}

      <StaffManagementSection />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-stone-500">ข้อมูลร้าน</h2>
        {text('ชื่อร้าน', 'shop_name')}
        {isOwnerOrExec && text('เบอร์โทร', 'phone')}
        {isOwnerOrExec && text('ที่อยู่ร้าน', 'address')}
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

      {isOwnerOrExec && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500">แจ้งเตือนออเดอร์ใหม่</h2>
          <p className="text-xs text-stone-400">พอมีลูกค้ายืนยันออเดอร์ใหม่ ระบบจะส่งอีเมลแจ้งมาที่อีเมลนี้ทันที (ปล่อยว่างไว้ได้ถ้าไม่ต้องการ)</p>
          {text('อีเมลรับแจ้งเตือน', 'owner_notification_email')}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-500">วิธีชำระเงิน (โชว์ให้ลูกค้าเห็นในลิงก์สรุปตอนยังไม่จ่าย)</h2>
        {text('ข้อความวิธีชำระเงิน', 'payment_instructions')}
      </section>

      {isOwnerOrExec && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500">ค่าเริ่มต้นใบเสร็จ</h2>
          {text('ข้อความท้ายใบเสร็จ', 'receipt_footer')}
          {checkbox('ใบเสร็จแสดงโลโก้', 'receipt_show_logo')}
          {checkbox('ใบเสร็จแสดงที่อยู่', 'receipt_show_address')}
          {checkbox('ใบเสร็จแสดงเบอร์โทร', 'receipt_show_phone')}
          {checkbox('ใบเสร็จแสดงพร้อมเพย์', 'receipt_show_promptpay')}
        </section>
      )}

      {isOwnerOrExec && (
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
      )}

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
