/** ตัวช่วยส่งออกไฟล์ CSV ที่ Excel เปิดภาษาไทยได้ถูกต้อง (ใส่ BOM นำหน้า) */
function escapeCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const blob = new Blob(['﻿' + toCsv(header, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
