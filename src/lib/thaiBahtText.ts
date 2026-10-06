const DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
const PLACES = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']

/** อ่านเลขจำนวนเต็มไม่เกินหลักแสน (< 1,000,000) เป็นคำไทย */
function readBelowMillion(n: number): string {
  const s = String(n)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i])
    const place = s.length - i - 1
    if (d === 0) continue
    if (place === 0) {
      // หลักหน่วย: 1 ที่ตามหลักสิบขึ้นไปอ่านว่า "เอ็ด"
      out += d === 1 && s.length > 1 ? 'เอ็ด' : DIGITS[d]
    } else if (place === 1) {
      out += d === 1 ? 'สิบ' : d === 2 ? 'ยี่สิบ' : DIGITS[d] + 'สิบ'
    } else {
      out += DIGITS[d] + PLACES[place]
    }
  }
  return out
}

function readInteger(n: number): string {
  if (n === 0) return DIGITS[0]
  if (n >= 1_000_000) {
    const high = Math.floor(n / 1_000_000)
    const low = n % 1_000_000
    return readInteger(high) + 'ล้าน' + (low > 0 ? readBelowMillion(low) : '')
  }
  return readBelowMillion(n)
}

/** แปลงจำนวนเงินเป็นตัวอักษรไทย เช่น 125.5 → "หนึ่งร้อยยี่สิบห้าบาทห้าสิบสตางค์" (ใช้ในเอกสาร Invoice) */
export function thaiBahtText(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100)
  const baht = Math.floor(rounded / 100)
  const satang = rounded % 100
  const bahtText = readInteger(baht) + 'บาท'
  return satang === 0 ? bahtText + 'ถ้วน' : bahtText + readInteger(satang) + 'สตางค์'
}
