-- ระบบสิทธิ์พนักงาน: ก่อนหน้านี้ authenticated ทุกคน (ใครก็ได้ที่ล็อกอินสำเร็จ) เข้าถึงข้อมูลได้หมดทุกตาราง
-- เพราะออกแบบไว้ให้มีแค่เจ้าของร้านคนเดียว ตอนนี้เปิดให้สมัครเป็นพนักงานได้ (ยืนยันอีเมลก่อนถึงจะล็อกอินได้อยู่แล้ว
-- เพราะปิด mailer_autoconfirm ไว้) จึงต้องเพิ่มตารางเก็บสิทธิ์และคุมทุก policy ใหม่ ไม่ให้บัญชีที่ยังไม่ได้รับอนุมัติ
-- เข้าถึงอะไรได้เลยแม้แต่นิดเดียว
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  -- null ได้ตอนเจ้าของร้าน "เชิญ" ด้วยอีเมลไว้ล่วงหน้าแต่พนักงานยังไม่ได้สมัครจริง พอสมัครแล้วค่อยผูก user_id ทีหลัง
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now()
);

create unique index staff_members_email_lower_idx on public.staff_members (lower(email));

-- ผู้ใช้ที่ล็อกอินอยู่ก่อนมีระบบนี้ (เจ้าของร้านคนเดียว) กลายเป็น owner โดยอัตโนมัติตอนย้ายฐานข้อมูล
insert into public.staff_members (user_id, email, role, status)
select id, email, 'owner', 'active' from auth.users
on conflict (user_id) do nothing;

alter table public.staff_members enable row level security;

-- ฟังก์ชันช่วยเช็กสิทธิ์ ใช้ security definer เพื่อไม่ให้ policy ที่อ้างถึงตารางเดียวกันวนเช็กตัวเองไม่รู้จบ
create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = auth.uid() and role = 'owner' and status = 'active'
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = auth.uid() and status = 'active'
  );
$$;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_active_member() to authenticated;

create policy staff_members_select on public.staff_members
  for select to authenticated using (user_id = auth.uid() or public.is_owner());
create policy staff_members_owner_invite on public.staff_members
  for insert to authenticated with check (public.is_owner());
create policy staff_members_owner_manage on public.staff_members
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy staff_members_owner_delete on public.staff_members
  for delete to authenticated using (public.is_owner());

-- พนักงานสมัครเข้ามาเอง (ยืนยันอีเมลแล้วล็อกอินครั้งแรก) เรียกฟังก์ชันนี้เพื่อผูกสิทธิ์ — ถ้าเจ้าของร้าน
-- เคย "เชิญ" อีเมลนี้ไว้ล่วงหน้า จะผูกและอนุมัติให้ทันที (การยืนยันอีเมลถือเป็นการยืนยันตัวตนเพียงพอแล้ว
-- เพราะเจ้าของร้านอนุมัติชื่อไว้ล่วงหน้าอยู่แล้ว) ถ้าไม่เคยเชิญไว้ (มาสมัครเองเฉยๆ) จะสร้างสถานะรออนุมัติไว้
-- ให้เจ้าของร้านมาอนุมัติเองอีกที ไม่ให้เข้าถึงอะไรได้จนกว่าจะอนุมัติ
create or replace function public.claim_staff_invite(p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.email();
  v_matched uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'ต้องล็อกอินก่อน';
  end if;

  select status into v_status from public.staff_members where user_id = auth.uid();
  if v_status is not null then
    return v_status;
  end if;

  select id into v_matched
    from public.staff_members
   where lower(email) = lower(v_email) and user_id is null and status = 'pending'
   limit 1;

  if v_matched is not null then
    update public.staff_members
       set user_id = auth.uid(), status = 'active', display_name = coalesce(p_display_name, display_name)
     where id = v_matched;
    return 'active';
  end if;

  insert into public.staff_members (user_id, email, display_name, role, status)
  values (auth.uid(), v_email, p_display_name, 'staff', 'pending');
  return 'pending';
end;
$$;

grant execute on function public.claim_staff_invite(text) to authenticated;

-- settings: พนักงานอ่านได้ (ต้องใช้ตอนสร้างออเดอร์/พิมพ์ใบเสร็จ) แต่แก้ไขได้เฉพาะเจ้าของร้าน
drop policy settings_select on public.settings;
drop policy settings_update on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (public.is_active_member());
create policy settings_update on public.settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- ตารางงานหลักของร้าน: เจ้าของร้านและพนักงานที่ active เข้าถึงได้เท่ากันตามที่ตกลงกันไว้
drop policy categories_all on public.categories;
create policy categories_all on public.categories
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

drop policy products_all on public.products;
create policy products_all on public.products
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

drop policy customers_all on public.customers;
create policy customers_all on public.customers
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

drop policy customer_addresses_all on public.customer_addresses;
create policy customer_addresses_all on public.customer_addresses
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

drop policy orders_all on public.orders;
create policy orders_all on public.orders
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

drop policy order_items_all on public.order_items;
create policy order_items_all on public.order_items
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

drop policy payments_all on public.payments;
create policy payments_all on public.payments
  for all to authenticated using (public.is_active_member()) with check (public.is_active_member());

drop policy receipts_select on public.receipts;
drop policy receipts_insert on public.receipts;
drop policy receipts_cancel on public.receipts;
create policy receipts_select on public.receipts
  for select to authenticated using (public.is_active_member());
create policy receipts_insert on public.receipts
  for insert to authenticated with check (public.is_active_member());
create policy receipts_cancel on public.receipts
  for update to authenticated using (status = 'issued' and public.is_active_member()) with check (public.is_active_member());

-- storage: รูปสินค้าดูได้แบบสาธารณะอยู่แล้ว (ไม่มีข้อมูลอ่อนไหว) แต่แก้ไข/ลบ และสลิปโอนเงินต้องเป็นสมาชิก active เท่านั้น
drop policy product_images_write on storage.objects;
drop policy product_images_update on storage.objects;
drop policy product_images_delete on storage.objects;
create policy product_images_write on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_active_member());
create policy product_images_update on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_active_member());
create policy product_images_delete on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_active_member());

