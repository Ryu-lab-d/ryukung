type ConfirmDialogProps = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** กล่องถามยืนยันกลางจอแบบใช้ซ้ำได้ทั้งแอป แทนที่ window.confirm() ของเบราว์เซอร์ที่แต่งหน้าตาไม่ได้ */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ไม่ทำ',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 animate-overlay-fade">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-1 text-center shadow-lg animate-toast-pop">
        <p className="text-lg font-semibold text-stone-900">{title}</p>
        {message && <p className="text-sm text-stone-600 pt-1">{message}</p>}
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-stone-100 text-stone-700 py-2.5 font-medium"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={
              'flex-1 rounded-lg py-2.5 font-medium text-white disabled:opacity-50 ' +
              (danger ? 'bg-red-600' : 'bg-stone-900')
            }
          >
            {busy ? 'กำลังทำ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
