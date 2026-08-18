import { useState, type FormEvent } from 'react'
import { useStaffMembers, type StaffMember } from './useStaffMembers'
import { StaffPermissionsModal } from './StaffPermissionsModal'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { Toast } from '../lib/Toast'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

const STATUS_LABEL: Record<string, string> = { pending: 'รออนุมัติ', active: 'ใช้งานได้', revoked: 'ถูกระงับ' }
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  revoked: 'bg-red-100 text-red-700',
}

/**
 * แถวที่ user_id ยังเป็น null คือแค่ "เชิญไว้ล่วงหน้า" ยังไม่มีบัญชีจริงผูกอยู่เลย (พนักงานยังไม่ได้สมัคร)
 * ต่างจาก "รออนุมัติ" ปกติที่มีคนสมัครจริงแล้วแค่รอเจ้าของร้านกดอนุมัติ — ต้องแยกป้ายให้ชัด กันเข้าใจผิดว่า
 * ใช้งานได้แล้วทั้งที่ยังไม่มีใครสมัครเลย (บั๊กเดิม: กดอนุมัติแถวที่ยังไม่มีบัญชีจริง ทำให้ยืนยันตัวตนพนักงานจริงไม่ได้)
 */
function statusLabel(m: StaffMember): string {
  if (m.status === 'revoked') return m.user_id === null ? 'ยกเลิกคำเชิญแล้ว' : STATUS_LABEL.revoked
  if (m.user_id === null) return 'รอพนักงานสมัคร'
  return STATUS_LABEL[m.status]
}
function statusColor(m: StaffMember): string {
  if (m.status === 'revoked') return STATUS_COLOR.revoked
  if (m.user_id === null) return 'bg-sky-100 text-sky-700'
  return STATUS_COLOR[m.status]
}

