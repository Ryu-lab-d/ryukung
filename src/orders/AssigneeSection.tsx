import { useStaffMembers } from '../staff/useStaffMembers'

/** เลือกพนักงานผู้ดูแลออเดอร์นี้ — ใครก็ตามในทีมเห็นได้ว่าใครรับผิดชอบ และมอบหมาย/เปลี่ยนได้ทันที */
export function AssigneeSection({
  assignedTo,
  assigneeName,
  onAssign,
}: {
  assignedTo: string | null
  assigneeName: string | null
  onAssign: (staffId: string | null) => void
}) {
  const { members } = useStaffMembers()
  const active = members.filter((m) => m.status === 'active')

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2.5">
      <span className="text-sm">
        <span className="text-stone-500">👤 ผู้ดูแล: </span>
        <span className="font-medium">{assigneeName ?? 'ยังไม่มอบหมาย'}</span>
      </span>
      <select
        value={assignedTo ?? ''}
        onChange={(e) => onAssign(e.target.value || null)}
        className="rounded-lg border border-stone-300 text-sm px-2 py-1.5 max-w-[45%]"
      >
        <option value="">ไม่ระบุ</option>
        {active.map((m) => (
          <option key={m.id} value={m.id}>
            {m.display_name ?? m.email}{m.role === 'owner' ? ' (เจ้าของร้าน)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
