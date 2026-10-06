import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { InvoiceDocument } from './InvoiceDocument'
import { deleteInvoice, getInvoice, type InvoiceRow } from './invoiceApi'

/** เปิดดู Invoice ย้อนหลังจากรายการ (/invoices) — วาดจาก snapshot ที่บันทึกไว้ ใช้ได้แม้ออเดอร์ต้นทางถูกลบไปแล้ว */
export function InvoiceViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    void getInvoice(id).then(({ invoice }) => {
      setInvoice(invoice)
      setState(invoice ? 'ready' : 'missing')
    })
  }, [id])

  if (state === 'loading') {
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังโหลด...
        </div>
      </div>
    )
  }
  if (state === 'missing' || !invoice) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3">
        <p className="text-4xl">🗂️</p>
        <p className="text-sm text-stone-600">ไม่พบ Invoice ใบนี้ (อาจครบ 30 วันแล้วถูกลบอัตโนมัติ หรือถูกลบไปแล้ว)</p>
        <Link to="/invoices" className="inline-block rounded-full bg-white border border-stone-300 px-4 py-2 text-sm">← กลับรายการ Invoice</Link>
      </div>
    )
  }

  return (
    <>
      <InvoiceDocument
        snapshot={invoice.snapshot}
        invoiceNo={invoice.invoice_no}
        issuedAt={invoice.issued_at}
        backTo="/invoices"
        backLabel="← กลับรายการ Invoice"
        onDelete={() => setConfirmDelete(true)}
      />
      {confirmDelete && (
        <ConfirmDialog
          title="ลบ Invoice ใบนี้?"
          message="ลบแล้วกู้คืนไม่ได้ (ออกใหม่ได้จากหน้าออเดอร์ถ้าออเดอร์ยังอยู่)"
          confirmLabel="ลบ"
          cancelLabel="ไม่ลบ"
          onConfirm={async () => {
            await deleteInvoice(invoice.id)
            navigate('/invoices')
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
