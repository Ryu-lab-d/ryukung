import { buildIcsContent } from './ics'

export function AddToCalendarButton({
  orderNo,
  shopName,
  neededDate,
  location,
  description,
}: {
  orderNo: string
  shopName: string
  neededDate: string
  location: string | null
  description: string
}) {
  function handleClick() {
    const ics = buildIcsContent({ orderNo, shopName, neededDate, location, description })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${orderNo}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 text-stone-700 font-medium py-2.5 text-sm"
    >
      📅 เพิ่มลงปฏิทิน
    </button>
  )
}
