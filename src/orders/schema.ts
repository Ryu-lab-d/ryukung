import { z } from 'zod'

const itemSchema = z.object({
  product_id: z.string().nullable(),
  product_name: z.string().min(1),
  unit_price: z.number().nonnegative(),
  unit_cost: z.number().nonnegative(),
  qty: z.number().positive(),
  note: z.string().nullable(),
})

export function buildOrderSchema(requireFullInfo: boolean) {
  return z
    .object({
      customer_id: z.string().nullable(),
      fulfillment_type: z.enum(['pickup', 'shipping', 'rider', 'self_deliver']),
      needed_date: z.string().nullable(),
      bake_date: z.string().nullable(),
      pickup_place: z.string().nullable(),
      pickup_time: z.string().nullable(),
      ship_recipient_name: z.string().nullable(),
      ship_recipient_phone: z.string().nullable(),
      ship_address_text: z.string().nullable(),
      shipping_fee: z.number().nonnegative(),
      discount_type: z.enum(['none', 'amount', 'percent']),
      discount_value: z.number().nonnegative(),
      note: z.string().nullable(),
      items: z.array(itemSchema).min(1, 'ต้องมีสินค้าอย่างน้อยหนึ่งรายการ'),
    })
    .superRefine((order, ctx) => {
      if (!requireFullInfo) return

      const needsShippingInfo = ['shipping', 'rider', 'self_deliver'].includes(order.fulfillment_type)
      if (needsShippingInfo) {
        if (!order.ship_recipient_name) {
          ctx.addIssue({ code: 'custom', path: ['ship_recipient_name'], message: 'กรุณาใส่ชื่อผู้รับ' })
        }
        if (!order.ship_recipient_phone) {
          ctx.addIssue({ code: 'custom', path: ['ship_recipient_phone'], message: 'กรุณาใส่เบอร์โทรผู้รับ' })
        }
        if (!order.ship_address_text) {
          ctx.addIssue({ code: 'custom', path: ['ship_address_text'], message: 'กรุณาใส่ที่อยู่จัดส่ง' })
        }
      } else {
        if (!order.pickup_place) {
          ctx.addIssue({ code: 'custom', path: ['pickup_place'], message: 'กรุณาใส่จุดนัดรับ' })
        }
        if (!order.pickup_time) {
          ctx.addIssue({ code: 'custom', path: ['pickup_time'], message: 'กรุณาใส่เวลานัดรับ' })
        }
      }
    })
}

export type OrderFormValues = z.infer<ReturnType<typeof buildOrderSchema>>
