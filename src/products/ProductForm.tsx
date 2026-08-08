import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProducts } from './useProducts'
import { useCategories } from './useCategories'
import { uploadToBucket } from '../lib/imageUpload'
import { productImageUrl } from './ProductCard'

export function ProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { products, save, remove } = useProducts()
  const { categories } = useCategories()
  const existing = products.find((p) => p.id === id)

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('0')
  const [cost, setCost] = useState('0')
  const [unit, setUnit] = useState('ชิ้น')
  const [note, setNote] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setCategoryId(existing.category_id ?? '')
      setPrice(String(existing.price))
      setCost(String(existing.cost))
      setUnit(existing.unit)
      setNote(existing.note ?? '')
      setIsActive(existing.is_active)
      setImagePath(existing.image_path)
    }
  }, [existing])

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
    setBusy(true)
    const { error } = await save(id ?? null, {
      name: name.trim(),
      category_id: categoryId || null,
      price: Number(price),
      cost: Number(cost),
      unit,
      note: note.trim() || null,
      is_active: isActive,
      image_path: imagePath,
    })
    setBusy(false)
    if (error) { setError('บันทึกไม่สำเร็จ: ' + error.message); return }
    navigate('/products')
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm('ยืนยันการลบสินค้านี้?')) return
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
          <button type="button" onClick={handleDelete} className="rounded-lg px-4 py-2.5 text-red-600 hover:bg-red-50">
            ลบสินค้า
          </button>
        )}
      </div>
    </form>
  )
}
