import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/** บาร์โค้ด Code 128 ขาว-ดำล้วนของเลขออเดอร์ (เครื่องสแกนบาร์โค้ดทั่วไปอ่านได้) — วาดเป็น SVG เลยคมทั้งตอนพิมพ์และตอนบันทึกเป็นรูป */
export function Barcode128({ value, height = 52, compact = false }: { value: string; height?: number; compact?: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: !compact,
        height,
        width: compact ? 1.5 : 2,
        margin: 0,
        fontSize: 14,
        textMargin: 4,
        font: 'monospace',
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      // เลขออเดอร์มีตัวอักษรแปลกจนเข้ารหัสไม่ได้ — ปล่อยว่างไว้ ไม่ให้ทั้งหน้าพัง
    }
  }, [value, height, compact])
  return <svg ref={ref} role="img" aria-label={`บาร์โค้ดเลขออเดอร์ ${value}`} />
}
