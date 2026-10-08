-- red team รอบ 2: (1) ยึดอีเมลลูกค้าคนอื่นด้วยเบอร์โทรได้ (2) สั่งรัวท่วมคิวได้ไม่จำกัด — แก้ใน submit_customer_order
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
  p_items jsonb,
  p_promo_code text default null
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
  v_subtotal numeric;
  v_item jsonb;
  v_product record;
  v_promo public.promotions;
  v_cand public.promotions;
  v_disc numeric := 0;
  v_best numeric;
  v_code text := upper(trim(coalesce(p_promo_code, '')));
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

  if p_fulfillment_type = 'pickup' and length(trim(coalesce(p_pickup_place, ''))) = 0 then
    raise exception 'กรุณาระบุสถานที่นัดรับสินค้า';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ';
  end if;

  -- กันสั่งรัวท่วมคิว: เบอร์เดียวไม่เกิน 15 ออเดอร์/วัน และทั้งร้านไม่เกิน 100 ออเดอร์จากลูกค้าที่รอยืนยัน/ชั่วโมง
  if (
    select count(*) from public.orders o join public.customers c on c.id = o.customer_id
    where o.order_source = 'customer' and o.created_at > now() - interval '24 hours'
      and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone_digits
  ) >= 15 then
    raise exception 'สั่งซื้อบ่อยเกินไปในวันนี้ กรุณาติดต่อร้านโดยตรง';
  end if;
  if (
    select count(*) from public.orders where order_source = 'customer' and is_draft and created_at > now() - interval '1 hour'
  ) >= 100 then
    raise exception 'ระบบรับออเดอร์หนาแน่นชั่วคราว กรุณาลองใหม่ภายหลังหรือติดต่อร้านโดยตรง';
  end if;

  -- จับคู่ลูกค้าเดิมด้วยเบอร์ "และอีเมลต้องตรงกัน" (หรือลูกค้าเดิมยังไม่มีอีเมล) — ห้ามใช้เบอร์อย่างเดียว เพราะใครรู้เบอร์ก็ยึดอีเมลของลูกค้าคนนั้นได้
  -- (อีเมลแจ้งสถานะ/ลิงก์ Invoice ของลูกค้าจริงจะไปตกที่ผู้โจมตี) ถ้าเบอร์ตรงแต่อีเมลต่าง = สร้างเป็นลูกค้าคนใหม่แยกกัน
  select id into v_customer_id from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits
      and (email is null or email = '' or lower(email) = lower(v_email))
    order by created_at
    limit 1;

  if v_customer_id is null then
    insert into public.customers (name, phone, email) values (trim(p_customer_name), p_customer_phone, v_email)
      returning id into v_customer_id;
  else
    update public.customers set email = v_email where id = v_customer_id and (email is null or email = '');
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

  select items_total into v_subtotal from public.orders where id = v_order_id;

  -- ส่วนลด: มีโค้ด → ต้องใช้ได้จริง (ไม่งั้นปฏิเสธทั้งออเดอร์ ลูกค้าจะได้แก้โค้ด) / ไม่มีโค้ด → โปรอัตโนมัติที่ลดมากสุด
  if v_code <> '' then
    select * into v_promo from public.promotions where code is not null and upper(code) = v_code;
    if not found or not public.promo_is_live(v_promo) then
      raise exception 'โค้ดส่วนลดไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว';
    end if;
    v_disc := public.promo_discount(v_promo, v_subtotal);
    if v_disc <= 0 then
      raise exception 'ยอดสั่งซื้อยังไม่ถึงขั้นต่ำของโค้ดนี้ (ขั้นต่ำ % บาท)', v_promo.min_subtotal;
    end if;
  else
    v_best := 0;
    for v_cand in select p.* from public.promotions p where p.code is null and public.promo_is_live(p) loop
      if public.promo_discount(v_cand, v_subtotal) > v_best then
        v_best := public.promo_discount(v_cand, v_subtotal);
        v_promo := v_cand;
      end if;
    end loop;
    v_disc := v_best;
  end if;

  if v_disc > 0 then
    -- นับสิทธิ์แบบ atomic กันโควต้าเกินเมื่อมีคนสั่งพร้อมกัน
    update public.promotions set used_count = used_count + 1
      where id = v_promo.id and (usage_limit is null or used_count < usage_limit);
    if not found then
      raise exception 'โปรโมชั่นนี้ถูกใช้ครบสิทธิ์แล้ว';
    end if;
    update public.orders
      set discount_type = 'amount', discount_value = v_disc, promotion_id = v_promo.id,
          promo_label = v_promo.name || case when v_promo.code is not null then ' (' || upper(v_promo.code) || ')' else '' end
      where id = v_order_id;
  end if;

  select grand_total into v_grand_total from public.orders where id = v_order_id;

  return jsonb_build_object('order_id', v_order_id, 'public_token', v_public_token, 'grand_total', v_grand_total, 'discount_amount', v_disc);
end;
$$;
