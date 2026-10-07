import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHero } from '../layout/PageHero'
import { generatePromoCode, promoSummary, type PublicPromo } from '../lib/promoApi'

type PromoRow = {
  id: string
  name: string
  description: string | null
  code: string | null
  kind: 'percent' | 'amount'
  value: number
  min_subtotal: number
  max_discount: number | null
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  used_count: number
  is_active: boolean
  created_at: string
}

const INPUT = 'w-full rounded-xl border border-stone-300 px-3 py-2 text-sm'
const BTN = 'rounded-full bg-white border border-stone-300 text-stone-700 px-4 py-1.5 text-sm font-semibold'

export function promoStatus(p: PromoRow, now = new Date()): { label: string; tone: 'green' | 'amber' | 'gray' | 'red' } {
  if (!p.is_active) return { label: 'ปิดอยู่', tone: 'gray' }
  if (p.usage_limit != null && p.used_count >= p.usage_limit) return { label: 'ใช้ครบสิทธิ์แล้ว', tone: 'red' }
  if (p.starts_at && new Date(p.starts_at) > now) return { label: 'ยังไม่เริ่ม', tone: 'amber' }
  if (p.ends_at && new Date(p.ends_at) <= now) return { label: 'หมดเวลาแล้ว', tone: 'red' }
  return { label: 'กำลังใช้งาน', tone: 'green' }
}

