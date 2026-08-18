export const NAV_ITEMS = [
  { path: '/', label: 'ออเดอร์', icon: '📋', page: 'orders' },
  { path: '/calendar', label: 'ปฏิทิน', icon: '📅', page: 'orders' },
  { path: '/content', label: 'คอนเทนต์', icon: '🎬', page: 'content' },
  { path: '/products', label: 'สินค้า', icon: '🍪', page: 'products' },
  { path: '/customers', label: 'ลูกค้า', icon: '👤', page: 'customers' },
  { path: '/costing', label: 'ต้นทุน', icon: '💰', page: 'costing' },
  { path: '/summary', label: 'สรุปยอด', icon: '📊', page: 'summary' },
  { path: '/settings', label: 'ตั้งค่า', icon: '⚙️', ownerOnly: true },
] as const
