export type ExpenseCategory =
  | 'rent_utilities'
  | 'packaging'
  | 'marketing'
  | 'transport'
  | 'equipment'
  | 'ingredients_other'
  | 'other'

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent_utilities', label: 'ค่าเช่า/น้ำ/ไฟ' },
  { value: 'packaging', label: 'บรรจุภัณฑ์/ถุง/กล่อง' },
  { value: 'marketing', label: 'การตลาด/โฆษณา' },
  { value: 'transport', label: 'ค่าขนส่ง/น้ำมัน' },
  { value: 'equipment', label: 'อุปกรณ์/เครื่องมือ' },
  { value: 'ingredients_other', label: 'วัตถุดิบอื่นๆ นอกระบบ' },
  { value: 'other', label: 'อื่นๆ' },
]

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
)
