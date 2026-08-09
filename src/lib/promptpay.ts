/**
 * สร้าง payload สำหรับ QR พร้อมเพย์ ตามมาตรฐาน Thai QR Payment (EMVCo) — ทำฝั่ง client ล้วนๆ ไม่มีค่าใช้จ่าย
 * ถ้าใส่ยอดเงินมาด้วย (amount) จะเป็น "dynamic QR" ที่ล็อกยอดไว้ในตัว QR เลย แอปธนาคารจะกรอกยอดให้อัตโนมัติ
 * และแก้ไขเองไม่ได้ — ถ้าไม่ใส่ยอดจะเป็น QR แบบ static ที่ใช้ซ้ำได้ทุกยอด
 */

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`
}

/** เบอร์มือถือ 10 หลักแปลงเป็นรูปแบบ 0066xxxxxxxxx เลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลักใช้ตามที่เป็น */
function formatPromptPayTarget(id: string): { tag: string; value: string } {
  const digits = id.replace(/[^0-9]/g, '')
  if (digits.length >= 13) {
    return { tag: '02', value: digits.slice(0, 13) }
  }
  const withCountryCode = digits.startsWith('0') ? '66' + digits.slice(1) : digits
  return { tag: '01', value: withCountryCode.padStart(13, '0') }
}

/** ส่งออกแยกไว้เฉพาะเพื่อเทสต์กับค่าอ้างอิงมาตรฐาน CRC-16/CCITT-FALSE ("123456789" -> 0x29B1) */
export function crc16(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function generatePromptPayPayload(promptpayId: string, amount?: number): string {
  const { tag, value } = formatPromptPayTarget(promptpayId)
  const merchantInfo = tlv('00', 'A000000677010111') + tlv(tag, value)
  const isDynamic = typeof amount === 'number' && amount > 0

  let payload =
    tlv('00', '01') +
    tlv('01', isDynamic ? '12' : '11') +
    tlv('29', merchantInfo) +
    tlv('53', '764')

  if (isDynamic) {
    payload += tlv('54', amount!.toFixed(2))
  }

  payload += tlv('58', 'TH')
  payload += '6304'

  return payload + crc16(payload)
}
