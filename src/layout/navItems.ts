export const NAV_ITEMS = [
  { path: '/', label: 'ออเดอร์', icon: '📋' },
  { path: '/calendar', label: 'ปฏิทิน', icon: '📅' },
  { path: '/content', label: 'คอนเทนต์', icon: '🎬' },
  { path: '/products', label: 'สินค้า', icon: '🍪' },
  { path: '/customers', label: 'ลูกค้า', icon: '👤' },
  { path: '/costing', label: 'ต้นทุน', icon: '💰' },
  { path: '/summary', label: 'สรุปยอด', icon: '📊' },
  { path: '/settings', label: 'ตั้งค่า', icon: '⚙️', ownerOnly: true },
] as const
