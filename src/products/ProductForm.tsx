import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProducts } from './useProducts'
import { useCategories } from './useCategories'
import { uploadToBucket } from '../lib/imageUpload'
import { productImageUrl } from './ProductCard'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { useIngredients } from '../ingredients/useIngredients'
import { useProductIngredients } from './useProductIngredients'
import { saveProductIngredients } from './api'
import { formatBaht } from '../lib/money'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

type RecipeRow = { ingredient_id: string; qty_per_unit: string }

type ProductDraft = {
  name: string
  categoryId: string
  price: string
  cost: string
  unit: string
  note: string
  isActive: boolean
  imagePath: string | null
  recipeRows: RecipeRow[]
}

export function ProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { products, save, remove } = useProducts()
  const { categories } = useCategories()
  const { ingredients } = useIngredients()
  const { rows: savedRecipeRows } = useProductIngredients(id ?? null)
  const existing = products.find((p) => p.id === id)

  const draftKey = `product-form:${id ?? 'new'}`
  const [draft] = useState(() => loadFormDraft<ProductDraft>(draftKey))

  const [name, setName] = useState(draft?.name ?? '')
  const [categoryId, setCategoryId] = useState(draft?.categoryId ?? '')
  const [price, setPrice] = useState(draft?.price ?? '0')
  const [cost, setCost] = useState(draft?.cost ?? '0')
  const [unit, setUnit] = useState(draft?.unit ?? 'ชิ้น')
  const [note, setNote] = useState(draft?.note ?? '')
  const [isActive, setIsActive] = useState(draft?.isActive ?? true)
  const [imagePath, setImagePath] = useState<string | null>(draft?.imagePath ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>(draft?.recipeRows ?? [])

  useEffect(() => {
    if (existing && !draft) {
      setName(existing.name)
      setCategoryId(existing.category_id ?? '')
      setPrice(String(existing.price))
      setCost(String(existing.cost))
      setUnit(existing.unit)
      setNote(existing.note ?? '')
      setIsActive(existing.is_active)
      setImagePath(existing.image_path)
    }
  }, [existing, draft])

  useEffect(() => {
    if (savedRecipeRows.length > 0 && !draft) {
      setRecipeRows(savedRecipeRows.map((r) => ({ ingredient_id: r.ingredient_id, qty_per_unit: String(r.qty_per_unit) })))
    }
  }, [savedRecipeRows, draft])

  useFormDraft(draftKey, { name, categoryId, price, cost, unit, note, isActive, imagePath, recipeRows })

  function addRecipeRow() {
    setRecipeRows((prev) => [...prev, { ingredient_id: '', qty_per_unit: '' }])
  }

  function updateRecipeRow(index: number, patch: Partial<RecipeRow>) {
    setRecipeRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeRecipeRow(index: number) {
    setRecipeRows((prev) => prev.filter((_, i) => i !== index))
  }

  const costFromRecipe = useMemo(() => {
    return recipeRows.reduce((sum, r) => {
      const ing = ingredients.find((i) => i.id === r.ingredient_id)
      const qty = Number(r.qty_per_unit)
      if (!ing || !qty) return sum
      return sum + qty * ing.cost_per_unit
    }, 0)
  }, [recipeRows, ingredients])

  async function handleImageChange(file: File) {
    setUploading(true)
    const { path, error } = await uploadToBucket('product-images', 'products', file)
    setUploading(false)
    if (error) { setError('อัปโหลดรูปไม่สำเร็จ: ' + error.message); return }
    setImagePath(path)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('กรุณาใส่ชื่อสินค้า'); return }
    const validRows = recipeRows.filter((r) => r.ingredient_id && Number(r.qty_per_unit) > 0)
    if (recipeRows.some((r) => r.ingredient_id && !(Number(r.qty_per_unit) > 0))) {
      setError('กรุณาใส่จำนวนที่ใช้ให้ครบทุกแถวสูตรที่เลือกวัตถุดิบไว้')
      return
    }
    setBusy(true)
    const { id: savedId, error } = await save(id ?? null, {
      name: name.trim(),
      category_id: categoryId || null,
      price: Number(price),
      cost: Number(cost),
      unit,
      note: note.trim() || null,
      is_active: isActive,
      image_path: imagePath,
    })
    if (error || !savedId) {
      setBusy(false)
      setError('บันทึกไม่สำเร็จ: ' + (error?.message ?? ''))
      return
    }
    const { error: recipeError } = await saveProductIngredients(
      savedId,
      validRows.map((r) => ({ ingredient_id: r.ingredient_id, qty_per_unit: Number(r.qty_per_unit) }))
    )
    setBusy(false)
    if (recipeError) { setError('บันทึกสูตรไม่สำเร็จ: ' + recipeError.message); return }
    clearFormDraft(draftKey)
    navigate('/products')
  }

  async function handleDelete() {
    if (!id) return
    setShowDeleteConfirm(false)
    const { error } = await remove(id)
    if (error) { setError(error.message); return }
    navigate('/products')
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">{isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h1>

      <div className="space-y-2">
        <label htmlFor="image" className="text-sm text-stone-600">รูปสินค้า</label>
        <div className="flex items-center gap-3">
          <div className="w-24 h-24 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden grid place-items-center shrink-0">
            {imagePath ? (
              <img src={productImageUrl(imagePath)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-stone-400">ไม่มีรูป</span>
            )}
          </div>
          <div className="space-y-1">
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageChange(f) }}
              className="block text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-900 file:text-white file:px-3 file:py-2 file:text-sm"
            />
            {uploading && <p className="text-xs text-stone-500">กำลังอัปโหลด...</p>}
            {imagePath && !uploading && (
              <button type="button" onClick={() => setImagePath(null)} className="text-xs text-red-600 underline">
                ลบรูปนี้
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="name" className="text-sm text-stone-600">ชื่อสินค้า</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="category" className="text-sm text-stone-600">หมวดหมู่</label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        >
          <option value="">ไม่มีหมวดหมู่</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="price" className="text-sm text-stone-600">ราคาขาย</label>
          <input
            id="price" type="number" step="0.01" min="0" inputMode="decimal"
            value={price} onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="cost" className="text-sm text-stone-600">ต้นทุนโดยประมาณ</label>
          <input
            id="cost" type="number" step="0.01" min="0" inputMode="decimal"
            value={cost} onChange={(e) => setCost(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="unit" className="text-sm text-stone-600">หน่วย</label>
        <input
          id="unit" value={unit} onChange={(e) => setUnit(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </div>

      <div className="space-y-2 rounded-lg border border-stone-200 p-3">
        <p className="text-sm font-medium text-stone-700">สูตร/วัตถุดิบที่ใช้ (ไม่บังคับ)</p>
        {recipeRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              aria-label={`วัตถุดิบแถวที่ ${i + 1}`}
              value={row.ingredient_id}
              onChange={(e) => updateRecipeRow(i, { ingredient_id: e.target.value })}
              className="flex-1 min-w-0 rounded-lg border border-stone-300 px-2 py-2 text-sm"
            >
              <option value="">เลือกวัตถุดิบ</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              aria-label={`จำนวนที่ใช้แถวที่ ${i + 1}`}
              value={row.qty_per_unit}
              onChange={(e) => updateRecipeRow(i, { qty_per_unit: e.target.value })}
              placeholder="จำนวนที่ใช้"
              className="w-24 shrink-0 rounded-lg border border-stone-300 px-2 py-2 text-sm"
            />
            <button type="button" onClick={() => removeRecipeRow(i)} className="shrink-0 text-red-600 text-sm px-1">
              ลบ
            </button>
          </div>
        ))}
        <button type="button" onClick={addRecipeRow} className="text-sm text-stone-600 underline">
          + เพิ่มวัตถุดิบ
        </button>
        {costFromRecipe > 0 && (
          <div className="flex items-center justify-between gap-2 pt-1 text-sm">
            <span className="text-stone-600">ต้นทุนจากสูตร: <strong>{formatBaht(costFromRecipe)}</strong></span>
            <button type="button" onClick={() => setCost(costFromRecipe.toFixed(2))} className="text-stone-900 underline shrink-0">
              ใช้ค่านี้เป็นต้นทุน
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="note" className="text-sm text-stone-600">หมายเหตุ</label>
        <textarea
          id="note" value={note} onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        เปิดขาย
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-stone-900 text-white px-4 py-2.5 disabled:opacity-50">
          {busy ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        {isEdit && (
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className="rounded-lg px-4 py-2.5 text-red-600 hover:bg-red-50">
            ลบสินค้า
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="ลบสินค้านี้ถาวร?"
          confirmLabel="ลบถาวร"
          cancelLabel="ไม่ลบ"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </form>
  )
}
