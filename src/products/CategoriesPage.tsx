import { useState, type FormEvent } from 'react'
import { useCategories } from './useCategories'

export function CategoriesPage() {
  const { categories, save } = useCategories()
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const { error } = await save(null, { name: newName.trim(), sort_order: categories.length })
    if (error) { setError(error.message); return }
    setNewName('')
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = categories.findIndex((c) => c.id === id)
    const swapWith = categories[idx + direction]
    if (!swapWith) return
    const current = categories[idx]
    await save(current.id, { sort_order: swapWith.sort_order })
    await save(swapWith.id, { sort_order: current.sort_order })
  }

  return (
    <div className="p-4 max-w-md space-y-4">
      <h1 className="text-lg font-semibold">หมวดหมู่สินค้า</h1>

      <ul className="space-y-2">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1 rounded-lg border border-stone-200 pl-3 pr-1 py-1">
            <span className="flex-1 text-sm">{c.name}</span>
            {!c.is_active && <span className="text-xs text-stone-400">ปิดใช้งาน</span>}
            <button type="button" onClick={() => move(c.id, -1)} disabled={i === 0} className="text-stone-500 disabled:opacity-30 w-11 h-11 grid place-items-center text-lg">↑</button>
            <button type="button" onClick={() => move(c.id, 1)} disabled={i === categories.length - 1} className="text-stone-500 disabled:opacity-30 w-11 h-11 grid place-items-center text-lg">↓</button>
            <button type="button" onClick={() => save(c.id, { is_active: !c.is_active })} className="text-xs text-stone-500 underline px-2 py-2">
              {c.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ชื่อหมวดหมู่ใหม่"
          className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-stone-900 text-white px-4 py-2 text-sm">เพิ่ม</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
