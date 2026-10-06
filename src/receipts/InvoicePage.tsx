import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useOrder } from '../orders/useOrder'
import { useSettings } from '../settings/useSettings'
import { InvoiceDocument } from './InvoiceDocument'
import {
  buildInvoiceSnapshot,
  fetchInvoiceByOrder,
  issueInvoice,
  refreshInvoice,
  type InvoiceRow,
} from './invoiceApi'

/**
 * หน้า "ออก Invoice" ของออเดอร์หนึ่งใบ (เปิดจากปุ่ม Invoice ในหน้ารายละเอียดออเดอร์)
 * - ยังไม่เคยออก: ออกให้อัตโนมัติทันที (บันทึก snapshot + วันที่ออกเอกสารตอนนี้) แล้วโชว์เอกสาร
 * - เคยออกแล้ว (ภายใน 30 วัน): โชว์ใบเดิมพร้อมวันที่ออกเดิม มีปุ่ม "อัปเดตข้อมูลจากออเดอร์ล่าสุด" เมื่อข้อมูลเปลี่ยน (เช่นรับเงินเพิ่ม)
 */
export function InvoicePage() {
  const { id } = useParams()
  const { order, items, payments, loading } = useOrder(id ?? null)
  const { settings } = useSettings()
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const issuing = useRef(false)

  const load = useCallback(async () => {
    if (!id) return
    const { invoice: existing, error } = await fetchInvoiceByOrder(id)
    if (error) setError(error.message)
    setInvoice(existing)
    setChecked(true)
  }, [id])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!checked || invoice || loading || !order || !settings || !id || issuing.current) return
    issuing.current = true
    void issueInvoice(id, buildInvoiceSnapshot(order, items, payments, settings)).then(({ invoice: created, error }) => {
      if (error) setError(error.message)
      else setInvoice(created)
    })
  }, [checked, invoice, loading, order, settings, id, items, payments])

  async function handleRefresh() {
    if (!invoice || !order || !settings) return
    const { invoice: updated, error } = await refreshInvoice(invoice.id, buildInvoiceSnapshot(order, items, payments, settings))
    if (error) setError(error.message)
    else setInvoice(updated)
  }

  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3">
        <p className="text-sm text-red-600">ออก Invoice ไม่สำเร็จ: {error}</p>
        <Link to={`/orders/${id}`} className="inline-block rounded-full bg-white border border-stone-300 px-4 py-2 text-sm">← กลับหน้าออเดอร์</Link>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="bg-stone-50 min-h-screen">
        <div className="flex items-center justify-center gap-2.5 py-16 text-stone-400">
          <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
          กำลังเตรียม Invoice...
        </div>
      </div>
    )
  }

  return (
    <InvoiceDocument
      snapshot={invoice.snapshot}
      invoiceNo={invoice.invoice_no}
      issuedAt={invoice.issued_at}
      backTo={`/orders/${id}`}
      backLabel="← กลับหน้าออเดอร์นี้"
      onRefresh={handleRefresh}
    />
  )
}