const TONE = { green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', gray: 'bg-stone-200 text-stone-600', red: 'bg-red-100 text-red-700' }

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

/** หน้าออกโปรโมชั่น/โค้ดส่วนลด (เจ้าของ/ผู้จัดการ) — ลูกค้าเห็นโปรอัตโนมัติที่หน้า /menu และกรอกโค้ดตอนทวนรายการ */
export function PromotionsPage() {
  const [rows, setRows] = useState<PromoRow[]>([])
  const [editing, setEditing] = useState<PromoRow | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
    if (e) setError(e.message)
    setRows((data ?? []) as PromoRow[])
  }, [])
  useEffect(() => { void load() }, [load])

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error: e } = await p
    setError(e ? (e.message.includes('promotions_code_uidx') ? 'โค้ดนี้มีอยู่แล้ว ใช้โค้ดอื่น' : e.message) : null)
    await load()
    return !e
  }

  const live = rows.filter((r) => promoStatus(r).tone === 'green').length

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto pb-24">
      <PageHero icon="🎁" title="โปรโมชั่น & โค้ดส่วนลด" subtitle={`กำลังใช้งาน ${live} รายการ · ลูกค้าเห็นที่หน้าสั่งซื้อ /menu`}>
        <button type="button" onClick={() => setEditing('new')}>＋ ออกโปรใหม่</button>
        <Link to="/settings">← ตั้งค่า</Link>
      </PageHero>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1">
        <p><b>🤖 โปรอัตโนมัติ</b> (ไม่ใส่โค้ด): ลูกค้าไม่ต้องกรอกอะไร ระบบลดให้เองถ้ายอดถึงเงื่อนไข ถ้ามีหลายโปรจะใช้อันที่ลดมากสุดอันเดียว</p>
        <p><b>🎟️ โค้ดส่วนลด</b> (ตั้งโค้ด): ลูกค้ากรอกเองตอนทวนรายการ ใช้แทนโปรอัตโนมัติ — เหมาะแจกเฉพาะคน/เฉพาะช่องทาง</p>
      </div>

      {editing && (
        <PromoForm
          key={editing === 'new' ? 'new' : editing.id}
          row={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async (payload) => {
            const ok = await run(editing === 'new' ? supabase.from('promotions').insert(payload) : supabase.from('promotions').update(payload).eq('id', editing.id))
            if (ok) setEditing(null)
          }}
        />
      )}

      {rows.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีโปรโมชั่น กด "ออกโปรใหม่" ได้เลย</p>}
      {rows.map((r) => {
        const st = promoStatus(r)
        return (
          <div key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display font-bold text-lg leading-tight">{r.name}</p>
                <p className="text-sm text-amber-900 font-semibold">{promoSummary(r as unknown as PublicPromo)}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {r.code ? <>🎟️ โค้ด <b className="font-mono tracking-wider">{r.code}</b></> : '🤖 โปรอัตโนมัติ'}
                  {' · '}ใช้แล้ว {r.used_count}{r.usage_limit ? `/${r.usage_limit}` : ''} ครั้ง
                  {r.starts_at ? ` · เริ่ม ${new Date(r.starts_at).toLocaleDateString('th-TH')}` : ''}
                  {r.ends_at ? ` · ถึง ${new Date(r.ends_at).toLocaleDateString('th-TH')}` : ''}
                </p>
              </div>
              <span className={'rounded-full px-3 py-1 text-xs font-bold ' + TONE[st.tone]}>{st.label}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.code && (
                <button
                  type="button"
                  className={BTN}
                  onClick={() => void navigator.clipboard?.writeText(`ใช้โค้ด ${r.code} ลดเลย! สั่งที่ ${window.location.origin}/menu`)}
                >
                  📋 คัดลอกข้อความแจก
                </button>
              )}
              <button type="button" className={BTN} onClick={() => setEditing(r)}>✏️ แก้ไข</button>
              <button type="button" className={BTN} onClick={() => void run(supabase.from('promotions').update({ is_active: !r.is_active }).eq('id', r.id))}>
                {r.is_active ? 'ปิดโปร' : 'เปิดโปร'}
              </button>
              <button
                type="button"
                className={BTN + ' !text-red-600 !border-red-300'}
                onClick={() => window.confirm(`ลบโปร "${r.name}"? (ออเดอร์เก่าที่ใช้โปรนี้ยังเก็บส่วนลดไว้ตามเดิม)`) && void run(supabase.from('promotions').delete().eq('id', r.id))}
              >
                ลบ
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PromoForm({ row, onCancel, onSave }: { row: PromoRow | null; onCancel: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState(row?.name ?? '')
  const [description, setDescription] = useState(row?.description ?? '')
  const [useCode, setUseCode] = useState(row ? row.code !== null : false)
  const [code, setCode] = useState(row?.code ?? '')
  const [kind, setKind] = useState<'percent' | 'amount'>(row?.kind ?? 'percent')
  const [value, setValue] = useState(row ? String(row.value) : '')
  const [minSubtotal, setMinSubtotal] = useState(row ? String(row.min_subtotal) : '')
  const [maxDiscount, setMaxDiscount] = useState(row?.max_discount != null ? String(row.max_discount) : '')
  const [startsAt, setStartsAt] = useState(toLocalInput(row?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(row?.ends_at ?? null))
  const [usageLimit, setUsageLimit] = useState(row?.usage_limit != null ? String(row.usage_limit) : '')
  const [err, setErr] = useState<string | null>(null)

  const numValue = Number(value)
  const valid = name.trim() && numValue > 0 && (kind === 'amount' || numValue <= 100) && (!useCode || code.trim())

  const label = 'block text-xs font-semibold text-stone-600 mb-1'
  return (
    <form
      className="rounded-2xl border-2 border-amber-300 bg-white p-4 shadow-md space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid) return setErr('กรอกชื่อโปร ส่วนลด (เปอร์เซ็นต์ไม่เกิน 100) และโค้ด (ถ้าเลือกแบบโค้ด) ให้ครบ')
        if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return setErr('วันสิ้นสุดต้องหลังวันเริ่ม')
        setErr(null)
        await onSave({
          name: name.trim(),
          description: description.trim() || null,
          code: useCode ? code.trim().toUpperCase() : null,
          kind,
          value: numValue,
          min_subtotal: Number(minSubtotal) || 0,
          max_discount: kind === 'percent' && Number(maxDiscount) > 0 ? Number(maxDiscount) : null,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          usage_limit: Number(usageLimit) > 0 ? Number(usageLimit) : null,
        })
      }}
    >
      <h2 className="font-bold">{row ? 'แก้ไขโปรโมชั่น' : 'ออกโปรโมชั่นใหม่'}</h2>
      <div>
        <label className={label} htmlFor="promo-name">ชื่อโปร (ลูกค้าเห็น)</label>
        <input id="promo-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ลดต้อนรับเปิดคอร์ส" />
      </div>
      <div>
        <label className={label} htmlFor="promo-desc">รายละเอียด (ไม่บังคับ)</label>
        <input id="promo-desc" className={INPUT} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setUseCode(false)} className={'rounded-xl border px-3 py-2 text-sm font-semibold ' + (!useCode ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-300')}>
          🤖 โปรอัตโนมัติ
        </button>
        <button type="button" onClick={() => { setUseCode(true); if (!code) setCode(generatePromoCode()) }} className={'rounded-xl border px-3 py-2 text-sm font-semibold ' + (useCode ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-300')}>
          🎟️ โค้ดส่วนลด
        </button>
      </div>
      {useCode && (
        <div className="flex gap-2">
          <input aria-label="โค้ดส่วนลด" className={INPUT + ' font-mono uppercase tracking-wider'} value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="button" className={BTN + ' shrink-0'} onClick={() => setCode(generatePromoCode())}>🎲 สุ่ม</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label} htmlFor="promo-kind">รูปแบบส่วนลด</label>
          <select id="promo-kind" className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'amount')}>
            <option value="percent">ลดเป็น % </option>
            <option value="amount">ลดเป็นบาท</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="promo-value">{kind === 'percent' ? 'ลดกี่ %' : 'ลดกี่บาท'}</label>
          <input id="promo-value" className={INPUT} type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="promo-min">ซื้อขั้นต่ำ (บาท)</label>
          <input id="promo-min" className={INPUT} type="number" min="0" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} placeholder="0 = ไม่มีขั้นต่ำ" />
        </div>
        {kind === 'percent' && (
          <div>
            <label className={label} htmlFor="promo-max">ลดสูงสุด (บาท)</label>
            <input id="promo-max" className={INPUT} type="number" min="0" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="เว้นว่าง = ไม่จำกัด" />
          </div>
        )}
        <div>
          <label className={label} htmlFor="promo-start">เริ่ม (เว้นว่าง = ทันที)</label>
          <input id="promo-start" className={INPUT} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="promo-end">สิ้นสุด (เว้นว่าง = ไม่หมด)</label>
          <input id="promo-end" className={INPUT} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="promo-limit">จำนวนสิทธิ์ (ครั้ง)</label>
          <input id="promo-limit" className={INPUT} type="number" min="0" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="เว้นว่าง = ไม่จำกัด" />
        </div>
      </div>

      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded-full bg-stone-900 text-white px-5 py-2 text-sm font-semibold">💾 บันทึกโปร</button>
        <button type="button" className={BTN} onClick={onCancel}>ยกเลิก</button>
      </div>
    </form>
  )
}
