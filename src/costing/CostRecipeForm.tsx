import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCostRecipe } from './useCostRecipe'
import { saveCostRecipe, deleteCostRecipe } from './api'
import { computeRecipeCost, ingredientCost } from './costMath'
import { formatBaht } from '../lib/money'
import { ConfirmDialog } from '../lib/ConfirmDialog'
import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'
import { useIngredients } from '../ingredients/useIngredients'

// mode เป็นแค่ state ฝั่ง UI ล้วนๆ ไม่ถูกบันทึกลง DB (handleSave map เฉพาะ field ที่ตารางมีจริงเสมอ) —
// 'pick' คือเลือกวัตถุดิบจากคลังจริง (หน่วย+ราคาต่อหน่วยดึงมาอัตโนมัติ พิมพ์แค่ "ใช้กี่หน่วย") ป้องกันบั๊กแปลง
// หน่วยผิดที่เจ้าของร้านเจอ (พิมพ์ purchase_unit/purchase_price เองแล้วหน่วยไม่ตรงกับที่ใช้จริงในคลัง) —
// 'manual' คือกรอกเองทั้งหมดแบบเดิม ไว้ใช้กับรายการที่ไม่ใช่วัตถุดิบในคลัง (เช่น กล่อง/สติกเกอร์)
type IngredientRow = {
  mode: 'pick' | 'manual'
  ingredientId: string
  name: string
  purchase_qty: string
  purchase_unit: string
  purchase_price: string
  qty_used: string
}
type LaborRow = { label: string; amount: string }

type RecipeDraft = {
  name: string
  wasteOverheadPercent: string
  profitPercent: string
  yieldQty: string
  note: string
  ingredientRows: IngredientRow[]
  laborRows: LaborRow[]
}

function makeEmptyIngredient(defaultMode: 'pick' | 'manual'): IngredientRow {
  return { mode: defaultMode, ingredientId: '', name: '', purchase_qty: '', purchase_unit: 'กรัม', purchase_price: '', qty_used: '' }
}

