import { useMemo, useState } from 'react'
import { useProducts } from '../products/useProducts'
import { useCategories } from '../products/useCategories'
import { ProductCard } from '../products/ProductCard'
import { useSettings } from '../settings/useSettings'
import { formatBaht } from '../lib/money'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { playAddSound } from '../lib/uiSound'
import { CartPanel, type CartItem } from './CartPanel'
import { PaymentStep, type SaleResult } from './PaymentStep'
import { SaleComplete } from './SaleComplete'
import { TodaySalesPanel } from './TodaySalesPanel'
import { HeldSalesPanel, type HeldSale } from './HeldSalesPanel'
import { MilestoneToast } from './MilestoneToast'
import { useTodaySales } from './useTodaySales'
import { PageHero } from '../layout/PageHero'

type Step = 'cart' | 'payment' | 'complete'

const CART_DRAFT_KEY = 'pos-cart'
const HELD_DRAFT_KEY = 'pos-held-sales'

export function POSPage() {
  const { products } = useProducts()
  const { categories } = useCategories()
  const { settings } = useSettings()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  // กันตะกร้าหายตอนสลับแท็บ/แอปแล้วกลับมา — บันทึกลง localStorage ทุกครั้งที่เปลี่ยน เหมือนฟอร์มอื่นๆ ในระบบ
  const [items, setItems] = useState<CartItem[]>(() => loadFormDraft<CartItem[]>(CART_DRAFT_KEY) ?? [])
  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => loadFormDraft<HeldSale[]>(HELD_DRAFT_KEY) ?? [])
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('cart')
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null)
  const [completedTotal, setCompletedTotal] = useState(0)
  const [milestoneCount, setMilestoneCount] = useState<number | null>(null)
  const { sales: todaySales, loading: todaySalesLoading, reload: reloadTodaySales } = useTodaySales()

  useFormDraft(CART_DRAFT_KEY, items)
  useFormDraft(HELD_DRAFT_KEY, heldSales)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.is_active && p.name.toLowerCase().includes(q) && (!categoryId || p.category_id === categoryId)
    )
  }, [products, search, categoryId])

  function addProduct(p: (typeof products)[number]) {
    // เล่นเสียงเป็นบรรทัดแรกสุดเสมอ ก่อน setState ใดๆ — iOS Safari ต้องมี user gesture อยู่ใน call stack
    // เดียวกันตอนสร้าง AudioContext ครั้งแรก ไม่งั้นจะโดนบล็อกเสียงเงียบๆ (บทเรียนเดียวกับ speakThai.ts)
    playAddSound()
    setJustAddedId(p.id)
    setTimeout(() => setJustAddedId((cur) => (cur === p.id ? null : cur)), 300)

    const existingIndex = items.findIndex((it) => it.product_id === p.id)
    if (existingIndex >= 0) {
      setItems((rows) => rows.map((r, i) => (i === existingIndex ? { ...r, qty: r.qty + 1 } : r)))
      return
    }
    setItems((rows) => [...rows, { product_id: p.id, product_name: p.name, unit_price: p.price, unit_cost: p.cost, qty: 1 }])
  }

  function holdSale() {
    if (items.length === 0) return
    setHeldSales((rows) => [{ id: crypto.randomUUID(), items, heldAt: new Date().toISOString() }, ...rows])
    setItems([])
  }

  function resumeSale(id: string) {
    if (items.length > 0) return
    const held = heldSales.find((h) => h.id === id)
    if (!held) return
    setItems(held.items)
    setHeldSales((rows) => rows.filter((h) => h.id !== id))
  }

  function discardHeldSale(id: string) {
    setHeldSales((rows) => rows.filter((h) => h.id !== id))
  }

  function updateQty(index: number, qty: number) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, qty } : r)))
  }

  function updatePrice(index: number, price: number) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, unit_price: price } : r)))
  }

  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index))
  }

  function handleComplete(result: SaleResult) {
    // ขายสำเร็จแล้ว เคลียร์ร่างตะกร้าที่บันทึกไว้ทันที กันไม่ให้ค้างเป็นของเก่าถ้าแอปถูกปิด/รีโหลดก่อนกด
    // "ขายรายการต่อไป" (ไม่งั้นจะดูเหมือนของที่ขายไปแล้วยังค้างอยู่ในตะกร้าตอนเปิดแอปกลับมา)
    clearFormDraft(CART_DRAFT_KEY)
    setCompletedTotal(items.reduce((sum, it) => sum + it.unit_price * it.qty, 0))
    setSaleResult(result)
    setStep('complete')
    void reloadTodaySales().then((rows) => {
      if (rows.length > 0 && rows.length % 5 === 0) setMilestoneCount(rows.length)
    })
  }

  function handleNextSale() {
    setItems([])
    setSaleResult(null)
    setStep('cart')
  }

  if (step === 'payment') {
    return (
      <div className="bg-stone-50 min-h-screen p-4">
        <div className="max-w-md mx-auto">
          <PaymentStep items={items} settings={settings} onBack={() => setStep('cart')} onComplete={handleComplete} />
        </div>
      </div>
    )
  }

  if (step === 'complete' && saleResult) {
    return (
      <div className="bg-stone-50 min-h-screen p-4">
        <div className="max-w-md mx-auto">
          <SaleComplete result={saleResult} grandTotal={completedTotal} onNextSale={handleNextSale} />
          {milestoneCount !== null && (
            <MilestoneToast count={milestoneCount} onDone={() => setMilestoneCount(null)} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 max-w-5xl mx-auto pb-8">
        <PageHero icon="🛒" title="ขายหน้าร้าน" subtitle="ลูกค้าเดินเข้ามาซื้อ ไม่ต้องกรอกข้อมูลลูกค้า เลือกสินค้าแล้วรับเงินได้เลย" />

        <TodaySalesPanel sales={todaySales} loading={todaySalesLoading} />
        <HeldSalesPanel
          heldSales={heldSales}
          canResume={items.length === 0}
          onResume={resumeSale}
          onDiscard={discardHeldSale}
        />

        <div className="lg:grid lg:grid-cols-[1fr,380px] lg:gap-4 lg:items-start">
          <div className="space-y-3">
            <input
              placeholder="🔍 ค้นหาสินค้า"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryId(null)}
                className={'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' + (!categoryId ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')}
              >
                ทั้งหมด
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' + (categoryId === c.id ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
                <p className="text-3xl mb-1.5">🔍</p>
                <p className="text-sm text-stone-400">ไม่พบสินค้าที่ค้นหา</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-32 lg:pb-0">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className={'text-left rounded-xl ' + (p.id === justAddedId ? 'animate-cart-bump' : '')}
                  >
                    <ProductCard product={p} mode="picker" qtyInCart={items.find((it) => it.product_id === p.id)?.qty ?? 0} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* จอกว้าง: ตะกร้าลอยอยู่ขวามือระหว่างเลือกสินค้า / มือถือ: เรียงไว้ใต้ตัวเลือกสินค้า */}
          <div className="mt-4 lg:mt-0">
            <CartPanel
              items={items}
              onUpdateQty={updateQty}
              onUpdatePrice={updatePrice}
              onRemove={removeItem}
              onCheckout={() => setStep('payment')}
              onHold={holdSale}
            />
          </div>
        </div>

        {/* แถบสรุปยอดลอยด้านล่าง เฉพาะจอแคบ — กันต้องเลื่อนหาปุ่มชำระเงินตอนตะกร้าอยู่ใต้รายการสินค้ายาวๆ */}
        {items.length > 0 && (
          <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-amber-200 p-3 shadow-[0_-10px_28px_-12px_rgb(51_32_14_/_0.45)] animate-form-in">
            <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
              <div>
                <p className="text-xs text-stone-500">ยอดรวม ({items.length} รายการ)</p>
                <p className="text-xl font-bold text-stone-900 tabular-nums">
                  {formatBaht(items.reduce((sum, it) => sum + it.unit_price * it.qty, 0))} บาท
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('payment')}
                className="btn-shimmer rounded-full bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold px-7 py-3 shadow-[0_12px_24px_-10px_rgb(5_122_85_/_0.8)] active:scale-95"
              >
                ชำระเงิน
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
