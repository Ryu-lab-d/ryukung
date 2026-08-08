export type OrderItemInput = {
  product_id: string | null
  product_name: string
  unit_price: number
  unit_cost: number
  qty: number
  note: string | null
}

export type OrderDraftInput = {
  customer_id: string | null
  fulfillment_type: 'pickup' | 'shipping' | 'rider' | 'self_deliver'
  needed_date: string | null
  bake_date: string | null
  pickup_place: string | null
  pickup_time: string | null
  ship_recipient_name: string | null
  ship_recipient_phone: string | null
  ship_address_text: string | null
  shipping_fee: number
  discount_type: 'none' | 'amount' | 'percent'
  discount_value: number
  note: string | null
  items: OrderItemInput[]
}
