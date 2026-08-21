import { formatBaht } from '../lib/money'

export type CartItem = {
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty: number
}

export function CartPanel({
  items,
  onUpdateQty,
  onUpdatePrice,
  onRemove,
  onCheckout,
}: {
  items: CartItem[]
  onUpdateQty: (index: number, qty: number) => void
  onUpdatePrice: (index: number, price: number) => void
  onRemove: (index: number) => void
  onCheckout: () => void
}) {
  const grandTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-3 lg:sticky lg:top-4 lg:self-start">
      <h2 className="text-sm font-semibold">ตะกร้า</h2>
      {items.length === 0 ? (
        <p className="text-sm text-stone-400">ยังไม่ได้เลือกสินค้า</p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-stone-200 px-3 py-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{it.product_name}</p>
                <button type="button" onClick={() => onRemove(i)} className="text-red-600 text-sm shrink-0">
                  ลบ
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(i, Math.max(1, it.qty - 1))}
                    aria-label={`ลดจำนวน ${it.product_name}`}
                    className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 font-semibold grid place-items-center shrink-0"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums">{it.qty}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(i, it.qty + 1)}
                    aria-label={`เพิ่มจำนวน ${it.product_name}`}
                    className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 font-semibold grid place-items-center shrink-0"
                  >
                    +
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <label htmlFor={`cart-price-${i}`} className="sr-only">ราคาต่อชิ้น</label>
                  <input
                    id={`cart-price-${i}`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={it.unit_price}
                    onChange={(e) => onUpdatePrice(i, Number(e.target.value))}
                    className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-right"
                  />
                  <span className="text-xs text-stone-400">บาท</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-stone-200 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">ยอดรวม</span>
          <span className="text-xl font-bold text-stone-900">{formatBaht(grandTotal)} บาท</span>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-40"
        >
          ไปหน้าชำระเงิน →
        </button>
      </div>
    </div>
  )
}
