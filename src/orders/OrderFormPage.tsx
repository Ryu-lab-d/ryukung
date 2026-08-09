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
import { supabase } from '../lib/supabase'
import { sendCustomerEmail } from '../lib/customerEmail'
import { orderConfirmedEmail } from '../lib/emailTemplates'

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
    if (!orderId || !values.customer_id) {
      setError('กรุณาเลือกหรือสร้างลูกค้าก่อนยืนยันออเดอร์')
      return
    }
    // เช็กอีเมลจากฐานข้อมูลจริง ณ ตอนนี้เลย ไม่ใช้ข้อมูลลูกค้าที่โหลดไว้ตอนเปิดหน้า เพราะลูกค้าอาจเพิ่งกรอก/แก้อีเมล
    // ในหน้า "ลูกค้า" เมื่อครู่นี้เอง — hook รายชื่อลูกค้าของหน้านั้นกับของฟอร์มนี้เป็นคนละชุด ไม่ได้ sync กันอัตโนมัติ
    const { data: customer } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', values.customer_id)
      .single()
    if (!customer?.email) {
      setError('กรุณากรอกอีเมลลูกค้าให้ครบก่อนยืนยันออเดอร์ (ย้อนกลับไปหน้า "ลูกค้า")')
      return
    }
    const { orderNo, error } = await confirmOrder(orderId, values)
    if (error) { setError(error.message); return }
    clearDraftFromLocalStorage(orderId)

    // แจ้งอีเมลลูกค้าว่ารับออเดอร์แล้ว — best-effort ไม่บล็อกการนำทางแม้ส่งไม่สำเร็จ (เช่น SMTP มีปัญหาชั่วคราว)
    if (orderNo && settings) {
      void supabase
        .from('orders')
        .select('public_token, grand_total')
        .eq('id', orderId)
        .single()
        .then(({ data }) => {
          if (!data?.public_token) return
          const { subject, html } = orderConfirmedEmail({
            shopName: settings.shop_name,
            orderNo,
            customerName: customer.name,
            itemsSummary: values.items.map((it) => `${it.product_name} x${it.qty}`).join(', '),
            grandTotal: Number(data.grand_total ?? 0),
            neededDate: values.needed_date,
            publicUrl: `${window.location.origin}/o/${data.public_token}`,
          })
          void sendCustomerEmail(customer.email!, subject, html)
        })
    }

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

        <div className="fixed bottom-16 lg:bottom-0 inset-x-0 bg-white border-t border-stone-200 p-3 max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border-2 border-stone-200 text-stone-700 font-medium px-4 py-2.5"
              >
                ← ย้อนกลับ
              </button>
            )}
            <button
              type="button"
              disabled={savingDraft}
              onClick={() => runSaveDraft()}
              className="rounded-lg border-2 border-stone-200 text-stone-700 font-medium px-4 py-2.5 disabled:opacity-50"
            >
              {savingDraft ? 'กำลังบันทึก...' : '💾 บันทึกร่าง'}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="ml-auto rounded-lg bg-stone-900 text-white font-medium px-6 py-2.5 min-w-[120px]"
              >
                ถัดไป →
              </button>
            ) : (
              <button
                type="button"
                disabled={confirming}
                onClick={methods.handleSubmit((values) => runConfirm(values))}
                className="ml-auto rounded-lg bg-stone-900 text-white font-medium px-6 py-2.5 min-w-[140px] disabled:opacity-50"
              >
                {confirming ? 'กำลังยืนยัน...' : '✓ ยืนยันออเดอร์'}
              </button>
            )}
          </div>
        </div>
      </div>
    </FormProvider>
  )
}
