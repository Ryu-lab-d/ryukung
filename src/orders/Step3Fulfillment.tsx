import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useSettings } from '../settings/useSettings'
import { formatBaht } from '../lib/money'
import { addDays } from '../lib/dates'
import type { OrderFormValues } from './schema'

const FULFILLMENT_LABELS: Record<OrderFormValues['fulfillment_type'], string> = {
  pickup: 'นัดรับเอง',
  shipping: 'ส่งไปรษณีย์/ขนส่ง',
  rider: 'ไรเดอร์ในเมือง',
  self_deliver: 'ไปส่งเอง',
}

export function Step3Fulfillment() {
  const { register, control, setValue, watch, formState: { errors } } = useFormContext<OrderFormValues>()
  const { settings } = useSettings()
  const fulfillmentType = useWatch({ control, name: 'fulfillment_type' })
  const neededDate = useWatch({ control, name: 'needed_date' })
  const items = watch('items')
  const shippingFee = watch('shipping_fee')
  const discountType = watch('discount_type')
  const discountValue = watch('discount_value')

  const itemsTotal = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0)
  const discountAmount = Math.min(
    discountType === 'percent' ? Math.round(itemsTotal * discountValue) / 100 : discountType === 'amount' ? discountValue : 0,
    itemsTotal
  )
  const grandTotal = itemsTotal - discountAmount + shippingFee

  useEffect(() => {
    if (!neededDate) return
    const leadDays = fulfillmentType === 'shipping' ? (settings?.shipping_lead_days ?? 1) : 0
    setValue('bake_date', addDays(neededDate, -leadDays))
  }, [neededDate, fulfillmentType, settings?.shipping_lead_days, setValue])

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="fulfillment_type" className="text-sm text-stone-600">วิธีรับของ</label>
        <select id="fulfillment_type" {...register('fulfillment_type')} className="w-full rounded-lg border border-stone-300 px-3 py-2">
          {Object.entries(FULFILLMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="needed_date" className="text-sm text-stone-600">วันที่ต้องได้ของ</label>
          <input id="needed_date" type="date" {...register('needed_date')} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label htmlFor="bake_date" className="text-sm text-stone-600">วันที่ต้องอบ (แก้ทับได้)</label>
          <input id="bake_date" type="date" {...register('bake_date')} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
        </div>
      </div>

      {fulfillmentType === 'pickup' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="pickup_place" className="text-sm text-stone-600">จุดนัดรับ</label>
            <input id="pickup_place" {...register('pickup_place')} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
            {errors.pickup_place && <p className="text-xs text-red-600">{errors.pickup_place.message}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="pickup_time" className="text-sm text-stone-600">เวลานัดรับ</label>
            <input id="pickup_time" {...register('pickup_time')} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
            {errors.pickup_time && <p className="text-xs text-red-600">{errors.pickup_time.message}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="ship_recipient_name" className="text-sm text-stone-600">ชื่อผู้รับ</label>
              <input id="ship_recipient_name" {...register('ship_recipient_name')} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
              {errors.ship_recipient_name && <p className="text-xs text-red-600">{errors.ship_recipient_name.message}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="ship_recipient_phone" className="text-sm text-stone-600">เบอร์ผู้รับ</label>
              <input id="ship_recipient_phone" {...register('ship_recipient_phone')} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
              {errors.ship_recipient_phone && <p className="text-xs text-red-600">{errors.ship_recipient_phone.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="ship_address_text" className="text-sm text-stone-600">ที่อยู่จัดส่ง</label>
            <textarea id="ship_address_text" {...register('ship_address_text')} className="w-full rounded-lg border border-stone-300 px-3 py-2" />
            {errors.ship_address_text && <p className="text-xs text-red-600">{errors.ship_address_text.message}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="shipping_fee" className="text-sm text-stone-600">ค่าส่ง</label>
          <input
            id="shipping_fee" type="number" step="0.01" min="0" inputMode="decimal"
            {...register('shipping_fee', { valueAsNumber: true })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="discount_value" className="text-sm text-stone-600">ส่วนลด</label>
          <div className="flex gap-1">
            <select {...register('discount_type')} className="rounded-lg border border-stone-300 px-2 py-2 text-sm">
              <option value="none">ไม่มี</option>
              <option value="amount">บาท</option>
              <option value="percent">%</option>
            </select>
            <input
              id="discount_value" type="number" step="0.01" min="0" inputMode="decimal"
              {...register('discount_value', { valueAsNumber: true })}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-stone-50 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>รวมสินค้า</span><span>{formatBaht(itemsTotal)}</span></div>
        <div className="flex justify-between"><span>ส่วนลด</span><span>-{formatBaht(discountAmount)}</span></div>
        <div className="flex justify-between"><span>ค่าส่ง</span><span>{formatBaht(shippingFee)}</span></div>
        <div className="flex justify-between font-semibold text-base"><span>ยอดรวม</span><span>{formatBaht(grandTotal)}</span></div>
      </div>
    </div>
  )
}
