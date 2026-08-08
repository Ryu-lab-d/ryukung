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
    <button type="button" onClick={handleCopy} className="text-sm text-stone-600 underline">
      {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์สรุปให้ลูกค้า'}
    </button>
  )
}
