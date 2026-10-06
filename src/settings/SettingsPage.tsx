import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings, type Settings } from './useSettings'
import { productImageUrl } from '../products/ProductCard'
import { StaffManagementSection } from '../staff/StaffManagementSection'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { useAuth, isOwnerOrExecutive } from '../auth/AuthProvider'
import { AmbientGlow } from '../public/PublicSiteChrome'
import type { ReactNode } from 'react'

type Draft = Omit<Settings, 'id'>

const DRAFT_KEY = 'settings-form'

const CARD =
  'rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)]'
const INPUT = 'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5'

/** หมวดพับได้ — แบ่งหน้าตั้งค่าที่ยาวมากเป็นกลุ่มย่อย แตะหัวข้อเพื่อเปิด/ปิด (เนื้อหายังอยู่ใน DOM ตลอด ฟอร์มไม่หาย) */
function Group({ icon, title, subtitle, defaultOpen = false, children }: { icon: string; title: string; subtitle: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-3xl border border-stone-200 bg-white/80 shadow-[0_10px_26px_-16px_rgb(51_32_14_/_0.45)]">
      <summary className="cursor-pointer select-none list-none flex items-center gap-3 px-4 py-3.5">
        <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 grid place-items-center text-xl shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-stone-900">{title}</span>
          <span className="block text-xs text-stone-500 truncate">{subtitle}</span>
        </span>
        <span className="text-stone-400 transition-transform duration-200 group-open:rotate-180">▾</span>
      </summary>
      <div className="px-3 pb-3 space-y-3">{children}</div>
    </details>
  )
}

