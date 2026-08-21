import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useSettings } from '../settings/useSettings'
import { Toast } from '../lib/Toast'

const SESSION_KEY = 'ryukung-welcomed'

/** ทักทายต้อนรับตอนเข้าเว็บ — โผล่แค่ครั้งเดียวต่อการเปิดแท็บ/หน้าต่างนี้ (sessionStorage) ไม่โผล่ซ้ำตอนสลับหน้าไปมาในแอป */
export function WelcomeToast() {
  const { staffStatus } = useAuth()
  const { settings } = useSettings()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!staffStatus || !settings) return
    let alreadyShown = false
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {
      alreadyShown = false
    }
    if (alreadyShown) return
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // เข้าถึง sessionStorage ไม่ได้ (เช่น โหมดส่วนตัวบางเบราว์เซอร์) — ยอมให้โผล่ทุกครั้งแทน ไม่ใช่เรื่องใหญ่
    }
    setShow(true)
  }, [staffStatus, settings])

  if (!show || !staffStatus || !settings) return null

  const name = staffStatus.displayName?.trim() || null
  const message = name
    ? `ยินดีต้อนรับคุณ ${name} เข้าสู่ ${settings.shop_name} 🧁 ขอให้มีความสุขกับการทำงานวันนี้นะคะ`
    : `ยินดีต้อนรับเข้าสู่ ${settings.shop_name} 🧁 ขอให้มีความสุขกับการทำงานวันนี้นะคะ`

  return <Toast variant="success" message={message} durationMs={3200} onDone={() => setShow(false)} />
}
