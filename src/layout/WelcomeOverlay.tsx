import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useSettings } from '../settings/useSettings'
import { productImageUrl } from '../products/ProductCard'
import { StartWorkOverlay } from './StartWorkOverlay'

const SESSION_KEY = 'ryukung-welcomed'

/** ป็อปอัพต้อนรับตอนเข้าเว็บ — โผล่แค่ครั้งเดียวต่อการเปิดแท็บ/หน้าต่างนี้ (sessionStorage) ไม่โผล่ซ้ำตอนสลับหน้าไปมาในแอป */
export function WelcomeOverlay() {
  const { staffStatus } = useAuth()
  const { settings } = useSettings()
  const [show, setShow] = useState(false)
  const [started, setStarted] = useState(false)

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

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 6000)
    return () => clearTimeout(t)
  }, [show])

  if (!show || !staffStatus || !settings) return null

  const name = staffStatus.displayName?.trim() || null

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4 animate-overlay-fade">
      <div className="relative bg-white rounded-3xl p-8 text-center space-y-3 max-w-sm w-full shadow-xl animate-toast-pop overflow-hidden">
        {started ? (
          <StartWorkOverlay onDone={() => setShow(false)} />
        ) : (
          <>
            {settings.logo_path ? (
              <img
                src={productImageUrl(settings.logo_path)}
                alt=""
                className="w-20 h-20 rounded-full object-cover mx-auto border border-stone-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-stone-100 mx-auto grid place-items-center text-3xl" aria-hidden="true">
                🧁
              </div>
            )}
            <div>
              <p className="text-xs text-stone-400 tracking-wide">ยินดีต้อนรับ{name ? `คุณ ${name}` : ''}</p>
              <p className="text-2xl font-bold text-stone-900">{settings.shop_name}</p>
            </div>
            <p className="text-sm text-stone-500">ขอให้มีความสุขกับการทำงานวันนี้นะคะ 💛</p>

            {(settings.promptpay || settings.phone) && (
              <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-3 text-sm text-stone-600 space-y-1 text-left">
                {settings.promptpay && <p>💳 พร้อมเพย์: {settings.promptpay}</p>}
                {settings.phone && <p>📞 {settings.phone}</p>}
              </div>
            )}

            <button
              type="button"
              onClick={() => setStarted(true)}
              className="w-full rounded-lg bg-stone-900 text-white font-medium py-2.5 mt-2"
            >
              เริ่มทำงานเลย 🚀
            </button>
          </>
        )}
      </div>
    </div>
  )
}
