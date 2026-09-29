import { supabase } from '../lib/supabase'
import { formatBaht, toNumber } from '../lib/money'
import type { Product } from './useProducts'

export function productImageUrl(path: string): string {
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

type ProductCardProps = {
  product: Product
  mode?: 'catalog' | 'picker'
}

export function ProductCard({ product, mode = 'catalog' }: ProductCardProps) {
  const margin = toNumber(product.price) - toNumber(product.cost)
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_6px_-2px_rgb(0_0_0_/_0.08)] transition-shadow hover:shadow-[0_2px_4px_rgb(0_0_0_/_0.06),0_4px_12px_-2px_rgb(0_0_0_/_0.12)]">
      <div className="aspect-square bg-stone-100 grid place-items-center text-stone-300 text-xs">
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
