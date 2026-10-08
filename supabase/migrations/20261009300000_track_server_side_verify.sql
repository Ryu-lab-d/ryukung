-- red team: ด่าน "กรอกชื่อ/เบอร์ให้ตรงก่อนดูออเดอร์" ของหน้าติดตามออเดอร์เดิมเป็นแค่ฝั่งเบราว์เซอร์ — ฐานข้อมูลส่งชื่อ+เบอร์+ที่อยู่
-- ครบทุกอย่างให้ใครก็ตามที่มี token ตั้งแต่แรก (เบราว์เซอร์แค่เทียบเองทีหลัง) ผู้ที่ได้ลิงก์ไปเรียกฟังก์ชันตรงๆ ก็ข้ามด่านได้ทั้งหมด
-- ย้ายการตรวจมาไว้ที่เซิร์ฟเวอร์: ไม่ส่งข้อมูลส่วนตัวจนกว่าจะส่งชื่อ/เบอร์ที่ตรงมาให้ และจำกัดการเดา 10 ครั้ง/ชั่วโมง/ออเดอร์

-- แกนกลางตรวจตัวตน (ภายในเท่านั้น — เรียกจากฟังก์ชันสาธารณะด้านล่างและจาก Edge Function ด้วย service role)
-- คืน: 'ok' | 'wrong' | 'locked_out' | 'no_identity' | 'not_found'
create or replace function public.verify_order_token(p_token text, p_verify text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_name text;
  v_phone text;
  v_key text;
  v_in_name text;
  v_in_digits text;
  v_phone_digits text;
begin
  if p_token is null or length(p_token) < 20 then
    return 'not_found';
  end if;
  select * into v_order from public.orders
   where public_token = p_token and (is_draft = false or order_source = 'customer');
  if not found then
    return 'not_found';
  end if;
  select name, phone into v_name, v_phone from public.customers where id = v_order.customer_id;
  if coalesce(v_name, '') = '' and coalesce(v_phone, '') = '' then
    return 'no_identity';
  end if;

  v_key := 'track-fail:' || md5(p_token) || ':' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDDHH24');
  if not public.throttle_ok(v_key, 10) then
    return 'locked_out';
  end if;

  if length(coalesce(p_verify, '')) = 0 or length(p_verify) > 200 then
    perform public.throttle_hit(v_key);
    return 'wrong';
  end if;

  v_in_name := lower(regexp_replace(btrim(normalize(p_verify, NFC)), '\s+', ' ', 'g'));
  v_in_digits := regexp_replace(p_verify, '\D', '', 'g');
  if v_in_digits like '66%' and length(v_in_digits) = 11 then v_in_digits := '0' || substr(v_in_digits, 3); end if;
  v_phone_digits := regexp_replace(coalesce(v_phone, ''), '\D', '', 'g');
  if v_phone_digits like '66%' and length(v_phone_digits) = 11 then v_phone_digits := '0' || substr(v_phone_digits, 3); end if;

  if (coalesce(v_name, '') <> '' and v_in_name = lower(regexp_replace(btrim(normalize(v_name, NFC)), '\s+', ' ', 'g')))
     or (length(v_in_digits) >= 9 and v_phone_digits <> '' and v_in_digits = v_phone_digits) then
    return 'ok';
  end if;

  perform public.throttle_hit(v_key);
  return 'wrong';
end;
$$;
revoke execute on function public.verify_order_token(text, text) from public, anon, authenticated;
grant execute on function public.verify_order_token(text, text) to service_role;

-- get_public_order: เพิ่ม p_verify — ไม่ส่ง = ได้แค่ "หน้าล็อก" (เลขออเดอร์ + ข้อมูลร้านที่เปิดสาธารณะอยู่แล้ว)
drop function if exists public.get_public_order(text);
create or replace function public.get_public_order(p_token text, p_verify text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_name text;
  v_customer_phone text;
  v_paid_total numeric;
  v_status text;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;

  select * into v_order
    from public.orders
   where public_token = p_token
     and (is_draft = false or order_source = 'customer');
  if not found then
    return null;
  end if;

  if p_verify is null then
    -- หน้าล็อก: ยังไม่ยืนยันตัวตน ไม่ส่งข้อมูลส่วนตัวใดๆ
    return jsonb_build_object(
      'locked', true,
      'order_no', v_order.order_no,
      'shop_name', (select shop_name from public.settings limit 1),
      'logo_path', (select logo_path from public.settings limit 1),
      'line_url', (select line_url from public.settings limit 1)
    );
  end if;

  v_status := public.verify_order_token(p_token, p_verify);
  if v_status <> 'ok' then
    return jsonb_build_object(
      'locked', true,
      'reason', v_status,
      'order_no', v_order.order_no,
      'shop_name', (select shop_name from public.settings limit 1),
      'logo_path', (select logo_path from public.settings limit 1),
      'line_url', (select line_url from public.settings limit 1)
    );
  end if;

  select name, phone into v_customer_name, v_customer_phone from public.customers where id = v_order.customer_id;
  select coalesce(sum(amount), 0) into v_paid_total from public.payments where order_id = v_order.id;

  select jsonb_build_object(
    'shop_name',             (select shop_name from public.settings limit 1),
    'logo_path',              (select logo_path from public.settings limit 1),
    'payment_instructions',  (select payment_instructions from public.settings limit 1),
    'promptpay',              (select promptpay from public.settings limit 1),
    'faqs',                  (select faqs from public.settings limit 1),
    'line_url',              (select line_url from public.settings limit 1),
    'order_no',               v_order.order_no,
    'pending_confirmation',   v_order.is_draft,
    'customer_name',          v_customer_name,
    'customer_phone',         v_customer_phone,
    'needed_date',            v_order.needed_date,
    'fulfillment_type',       v_order.fulfillment_type,
    'pickup_place',           v_order.pickup_place,
    'pickup_time',            v_order.pickup_time,
    'ship_recipient_name',    v_order.ship_recipient_name,
    'ship_recipient_phone',   v_order.ship_recipient_phone,
    'ship_address_text',      v_order.ship_address_text,
    'work_status',            v_order.work_status,
    'payment_status',         v_order.payment_status,
    'cancelled_reason',       v_order.cancelled_reason,
    'refund_status',          v_order.refund_status,
    'previous_needed_date',   case when v_order.needed_date_change_seen then null else v_order.previous_needed_date end,
    'items_total',            v_order.items_total,
    'discount_amount',        v_order.discount_amount,
    'shipping_fee',           v_order.shipping_fee,
    'grand_total',            v_order.grand_total,
    'balance_due',            greatest(v_order.grand_total - v_paid_total, 0),
    'carrier',                v_order.carrier,
    'tracking_no',            v_order.tracking_no,
    'note',                   v_order.note,
    'address_editable',       (not v_order.is_draft) and v_order.fulfillment_type <> 'pickup' and v_order.work_status in ('to_bake', 'baking'),
    'payment_claimed_at',     v_order.payment_claimed_at,
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
revoke execute on function public.get_public_order(text, text) from public;
grant execute on function public.get_public_order(text, text) to anon, authenticated;

-- แก้ที่อยู่จัดส่ง: ต้องยืนยันตัวตน (ชื่อ/เบอร์) ด้วย — ไม่งั้นใครได้ลิงก์ไปก็เปลี่ยนที่ส่งของลูกค้าได้
drop function if exists public.update_public_order_address(text, text, text, text);
create or replace function public.update_public_order_address(
  p_token text, p_recipient_name text, p_recipient_phone text, p_address_text text, p_verify text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_token is null or length(p_token) < 20 then
    return false;
  end if;

  if p_address_text is null or length(trim(p_address_text)) = 0 then
    raise exception 'กรุณากรอกที่อยู่';
  end if;
  if length(p_address_text) > 600 or length(coalesce(p_recipient_name, '')) > 200 or length(coalesce(p_recipient_phone, '')) > 30 then
    raise exception 'ข้อมูลยาวเกินไป';
  end if;

  if public.verify_order_token(p_token, p_verify) <> 'ok' then
    raise exception 'ยืนยันตัวตนไม่สำเร็จ กรุณากรอกชื่อหรือเบอร์โทรที่แจ้งไว้ตอนสั่ง';
  end if;

  select * into v_order
    from public.orders
   where public_token = p_token
     and is_draft = false
     and work_status <> 'cancelled';

  if not found then
    return false;
  end if;

  if v_order.fulfillment_type = 'pickup' then
    raise exception 'ออเดอร์นี้เป็นแบบนัดรับ ไม่มีที่อยู่จัดส่งให้แก้ไข';
  end if;

  if v_order.work_status not in ('to_bake', 'baking') then
    raise exception 'ออเดอร์นี้เลยขั้นตอนที่แก้ไขที่อยู่ได้แล้ว กรุณาติดต่อร้านโดยตรง';
  end if;

  update public.orders set
    ship_recipient_name  = p_recipient_name,
    ship_recipient_phone = p_recipient_phone,
    ship_address_text    = p_address_text,
    address_edited_at     = now()
  where id = v_order.id;

  return true;
end;
$$;
revoke execute on function public.update_public_order_address(text, text, text, text, text) from public;
grant execute on function public.update_public_order_address(text, text, text, text, text) to anon, authenticated;

-- ประวัติ: การเปลี่ยนที่อยู่จัดส่งทุกครั้ง (โดยลูกค้าผ่านลิงก์ = ไม่มีชื่อผู้ทำ) ลงบันทึกกิจกรรม
create trigger audit_orders_address
  after update of ship_address_text, ship_recipient_name, ship_recipient_phone on public.orders
  for each row
  when (old.ship_address_text is distinct from new.ship_address_text
        or old.ship_recipient_name is distinct from new.ship_recipient_name
        or old.ship_recipient_phone is distinct from new.ship_recipient_phone)
  execute function public.audit_row();
