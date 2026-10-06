/**
 * ตราประทับร้านแบบหมึกประทับ (ขาว-ดำ): วงแหวนคู่ ชื่อร้านโค้งรอบด้านบน ข้อความรับรองโค้งด้านล่าง
 * กลางตราเป็นสถานะ + วันที่ มีรอยหมึกไม่สม่ำเสมอเล็กน้อยและเอียงนิดๆ ให้ดูเหมือนประทับด้วยตรายางจริง
 */
export function ShopStamp({
  shopName,
  statusText,
  dateText,
  size = 150,
  color = '#000',
}: {
  shopName: string
  statusText: string
  dateText: string
  size?: number
  /** สีหมึก (ดีฟอลต์ดำสำหรับเอกสารขาว-ดำ) */
  color?: string
}) {
  const id = 'stamp-' + shopName.replace(/\W+/g, '').slice(0, 8)
  const top = shopName.toUpperCase().slice(0, 26)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label={`ตราประทับร้าน ${shopName}`}
      style={{ transform: 'rotate(-12deg)', opacity: 0.88 }}
    >
      <defs>
        <filter id={id + '-ink'} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
        </filter>
        <path id={id + '-top'} d="M 30,100 A 70,70 0 0 1 170,100" />
        <path id={id + '-bot'} d="M 22,100 A 78,78 0 0 0 178,100" />
      </defs>
      <g filter={`url(#${id}-ink)`} fill="none" stroke={color} strokeWidth="3">
        <circle cx="100" cy="100" r="94" />
        <circle cx="100" cy="100" r="86" strokeWidth="1.4" />
        <circle cx="100" cy="100" r="58" strokeWidth="1.6" />
      </g>
      <g filter={`url(#${id}-ink)`} fill={color}>
        <text fontSize="15" fontWeight="700" letterSpacing="1.8" textAnchor="middle" fontFamily="Sarabun, sans-serif">
          <textPath href={`#${id}-top`} startOffset="50%">{top}</textPath>
        </text>
        <text fontSize="11.5" fontWeight="700" letterSpacing="3" textAnchor="middle" fontFamily="Sarabun, sans-serif">
          <textPath href={`#${id}-bot`} startOffset="50%">★ OFFICIAL ★ ตรวจสอบแล้ว ★</textPath>
        </text>
        <text x="100" y="94" fontSize="20" fontWeight="800" textAnchor="middle" fontFamily="Sarabun, sans-serif">{statusText}</text>
        <line x1="62" y1="103" x2="138" y2="103" stroke={color} strokeWidth="1.4" />
        <text x="100" y="121" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="Sarabun, sans-serif">{dateText}</text>
      </g>
    </svg>
  )
}
