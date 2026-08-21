const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'] as const

/** ปุ่มกดตัวเลขแบบเครื่องคิดเลขในมือถือ — กดสะสมทีละหลัก (กด 2 สามครั้ง = "222") แทนการพิมพ์บนคีย์บอร์ดตัวเลขของมือถือที่กดยากกว่า */
export function NumericKeypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function press(key: (typeof KEYPAD_KEYS)[number]) {
    if (key === 'C') {
      onChange('')
      return
    }
    if (key === '.' && value.includes('.')) return
    onChange(value + key)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl bg-stone-900 text-white px-4 py-4">
        <p className="text-3xl font-bold tabular-nums">
          <span data-testid="payment-amount-display">{value || '0'}</span>{' '}
          <span className="text-base font-normal text-stone-300">บาท</span>
        </p>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          aria-label="ลบตัวเลขล่าสุด"
          className="w-10 h-10 rounded-full bg-white/10 grid place-items-center text-xl shrink-0"
        >
          ⌫
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYPAD_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={'rounded-xl text-xl font-semibold py-3.5 ' + (k === 'C' ? 'bg-stone-200 text-stone-700' : 'bg-stone-100 text-stone-900')}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
