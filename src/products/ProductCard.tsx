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
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="aspect-square bg-stone-100 grid place-items-center text-stone-300 text-xs">
        {product.image_path ? (
          <img src={productImageUrl(product.image_path)} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          'ไม่มีรูป'
        )}
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-sm font-medium truncate">{product.name}</p>
        <p className="text-sm text-stone-900">{formatBaht(product.price)}</p>
        {mode === 'catalog' && (
          <>
            <p className="text-xs text-stone-500">ต้นทุน {formatBaht(product.cost)} · กำไร {formatBaht(margin)}</p>
            {!product.is_active && (
              <span className="inline-block text-xs rounded-full bg-stone-200 text-stone-600 px-2 py-0.5">
                ปิดขาย
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
