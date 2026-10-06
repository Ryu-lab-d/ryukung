import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHero } from '../layout/PageHero'
import { formatBaht } from '../lib/money'
import { INVOICE_RETENTION_DAYS, listInvoices, normalizeOrderCode, purgeExpiredInvoices, type InvoiceRow } from './invoiceApi'

type Row = Omit<InvoiceRow, 'snapshot'>

const PAYMENT: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'ยังไม่จ่าย', cls: 'bg-red-100 text-red-700' },
  partial: { label: 'มัดจำแล้ว', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'จ่ายครบ', cls: 'bg-green-100 text-green-700' },
}

function daysLeft(issuedAt: string) {
  return Math.max(0, INVOICE_RETENTION_DAYS - Math.floor((Date.now() - new Date(issuedAt).getTime()) / 86400000))
}

/**
 * หน้ารายการ Invoice ย้อนหลัง 30 วัน — ช่องค้นหาเลขออเดอร์เปิดโฟกัสไว้ตลอด ยิงบาร์โค้ดจากเครื่องสแกนใส่ได้เลย
 * (เครื่องสแกนพิมพ์เลขออเดอร์ตามด้วย Enter) กด Enter แล้วเจอใบเดียว → เปิดเอกสารทันที เจอหลายใบ → แสดงรายการให้เลือก
 */
export function InvoiceListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (q: string) => {
    const { invoices } = await listInvoices(q)
    setRows(invoices)
    setLoading(false)
    return invoices
  }, [])

  // เปิดหน้าครั้งแรก: ลบของที่ครบ 30 วันจริงๆ ก่อนแล้วค่อยโหลดรายการ
  useEffect(() => {
    void purgeExpiredInvoices().then(() => load(''))
  }, [load])

  // พิมพ์ค้นหาแล้วกรองทันที (หน่วงเล็กน้อยกันยิงคำสั่งทุกตัวอักษร)
  useEffect(() => {
    const t = setTimeout(() => {
      // เคลียร์ข้อความ "ไม่พบ" เฉพาะตอนผู้ใช้เริ่มพิมพ์ใหม่ (ช่องว่างที่เกิดจากการสแกนไม่พบ ต้องคงข้อความไว้ให้เห็น)
      if (search) setNotFound(null)
      void load(search)
    }, 200)
    return () => clearTimeout(t)
  }, [search, load])

  async function handleScan(e: FormEvent) {
    e.preventDefault()
    const q = normalizeOrderCode(search)
    if (!q) return
    const found = await load(q)
    const exact = found.filter((r) => r.order_no.toLowerCase() === q.toLowerCase())
    const target = exact.length === 1 ? exact[0] : found.length === 1 ? found[0] : null
    if (target) {
      navigate(`/invoices/${target.id}`)
      return
    }
    if (found.length === 0) {
      setNotFound(q)
      setSearch('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">
        <PageHero icon="📄" title="Invoice" subtitle={`เก็บย้อนหลัง ${INVOICE_RETENTION_DAYS} วัน แล้วลบอัตโนมัติ`} chips={[`${rows.length} ใบ`]} />

        <form onSubmit={(e) => void handleScan(e)} className="space-y-1.5">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg" aria-hidden="true">🔎</span>
            <input
              ref={inputRef}
              autoFocus
              value={search}
              onChange={(e) => setSearch(normalizeOrderCode(e.target.value))}
              placeholder="ยิงบาร์โค้ด หรือพิมพ์เลขออเดอร์ เช่น RYB-001296"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl border-2 border-stone-300 bg-white pl-12 pr-24 py-3.5 text-base font-mono tracking-wide shadow-sm focus:border-amber-600"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-stone-900 text-white text-sm font-semibold px-4 py-2"
            >
              เปิด
            </button>
          </div>
          <p className="text-[11px] text-stone-500 px-1">เครื่องสแกนบาร์โค้ดจะพิมพ์เลขออเดอร์ใส่ช่องนี้แล้วกด Enter ให้เอง — เจอใบเดียวจะเปิดเอกสารทันที</p>
          {notFound && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 animate-form-in">
              ไม่พบ Invoice ของออเดอร์ "{notFound}" ในช่วง {INVOICE_RETENTION_DAYS} วัน — ถ้าเป็นออเดอร์ที่ยังไม่เคยออก Invoice ให้เปิดจากปุ่ม "Invoice" ในหน้ารายละเอียดออเดอร์
            </p>
          )}
        </form>

        {loading ? (
          <div className="flex items-center justify-center gap-2.5 py-8 text-stone-400">
            <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
            กำลังโหลด...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl bg-white border border-stone-200 p-10 text-center">
            <p className="text-3xl mb-1.5">🗂️</p>
            <p className="text-sm text-stone-400">{search ? 'ไม่พบ Invoice ที่ตรงกับเลขออเดอร์นี้' : 'ยังไม่มี Invoice ใน 30 วันที่ผ่านมา — ออกได้จากปุ่ม "Invoice" ในหน้ารายละเอียดออเดอร์'}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => {
              const left = daysLeft(r.issued_at)
              const pay = PAYMENT[r.payment_status ?? ''] ?? { label: r.payment_status ?? '-', cls: 'bg-stone-100 text-stone-600' }
              return (
                <Link
                  key={r.id}
                  to={`/invoices/${r.id}`}
                  className="relative overflow-hidden flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white pl-5 pr-3.5 py-3 shadow-[0_6px_18px_-12px_rgb(51_32_14_/_0.45)]"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-stone-700 to-black" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-stone-900">{r.order_no}</p>
                    <p className="text-sm text-stone-600 truncate">{r.customer_name ?? 'ไม่มีชื่อลูกค้า'}</p>
                    <p className="text-[11px] text-stone-400">
                      ออกเมื่อ {new Date(r.issued_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      <span className={left <= 5 ? 'text-red-600 font-semibold' : ''}>ลบอัตโนมัติในอีก {left} วัน</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-bold tabular-nums text-stone-900">{formatBaht(r.grand_total)}</p>
                    <span className={'inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 ' + pay.cls}>{pay.label}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
