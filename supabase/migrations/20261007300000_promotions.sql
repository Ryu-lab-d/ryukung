-- โปรโมชั่น/ส่วนลดของหน้าสั่งซื้อลูกค้า (/menu)
--  * โปรอัตโนมัติ (code เป็น null): ลูกค้าไม่ต้องกรอกอะไร ระบบใช้ให้เองถ้ายอดถึงเงื่อนไข (เลือกอันที่ลดมากสุดอันเดียว)
--  * โค้ดส่วนลด (มี code): ลูกค้ากรอกเองตอนทวนรายการ ถ้าโค้ดใช้ได้จะใช้แทนโปรอัตโนมัติ
-- ตัวเลขส่วนลดคิดซ้ำที่เซิร์ฟเวอร์ใน submit_customer_order เสมอ (ไม่เชื่อค่าที่หน้าเว็บส่งมา) แล้วเก็บลง orders.discount_* ที่มีอยู่เดิม
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  code text,
  kind text not null check (kind in ('percent', 'amount')),
  value numeric(10,2) not null check (value > 0),
  min_subtotal numeric(10,2) not null default 0 check (min_subtotal >= 0),
  max_discount numeric(10,2) check (max_discount is null or max_discount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);
create unique index promotions_code_uidx on public.promotions (upper(code)) where code is not null;

alter table public.promotions enable row level security;
create policy promotions_manage on public.promotions for all to authenticated
  using (public.is_manager_or_owner()) with check (public.is_manager_or_owner());

alter table public.orders add column if not exists promotion_id uuid references public.promotions(id) on delete set null;
alter table public.orders add column if not exists promo_label text;

create or replace function public.promo_is_live(p public.promotions)
returns boolean
language sql
stable
as $$
  select p.is_active
    and (p.starts_at is null or p.starts_at <= now())
    and (p.ends_at is null or p.ends_at > now())
    and (p.usage_limit is null or p.used_count < p.usage_limit)
$$;

-- ส่วนลดของโปรนี้ที่ยอดสินค้า p_subtotal (0 ถ้ายังไม่ถึงขั้นต่ำ) ไม่เกินยอดสินค้า
create or replace function public.promo_discount(p public.promotions, p_subtotal numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_subtotal <= 0 or p_subtotal < p.min_subtotal then 0
    else least(
      p_subtotal,
      case when p.kind = 'percent'
        then least(round(p_subtotal * p.value / 100, 2), coalesce(p.max_discount, round(p_subtotal * p.value / 100, 2)))
        else p.value end
    )
  end
$$;

-- โปรอัตโนมัติที่ใช้ได้ตอนนี้ (แสดงแบนเนอร์ในหน้าเมนู + ให้หน้าเว็บคำนวณพรีวิว)
create or replace function public.get_public_promotions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'kind', p.kind, 'value', p.value,
    'min_subtotal', p.min_subtotal, 'max_discount', p.max_discount, 'ends_at', p.ends_at
  ) order by p.created_at), '[]'::jsonb)
  from public.promotions p
  where p.code is null and public.promo_is_live(p)
$$;

-- ตรวจโค้ดที่ลูกค้ากรอก (พรีวิวเท่านั้น — ตอนสั่งจริงตรวจซ้ำอีกครั้งที่ submit_customer_order)
create or replace function public.check_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  p public.promotions;
begin
  select * into p from public.promotions where code is not null and upper(code) = upper(trim(coalesce(p_code, '')));
  if not found or not public.promo_is_live(p) then
    return jsonb_build_object('valid', false, 'message', 'โค้ดส่วนลดไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว');
  end if;
  return jsonb_build_object('valid', true, 'promotion', jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description, 'code', upper(p.code), 'kind', p.kind, 'value', p.value,
    'min_subtotal', p.min_subtotal, 'max_discount', p.max_discount, 'ends_at', p.ends_at
  ));
end;
$$;

revoke execute on function public.get_public_promotions() from public;
revoke execute on function public.check_promo_code(text) from public;
grant execute on function public.get_public_promotions() to anon, authenticated;
grant execute on function public.check_promo_code(text) to anon, authenticated;

-- submit_customer_order เพิ่มพารามิเตอร์ p_promo_code (ตัวสุดท้าย ค่าเริ่มต้น null) — ลบ signature เดิมทิ้งกันฟังก์ชันซ้อนกันสองตัว
drop function if exists public.submit_customer_order(text, text, text, text, date, text, text, text, text, text, text, jsonb);

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

  select id into v_customer_id from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits
    limit 1;

  if v_customer_id is null then
    insert into public.customers (name, phone, email) values (trim(p_customer_name), p_customer_phone, v_email)
      returning id into v_customer_id;
  else
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

revoke execute on function public.submit_customer_order(
  text, text, text, text, date, text, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.submit_customer_order(
  text, text, text, text, date, text, text, text, text, text, text, jsonb, text
) to service_role;
