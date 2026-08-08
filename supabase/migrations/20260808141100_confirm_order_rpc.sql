create or replace function public.confirm_order(
  p_order_id uuid,
  p_customer_id uuid,
  p_fulfillment_type text,
  p_needed_date date,
  p_bake_date date,
  p_pickup_place text,
  p_pickup_time text,
  p_ship_recipient_name text,
  p_ship_recipient_phone text,
  p_ship_address_text text,
  p_shipping_fee numeric,
  p_discount_type text,
  p_discount_value numeric,
  p_note text,
  p_items jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_no text;
begin
  delete from public.order_items where order_id = p_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_price, unit_cost, qty, note)
  select
    p_order_id,
    (item->>'product_id')::uuid,
    item->>'product_name',
    (item->>'unit_price')::numeric,
    (item->>'unit_cost')::numeric,
    (item->>'qty')::numeric,
    item->>'note'
  from jsonb_array_elements(p_items) as item;

  v_order_no := public.next_order_no();

  update public.orders set
    customer_id = p_customer_id,
    fulfillment_type = p_fulfillment_type,
    needed_date = p_needed_date,
    bake_date = p_bake_date,
    pickup_place = p_pickup_place,
    pickup_time = p_pickup_time,
    ship_recipient_name = p_ship_recipient_name,
    ship_recipient_phone = p_ship_recipient_phone,
    ship_address_text = p_ship_address_text,
    shipping_fee = p_shipping_fee,
    discount_type = p_discount_type,
    discount_value = p_discount_value,
    note = p_note,
    order_no = v_order_no,
    is_draft = false
  where id = p_order_id;

  return v_order_no;
end;
$$;

grant execute on function public.confirm_order(
  uuid, uuid, text, date, date, text, text, text, text, text, numeric, text, numeric, text, jsonb
) to authenticated;
