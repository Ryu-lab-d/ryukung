import { useState } from 'react'

export function ShareOrderButton({ shopName, orderNo }: { shopName: string; orderNo: string }) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    const url = window.location.href
    // มือถือส่วนใหญ่รองรับ navigator.share (เปิด sheet เลือกแอปแชร์ เช่น LINE ให้เลย) ดีกว่าคัดลอกอย่างเดียว
    if (navigator.share) {
      try {
        await navigator.share({ title: `${shopName} - ออเดอร์ ${orderNo}`, url })
      } catch {
        // ผู้ใช้กดยกเลิก sheet เอง ไม่ถือเป็นข้อผิดพลาด ไม่ต้องทำอะไรต่อ
      }
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 text-stone-700 font-medium py-2.5 text-sm"
    >
      {copied ? '✅ คัดลอกลิงก์แล้ว' : '🔗 แชร์ออเดอร์นี้'}
    </button>
  )
}