export function SettingsPage() {
  const { staffStatus } = useAuth()
  const isOwner = staffStatus?.role === 'owner'
  const isOwnerOrExec = isOwnerOrExecutive(staffStatus?.role)
  const { settings, loading, save, uploadLogo } = useSettings()
  const [restoredDraft] = useState(() => loadFormDraft<Draft>(DRAFT_KEY))
  const [draft, setDraft] = useState<Draft | null>(restoredDraft)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuLinkCopied, setMenuLinkCopied] = useState(false)

  async function handleCopyMenuLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/menu`)
    setMenuLinkCopied(true)
    setTimeout(() => setMenuLinkCopied(false), 2000)
  }
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
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด...
        </div>
      </div>
    )
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
    key: 'shop_name' | 'phone' | 'address' | 'promptpay' | 'receipt_footer' | 'payment_instructions' | 'owner_notification_email' | 'tax_id'
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
            className={INPUT}
          />
        ) : (
          <input
            id={key}
            value={values[key] ?? ''}
            onChange={(e) => set(key, e.target.value)}
            className={INPUT}
          />
        )}
      </div>
    )
  }

  function checkbox(
    label: string,
    key:
      | 'receipt_show_logo'
      | 'receipt_show_address'
      | 'receipt_show_phone'
      | 'receipt_show_promptpay'
      | 'require_full_customer_info'
      | 'disaster_mode_enabled'
      | 'auto_notify_customer'
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
    <div className="bg-stone-50 min-h-screen">
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">
      <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-5 shadow-[0_16px_34px_-16px_rgb(51_32_14_/_0.7)]">
        <AmbientGlow />
        <div className="relative z-10 flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur grid place-items-center text-2xl">⚙️</span>
          <div>
            <h1 className="text-xl font-bold leading-tight">ตั้งค่า</h1>
            <p className="text-sm text-white/80 mt-0.5">ข้อมูลร้าน ใบเสร็จ และเครื่องมือจัดการระบบ</p>
          </div>
        </div>
      </div>

      {isOwner && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-stone-700">จัดการร้าน</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              ['/withdrawals', '📦', 'เบิกของ', 'bg-amber-50 border-amber-200'],
              ['/expenses', '💸', 'รายจ่าย', 'bg-red-50 border-red-200'],
              ['/chatbot', '💬', 'แชทบอทน้องริว', 'bg-sky-50 border-sky-200'],
              ['/promo', '🎨', 'การ์ดโปรโมทร้าน', 'bg-violet-50 border-violet-200'],
              ['/storage', '🗑️', 'พื้นที่จัดเก็บ', 'bg-stone-100 border-stone-200'],
            ].map(([to, icon, label, tone]) => (
              <Link
                key={to}
                to={to}
                className={'flex items-center gap-2.5 rounded-2xl border px-3.5 py-3.5 text-sm font-semibold text-stone-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 ' + tone}
              >
                <span className="text-2xl">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </section>
      )}

      <Group icon="🏪" title="ร้านของฉัน" subtitle="ชื่อ โลโก้ พร้อมเพย์ วิธีชำระเงิน ลิงก์เมนูออนไลน์" defaultOpen>
      <section className={CARD + ' space-y-4'}>
        <h2 className="text-sm font-semibold text-stone-700">ข้อมูลร้าน</h2>
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
                className="block text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-stone-900 file:text-white file:px-3 file:py-2 file:text-sm"
              />
              {busy && <p className="text-xs text-stone-500 mt-1">กำลังอัปโหลด...</p>}
            </div>
          </div>
        </div>
      </section>

      <section className={CARD + ' space-y-3'}>
        <h2 className="text-sm font-semibold text-stone-700">วิธีชำระเงิน (โชว์ให้ลูกค้าเห็นในลิงก์สรุปตอนยังไม่จ่าย)</h2>
        {text('ข้อความวิธีชำระเงิน', 'payment_instructions')}
      </section>

      <section className={CARD + ' space-y-2'}>
        <h2 className="text-sm font-semibold text-stone-700">เมนูออนไลน์ให้ลูกค้าสั่งเอง</h2>
        <p className="text-xs text-stone-400">
          ส่งลิงก์นี้ให้ลูกค้าเลือกสินค้า/สั่งซื้อได้เอง — ออเดอร์ที่ส่งเข้ามาจะรอร้านตรวจสอบและกดยืนยันก่อนเสมอ ยังไม่เข้าคิวอบทันที
        </p>
        <button
          type="button"
          onClick={() => void handleCopyMenuLink()}
          className={
            'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ' +
            (menuLinkCopied ? 'bg-green-600 text-white' : 'bg-stone-900 text-white')
          }
        >
          {menuLinkCopied ? '✅ คัดลอกลิงก์แล้ว!' : '🔗 คัดลอกลิงก์เมนูออนไลน์'}
        </button>
      </section>

      </Group>

      <Group icon="👥" title="ทีมงานและสิทธิ์" subtitle="เชิญ/จัดการพนักงานและบทบาท">
      <StaffManagementSection />
      </Group>

      {isOwnerOrExec && (
      <Group icon="🔔" title="การแจ้งเตือน" subtitle="อีเมลออเดอร์ใหม่ และระบบเตือนภัยพิบัติ">
      {isOwnerOrExec && (
        <section className={CARD + ' space-y-3'}>
          <h2 className="text-sm font-semibold text-stone-700">แจ้งเตือนออเดอร์ใหม่</h2>
          <p className="text-xs text-stone-400">พอมีลูกค้ายืนยันออเดอร์ใหม่ ระบบจะส่งอีเมลแจ้งมาที่อีเมลนี้ทันที (ปล่อยว่างไว้ได้ถ้าไม่ต้องการ)</p>
          {text('อีเมลรับแจ้งเตือน', 'owner_notification_email')}
          {checkbox('แจ้งลูกค้าทางอีเมลอัตโนมัติ (เมื่อสถานะเปลี่ยน / รับเงินแล้ว)', 'auto_notify_customer')}
        </section>
      )}

      {isOwner && (
        <section className={CARD + ' space-y-2'}>
          <h2 className="text-sm font-semibold text-stone-700">ระบบแจ้งเตือนภัยพิบัติ</h2>
          <p className="text-xs text-stone-400">
            สวิตช์รวมของระบบติดตาม/แจ้งเตือนภัยพิบัติทั้งหมด (ตอนนี้มีโมดูลติดตามสถานการณ์น้ำท่วมกรุงเทพฯ) — ปิดไว้ได้เมื่อไม่มีเหตุ
            โดยไม่ต้องลบอะไรออก แถบแจ้งเตือนในหน้าเมนูและหน้า /flood จะซ่อนไปเอง พอมีภัยพิบัติจริงค่อยกลับมาติ๊กเปิด ใช้งานได้ทันที
          </p>
          {checkbox('เปิดใช้งานระบบแจ้งเตือนภัยพิบัติ', 'disaster_mode_enabled')}
        </section>
      )}

      </Group>
      )}

      {isOwnerOrExec && (
      <Group icon="🧾" title="ใบเสร็จและเลขเอกสาร" subtitle="ข้อความท้ายใบเสร็จ เลขออเดอร์ เงื่อนไขออเดอร์">
      {isOwnerOrExec && (
        <section className={CARD + ' space-y-3'}>
          <h2 className="text-sm font-semibold text-stone-700">ค่าเริ่มต้นใบเสร็จ</h2>
          {text('ข้อความท้ายใบเสร็จ', 'receipt_footer')}
          {text('เลขประจำตัวผู้เสียภาษี (แสดงบน Invoice ถ้ากรอก)', 'tax_id')}
          {checkbox('ใบเสร็จแสดงโลโก้', 'receipt_show_logo')}
          {checkbox('ใบเสร็จแสดงที่อยู่', 'receipt_show_address')}
          {checkbox('ใบเสร็จแสดงเบอร์โทร', 'receipt_show_phone')}
          {checkbox('ใบเสร็จแสดงพร้อมเพย์', 'receipt_show_promptpay')}
        </section>
      )}

      {isOwnerOrExec && (
        <section className={CARD + ' space-y-4'}>
          <h2 className="text-sm font-semibold text-stone-700">เลขที่เอกสารและออเดอร์</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="order_no_prefix" className="text-sm text-stone-600">ส่วนนำหน้าเลขออเดอร์</label>
              <input
                id="order_no_prefix"
                value={draft.order_no_prefix}
                onChange={(e) => set('order_no_prefix', e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="receipt_no_prefix" className="text-sm text-stone-600">ส่วนนำหน้าเลขใบเสร็จ</label>
              <input
                id="receipt_no_prefix"
                value={draft.receipt_no_prefix}
                onChange={(e) => set('receipt_no_prefix', e.target.value)}
                className={INPUT}
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
              className={INPUT}
            />
          </div>

          {checkbox('บังคับกรอกข้อมูลลูกค้าให้ครบก่อนยืนยันออเดอร์', 'require_full_customer_info')}
        </section>
      )}

      </Group>
      )}

      {message && (
        <p className="text-sm rounded-2xl bg-white border border-stone-200 px-3.5 py-2.5 text-stone-700 shadow-sm">{message}</p>
      )}

      <div className="sticky bottom-[4.5rem] lg:bottom-4 z-20 -mx-1 rounded-3xl bg-white/85 backdrop-blur border border-stone-200 p-2 shadow-[0_14px_30px_-14px_rgb(51_32_14_/_0.5)]">
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="w-full rounded-full bg-gradient-to-r from-amber-600 to-amber-800 text-white px-4 py-3 font-semibold disabled:opacity-50 active:scale-95"
        >
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </div>
    </div>
  )
}
