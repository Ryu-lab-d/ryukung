-- บังคับให้ลูกค้าที่เลือก "นัดรับเอง" ระบุสถานที่นัดรับ (pickup_place) — ค่านี้ไหลไปแสดงที่หน้าติดตามออเดอร์ของลูกค้า
-- และหน้ารายละเอียดออเดอร์ฝั่งพนักงานอยู่แล้ว (คอลัมน์เดียวกัน) เปลี่ยนแค่ตัวฟังก์ชัน signature เดิม สิทธิ์เดิมคงอยู่
create or replace function public.submit_customer_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
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
  v_email text;
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

  v_email := trim(coalesce(p_customer_email, ''));
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'กรุณากรอกอีเมลให้ถูกต้อง';
  end if;

  if p_fulfillment_type not in ('pickup', 'shipping') then
    raise exception 'วิธีรับของไม่ถูกต้อง';
  end if;

  -- นัดรับเอง: ต้องระบุจุดนัดรับเสมอ (หลังบ้านบังคับกรอกอยู่แล้วที่ฟอร์มพนักงาน — ฝั่งลูกค้าเคยส่งค่าว่างไปตลอดเพราะไม่มีช่องกรอก)
  if p_fulfillment_type = 'pickup' and length(trim(coalesce(p_pickup_place, ''))) = 0 then
    raise exception 'กรุณาระบุสถานที่นัดรับสินค้า';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ';
  end if;

  select id into v_customer_id from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits
    limit 1;

  if v_customer_id is null then
    insert into public.customers (name, phone, email) values (trim(p_customer_name), p_customer_phone, v_email)
      returning id into v_customer_id;
  else
    -- ลูกค้าเดิม (จับคู่จากเบอร์) — ซิงค์อีเมลล่าสุดที่กรอกตอนสั่งครั้งนี้เข้าไปเสมอ กันเคสไม่เคยมีอีเมลผูกไว้เลย
    update public.customers set email = v_email where id = v_customer_id and email is distinct from v_email;
  end if;

  insert into public.orders (
    is_draft, order_source, customer_id, fulfillment_type, needed_date,
    pickup_place, pickup_time, ship_recipient_name, ship_recipient_phone, ship_address_text,
    note, payment_claimed_at
  ) values (
    true, 'customer', v_customer_id, p_fulfillment_type, p_needed_date,
    nullif(trim(p_pickup_place), ''), p_pickup_time, p_ship_recipient_name, p_ship_recipient_phone, p_ship_address_text,
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
