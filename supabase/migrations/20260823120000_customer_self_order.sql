-- ระบบให้ลูกค้าสั่งของเองจากหน้าเมนูออนไลน์ (/menu) — ออเดอร์ที่ลูกค้าส่งมาต้องรอเจ้าของร้าน/พนักงานกดยืนยัน
-- ก่อนเสมอ (ไม่เข้าคิวอบทันที เพราะร้านมีกำลังผลิตจำกัดต่อวัน) จึงต้องแยกให้ชัดว่า is_draft=true แถวไหนเป็น
-- "ลูกค้าส่งมารอตรวจ" กับ "พนักงานพิมพ์ค้างไว้เฉยๆ" — ไม่งั้น useAbandonedDrafts.ts จะเสนอลบออเดอร์ลูกค้าทิ้ง
-- และ BoardDesktop.tsx จะซ่อนออเดอร์นี้จาก kanban ไปเลยเพราะกรองเอา draft ออกทั้งหมด
alter table public.orders add column order_source text not null default 'staff' check (order_source in ('staff', 'customer'));

-- เมนูสาธารณะ — เฉพาะฟิลด์ที่ปลอดภัยให้ลูกค้าเห็นเท่านั้น (ไม่มี cost/note หลุดออกไปแน่นอน เหมือน get_public_order)
create or replace function public.get_public_menu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'shop_name',   (select shop_name from public.settings limit 1),
    'logo_path',   (select logo_path from public.settings limit 1),
    'promptpay',   (select promptpay from public.settings limit 1),
    'shipping_lead_days', (select shipping_lead_days from public.settings limit 1),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
      from public.categories where is_active = true
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'price', price, 'unit', unit, 'image_path', image_path, 'category_id', category_id
      ) order by name)
      from public.products where is_active = true
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.get_public_menu() to anon, authenticated;

-- ลูกค้าส่งออเดอร์เอง — สร้างลูกค้า (จับคู่จากเบอร์โทรถ้าเคยสั่งมาก่อน) + ออเดอร์แบบ is_draft=true,
-- order_source='customer' (ยังไม่เข้าคิวอบจนกว่าพนักงานจะกดยืนยันผ่าน confirm_order เดิม) — ราคา/ต้นทุนต่อชิ้น
-- ดึงจากตาราง products ฝั่งเซิร์ฟเวอร์เองเสมอ ไม่เชื่อค่าที่ client ส่งมา กันลูกค้าปลอมราคาสินค้า
create or replace function public.submit_customer_order(
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_type text,
  p_needed_date date,
  p_pickup_place text,
  p_pickup_time text,
  p_ship_recipient_name text,
  p_ship_recipient_phone text,
  p_ship_address_text text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone_digits text;
  v_customer_id uuid;
  v_order_id uuid;
  v_public_token text;
  v_grand_total numeric;
  v_item jsonb;
  v_product record;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'กรุณากรอกชื่อผู้สั่งซื้อ';
  end if;

  v_phone_digits := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  if length(v_phone_digits) < 9 then
    raise exception 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง';
  end if;

  if p_fulfillment_type not in ('pickup', 'shipping') then
    raise exception 'วิธีรับของไม่ถูกต้อง';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ';
  end if;

  select id into v_customer_id from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits
    limit 1;

  if v_customer_id is null then
    insert into public.customers (name, phone) values (trim(p_customer_name), p_customer_phone)
      returning id into v_customer_id;
  end if;

  insert into public.orders (
    is_draft, order_source, customer_id, fulfillment_type, needed_date,
    pickup_place, pickup_time, ship_recipient_name, ship_recipient_phone, ship_address_text,
    note, payment_claimed_at
  ) values (
    true, 'customer', v_customer_id, p_fulfillment_type, p_needed_date,
    p_pickup_place, p_pickup_time, p_ship_recipient_name, p_ship_recipient_phone, p_ship_address_text,
    p_note, now()
  ) returning id, public_token into v_order_id, v_public_token;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select id, name, price, cost into v_product from public.products
      where id = (v_item->>'product_id')::uuid and is_active = true;

    if v_product.id is null then
      raise exception 'สินค้าบางรายการไม่มีอยู่หรือปิดขายไปแล้ว กรุณาลองใหม่';
    end if;

    insert into public.order_items (order_id, product_id, product_name, unit_price, unit_cost, qty)
      values (v_order_id, v_product.id, v_product.name, v_product.price, v_product.cost, (v_item->>'qty')::numeric);
  end loop;

  select grand_total into v_grand_total from public.orders where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'public_token', v_public_token, 'grand_total', v_grand_total);
end;
$$;

grant execute on function public.submit_customer_order(
  text, text, text, date, text, text, text, text, text, text, jsonb
) to anon, authenticated;

-- พนักงานปฏิเสธออเดอร์ที่ลูกค้าส่งมา (เช่น คิวอบเต็มวันนั้น) — ออกเลขที่ให้เป็นหลักฐานแม้ยกเลิก ตั้งสถานะรอ
-- คืนเงินถ้าลูกค้าจ่ายมาแล้ว (คืนเงินจริงพนักงานทำเองนอกระบบ นี่แค่บันทึกสถานะเตือนความจำ ตรงกับ
-- refund_status ที่มีอยู่แล้วในระบบตอนยกเลิกออเดอร์ปกติ)
create or replace function public.reject_customer_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_no text;
  v_payment_claimed_at timestamptz;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;

  select order_no, payment_claimed_at into v_order_no, v_payment_claimed_at
    from public.orders
    where id = p_order_id and is_draft = true and order_source = 'customer';

  if not found then
    raise exception 'ไม่พบออเดอร์นี้ หรือถูกจัดการไปแล้ว';
  end if;

  if v_order_no is null then
    v_order_no := public.next_order_no();
  end if;

  update public.orders set
    is_draft = false,
    work_status = 'cancelled',
    refund_status = case when v_payment_claimed_at is not null then 'pending' else 'none' end,
    cancelled_reason = p_reason,
    order_no = v_order_no
  where id = p_order_id;
end;
$$;

grant execute on function public.reject_customer_order(uuid, text) to authenticated;

-- แก้บั๊กที่เจอระหว่างสำรวจ (ไม่เกี่ยวกับฟีเจอร์นี้โดยตรง): confirm_order เวอร์ชันก่อนหน้าทำจากการเพิ่มการตัด
-- สต็อกวัตถุดิบ (20260812032500) ทำให้เช็คสิทธิ์ is_active_member() ที่เคยมีในเวอร์ชันก่อนหน้านั้นหลุดหายไป
-- เติมกลับให้ครบ — โค้ดส่วนอื่นเหมือนเดิมทุกตัวอักษร
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
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;

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
