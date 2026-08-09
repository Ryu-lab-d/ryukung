export type WorkStatusStage = { status: string; label: string; icon: string }

/** ลำดับขั้นงานสำหรับออเดอร์แบบ "นัดรับเอง" หรือ "ร้านไปส่งเอง" — ไม่ต้องมีสถานะย่อยของขนส่งบริษัท */
export const SIMPLE_STAGES: WorkStatusStage[] = [
  { status: 'to_bake', label: 'รออบ', icon: '🥐' },
  { status: 'baking', label: 'กำลังทำ', icon: '👩‍🍳' },
  { status: 'ready', label: 'แพ็คแล้วรอส่งมอบ', icon: '📦' },
  { status: 'delivered', label: 'ส่งมอบแล้ว', icon: '✅' },
]

/** ลำดับขั้นงานสำหรับออเดอร์ที่ต้องผ่านขนส่งบริษัทหรือไรเดอร์ — มีสถานะย่อยระหว่างทางเพิ่มจากแบบธรรมดา */
export const COURIER_STAGES: WorkStatusStage[] = [
  { status: 'to_bake', label: 'รออบ', icon: '🥐' },
  { status: 'baking', label: 'กำลังทำ', icon: '👩‍🍳' },
  { status: 'ready', label: 'แพ็คแล้วรอส่ง', icon: '📦' },
  { status: 'waiting_courier', label: 'รอขนส่งเข้ารับพัสดุ', icon: '⏳' },
  { status: 'picked_up', label: 'ขนส่งเข้ารับพัสดุแล้ว', icon: '🚚' },
  { status: 'in_transit', label: 'พัสดุอยู่ระหว่างจัดส่ง', icon: '🛣️' },
  { status: 'delivered', label: 'จัดส่งสำเร็จ', icon: '✅' },
]

/** ขนส่งบริษัท/ไรเดอร์เท่านั้นที่ต้องมีสถานะย่อยระหว่างทาง นัดรับเอง/ไปส่งเองไม่จำเป็นต้องมี */
export function stagesFor(fulfillmentType: string): WorkStatusStage[] {
  return fulfillmentType === 'shipping' || fulfillmentType === 'rider' ? COURIER_STAGES : SIMPLE_STAGES
}

export function stageLabel(fulfillmentType: string, status: string): string {
  return stagesFor(fulfillmentType).find((s) => s.status === status)?.label ?? status
}

export function nextStatus(fulfillmentType: string, current: string): string | null {
  const stages = stagesFor(fulfillmentType)
  const idx = stages.findIndex((s) => s.status === current)
  if (idx === -1 || idx === stages.length - 1) return null
  return stages[idx + 1].status
}

export const STATUS_COLOR: Record<string, string> = {
  to_bake: 'bg-stone-700',
  baking: 'bg-amber-600',
  ready: 'bg-blue-600',
  waiting_courier: 'bg-indigo-600',
  picked_up: 'bg-indigo-600',
  in_transit: 'bg-indigo-600',
  delivered: 'bg-green-600',
  cancelled: 'bg-red-600',
}

export const STATUS_ICON: Record<string, string> = {
  to_bake: '🥐',
  baking: '👩‍🍳',
  ready: '📦',
  waiting_courier: '⏳',
  picked_up: '🚚',
  in_transit: '🛣️',
  delivered: '✅',
  cancelled: '✖️',
}