drop policy slips_read on storage.objects;
drop policy slips_write on storage.objects;
drop policy slips_delete on storage.objects;
create policy slips_read on storage.objects
  for select to authenticated using (bucket_id = 'slips' and public.is_active_member());
create policy slips_write on storage.objects
  for insert to authenticated with check (bucket_id = 'slips' and public.is_active_member());
create policy slips_delete on storage.objects
  for delete to authenticated using (bucket_id = 'slips' and public.is_active_member());

-- RPC ที่ security definer เดิมข้าม RLS อยู่แล้ว ต้องเช็กสิทธิ์เองในตัวฟังก์ชัน ไม่งั้นบัญชีที่ยังไม่อนุมัติ
-- จะเรียกออกเลขออเดอร์/ยืนยันออเดอร์/ออกใบเสร็จได้ทั้งที่ RLS ของตารางบล็อกไว้แล้วก็ตาม (RPC ไม่ผ่าน RLS)
create or replace function public.next_order_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_num bigint;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;
  select order_no_prefix into v_prefix from public.settings limit 1;
  v_num := nextval('public.order_no_seq');
  return coalesce(v_prefix, 'RYB') || '-' || lpad(v_num::text, 6, '0');
end;
$$;

create or replace function public.next_receipt_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_num bigint;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;
  select receipt_no_prefix into v_prefix from public.settings limit 1;
  v_num := nextval('public.receipt_no_seq');
  return coalesce(v_prefix, 'RC') || '-' || lpad(v_num::text, 6, '0');
end;
$$;

create or replace function public.confirm_order(
  p_order_id uuid, p_customer_id uuid, p_fulfillment_type text, p_needed_date date, p_bake_date date,
  p_pickup_place text, p_pickup_time text, p_ship_recipient_name text, p_ship_recipient_phone text,
  p_ship_address_text text, p_shipping_fee numeric, p_discount_type text, p_discount_value numeric,
  p_note text, p_items jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_no text;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
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

create or replace function public.issue_receipt(p_order_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_no text;
  v_receipt_id uuid;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;
  v_receipt_no := public.next_receipt_no();
  insert into public.receipts (order_id, receipt_no, snapshot)
  values (p_order_id, v_receipt_no, p_snapshot)
  returning id into v_receipt_id;
  return v_receipt_id;
end;
$$;

create or replace function public.reissue_receipt(p_old_receipt_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_receipt_no text;
  v_new_id uuid;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์เข้าถึง';
  end if;

  select order_id into v_order_id
    from public.receipts
   where id = p_old_receipt_id and status = 'issued';

  if v_order_id is null then
    raise exception 'ไม่พบใบเสร็จที่ยกเลิกได้ หรือใบนี้ถูกยกเลิกไปแล้ว';
  end if;

  v_receipt_no := public.next_receipt_no();
  insert into public.receipts (order_id, receipt_no, snapshot)
  values (v_order_id, v_receipt_no, p_snapshot)
  returning id into v_new_id;

  update public.receipts
     set status = 'cancelled', cancelled_at = now(), replaced_by_receipt_id = v_new_id
   where id = p_old_receipt_id;

  return v_new_id;
end;
$$;
