import { useState, type FormEvent } from 'react'
import { useCategories } from './useCategories'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

const DRAFT_KEY = 'category-form:new'

export function CategoriesPage() {
  const { categories, save } = useCategories()
  const [newName, setNewName] = useState(() => loadFormDraft<string>(DRAFT_KEY) ?? '')
  const [error, setError] = useState<string | null>(null)

  useFormDraft(DRAFT_KEY, newName)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const { error } = await save(null, { name: newName.trim(), sort_order: categories.length })
    if (error) { setError(error.message); return }
    setNewName('')
    clearFormDraft(DRAFT_KEY)
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
    <div className="bg-stone-50 min-h-screen">
      <div className="p-4 max-w-md mx-auto space-y-4 pb-8">
        <div>
          <h1 className="text-xl font-bold text-stone-900">หมวดหมู่สินค้า</h1>
          <p className="text-sm text-stone-500 mt-0.5">ลากลำดับด้วยลูกศร กดปิด/เปิดใช้งานได้ทันที</p>
        </div>

        <ul className="space-y-2">
          {categories.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-1 rounded-2xl bg-white border border-stone-200 shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_6px_-2px_rgb(0_0_0_/_0.08)] pl-3.5 pr-2 py-1.5"
            >
              <span className="flex-1 text-sm font-medium text-stone-900">{c.name}</span>
              {!c.is_active && (
                <span className="text-xs font-medium text-stone-400 bg-stone-100 rounded-full px-2 py-0.5 shrink-0">ปิดใช้งาน</span>
              )}
              <button
                type="button"
                onClick={() => move(c.id, -1)}
                disabled={i === 0}
                aria-label={`ย้าย ${c.name} ขึ้น`}
                className="text-stone-500 disabled:opacity-30 w-9 h-9 grid place-items-center text-lg rounded-full hover:bg-stone-50 shrink-0"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(c.id, 1)}
                disabled={i === categories.length - 1}
                aria-label={`ย้าย ${c.name} ลง`}
                className="text-stone-500 disabled:opacity-30 w-9 h-9 grid place-items-center text-lg rounded-full hover:bg-stone-50 shrink-0"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => save(c.id, { is_active: !c.is_active })}
                className="text-xs font-medium text-stone-600 bg-stone-100 rounded-full px-2.5 py-1.5 shrink-0"
              >
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
            className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
          />
          <button type="submit" className="rounded-xl bg-stone-900 text-white px-4 py-2.5 text-sm font-medium shadow-[0_6px_16px_-4px_rgb(0_0_0_/_0.3)]">
            เพิ่ม
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
