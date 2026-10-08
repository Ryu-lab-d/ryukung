/** ลิงก์ที่ผู้ใช้/พนักงานกรอกเอง ใช้เป็น href ได้เฉพาะ http(s) — กัน javascript:/data: */
export function safeHttpUrl(url: string | null | undefined): string | null {
  const u = (url ?? '').trim()
  return /^https?:\/\//i.test(u) ? u : null
}
