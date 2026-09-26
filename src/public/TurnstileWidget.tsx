import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let scriptLoadPromise: Promise<void> | null = null

/** โหลดสคริปต์ Cloudflare Turnstile ครั้งเดียวทั้งแอป (ไม่ว่า widget จะถูก mount กี่รอบก็ตาม) */
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('โหลดระบบยืนยันตัวตนไม่สำเร็จ'))
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

/**
 * ป้ายยืนยัน "ไม่ใช่บอท" ของ Cloudflare Turnstile — โหมด managed (เจ้าของร้านตั้งไว้ตอนสร้าง widget) ทำให้
 * ลูกค้าจริงส่วนใหญ่ผ่านอัตโนมัติไม่ต้องกดอะไรเลย โผล่กล่องกาเครื่องหมายให้กดเฉพาะเคสที่เสี่ยงเท่านั้น
 * ต้องได้ token จาก onToken ก่อนถึงจะกด "ไปหน้าชำระเงิน" ได้ (ดู Step1 ในฟอร์ม checkout ของ CustomerOrderPage)
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        })
      })
      .catch(() => onToken(null))

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="flex justify-center" />
}
