import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { InvoiceDocument } from './InvoiceDocument'
import { fetchPublicInvoice, type InvoiceSnapshot } from './invoiceApi'

/** หน้า Invoice สำหรับลูกค้า (/inv/:token) — เปิดจากลิงก์ที่ร้านส่งให้ ไม่ต้องล็อกอิน พิมพ์หรือบันทึกเป็นรูปได้ ใช้ได้ 30 วันนับจากวันที่ออก */
export function InvoicePublicPage() {
  const { token } = useParams()
  const [doc, setDoc] = useState<{ invoice_no: string; issued_at: string; snapshot: InvoiceSnapshot } | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!token) return
    void fetchPublicInvoice(token).then((d) => {
      setDoc(d)
      setState(d ? 'ready' : 'missing')
    })
  }, [token])

  if (state === 'loading') {
    return (
      <div className="bg-stone-50 min-h-screen font-warm">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด Invoice...
        </div>
      </div>
    )
  }
  if (state === 'missing' || !doc) {
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
  return <InvoiceDocument snapshot={doc.snapshot} invoiceNo={doc.invoice_no} issuedAt={doc.issued_at} publicView />
}
