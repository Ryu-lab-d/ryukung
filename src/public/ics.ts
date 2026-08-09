function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function toIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

function addOneDay(isoDate: string): string {
  // สร้างและคำนวณวันที่ทั้งหมดใน UTC ล้วนๆ (ไม่ผ่าน local timezone เลย) กัน toISOString() ปัดวันผิด
  // ตอนเครื่องรันอยู่ใน timezone ที่เร็วกว่า UTC (เช่นไทย UTC+7) ซึ่งจะทำให้เที่ยงคืนวันถัดไปกลายเป็นเย็นของวันเดิมในตัวเลข UTC
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/**
 * สร้างไฟล์ .ics แบบ all-day event — ไม่ผูกเวลาที่ชัดเจน เพราะ pickup_time เป็นข้อความอิสระที่ลูกค้า/ร้านพิมพ์เอง
 * (เช่น "บ่ายๆ", "10 โมงเช้า") parse เป็นเวลาแม่นยำไม่ได้ เอาไปใส่ใน description แทนให้อ่านเองตอนเปิดปฏิทิน
 */
export function buildIcsContent(params: {
  orderNo: string
  shopName: string
  neededDate: string
  location: string | null
  description: string
}): string {
  const { orderNo, shopName, neededDate, location, description } = params
  const dtstart = toIcsDate(neededDate)
  const dtend = toIcsDate(addOneDay(neededDate))
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RYUKUNG BAKERY POS//TH',
    'BEGIN:VEVENT',
    `UID:${orderNo}@ryukung-pos`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    `SUMMARY:${escapeIcsText(`รับ/ส่งของ ${orderNo} - ${shopName}`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
  ]
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}
