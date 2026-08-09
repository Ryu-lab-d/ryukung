-- ลูกค้ากด "ยืนยันการชำระเงิน" เองหลังโอนเงินแล้ว — แค่แจ้งเตือนร้าน ไม่ได้ตัดสถานะจ่ายเงินอัตโนมัติ
-- (ต้องรอเจ้าหน้าที่ตรวจสอบสลิป/ยอดจริงก่อนเสมอ ตามที่ตกลงกันไว้)
alter table public.orders add column payment_claimed_at timestamptz;

create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_name text;
  v_paid_total numeric;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;

  select * into v_order
    from public.orders
   where public_token = p_token
     and is_draft = false
     and work_status <> 'cancelled';

  if not found then
    return null;
  end if;

  select name into v_customer_name from public.customers where id = v_order.customer_id;
  select coalesce(sum(amount), 0) into v_paid_total from public.payments where order_id = v_order.id;

  select jsonb_build_object(
    'shop_name',             (select shop_name from public.settings limit 1),
    'payment_instructions',  (select payment_instructions from public.settings limit 1),
    'promptpay',              (select promptpay from public.settings limit 1),
    'faqs',                  (select faqs from public.settings limit 1),
    'line_url',              (select line_url from public.settings limit 1),
    'order_no',               v_order.order_no,
    'customer_name',          v_customer_name,
    'needed_date',            v_order.needed_date,
    'fulfillment_type',       v_order.fulfillment_type,
    'pickup_place',           v_order.pickup_place,
    'pickup_time',            v_order.pickup_time,
    'ship_recipient_name',    v_order.ship_recipient_name,
    'ship_recipient_phone',   v_order.ship_recipient_phone,
    'ship_address_text',      v_order.ship_address_text,
    'work_status',            v_order.work_status,
    'payment_status',         v_order.payment_status,
    'payment_claimed_at',     v_order.payment_claimed_at,
    'items_total',            v_order.items_total,
    'discount_amount',        v_order.discount_amount,
    'shipping_fee',           v_order.shipping_fee,
    'grand_total',            v_order.grand_total,
    'balance_due',            greatest(v_order.grand_total - v_paid_total, 0),
    'carrier',                v_order.carrier,
    'tracking_no',            v_order.tracking_no,
    'note',                   v_order.note,
    'address_editable',       v_order.fulfillment_type <> 'pickup' and v_order.work_status in ('to_bake', 'baking'),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_name', oi.product_name,
          'unit_price',   oi.unit_price,
          'qty',          oi.qty,
          'line_total',   oi.line_total,
          'note',         oi.note
        ) order by oi.created_at
      )
      from public.order_items oi
      where oi.order_id = v_order.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_public_order(text) to anon, authenticated;
