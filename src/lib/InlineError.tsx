/** ข้อความแจ้งกรอกผิดระดับฟิลด์ ใช้แทนข้อความแดงเปล่าๆ ให้มีไอคอน+อนิเมชั่นเข้าที่สม่ำเสมอกันทั้งแอป */
export function InlineError({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null
  return (
    <p className={'flex items-center gap-1.5 text-sm text-red-600 animate-field-error ' + (className ?? '')}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="shrink-0">
        <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v5M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {message}
    </p>
  )
}
