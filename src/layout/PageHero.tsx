import type { ReactNode } from 'react'
import { AmbientGlow } from '../public/PublicSiteChrome'

/**
 * ส่วนหัวแบนเนอร์ของทุกหน้าหลังบ้าน — พื้นสีแบรนด์ขยับได้ + ประกายทอง + ไอคอนใหญ่ในกรอบกระจก
 * ให้ทุกหน้าดูเป็นระบบเดียวกัน (ไม่ใช่แค่หัวข้อตัวหนังสือลอยบนพื้นครีม) ปุ่มที่ส่งมาใน children จะถูกบังคับเป็นปุ่มขาวมนเสมอ
 * เพื่อให้อ่านชัดบนพื้นสีเข้ม ไม่ว่าปุ่มนั้นเดิมจะเป็นสีอะไร
 */
export function PageHero({
  icon,
  title,
  subtitle,
  chips,
  children,
}: {
  icon: string
  title: string
  subtitle?: ReactNode
  chips?: ReactNode[]
  children?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-shader text-white p-5 shadow-[0_18px_36px_-16px_rgb(51_32_14_/_0.7)] animate-form-in">
      <AmbientGlow />
      <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/20 backdrop-blur border border-white/30 shadow-inner grid place-items-center text-3xl animate-icon-pop">
          {icon}
        </div>
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-white/85 mt-1">{subtitle}</p>}
        </div>
        {children && (
          <div className="basis-full sm:basis-auto flex flex-wrap items-center gap-2 sm:justify-end [&>*]:!bg-white [&>*]:!bg-none [&>*]:!text-stone-900 [&>*]:!border-0 [&>*]:!shadow-[0_10px_20px_-10px_rgb(0_0_0_/_0.6)] [&>*]:rounded-full [&>*]:font-semibold [&>*]:px-4 [&>*]:py-2 [&>*]:text-sm">
            {children}
          </div>
        )}
      </div>
      {chips && chips.length > 0 && (
        <div className="relative z-10 mt-4 flex flex-wrap gap-2">
          {chips.map((c, i) => (
            <span key={i} className="rounded-full bg-black/20 backdrop-blur border border-white/20 px-3 py-1 text-xs font-medium">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
