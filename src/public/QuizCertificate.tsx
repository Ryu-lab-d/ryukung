import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { ShopStamp } from '../receipts/ShopStamp'

const W = 1123 // A4 แนวนอนที่ 96dpi
const H = 794

export type CertificateData = {
  name: string
  rankName: string
  rankIcon: string
  correct: number
  total: number
  pct: number
  shopName: string
  logoUrl: string | null
  issuedAt: Date
  certNo: string
}

const dateTH = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

function Corner({ className }: { className: string }) {
  return (
    <svg className={'absolute ' + className} width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M2 62 V2 H62" fill="none" stroke="#b8860b" strokeWidth="4" />
      <path d="M12 62 V12 H62" fill="none" stroke="#d9a15d" strokeWidth="1.6" />
      <rect x="-5" y="-5" width="10" height="10" transform="translate(9 9) rotate(45)" fill="#b8860b" />
    </svg>
  )
}

/**
 * ใบเกียรติบัตร A4 แนวนอน — กรอบทองน้ำตาลสองชั้น มุมประดับ ลายน้ำโลโก้ ชื่อผู้รับตัวใหญ่ ป้ายระดับ คะแนน วันที่ เลขที่ และตราประทับร้าน
 * ย่อเต็มความกว้างจอด้วย CSS scale (ตอนพิมพ์/บันทึกรูปใช้ขนาดจริงเสมอ) — ref ชี้ที่ตัวกระดาษจริงสำหรับแปลงเป็นรูป
 */
export const QuizCertificate = forwardRef<HTMLDivElement, { data: CertificateData }>(function QuizCertificate({ data }, ref) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    function fit() {
      const w = frameRef.current?.parentElement?.clientWidth ?? window.innerWidth
      setScale(Math.min(1, (w - 4) / W))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div className="overflow-hidden">
      <div ref={frameRef} className="cert-frame mx-auto" style={{ width: W * scale, height: H * scale }}>
        <div style={{ width: W, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div
            ref={ref}
            id="cert-print-area"
            className="relative overflow-hidden text-center font-warm"
            style={{
              width: W,
              height: H,
              color: '#3a2412',
              background: 'radial-gradient(ellipse at 50% 40%, #fffdf6 0%, #fbeed2 70%, #f3dcb0 100%)',
              boxShadow: '0 14px 40px -12px rgba(51,32,14,0.5)',
            }}
          >
            {/* กรอบ */}
            <div className="pointer-events-none absolute inset-[14px] border-[6px]" style={{ borderColor: '#4a2e15' }} aria-hidden="true" />
            <div className="pointer-events-none absolute inset-[28px] border-2" style={{ borderColor: '#b8860b' }} aria-hidden="true" />
            <div className="pointer-events-none absolute inset-[36px] border" style={{ borderColor: '#d9a15d' }} aria-hidden="true" />
            <Corner className="left-[30px] top-[30px]" />
            <Corner className="right-[30px] top-[30px] rotate-90" />
            <Corner className="left-[30px] bottom-[30px] -rotate-90" />
            <Corner className="right-[30px] bottom-[30px] rotate-180" />

            {/* ลายน้ำ */}
            {data.logoUrl ? (
              <img
                src={data.logoUrl}
                alt=""
                crossOrigin="anonymous"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover"
                style={{ width: 460, height: 460, opacity: 0.07, filter: 'grayscale(0.3)' }}
              />
            ) : (
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[360px] leading-none" style={{ opacity: 0.06 }} aria-hidden="true">
                🥐
              </div>
            )}

            <div className="relative flex h-full flex-col items-center px-24 pt-14 pb-12">
              <div className="flex items-center gap-3">
                {data.logoUrl && (
                  <img src={data.logoUrl} alt="" crossOrigin="anonymous" className="h-14 w-14 rounded-full object-cover border-[3px]" style={{ borderColor: '#b8860b' }} />
                )}
                <p className="font-display text-[22px] font-bold tracking-[0.12em]">{data.shopName}</p>
              </div>

              <h1 className="font-display mt-3 text-[66px] font-bold leading-none" style={{ color: '#4a2e15', letterSpacing: '0.06em' }}>
                เกียรติบัตร
              </h1>
              <p className="mt-1 text-[15px] font-bold tracking-[0.5em] pl-[0.5em]" style={{ color: '#b8860b' }}>
                CERTIFICATE OF ACHIEVEMENT
              </p>

              <p className="mt-6 text-[17px]">ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</p>

              <p className="font-display mt-2 text-[56px] font-bold leading-tight" style={{ color: '#2b1604' }}>
                {data.name}
              </p>
              <div className="mt-1 h-[3px] w-[520px]" style={{ background: 'linear-gradient(90deg, transparent, #b8860b, transparent)' }} aria-hidden="true" />

              <p className="mt-4 text-[18px] leading-relaxed">
                ได้ผ่านการทดสอบความรู้ด้านเบเกอรี่ครบทั้ง 6 ระดับ
                <br />
                ตอบถูก <b>{data.correct}</b> จาก <b>{data.total}</b> ข้อ ({data.pct}%) และได้รับสถานะ
              </p>

              <div
                className="mt-3 inline-flex items-center gap-3 rounded-full px-9 py-2.5 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #4a2e15, #7a4423)', color: '#ffe08a' }}
              >
                <span className="text-[34px] leading-none">{data.rankIcon}</span>
                <span className="font-display text-[32px] font-bold tracking-wide">ระดับ {data.rankName}</span>
              </div>

              <div className="mt-auto flex w-full items-end justify-between text-[15px]">
                <div className="w-[300px] text-left leading-relaxed">
                  <p>
                    ให้ไว้ ณ วันที่ <b>{dateTH(data.issuedAt)}</b>
                  </p>
                  <p className="text-[12px]" style={{ color: '#8a6a3a' }}>
                    เลขที่ {data.certNo}
                  </p>
                </div>
                <div className="-mb-3">
                  <ShopStamp shopName={data.shopName} statusText="PASSED" dateText={dateTH(data.issuedAt)} size={150} color="#7a2e0a" />
                </div>
                <div className="w-[300px] text-center">
                  <div className="mx-auto mb-1 h-[1px] w-[230px]" style={{ background: '#4a2e15' }} />
                  <p className="font-semibold">ผู้ออกเกียรติบัตร</p>
                  <p className="text-[13px]">{data.shopName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
