import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from './useProducts'
import { useCategories } from './useCategories'
import { ProductCard } from './ProductCard'
import { CatalogTabs } from './CatalogTabs'
import { PageHero } from '../layout/PageHero'

export function ProductsPage() {
  const { products, loading } = useProducts()
  const { categories } = useCategories()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(q)
      const matchesCategory = !categoryId || p.category_id === categoryId
      return matchesSearch && matchesCategory
    })
  }, [products, search, categoryId])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2.5 text-stone-400">
        <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
        กำลังโหลด...
      </div>
    )
  }

  return (
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 space-y-4 pb-8">
        <CatalogTabs active="products" />

        <PageHero icon="🍪" title="สินค้า" subtitle={`${products.length} รายการทั้งหมด`}>
          <Link to="/products/new">+ เพิ่มสินค้า</Link>
        </PageHero>

        <input
          placeholder="🔍 ค้นหาสินค้า"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' +
              (!categoryId ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
            }
          >
            ทั้งหมด
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                (categoryId === c.id ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
              }
            >
              {c.name}
            </button>
          ))}
          <Link
            to="/categories"
            className="rounded-full px-3.5 py-1.5 text-sm font-medium bg-white border border-dashed border-stone-300 text-stone-500"
          >
            ⚙️ จัดการหมวดหมู่
          </Link>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-stone-200 p-10 text-center">
            <p className="text-3xl mb-1.5">🔍</p>
            <p className="text-sm text-stone-400">ไม่พบสินค้า</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`}>
                <ProductCard product={p} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
