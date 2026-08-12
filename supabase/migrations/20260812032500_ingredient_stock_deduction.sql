-- ปรับสต็อกวัตถุดิบตามรายการสินค้าทั้งใบของออเดอร์หนึ่งใบ ใช้ทั้งตอนยืนยัน/แก้ไขออเดอร์ (จาก confirm_order) และตอนยกเลิก (จาก trigger ด้านล่าง)
-- p_direction: 'deduct' = หักสต็อก (ออเดอร์ใช้วัตถุดิบไป), 'restore' = คืนสต็อก (ยกเลิก หรือแก้ไขออกจากรายการเดิม)
-- สินค้าที่ไม่มีสูตรผูกไว้ใน product_ingredients จะไม่มีผลอะไรเลย (no-op) — ค่อยๆ ใส่สูตรทีละสินค้าได้ ไม่บังคับใส่ให้ครบก่อน
create or replace function public.adjust_stock_for_order(
  p_order_id uuid,
  p_direction text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sign numeric := case when p_direction = 'deduct' then -1 else 1 end;
begin
  with usage as (
    select pi.ingredient_id, sum(pi.qty_per_unit * oi.qty) as total_qty
    from public.order_items oi
    join public.product_ingredients pi on pi.product_id = oi.product_id
    where oi.order_id = p_order_id
    group by pi.ingredient_id
  )
  update public.ingredients i
  set stock_qty = i.stock_qty + (v_sign * u.total_qty)
  from usage u
  where i.id = u.ingredient_id;

  insert into public.ingredient_stock_movements (ingredient_id, qty_delta, reason, ref_order_id)
  select pi.ingredient_id, v_sign * sum(pi.qty_per_unit * oi.qty), p_reason, p_order_id
  from public.order_items oi
  join public.product_ingredients pi on pi.product_id = oi.product_id
  where oi.order_id = p_order_id
  group by pi.ingredient_id;
end;
$$;

-- แทนที่ confirm_order เดิม: เพิ่มการตัด/คืนสต็อกวัตถุดิบ + แก้บั๊กเดิมที่เคยออกเลขที่ออเดอร์ใหม่ทุกครั้งที่กด "ยืนยันออเดอร์" ซ้ำ
-- (ตอนนี้จะออกเลขแค่ครั้งแรกที่ยืนยันเท่านั้น ครั้งต่อไปที่แก้ไขแล้วกดยืนยันซ้ำจะคงเลขเดิมไว้)
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
  v_was_confirmed boolean;
begin
  select not is_draft into v_was_confirmed from public.orders where id = p_order_id;

  if v_was_confirmed then
    perform public.adjust_stock_for_order(p_order_id, 'restore', 'order_edit_reverse');
  end if;

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

  perform public.adjust_stock_for_order(p_order_id, 'deduct', 'order_confirm');

  if v_was_confirmed then
    select order_no into v_order_no from public.orders where id = p_order_id;
  else
    v_order_no := public.next_order_no();
  end if;

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

-- คืนสต็อกวัตถุดิบอัตโนมัติเมื่อออเดอร์ที่เคยยืนยันแล้วถูกยกเลิก (กันซ้ำ: แค่ transition งาน 'cancelled' ครั้งแรกเท่านั้น
-- และเฉพาะออเดอร์ที่เคยยืนยันแล้ว is_draft=false เพราะร่างไม่เคยถูกตัดสต็อกไปตั้งแต่แรก)
create or replace function public.restore_stock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.work_status = 'cancelled' and old.work_status <> 'cancelled' and old.is_draft = false then
    perform public.adjust_stock_for_order(new.id, 'restore', 'order_cancel_restore');
  end if;
  return new;
end;
$$;

create trigger orders_restore_stock_on_cancel_trg
  after update on public.orders
  for each row execute function public.restore_stock_on_cancel();

-- เบิกของไปขายนอกร้าน (stock_withdrawals) ก็ใช้วัตถุดิบจริงเหมือนออเดอร์ปกติ ตัดสต็อกตอนบันทึกรายการเบิก คืนสต็อกถ้าลบรายการนั้นทิ้ง
create or replace function public.adjust_stock_for_withdrawal_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_sign numeric;
  v_qty numeric;
  v_product_id uuid;
  v_ref_id uuid;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_sign := -1; v_qty := new.qty_out; v_product_id := new.product_id; v_ref_id := new.withdrawal_id; v_reason := 'withdrawal_deduct';
  else
    v_sign := 1; v_qty := old.qty_out; v_product_id := old.product_id; v_ref_id := old.withdrawal_id; v_reason := 'withdrawal_restore';
  end if;

  if v_product_id is null then
    return coalesce(new, old);
  end if;

  for v_row in
    select ingredient_id, qty_per_unit from public.product_ingredients where product_id = v_product_id
  loop
    update public.ingredients set stock_qty = stock_qty + (v_sign * v_row.qty_per_unit * v_qty) where id = v_row.ingredient_id;
    insert into public.ingredient_stock_movements (ingredient_id, qty_delta, reason, ref_withdrawal_id)
    values (v_row.ingredient_id, v_sign * v_row.qty_per_unit * v_qty, v_reason, v_ref_id);
  end loop;

  return coalesce(new, old);
end;
$$;

create trigger stock_withdrawal_items_adjust_stock_trg
  after insert or delete on public.stock_withdrawal_items
  for each row execute function public.adjust_stock_for_withdrawal_item();

-- เติมสต็อก (ซื้อวัตถุดิบเข้ามาใหม่) — คำนวณต้นทุนเฉลี่ยถ่วงน้ำหนัก (moving average) ให้อัตโนมัติถ้าใส่ราคาซื้อมาด้วย
create or replace function public.restock_ingredient(
  p_ingredient_id uuid,
  p_qty numeric,
  p_price_per_unit numeric,
  p_note text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_stock numeric;
  v_old_cost numeric;
  v_new_cost numeric;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์ทำรายการนี้';
  end if;

  select stock_qty, cost_per_unit into v_old_stock, v_old_cost from public.ingredients where id = p_ingredient_id for update;

  v_new_cost := case
    when p_price_per_unit is not null and p_price_per_unit > 0 and (v_old_stock + p_qty) > 0
      then ((v_old_stock * v_old_cost) + (p_qty * p_price_per_unit)) / (v_old_stock + p_qty)
    when p_price_per_unit is not null and p_price_per_unit > 0
      then p_price_per_unit
    else v_old_cost
  end;

  update public.ingredients set stock_qty = stock_qty + p_qty, cost_per_unit = v_new_cost where id = p_ingredient_id;

  insert into public.ingredient_stock_movements (ingredient_id, qty_delta, reason, note)
  values (p_ingredient_id, p_qty, 'purchase_in', p_note);
end;
$$;

grant execute on function public.restock_ingredient(uuid, numeric, numeric, text) to authenticated;

-- ปรับสต็อกเอง เช่น นับได้ไม่ตรง ของเสียหาย — ไม่กระทบต้นทุนเฉลี่ยต่อหน่วย (ต่างจาก restock_ingredient)
create or replace function public.adjust_ingredient_stock(
  p_ingredient_id uuid,
  p_qty_delta numeric,
  p_note text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์ทำรายการนี้';
  end if;

  update public.ingredients set stock_qty = stock_qty + p_qty_delta where id = p_ingredient_id;

  insert into public.ingredient_stock_movements (ingredient_id, qty_delta, reason, note)
  values (p_ingredient_id, p_qty_delta, 'manual_adjustment', p_note);
end;
$$;

grant execute on function public.adjust_ingredient_stock(uuid, numeric, text) to authenticated;
