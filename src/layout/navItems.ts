export const NAV_ITEMS = [
  { path: '/', label: 'ออเดอร์', icon: 'orders', page: 'orders' },
  { path: '/pos', label: 'ขายหน้าร้าน', icon: 'pos', page: 'pos' },
  { path: '/calendar', label: 'ปฏิทิน', icon: 'calendar', page: 'orders' },
  { path: '/content', label: 'คอนเทนต์', icon: 'content', page: 'content' },
  { path: '/products', label: 'สินค้า', icon: 'products', page: 'products' },
  { path: '/customers', label: 'ลูกค้า', icon: 'customers', page: 'customers' },
  { path: '/withdrawals', label: 'เบิกของ', icon: 'withdrawals', page: 'withdrawals' },
  { path: '/costing', label: 'ต้นทุน', icon: 'costing', page: 'costing' },
  { path: '/summary', label: 'สรุปยอด', icon: 'summary', page: 'summary' },
  { path: '/settings', label: 'ตั้งค่า', icon: 'settings', ownerOnly: true },
] as const
