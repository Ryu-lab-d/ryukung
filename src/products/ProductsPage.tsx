import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from './useProducts'
import { useCategories } from './useCategories'
import { ProductCard } from './ProductCard'
import { CatalogTabs } from './CatalogTabs'

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

  if (loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-4">
      <CatalogTabs active="products" />

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">สินค้า</h1>
        <Link to="/products/new" className="rounded-lg bg-stone-900 text-white text-sm px-3 py-2">
          + เพิ่มสินค้า
        </Link>
      </div>

      <input
        placeholder="ค้นหาสินค้า"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryId(null)}
          className={
            'rounded-full px-3 py-1.5 text-sm ' +
            (!categoryId ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700')
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
              'rounded-full px-3 py-1.5 text-sm ' +
              (categoryId === c.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700')
            }
          >
            {c.name}
          </button>
        ))}
        <Link to="/categories" className="rounded-full px-3 py-1.5 text-sm text-stone-500 underline">
          จัดการหมวดหมู่
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((p) => (
          <Link key={p.id} to={`/products/${p.id}`}>
            <ProductCard product={p} />
          </Link>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-sm text-stone-400">ไม่พบสินค้า</p>}
    </div>
  )
}
