import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSettings } from '../settings/useSettings'
import { buildOrderSchema, type OrderFormValues } from './schema'
import { createDraft, saveDraft, confirmOrder } from './api'
import { useGuardedSubmit } from '../lib/guardedSubmit'
import {
  useOrderDraftAutosave,
  loadDraftFromLocalStorage,
  clearDraftFromLocalStorage,
} from './useOrderDraftAutosave'
import { Step1Customer } from './Step1Customer'
import { Step2Products } from './Step2Products'
import { Step3Fulfillment } from './Step3Fulfillment'

const EMPTY_ORDER: OrderFormValues = {
  customer_id: null,
  fulfillment_type: 'shipping',
  needed_date: null,
  bake_date: null,
  pickup_place: null,
  pickup_time: null,
  ship_recipient_name: null,
  ship_recipient_phone: null,
  ship_address_text: null,
  shipping_fee: 0,
  discount_type: 'none',
  discount_value: 0,
  note: null,
  items: [],
}

const STEP_LABELS = ['ลูกค้า', 'สินค้า', 'การส่งและยอดเงิน']

export function OrderFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [orderId, setOrderId] = useState<string | null>(id ?? null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const schema = useMemo(
    () => buildOrderSchema(settings?.require_full_customer_info ?? true),
    [settings?.require_full_customer_info]
  )

  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: (id && loadDraftFromLocalStorage<OrderFormValues>(id)) || EMPTY_ORDER,
    mode: 'onBlur',
  })

  useEffect(() => {
    if (!orderId) {
      void createDraft().then(({ id: newId }) => { if (newId) setOrderId(newId) })
    }
  }, [orderId])

  useOrderDraftAutosave(orderId, methods.watch())

  const { run: runSaveDraft, busy: savingDraft } = useGuardedSubmit(async () => {
    if (!orderId) return
    const { error } = await saveDraft(orderId, methods.getValues())
    if (error) { setError(error.message); return }
    navigate('/')
  })

  const { run: runConfirm, busy: confirming } = useGuardedSubmit(async (values: OrderFormValues) => {
    if (!orderId) return
    const { orderNo, error } = await confirmOrder(orderId, values)
    if (error) { setError(error.message); return }
    clearDraftFromLocalStorage(orderId)
    // ยืนยันสำเร็จแล้วพาไปหน้ารายละเอียดออเดอร์ทันที เพื่อให้เห็นที่อยู่/สถานะของออเดอร์ที่เพิ่งสร้างโดยไม่ต้องไปหาเอง
    navigate(`/orders/${orderId}`)
    return orderNo
  })

  return (
    <FormProvider {...methods}>
      <div className="p-4 pb-28 max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-semibold">{id ? 'แก้ไขออเดอร์' : 'สร้างออเดอร์ใหม่'}</h1>

        <div className="flex gap-3 text-sm">
          {STEP_LABELS.map((label, i) => (
            <span key={label} className={i + 1 === step ? 'font-semibold text-stone-900' : 'text-stone-400'}>
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {step === 1 && <Step1Customer />}
        {step === 2 && <Step2Products />}
        {step === 3 && <Step3Fulfillment />}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="fixed bottom-16 lg:bottom-0 inset-x-0 bg-white border-t border-stone-200 p-3 flex flex-wrap gap-2 justify-between max-w-2xl mx-auto">
          <div className="flex gap-2">
            {step > 1 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-lg px-4 py-2.5 text-stone-600">
                ย้อนกลับ
              </button>
            )}
            {step < 3 && (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-lg bg-stone-900 text-white px-4 py-2.5">
                ถัดไป
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={savingDraft}
              onClick={() => runSaveDraft()}
              className="rounded-lg px-4 py-2.5 text-stone-600 disabled:opacity-50"
            >
              บันทึกร่าง
            </button>
            {step === 3 && (
              <button
                type="button"
                disabled={confirming}
                onClick={methods.handleSubmit((values) => runConfirm(values))}
                className="rounded-lg bg-stone-900 text-white px-4 py-2.5 disabled:opacity-50"
              >
                {confirming ? 'กำลังยืนยัน...' : 'ยืนยันออเดอร์'}
              </button>
            )}
          </div>
        </div>
      </div>
    </FormProvider>
  )
}
