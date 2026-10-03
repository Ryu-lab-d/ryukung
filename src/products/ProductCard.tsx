import { supabase } from '../lib/supabase'
import { formatBaht, toNumber } from '../lib/money'
import type { Product } from './useProducts'

export function productImageUrl(path: string): string {
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

type ProductCardProps = {
  product: Product
  mode?: 'catalog' | 'picker'
  /** จำนวนที่อยู่ในตะกร้าตอนนี้ (โหมด picker ของหน้าขายหน้าร้าน) — โชว์เป็นป้ายมุมรูปให้เห็นว่าเลือกไปแล้วกี่ชิ้น */
  qtyInCart?: number
}

export function ProductCard({ product, mode = 'catalog', qtyInCart = 0 }: ProductCardProps) {
  const margin = toNumber(product.price) - toNumber(product.cost)
  return (
    <div
      className={
        'glow-card relative rounded-2xl border bg-white overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_-14px_rgb(51_32_14_/_0.5)] ' +
        (qtyInCart > 0
          ? 'border-amber-500 ring-2 ring-amber-300/50 shadow-[0_10px_22px_-12px_rgb(193_130_61_/_0.8)]'
          : 'border-stone-200 shadow-[0_6px_16px_-12px_rgb(51_32_14_/_0.5)]')
      }
    >
      <div className="relative aspect-square bg-stone-100 grid place-items-center text-stone-300 text-xs">
        {mode === 'picker' && (
          <>
            <span className="absolute left-2 bottom-2 z-10 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-stone-900 shadow-md" aria-hidden="true">
              ฿{formatBaht(product.price)}
            </span>
            <span className="absolute right-2 bottom-2 z-10 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white text-xl leading-none grid place-items-center shadow-md" aria-hidden="true">
              +
            </span>
            {qtyInCart > 0 && (
              <span
                key={qtyInCart}
                className="absolute top-2 right-2 z-10 min-w-7 h-7 px-1.5 rounded-full bg-stone-900 text-amber-300 ring-2 ring-white text-sm font-bold grid place-items-center shadow-md animate-qty-pop"
                role="img"
                aria-label={`ในตะกร้า ${qtyInCart} ชิ้น`}
              >
                <span aria-hidden="true">×{qtyInCart}</span>
              </span>
            )}
          </>
        )}
        {product.image_path ? (
          <img src={productImageUrl(product.image_path)} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          'ไม่มีรูป'
        )}
      </div>
      <div className="p-2.5 space-y-0.5">
        <p className="text-sm font-medium truncate text-stone-900">{product.name}</p>
        <p className="text-sm font-semibold text-stone-900">{formatBaht(product.price)}</p>
        {mode === 'catalog' && (
          <>
            <p className="text-xs text-stone-500">ต้นทุน {formatBaht(product.cost)} · กำไร {formatBaht(margin)}</p>
            {!product.is_active && (
              <span className="inline-block text-xs font-medium rounded-full bg-stone-200 text-stone-600 px-2 py-0.5">
                ปิดขาย
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