const JOIN_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/staff/join`
const DRAFT_KEY = 'staff-invite-form'

export function StaffManagementSection() {
  const { members, loading, invite, setStatus, remove, setAllowedPages } = useStaffMembers()
  const [draft] = useState(() => loadFormDraft<{ email: string; displayName: string }>(DRAFT_KEY))
  const [email, setEmail] = useState(draft?.email ?? '')
  const [displayName, setDisplayName] = useState(draft?.displayName ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [permissionsTarget, setPermissionsTarget] = useState<StaffMember | null>(null)

  useFormDraft(DRAFT_KEY, { email, displayName })

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await invite(email, displayName)
    setBusy(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'อีเมลนี้อยู่ในรายชื่อแล้ว' : 'เพิ่มไม่สำเร็จ: ' + error.message)
      return
    }
    const invitedName = displayName
    setEmail('')
    setDisplayName('')
    clearFormDraft(DRAFT_KEY)
    setMessage(
      `เชิญ ${email} แล้ว — ส่งลิงก์สมัคร (ปุ่มคัดลอกด้านบน) ให้ ${invitedName} ไปกรอกชื่อ+อีเมลเดียวกันนี้+ตั้งรหัสผ่านเอง ` +
        `แล้วกดยืนยันอีเมลที่ได้รับก่อนถึงจะเข้าใช้งานได้ทันที ไม่ต้องกดอนุมัติอะไรเพิ่มจากฝั่งเรา`
    )
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(JOIN_URL)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleRemove() {
    if (!removeTarget) return
    const id = removeTarget
    setRemoveTarget(null)
    await remove(id)
    setMessage('ลบพนักงานออกจากระบบแล้ว')
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-stone-500">จัดการพนักงาน</h2>

      <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-1.5">
        <p className="text-xs text-stone-500">ลิงก์สมัครพนักงาน (ส่งให้พนักงานใหม่เพื่อสมัครและยืนยันตัวตนด้วยอีเมลของตัวเอง)</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2 truncate">{JOIN_URL}</code>
          <button type="button" onClick={() => void handleCopyLink()} className="shrink-0 rounded-lg bg-stone-900 text-white text-xs px-3 py-2 font-medium">
            {linkCopied ? '✓ คัดลอกแล้ว' : 'คัดลอก'}
          </button>
        </div>
      </div>

      <form onSubmit={handleInvite} className="rounded-lg border border-stone-200 p-3 space-y-2">
        <p className="text-xs text-stone-500">เชิญพนักงานล่วงหน้าด้วยอีเมล — พอพนักงานสมัครด้วยอีเมลนี้และยืนยันอีเมลแล้ว จะได้สิทธิ์ใช้งานทันที ไม่ต้องอนุมัติซ้ำ</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            placeholder="ชื่อพนักงาน"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="อีเมลพนักงาน"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-stone-900 text-white text-sm px-3 py-2 font-medium disabled:opacity-50">
          {busy ? 'กำลังเพิ่ม...' : '+ เชิญพนักงาน'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-stone-400">กำลังโหลด...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-stone-400">ยังไม่มีพนักงานในระบบ</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.display_name ?? m.email} {m.role === 'owner' && <span className="text-xs text-stone-400">(เจ้าของร้าน)</span>}
                </p>
                <p className="text-xs text-stone-500 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={'text-xs rounded-full px-2 py-1 font-medium ' + statusColor(m)}>{statusLabel(m)}</span>
                {m.role !== 'owner' && (
                  <>
                    {m.user_id === null ? (
                      // ยังไม่มีบัญชีจริงผูกอยู่เลย — สลับได้แค่ยกเลิก/เปิดคำเชิญใหม่ ไม่มี "อนุมัติ" เพราะไม่มีบัญชีให้อนุมัติจริงๆ
                      m.status === 'revoked' ? (
                        <button type="button" onClick={() => void setStatus(m.id, 'pending')} className="text-xs rounded-lg bg-green-600 text-white px-2.5 py-1.5 font-medium">
                          เปิดคำเชิญอีกครั้ง
                        </button>
                      ) : (
                        <button type="button" onClick={() => void setStatus(m.id, 'revoked')} className="text-xs rounded-lg bg-amber-600 text-white px-2.5 py-1.5 font-medium">
                          ยกเลิกคำเชิญ
                        </button>
                      )
                    ) : (
                      <>
                        {m.status !== 'active' && (
                          <button type="button" onClick={() => void setStatus(m.id, 'active')} className="text-xs rounded-lg bg-green-600 text-white px-2.5 py-1.5 font-medium">
                            อนุมัติ
                          </button>
                        )}
                        {m.status === 'active' && (
                          <button type="button" onClick={() => void setStatus(m.id, 'revoked')} className="text-xs rounded-lg bg-amber-600 text-white px-2.5 py-1.5 font-medium">
                            ระงับ
                          </button>
                        )}
                        {m.status === 'active' && (
                          <button type="button" onClick={() => setPermissionsTarget(m)} className="text-xs rounded-lg bg-stone-200 text-stone-700 px-2.5 py-1.5 font-medium">
                            🔑 สิทธิ์
                          </button>
                        )}
                      </>
                    )}
                    <button type="button" onClick={() => setRemoveTarget(m.id)} className="text-xs rounded-lg bg-red-600 text-white px-2.5 py-1.5 font-medium">
                      ลบ
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="ลบพนักงานคนนี้?"
          message="ลบแล้วบัญชีนี้จะเข้าระบบไม่ได้อีก ถ้าจะให้กลับมาใช้ได้ต้องเชิญและสมัครใหม่"
          confirmLabel="ลบ"
          cancelLabel="ไม่ลบ"
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      {message && <Toast message={message} onDone={() => setMessage(null)} />}

      {permissionsTarget && (
        <StaffPermissionsModal
          member={permissionsTarget}
          onClose={() => setPermissionsTarget(null)}
          onSave={setAllowedPages}
        />
      )}
    </section>
  )
}
