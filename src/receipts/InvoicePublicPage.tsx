import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { InvoiceDocument } from './InvoiceDocument'
import { fetchPublicInvoice, type PublicInvoiceResult } from './invoiceApi'

/**
 * หน้า Invoice สำหรับลูกค้า (/inv/:token) — เปิดจากลิงก์ที่ร้านส่งให้ ไม่ต้องล็อกอิน ใช้ได้ 30 วันนับจากวันที่ออก
 * ต้องกรอกชื่อหรือเบอร์โทรที่ใช้สั่งซื้อให้ตรงก่อน — เซิร์ฟเวอร์เป็นคนตรวจ (ไม่ส่งข้อมูลลูกค้าเลยจนกว่าจะตรง) พิมพ์หรือบันทึกเป็นรูปได้หลังเปิดแล้ว
 */
export function InvoicePublicPage() {
  const { token } = useParams()
  const [result, setResult] = useState<PublicInvoiceResult | null | undefined>(undefined)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    void fetchPublicInvoice(token).then(setResult)
  }, [token])

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    const typed = input.trim()
    if (!typed || !token || busy) return
    setBusy(true)
    setError(null)
    const res = await fetchPublicInvoice(token, typed)
    setBusy(false)
    if (res && !res.locked) return setResult(res)
    setError(
      res?.reason === 'locked_out'
        ? 'ลองหลายครั้งเกินไป กรุณารอ 1 ชั่วโมงหรือติดต่อร้าน'
        : res?.reason === 'no_identity'
          ? 'Invoice นี้ไม่มีชื่อหรือเบอร์ลูกค้าผูกไว้ ไม่สามารถยืนยันตัวตนได้ กรุณาติดต่อร้าน'
          : 'ชื่อ/เบอร์ไม่ตรงกับที่แจ้งไว้ตอนสั่งซื้อ กรุณาลองใหม่'
    )
  }

  if (result === undefined) {
    return (
      <div className="bg-stone-50 min-h-screen font-warm">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด Invoice...
        </div>
      </div>
    )
  }
  if (result === null) {
    return (
      <div className="bg-stone-50 min-h-screen font-warm grid place-items-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-5xl">🗂️</p>
          <p className="font-display font-semibold text-stone-800">ไม่พบ Invoice นี้</p>
          <p className="text-sm text-stone-500">ลิงก์อาจไม่ถูกต้อง หรือเอกสารมีอายุเกิน 30 วันแล้วจึงถูกลบอัตโนมัติ — ติดต่อร้านเพื่อขอ Invoice ใหม่ได้ค่ะ</p>
        </div>
      </div>
    )
  }
  if (result.locked) {
    return (
      <div className="bg-stone-50 min-h-screen font-warm grid place-items-center p-4">
        <form onSubmit={(e) => void handleVerify(e)} className="w-full max-w-sm rounded-3xl bg-white border border-amber-200 shadow-xl p-6 space-y-4 text-center">
          <p className="text-4xl" aria-hidden="true">🔒</p>
          <h1 className="font-display text-xl font-bold text-stone-900">ยืนยันตัวตนเพื่อเปิด Invoice</h1>
          <p className="text-xs font-mono rounded-full bg-stone-50 border border-stone-200 inline-block px-3 py-1 text-stone-500">{result.invoice_no}</p>
          <p className="text-sm text-stone-500">กรอกชื่อผู้สั่งซื้อหรือเบอร์โทรศัพท์ให้ตรงกับที่แจ้งไว้ตอนสั่ง เพื่อปกป้องข้อมูลของคุณ</p>
          <input
            autoFocus
            value={input}
            onChange={(e) => { setInput(e.target.value); if (error) setError(null) }}
            placeholder="ชื่อผู้สั่งซื้อ หรือเบอร์โทรศัพท์"
            aria-label="ชื่อหรือเบอร์โทรศัพท์"
            autoComplete="off"
            className="w-full rounded-2xl border-2 border-stone-200 px-3 py-3 text-center focus:outline-none focus:border-amber-500"
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={!input.trim() || busy} className="w-full rounded-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40">
            {busy ? 'กำลังตรวจสอบ...' : 'เปิดดู Invoice'}
          </button>
        </form>
      </div>
    )
  }
  return <InvoiceDocument snapshot={result.snapshot!} invoiceNo={result.invoice_no} issuedAt={result.issued_at!} publicView />
}
