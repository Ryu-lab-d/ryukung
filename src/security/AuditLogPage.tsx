import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHero } from '../layout/PageHero'

type AuditRow = {
  id: number
  at: string
  actor_email: string | null
  table_name: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  row_id: string | null
  detail: Record<string, unknown> | null
}

export const TABLE_LABEL: Record<string, string> = {
  staff_members: 'พนักงาน/สิทธิ์',
  settings: 'ตั้งค่าร้าน',
  promotions: 'โปรโมชั่น',
  course_access_codes: 'รหัสเข้าเรียน',
  payments: 'การชำระเงิน',
  expenses: 'รายจ่าย',
  orders: 'ออเดอร์',
  invoices: 'Invoice',
  stock_withdrawals: 'เบิกของ',
}
const ACTION_LABEL = { INSERT: 'เพิ่ม', UPDATE: 'แก้ไข', DELETE: 'ลบ' }
const ACTION_TONE = { INSERT: 'bg-green-100 text-green-800', UPDATE: 'bg-amber-100 text-amber-800', DELETE: 'bg-red-100 text-red-700' }

/** สรุปรายละเอียดของแถวบันทึกเป็นข้อความสั้นๆ อ่านง่าย */
export function summarizeDetail(row: Pick<AuditRow, 'action' | 'detail'>): string {
  const d = row.detail
  if (!d) return ''
  if (row.action === 'UPDATE') {
    return Object.entries(d)
      .slice(0, 6)
      .map(([k, v]) => {
        const x = v as { from?: string; to?: string; changed?: boolean }
        return x.changed ? `${k} (เปลี่ยนค่า)` : `${k}: ${x.from || '∅'} → ${x.to || '∅'}`
      })
      .join(' · ')
  }
  const r = (d as { row?: Record<string, unknown> }).row ?? {}
  const pick = ['name', 'display_name', 'email', 'code', 'order_no', 'invoice_no', 'role', 'status', 'amount', 'title', 'description']
  return pick.filter((k) => r[k] != null && r[k] !== '').map((k) => `${k}: ${String(r[k])}`).slice(0, 5).join(' · ')
}

/** ประวัติกิจกรรมสำคัญในระบบ (เฉพาะเจ้าของร้าน) — ใครเพิ่ม/แก้/ลบอะไร เมื่อไหร่ ย้อนหลัง 180 วัน แก้ไขหรือลบเองไม่ได้ */
export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [table, setTable] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      let q = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300)
      if (table) q = q.eq('table_name', table)
      const { data, error: e } = await q
      if (e) setError(e.message)
      setRows((data ?? []) as AuditRow[])
    })()
  }, [table])

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto pb-24">
      <PageHero icon="🛡️" title="ประวัติกิจกรรมในระบบ" subtitle="ใครเพิ่ม/แก้/ลบข้อมูลสำคัญ เมื่อไหร่ — เก็บ 180 วัน แก้ไขย้อนหลังไม่ได้">
        <Link to="/settings">← ตั้งค่า</Link>
      </PageHero>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {[['', 'ทั้งหมด'], ...Object.entries(TABLE_LABEL)].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTable(k)}
            className={'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ' + (table === k ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600')}
          >
            {label}
          </button>
        ))}
      </div>

      {rows === null && <p className="text-sm text-stone-500">กำลังโหลด…</p>}
      {rows?.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีบันทึก (หรือคุณไม่ใช่เจ้าของร้าน)</p>}
      <ul className="space-y-2">
        {rows?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={'rounded-full px-2.5 py-0.5 font-bold ' + ACTION_TONE[r.action]}>{ACTION_LABEL[r.action]}</span>
              <b className="text-sm text-stone-900">{TABLE_LABEL[r.table_name] ?? r.table_name}</b>
              <span className="text-stone-500">{new Date(r.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span className="text-stone-500">· โดย {r.actor_email ?? 'ระบบ/ไม่ทราบ'}</span>
            </div>
            {summarizeDetail(r) && <p className="mt-1 text-xs text-stone-600 break-words">{summarizeDetail(r)}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
