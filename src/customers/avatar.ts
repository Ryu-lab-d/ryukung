const PALETTE = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-lime-100 text-lime-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-fuchsia-100 text-fuchsia-700',
]

/** สีพื้นหลังอวาตาร์ที่คงที่ต่อชื่อเดิมเสมอ (แฮชง่ายๆ จากตัวอักษร ไม่ต้องเก็บสีแยกในฐานข้อมูล) */
export function avatarStyle(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function initials(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase()
}
