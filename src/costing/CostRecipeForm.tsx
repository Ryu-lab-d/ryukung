import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCostRecipe } from './useCostRecipe'
import { saveCostRecipe, deleteCostRecipe } from './api'
import { computeRecipeCost, ingredientCost } from './costMath'
import { formatBaht } from '../lib/money'
import { ConfirmDialog } from '../lib/ConfirmDialog'

type IngredientRow = { name: string; purchase_qty: string; purchase_unit: string; purchase_price: string; qty_used: string }
type LaborRow = { label: string; amount: string }

const emptyIngredient: IngredientRow = { name: '', purchase_qty: '', purchase_unit: 'กรัม', purchase_price: '', qty_used: '' }

export function CostRecipeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recipe, ingredients: loadedIngredients, labor: loadedLabor, loading } = useCostRecipe(id ?? null)

  const [name, setName] = useState('')
  const [wasteOverheadPercent, setWasteOverheadPercent] = useState('0')
  const [profitPercent, setProfitPercent] = useState('30')
  const [yieldQty, setYieldQty] = useState('1')
  const [note, setNote] = useState('')
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([{ ...emptyIngredient }])
  const [laborRows, setLaborRows] = useState<LaborRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!recipe) return
    setName(recipe.name)
    setWasteOverheadPercent(String(recipe.waste_overhead_percent))
    setProfitPercent(String(recipe.profit_percent))
    setYieldQty(String(recipe.yield_qty))
    setNote(recipe.note ?? '')
    setIngredientRows(
      loadedIngredients.length > 0
        ? loadedIngredients.map((it) => ({
            name: it.name,
            purchase_qty: String(it.purchase_qty),
            purchase_unit: it.purchase_unit,
            purchase_price: String(it.purchase_price),
            qty_used: String(it.qty_used),
          }))
        : [{ ...emptyIngredient }]
    )
    setLaborRows(loadedLabor.map((l) => ({ label: l.label, amount: String(l.amount) })))
  }, [recipe, loadedIngredients, loadedLabor])

  const calc = useMemo(
    () =>
      computeRecipeCost({
        ingredients: ingredientRows.map((r) => ({
          purchase_qty: Number(r.purchase_qty) || 0,
          purchase_price: Number(r.purchase_price) || 0,
          qty_used: Number(r.qty_used) || 0,
        })),
        labor: laborRows.map((r) => ({ amount: Number(r.amount) || 0 })),
        wasteOverheadPercent: Number(wasteOverheadPercent) || 0,
        yieldQty: Number(yieldQty) || 0,
        profitPercent: Number(profitPercent) || 0,
      }),
    [ingredientRows, laborRows, wasteOverheadPercent, yieldQty, profitPercent]
  )

  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredientRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function addIngredient() {
    setIngredientRows((rows) => [...rows, { ...emptyIngredient }])
  }
  function removeIngredient(index: number) {
    setIngredientRows((rows) => rows.filter((_, i) => i !== index))
  }

  function updateLabor(index: number, patch: Partial<LaborRow>) {
    setLaborRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function addLabor() {
    setLaborRows((rows) => [...rows, { label: '', amount: '' }])
  }
  function removeLabor(index: number) {
    setLaborRows((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('กรุณาใส่ชื่อเมนู')
      return
    }
    const validIngredients = ingredientRows.filter((r) => r.name.trim() && Number(r.purchase_qty) > 0)
    setSaving(true)
    const { id: savedId, error: saveError } = await saveCostRecipe(id ?? null, {
      name: name.trim(),
      waste_overhead_percent: Number(wasteOverheadPercent) || 0,
      profit_percent: Number(profitPercent) || 0,
      yield_qty: Number(yieldQty) || 1,
      note: note.trim() || null,
      ingredients: validIngredients.map((r) => ({
        name: r.name.trim(),
        purchase_qty: Number(r.purchase_qty) || 0,
        purchase_unit: r.purchase_unit.trim() || 'กรัม',
        purchase_price: Number(r.purchase_price) || 0,
        qty_used: Number(r.qty_used) || 0,
      })),
      labor: laborRows.filter((r) => r.label.trim()).map((r) => ({ label: r.label.trim(), amount: Number(r.amount) || 0 })),
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    navigate(`/costing/${savedId}/edit`)
  }

  async function handleDelete() {
    if (!id) return
    await deleteCostRecipe(id)
    navigate('/costing')
  }

  if (id && loading) return <div className="p-4 text-stone-500">กำลังโหลด...</div>

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto pb-24">
      <Link to="/costing" className="inline-flex items-center gap-1 text-sm text-stone-600 underline">
        ← กลับหน้าต้นทุน
      </Link>
      <h1 className="text-lg font-semibold">{id ? 'แก้ไขสูตรต้นทุน' : 'คำนวณต้นทุนเมนูใหม่'}</h1>

      <div className="space-y-1">
        <label htmlFor="recipe-name" className="text-sm text-stone-600">
          ชื่อเมนู/สินค้า
        </label>
        <input
          id="recipe-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น คุกกี้ช็อกโกแลตชิพ"
          className="w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">วัตถุดิบ</h2>
          <button type="button" onClick={addIngredient} className="text-sm text-stone-600 underline">
            + เพิ่มวัตถุดิบ
          </button>
        </div>
        <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2">
          ตัวอย่าง: ซื้อเนย 1 ถุง หนัก 5,000 กรัม ราคา 1,125 บาท แล้วสูตรนี้ใช้เนย 200 กรัม — ระบบคิดต้นทุนส่วนเนยให้อัตโนมัติเป็น 45 บาท
        </p>
        {ingredientRows.map((row, i) => {
          const cost = ingredientCost({
            purchase_qty: Number(row.purchase_qty) || 0,
            purchase_price: Number(row.purchase_price) || 0,
            qty_used: Number(row.qty_used) || 0,
          })
          return (
            <div key={i} className="rounded-lg border border-stone-200 p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={row.name}
                  onChange={(e) => updateIngredient(i, { name: e.target.value })}
                  placeholder="ชื่อวัตถุดิบ เช่น เนย"
                  className="flex-1 rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                />
                <button type="button" onClick={() => removeIngredient(i)} className="text-red-600 text-sm px-2">
                  ลบ
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-xs text-stone-500">ซื้อมาทั้งหมดหนัก/ปริมาณเท่าไหร่</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="เช่น 5000"
                    value={row.purchase_qty}
                    onChange={(e) => updateIngredient(i, { purchase_qty: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-stone-500">หน่วย</label>
                  <input
                    list="cost-unit-suggestions"
                    placeholder="เช่น กรัม"
                    value={row.purchase_unit}
                    onChange={(e) => updateIngredient(i, { purchase_unit: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-stone-500">ราคาที่ซื้อทั้งหมด (บาท)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="เช่น 1125"
                    value={row.purchase_price}
                    onChange={(e) => updateIngredient(i, { purchase_price: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-stone-500">สูตรนี้ใช้กี่ {row.purchase_unit || 'หน่วย'}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="เช่น 200"
                    value={row.qty_used}
                    onChange={(e) => updateIngredient(i, { qty_used: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-stone-500 text-right">ต้นทุนส่วนนี้ {formatBaht(cost)} บาท</p>
            </div>
          )
        })}
        <datalist id="cost-unit-suggestions">
          <option value="กรัม" />
          <option value="มิลลิลิตร" />
          <option value="ชิ้น" />
          <option value="ฟอง" />
          <option value="ถุง" />
          <option value="ขวด" />
        </datalist>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">ค่าแรง/ค่าใช้จ่ายอื่นๆ</h2>
          <button type="button" onClick={addLabor} className="text-sm text-stone-600 underline">
            + เพิ่มรายการ
          </button>
        </div>
        {laborRows.length === 0 && <p className="text-sm text-stone-400">ยังไม่มีรายการ (ไม่บังคับ)</p>}
        {laborRows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={row.label}
              onChange={(e) => updateLabor(i, { label: e.target.value })}
              placeholder="เช่น ค่าแรงอบ"
              className="flex-1 rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={row.amount}
              onChange={(e) => updateLabor(i, { amount: e.target.value })}
              placeholder="บาท"
              className="w-28 rounded-lg border border-stone-300 px-2.5 py-2 text-sm"
            />
            <button type="button" onClick={() => removeLabor(i)} className="text-red-600 text-sm px-2">
              ลบ
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="waste-overhead" className="text-sm text-stone-600">
            % Waste/Overhead
          </label>
          <input
            id="waste-overhead"
            type="number"
            inputMode="decimal"
            min="0"
            value={wasteOverheadPercent}
            onChange={(e) => setWasteOverheadPercent(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="yield-qty" className="text-sm text-stone-600">
            ทำได้กี่ชิ้น
          </label>
          <input
            id="yield-qty"
            type="number"
            inputMode="decimal"
            min="0"
            value={yieldQty}
            onChange={(e) => setYieldQty(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label htmlFor="profit-percent" className="text-sm text-stone-600">
            กำไรที่ต้องการ (% จากต้นทุน)
          </label>
          <input
            id="profit-percent"
            type="number"
            inputMode="decimal"
            min="0"
            value={profitPercent}
            onChange={(e) => setProfitPercent(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label htmlFor="recipe-note" className="text-sm text-stone-600">
            หมายเหตุ (ไม่บังคับ)
          </label>
          <input
            id="recipe-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-stone-900 text-white p-5 space-y-2">
        <div className="flex justify-between text-sm text-stone-300">
          <span>ต้นทุนวัตถุดิบรวม</span>
          <span>{formatBaht(calc.ingredientTotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-300">
          <span>+ Waste/Overhead</span>
          <span>{formatBaht(calc.overhead)}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-300">
          <span>+ ค่าแรง/อื่นๆ</span>
          <span>{formatBaht(calc.laborTotal)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-stone-700 pt-2">
          <span>ต้นทุนรวมทั้งหมด</span>
          <span>{formatBaht(calc.totalCost)}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-300">
          <span>ทำได้ {yieldQty || 0} ชิ้น → ต้นทุนต่อชิ้น</span>
          <span>{formatBaht(calc.costPerUnit)}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-300">
          <span>กำไรต่อชิ้น ({profitPercent || 0}%)</span>
          <span>{formatBaht(calc.profitPerUnit)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold border-t border-stone-700 pt-2">
          <span>ราคาขายแนะนำ/ชิ้น</span>
          <span>{formatBaht(calc.suggestedPrice)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 rounded-xl bg-stone-900 text-white font-semibold py-3 disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        {id && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-xl border-2 border-red-300 text-red-700 font-medium px-4"
          >
            ลบสูตรนี้
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="แน่ใจนะว่าจะลบสูตรนี้?"
          message="ลบแล้วกู้คืนไม่ได้"
          confirmLabel="ลบ"
          cancelLabel="ไม่ลบ"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
