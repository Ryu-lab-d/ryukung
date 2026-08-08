import { useState } from 'react'

export function CopyPublicLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/o/${token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold shadow-sm ' +
        (copied ? 'bg-green-600 text-white' : 'bg-stone-900 text-white')
      }
    >
      <span aria-hidden="true">{copied ? '✅' : '🔗'}</span>
      {copied ? 'คัดลอกลิงก์แล้ว!' : 'คัดลอกลิงก์สรุปส่งให้ลูกค้า'}
    </button>
  )
}
