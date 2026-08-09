import { useEffect, useRef, useState } from 'react'

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}

export function ShareOrderButton({ shopName, orderNo }: { shopName: string; orderNo: string }) {
  const [copied, setCopied] = useState(false)
  const [manualUrl, setManualUrl] = useState<string | null>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (manualUrl) manualInputRef.current?.select()
  }, [manualUrl])

  async function handleClick() {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title: `${shopName} - ออเดอร์ ${orderNo}`, url })
        return
      } catch (err) {
        // ผู้ใช้กดยกเลิก sheet เอง ไม่ถือเป็นข้อผิดพลาด ไม่ต้องทำอะไรต่อ — แต่ถ้า share ใช้ไม่ได้จริงๆ
        // (เช่นเบราว์เซอร์ในแอป LINE บางเวอร์ชันมี navigator.share แต่เรียกแล้ว reject เสมอ) ต้องมีทางสำรอง
        // ไม่งั้นปุ่มจะดูเหมือนกดไม่ติดไปเลยเพราะไม่มีอะไรเกิดขึ้นให้เห็น
        if ((err as { name?: string } | null)?.name === 'AbortError') return
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard API ไม่มีในเบราว์เซอร์นี้')
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    } catch {
      // เบราว์เซอร์ในแอป (LINE, Facebook ฯลฯ) มักบล็อก Clipboard API รุ่นใหม่ ลองวิธีเก่าที่ยังใช้ได้แทบทุกที่
    }

    if (legacyCopy(url)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      return
    }

    // คัดลอกอัตโนมัติไม่ได้เลยสักทาง โชว์ลิงก์ให้กดเลือกคัดลอกเอง กันปุ่มดูเหมือนไม่ทำงาน
    setManualUrl(url)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 text-stone-700 font-medium py-2.5 text-sm"
      >
        {copied ? '✅ คัดลอกลิงก์แล้ว' : '🔗 แชร์ออเดอร์นี้'}
      </button>

      {manualUrl && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50" onClick={() => setManualUrl(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-stone-900">คัดลอกอัตโนมัติไม่ได้ กดเลือกข้อความแล้วคัดลอกเองได้เลย</p>
            <input
              ref={manualInputRef}
              readOnly
              value={manualUrl}
              onFocus={(e) => e.target.select()}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={() => setManualUrl(null)} className="w-full rounded-lg bg-stone-900 text-white py-2.5 font-medium">
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  )
}
