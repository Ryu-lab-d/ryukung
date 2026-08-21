export const STAFF_PAGES = [
  { key: 'orders', label: 'ออเดอร์ & ปฏิทิน' },
  { key: 'pos', label: 'ขายหน้าร้าน (POS)' },
  { key: 'products', label: 'สินค้า' },
  { key: 'customers', label: 'ลูกค้า' },
  { key: 'costing', label: 'ต้นทุน' },
  { key: 'summary', label: 'สรุปยอด' },
  { key: 'expenses', label: 'รายจ่าย' },
  { key: 'withdrawals', label: 'เบิกของ' },
  { key: 'content', label: 'คอนเทนต์' },
  { key: 'ingredients', label: 'วัตถุดิบ' },
  { key: 'promo', label: 'โปรโมท' },
  { key: 'storage', label: 'พื้นที่จัดเก็บ' },
] as const

export type PageKey = (typeof STAFF_PAGES)[number]['key']
