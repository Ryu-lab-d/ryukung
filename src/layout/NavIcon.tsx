export type NavIconName =
  | 'orders' | 'pos' | 'calendar' | 'content' | 'products'
  | 'customers' | 'withdrawals' | 'costing' | 'summary' | 'settings'

/** ไอคอนเมนูนำทางแบบวาดเอง (เส้น, สี่เหลี่ยมจัตุรัส 24x24) แทนอีโมจิเดิม — ใช้ currentColor ทั้งหมด
 * เพื่อให้เปลี่ยนสีตามสถานะ active/inactive ของ NavLink ได้เลยโดยไม่ต้องมี logic สีแยกต่างหาก */
export function NavIcon({ name, className = 'w-5 h-5' }: { name: NavIconName; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  switch (name) {
    case 'orders':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="M8 10h8M8 14h8M8 18h5" />
        </svg>
      )
    case 'pos':
      return (
        <svg {...common}>
          <path d="M3 6h2l2.4 12.2a2 2 0 0 0 2 1.8h8.4a2 2 0 0 0 2-1.8L21 8H6" />
          <circle cx="9" cy="21" r="1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="21" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      )
    case 'content':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 5v14M16 5v14M3 10h5M16 10h5M3 15h5M16 15h5" />
        </svg>
      )
    case 'products':
      return (
        <svg {...common}>
          <path d="M21 8 12 3 3 8l9 5 9-5Z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      )
    case 'customers':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      )
    case 'withdrawals':
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="10" rx="1.5" />
          <path d="M9 10V7a3 3 0 0 1 6 0v3" />
          <path d="M12 17v-4M9.5 15.5 12 13l2.5 2.5" />
        </svg>
      )
    case 'costing':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 2.5-2c1.4 0 2.5.9 2.5 2s-1.1 1.6-2.5 2-2.5 1-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2" />
          <path d="M12 5.5v13" />
        </svg>
      )
    case 'summary':
      return (
        <svg {...common}>
          <rect x="4" y="12" width="3.5" height="8" rx="0.5" />
          <rect x="10.25" y="6" width="3.5" height="14" rx="0.5" />
          <rect x="16.5" y="9" width="3.5" height="11" rx="0.5" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-2-3.5-2.3 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-1-2 3.5L4.6 10.5a7.6 7.6 0 0 0 0 3l-1.9 1.5 2 3.5 2.3-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3 1 2-3.5Z" />
        </svg>
      )
  }
}