export function CostRecipeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { recipe, ingredients: loadedIngredients, labor: loadedLabor, loading } = useCostRecipe(id ?? null)
  const { ingredients: stockIngredients } = useIngredients()
  const hasStockIngredients = stockIngredients.length > 0

  const draftKey = `cost-recipe-form:${id ?? 'new'}`
  const [draft] = useState(() => loadFormDraft<RecipeDraft>(draftKey))

  const [name, setName] = useState(draft?.name ?? '')
  const [wasteOverheadPercent, setWasteOverheadPercent] = useState(draft?.wasteOverheadPercent ?? '0')
  const [profitPercent, setProfitPercent] = useState(draft?.profitPercent ?? '30')
  const [yieldQty, setYieldQty] = useState(draft?.yieldQty ?? '1')
  const [note, setNote] = useState(draft?.note ?? '')
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(draft?.ingredientRows ?? [makeEmptyIngredient('manual')])
  const [laborRows, setLaborRows] = useState<LaborRow[]>(draft?.laborRows ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!recipe || draft) return
    setName(recipe.name)
    setWasteOverheadPercent(String(recipe.waste_overhead_percent))
    setProfitPercent(String(recipe.profit_percent))
    setYieldQty(String(recipe.yield_qty))
    setNote(recipe.note ?? '')
    setIngredientRows(
      loadedIngredients.length > 0
        ? loadedIngredients.map((it) => ({
            mode: 'manual' as const,
            ingredientId: '',
            name: it.name,
            purchase_qty: String(it.purchase_qty),
            purchase_unit: it.purchase_unit,
            purchase_price: String(it.purchase_price),
            qty_used: String(it.qty_used),
          }))
        : [makeEmptyIngredient('manual')]
    )
    setLaborRows(loadedLabor.map((l) => ({ label: l.label, amount: String(l.amount) })))
  }, [recipe, loadedIngredients, loadedLabor, draft])

  useFormDraft(draftKey, { name, wasteOverheadPercent, profitPercent, yieldQty, note, ingredientRows, laborRows })

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
    setIngredientRows((rows) => [...rows, makeEmptyIngredient(hasStockIngredients ? 'pick' : 'manual')])
  }
  function removeIngredient(index: number) {
    setIngredientRows((rows) => rows.filter((_, i) => i !== index))
  }
  function setIngredientMode(index: number, mode: 'pick' | 'manual') {
    updateIngredient(index, mode === 'manual' ? { mode, ingredientId: '' } : { mode })
  }
  // เลือกวัตถุดิบจากคลังจริง — ดึงหน่วย+ราคาต่อหน่วยมาอัตโนมัติ (purchase_qty ตั้งเป็น 1 เสมอ ราคาต่อหน่วยจากคลัง
  // ใส่เป็น purchase_price ตรงๆ ให้ unitCost = purchase_price/purchase_qty = cost_per_unit พอดี) ผู้ใช้พิมพ์แค่
  // "ใช้กี่หน่วย" อย่างเดียว ตัดขั้นตอนพิมพ์หน่วย/ราคาเองที่เป็นต้นตอบั๊กแปลงหน่วยผิดออกไปทั้งหมด
  function pickIngredient(index: number, ingredientId: string) {
    const ing = stockIngredients.find((i) => i.id === ingredientId)
    if (!ing) {
      updateIngredient(index, { ingredientId: '', name: '', purchase_unit: 'กรัม', purchase_qty: '', purchase_price: '' })
      return
    }
    updateIngredient(index, {
      ingredientId: ing.id,
      name: ing.name,
      purchase_unit: ing.unit,
      purchase_qty: '1',
      purchase_price: String(ing.cost_per_unit),
    })
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
    clearFormDraft(draftKey)
    navigate(`/costing/${savedId}/edit`)
  }

  async function handleDelete() {
    if (!id) return
    await deleteCostRecipe(id)
    navigate('/costing')
  }

  if (id && loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2.5 text-stone-400">
        <span className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
        กำลังโหลด...
      </div>
    )
  }

  const inputClass = 'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400'
  const cardClass = 'rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(0_0_0_/_0.04),0_1px_8px_-2px_rgb(0_0_0_/_0.06)] p-4 space-y-3.5'

  return (
    <div className="bg-stone-50 min-h-screen">
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
      <Link
        to="/costing"
        className="inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 text-stone-700 text-sm font-medium px-3.5 py-1.5 shadow-sm"
      >
        ← กลับหน้าต้นทุน
      </Link>
      <h1 className="text-xl font-bold text-stone-900">{id ? 'แก้ไขสูตรต้นทุน' : 'คำนวณต้นทุนเมนูใหม่'}</h1>

      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-stone-100 grid place-items-center text-sm shrink-0">📝</span>
          ชื่อเมนู
        </h2>
        <div className="space-y-1">
          <label htmlFor="recipe-name" className="text-xs font-medium text-stone-500">
            ชื่อเมนู/สินค้า
          </label>
          <input
            id="recipe-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น คุกกี้ช็อกโกแลตชิพ"
            className={inputClass}
          />
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-50 grid place-items-center text-sm shrink-0">🧂</span>
            วัตถุดิบ
          </h2>
          <button
            type="button"
            onClick={addIngredient}
            className="text-sm font-medium text-stone-700 bg-stone-100 rounded-full px-3 py-1.5"
          >
            + เพิ่มวัตถุดิบ
          </button>
        </div>
        {!hasStockIngredients && (
          <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5">
            ตัวอย่าง: ซื้อเนย 1 ถุง หนัก 5,000 กรัม ราคา 1,125 บาท แล้วสูตรนี้ใช้เนย 200 กรัม — ระบบคิดต้นทุนส่วนเนยให้อัตโนมัติเป็น 45 บาท
          </p>
        )}
        {ingredientRows.map((row, i) => {
          const cost = ingredientCost({
            purchase_qty: Number(row.purchase_qty) || 0,
            purchase_price: Number(row.purchase_price) || 0,
            qty_used: Number(row.qty_used) || 0,
          })
          const pickedIngredient = stockIngredients.find((ing) => ing.id === row.ingredientId) ?? null
          return (
            <div key={i} className="rounded-xl border border-stone-200 bg-stone-50/60 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                {hasStockIngredients ? (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIngredientMode(i, 'pick')}
                      className={
                        'rounded-full px-2.5 py-1 text-xs font-medium transition-colors ' +
                        (row.mode === 'pick' ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
                      }
                    >
                      🗂️ เลือกจากคลัง
                    </button>
                    <button
                      type="button"
                      onClick={() => setIngredientMode(i, 'manual')}
                      className={
                        'rounded-full px-2.5 py-1 text-xs font-medium transition-colors ' +
                        (row.mode === 'manual' ? 'bg-stone-900 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600')
                      }
                    >
                      ✏️ กรอกเอง
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="text-red-600 text-xs font-medium rounded-full bg-red-50 px-2.5 py-1 shrink-0"
                >
                  ลบ
                </button>
              </div>

              {row.mode === 'pick' ? (
                <>
                  <div className="space-y-0.5">
                    <label htmlFor={`ingredient-pick-${i}`} className="text-xs text-stone-500">วัตถุดิบ</label>
                    <select
                      id={`ingredient-pick-${i}`}
                      value={row.ingredientId}
                      onChange={(e) => pickIngredient(i, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">เลือกวัตถุดิบจากคลัง</option>
                      {stockIngredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                      ))}
                    </select>
                  </div>
                  {pickedIngredient && (
                    <>
                      <p className="text-xs text-stone-400">
                        ต้นทุน {formatBaht(pickedIngredient.cost_per_unit)} บาท/{pickedIngredient.unit} (ดึงจากคลังวัตถุดิบอัตโนมัติ)
                      </p>
                      <div className="space-y-0.5">
                        <label htmlFor={`ingredient-qty-used-${i}`} className="text-xs text-stone-500">สูตรนี้ใช้กี่ {pickedIngredient.unit}</label>
                        <input
                          id={`ingredient-qty-used-${i}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          placeholder={`เช่น 200`}
                          value={row.qty_used}
                          onChange={(e) => updateIngredient(i, { qty_used: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <input
                    value={row.name}
                    onChange={(e) => updateIngredient(i, { name: e.target.value })}
                    placeholder="ชื่อวัตถุดิบ เช่น เนย"
                    className={inputClass}
                  />
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
                        className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs text-stone-500">หน่วย</label>
                      <input
                        list="cost-unit-suggestions"
                        placeholder="เช่น กรัม"
                        value={row.purchase_unit}
                        onChange={(e) => updateIngredient(i, { purchase_unit: e.target.value })}
                        className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm"
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
                        className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm"
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
                        className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
              <p className="text-xs font-medium text-stone-600 text-right">ต้นทุนส่วนนี้ {formatBaht(cost)} บาท</p>
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
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-50 grid place-items-center text-sm shrink-0">💵</span>
            ค่าแรง/ค่าใช้จ่ายอื่นๆ
          </h2>
          <button
            type="button"
            onClick={addLabor}
            className="text-sm font-medium text-stone-700 bg-stone-100 rounded-full px-3 py-1.5"
          >
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
              className="flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={row.amount}
              onChange={(e) => updateLabor(i, { amount: e.target.value })}
              placeholder="บาท"
              className="w-28 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => removeLabor(i)}
              className="text-red-600 text-xs font-medium rounded-full bg-red-50 px-2.5 shrink-0"
            >
              ลบ
            </button>
          </div>
        ))}
      </section>

      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-green-50 grid place-items-center text-sm shrink-0">⚙️</span>
          ตั้งค่าคำนวณ
        </h2>
        <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="waste-overhead" className="text-xs font-medium text-stone-500">
            % Waste/Overhead
          </label>
          <input
            id="waste-overhead"
            type="number"
            inputMode="decimal"
            min="0"
            value={wasteOverheadPercent}
            onChange={(e) => setWasteOverheadPercent(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="yield-qty" className="text-xs font-medium text-stone-500">
            ทำได้กี่ชิ้น
          </label>
          <input
            id="yield-qty"
            type="number"
            inputMode="decimal"
            min="0"
            value={yieldQty}
            onChange={(e) => setYieldQty(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label htmlFor="profit-percent" className="text-xs font-medium text-stone-500">
            กำไรที่ต้องการ (% จากต้นทุน)
          </label>
          <input
            id="profit-percent"
            type="number"
            inputMode="decimal"
            min="0"
            value={profitPercent}
            onChange={(e) => setProfitPercent(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1 col-span-2">
          <label htmlFor="recipe-note" className="text-xs font-medium text-stone-500">
            หมายเหตุ (ไม่บังคับ)
          </label>
          <input
            id="recipe-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </div>
        </div>
      </section>

      <div className="rounded-2xl bg-stone-900 text-white p-5 space-y-2 shadow-[0_10px_24px_-8px_rgb(0_0_0_/_0.4)]">
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
          className="flex-1 rounded-xl bg-stone-900 text-white font-semibold py-3 shadow-[0_6px_16px_-4px_rgb(0_0_0_/_0.3)] disabled:opacity-50 disabled:shadow-none"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        {id && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-xl border border-red-300 bg-red-50 text-red-700 font-medium px-4 shadow-sm"
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
    </div>
  )
}
