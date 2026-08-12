import { Link } from 'react-router-dom'

/** แท็บสลับระหว่างหน้า "สินค้า" กับ "วัตถุดิบ" ใช้ร่วมกันทั้งสองหน้า แทนการเพิ่มเมนูล่างช่องใหม่ (เมนูล่างมือถือแน่นอยู่แล้ว) */
export function CatalogTabs({ active }: { active: 'products' | 'ingredients' }) {
  return (
    <div className="inline-flex rounded-full bg-stone-100 p-1 gap-1">
      <Link
        to="/products"
        className={'rounded-full px-3.5 py-1.5 text-sm font-medium ' + (active === 'products' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600')}
      >
        🍪 สินค้า
      </Link>
      <Link
        to="/ingredients"
        className={'rounded-full px-3.5 py-1.5 text-sm font-medium ' + (active === 'ingredients' ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-600')}
      >
        🧂 วัตถุดิบ
      </Link>
    </div>
  )
}
