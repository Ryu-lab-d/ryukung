import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHero } from '../layout/PageHero'
import { formatBaht } from '../lib/money'
import { playScanBeep } from '../lib/uiSound'
import { ScanOverlay } from '../lib/ScanOverlay'
import { downloadCsv } from '../lib/csv'
import { INVOICE_RETENTION_DAYS, listInvoices, normalizeOrderCode, purgeExpiredInvoices, type InvoiceRow } from './invoiceApi'

type Row = Omit<InvoiceRow, 'snapshot'>

// หน้าตาของเลขออเดอร์ที่ "ครบแล้ว" (เช่น RYB-001296) — ใช้ตัดสินว่าเครื่องสแกนยิงเสร็จแล้วแม้ไม่ส่ง Enter มา
const ORDER_CODE_RE = /^[A-Z]{2,6}-\d{4,}$/

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
  const [launching, setLaunching] = useState<Row | null>(null)
  const launchingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // เจอใบที่ตรงแล้ว: เล่นเสียง+อนิเมชันสแกนสำเร็จ แล้วเปิดเอกสารต่อให้เอง (ครั้งเดียว กันสแกนซ้ำระหว่างรอ)
  const launch = useCallback(
    (row: Row) => {
      if (launchingRef.current) return
      launchingRef.current = true
      playScanBeep()
      setLaunching(row)
      setTimeout(() => navigate(`/invoices/${row.id}`), 1300)
    },
    [navigate]
  )

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
      void load(search).then((found) => {
        const code = normalizeOrderCode(search)
        if (!code || launchingRef.current) return
        // เลขครบรูปแบบแล้ว (เครื่องสแกนยิงเสร็จ แม้ไม่ส่ง Enter): เจอ → เปิดเลย / ไม่เจอ → แจ้งแล้วเคลียร์ช่องรอสแกนใบถัดไป
        const exact = found.find((r) => r.order_no.toUpperCase() === code)
        if (exact) launch(exact)
        else if (found.length === 0 && ORDER_CODE_RE.test(code)) {
          setNotFound(code)
          setSearch('')
          inputRef.current?.focus()
        }
      })
    }, 350)
    return () => clearTimeout(t)
  }, [search, load, launch])

  async function handleScan(e: FormEvent) {
    e.preventDefault()
    const q = normalizeOrderCode(search)
    if (!q) return
    const found = await load(q)
    const exact = found.filter((r) => r.order_no.toLowerCase() === q.toLowerCase())
    const target = exact.length === 1 ? exact[0] : found.length === 1 ? found[0] : null
    if (target) {
      launch(target)
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
      {launching && (
        <ScanOverlay
          orderNo={launching.order_no}
          line1={`${launching.customer_name ?? 'ไม่มีชื่อลูกค้า'} · ${formatBaht(launching.grand_total)} บาท`}
          caption="กำลังเปิด Invoice..."
        />
      )}
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">
        <PageHero icon="📄" title="Invoice" subtitle={`เก็บย้อนหลัง ${INVOICE_RETENTION_DAYS} วัน แล้วลบอัตโนมัติ`} chips={[`${rows.length} ใบ`]} />

        <div className="flex justify-end">
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `invoices-${new Date().toISOString().slice(0, 10)}.csv`,
                ['เลขที่ Invoice', 'เลขที่ออเดอร์', 'ลูกค้า', 'ยอดรวม', 'สถานะชำระเงิน', 'วันที่ออกเอกสาร'],
                rows.map((r) => [r.invoice_no, r.order_no, r.customer_name ?? '', r.grand_total, PAYMENT[r.payment_status ?? '']?.label ?? r.payment_status ?? '', new Date(r.issued_at).toLocaleString('th-TH')])
              )
            }
            className="rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-semibold px-4 py-2 shadow-sm disabled:opacity-50"
          >
            ⬇️ ส่งออก CSV ({rows.length} ใบ)
          </button>
        </div>

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
          <p className="text-[11px] text-stone-500 px-1">ยิงบาร์โค้ดใส่ช่องนี้ได้เลย ไม่ต้องกดอะไรเพิ่ม — เจอแล้วระบบเล่นอนิเมชัน "สแกนสำเร็จ" และเปิด Invoice ให้เอง (พิมพ์เลขออเดอร์เองก็ได้)</p>
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
