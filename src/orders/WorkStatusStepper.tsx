import { stagesFor } from './workStatus'

/**
 * แถบขั้นตอนสถานะงาน — กดได้แค่ "ขั้นถัดไป" เท่านั้น ข้ามขั้นไม่ได้ (ล็อกไว้ด้วย 🔒)
 * ถ้ายังไม่ได้รับเงินเลย ขั้นถัดไปจะถูกล็อกไว้เสมอ ไม่ว่าจะอยู่ขั้นไหนก็ตาม
 */
export function WorkStatusStepper({
  fulfillmentType,
  workStatus,
  paymentStatus,
  onAdvance,
}: {
  fulfillmentType: string
  workStatus: string
  paymentStatus: string
  onAdvance: (status: string) => void
}) {
  const stages = stagesFor(fulfillmentType)
  const currentIdx = stages.findIndex((s) => s.status === workStatus)
  const paymentBlocksNext = paymentStatus === 'unpaid' && currentIdx < stages.length - 1

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {stages.map((stage, i) => {
          const isDone = i < currentIdx
          const isCurrent = i === currentIdx
          const isNext = i === currentIdx + 1
          const blocked = isNext && paymentBlocksNext
          const clickable = isNext && !blocked

          return (
            <button
              key={stage.status}
              type="button"
              disabled={!clickable}
              onClick={() => onAdvance(stage.status)}
              title={
                blocked
                  ? 'ต้องรับชำระเงินอย่างน้อยมัดจำก่อน ถึงจะไปขั้นถัดไปได้'
                  : !isDone && !isCurrent && !isNext
                    ? 'ต้องเปลี่ยนสถานะทีละขั้นตามลำดับ ข้ามไม่ได้'
                    : undefined
              }
              className={
                'rounded-full pl-2.5 pr-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition ' +
                (isDone
                  ? 'bg-stone-900 text-white'
                  : isCurrent
                    ? 'bg-stone-900 text-white ring-4 ring-stone-200'
                    : clickable
                      ? 'bg-amber-50 text-amber-800 border-2 border-amber-400'
                      : 'bg-stone-100 text-stone-400 border-2 border-transparent cursor-not-allowed')
              }
            >
              <span>{isDone ? '✓' : stage.icon}</span>
              {stage.label}
              {(blocked || (!isDone && !isCurrent && !isNext)) && <span className="text-xs">🔒</span>}
            </button>
          )
        })}
      </div>
      {paymentBlocksNext && (
        <p className="text-xs text-red-600">🔒 ลูกค้ายังไม่ชำระเงินเลย ต้องได้รับเงินอย่างน้อยมัดจำก่อนถึงจะไปขั้นถัดไปได้</p>
      )}
    </div>
  )
}
