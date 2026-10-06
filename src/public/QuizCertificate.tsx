import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { ShopStamp } from '../receipts/ShopStamp'

const W = 1123 // A4 แนวนอนที่ 96dpi
const H = 794

export type CertificateData = {
  name: string
  correct: number
  total: number
  pct: number
  shopName: string
  logoUrl: string | null
  issuedAt: Date
  certNo: string
}

/** ฟอนต์เกียรติบัตร: ชื่อ/หัวข้อใช้ Charmonman (ลายมือไทยสง่า) เนื้อความใช้ Pridi (ตัวมีหัวแบบทางการ) — โหลดจาก index.html */
const FONT_SCRIPT = '"Charmonman", "Mitr", serif'
const FONT_BODY = '"Pridi", "Sarabun", serif'

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
            className="relative overflow-hidden text-center"
            style={{
              width: W,
              height: H,
              fontFamily: FONT_BODY,
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

            <div className="relative flex h-full flex-col items-center px-24 pt-11 pb-11">
              <div className="flex items-center gap-3">
                {data.logoUrl && (
                  <img src={data.logoUrl} alt="" crossOrigin="anonymous" className="h-14 w-14 rounded-full object-cover border-[3px]" style={{ borderColor: '#b8860b' }} />
                )}
                <p className="text-[22px] font-semibold tracking-[0.14em]" style={{ fontFamily: FONT_BODY }}>{data.shopName}</p>
              </div>

              <h1 className="mt-5 text-[78px] font-bold leading-[1.5]" style={{ fontFamily: FONT_SCRIPT, color: '#4a2e15', textShadow: '2px 3px 0 rgba(184,134,11,0.25)' }}>
                เกียรติบัตร
              </h1>
              <p className="-mt-1 text-[14px] font-semibold tracking-[0.55em] pl-[0.55em]" style={{ color: '#b8860b' }}>
                CERTIFICATE OF ACHIEVEMENT
              </p>

              <p className="mt-4 text-[18px] font-light">ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</p>

              <p className="mt-1 text-[62px] font-bold leading-[1.55]" style={{ fontFamily: FONT_SCRIPT, color: '#2b1604' }}>
                {data.name}
              </p>
              <div className="mt-1 h-[3px] w-[520px]" style={{ background: 'linear-gradient(90deg, transparent, #b8860b, transparent)' }} aria-hidden="true" />

              <p className="mt-1 text-[19px] font-light leading-[1.7]">
                ได้ผ่านการทดสอบความรู้ด้านเบเกอรี่ครบทั้ง 6 ระดับ
                <br />
                ตอบถูก <b className="font-semibold">{data.correct}</b> จาก <b className="font-semibold">{data.total}</b> ข้อ ({data.pct}%)
              </p>

              <div className="mt-2 flex items-center gap-4" style={{ color: '#b8860b' }} aria-hidden="true">
                <span className="h-px w-24" style={{ background: 'linear-gradient(90deg, transparent, #b8860b)' }} />
                <span className="text-[26px] tracking-[0.35em] pl-[0.35em]">★★★★★★</span>
                <span className="h-px w-24" style={{ background: 'linear-gradient(270deg, transparent, #b8860b)' }} />
              </div>
              <p className="mt-1 text-[21px] font-medium" style={{ color: '#4a2e15' }}>
                ผ่านครบทุกระดับ · ผู้มีความรู้ด้านเบเกอรี่ยอดเยี่ยม
              </p>

              <div className="mt-auto flex w-full items-end justify-between text-[15px]">
                <div className="w-[300px] text-left leading-relaxed">
                  <p>
                    ให้ไว้ ณ วันที่ <b className="font-semibold">{dateTH(data.issuedAt)}</b>
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
