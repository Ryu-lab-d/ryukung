-- ปิดข้อมูลลูกค้าให้แน่นที่สุด (รอบ 2 ของหน้าสาธารณะ)
--  1) Invoice สาธารณะ (/inv/...) ต้องยืนยันตัวตน (ชื่อ/เบอร์) ที่เซิร์ฟเวอร์ เหมือนหน้าติดตามออเดอร์ — เดิมมีแค่ลิงก์ก็เห็นชื่อ/เบอร์/อีเมล/รายการทั้งหมด
--  2) ลิงก์ติดตามของออเดอร์ที่ส่งมอบ/ยกเลิกเกิน 90 วันแล้ว หยุดทำงาน (ลดข้อมูลส่วนตัวที่เปิดค้างตลอดไป)

-- ตัวเทียบตัวตนกลาง: ชื่อ (ไม่สนช่องว่าง/ตัวพิมพ์) หรือเบอร์ (+66 ได้, ต้องยาว >= 9 หลัก)
create or replace function public.identity_matches(p_name text, p_phone text, p_verify text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_in_name text;
  v_in_digits text;
  v_phone_digits text;
begin
  if length(coalesce(p_verify, '')) = 0 or length(p_verify) > 200 then
    return false;
  end if;
  v_in_name := lower(regexp_replace(btrim(normalize(p_verify, NFC)), '\s+', ' ', 'g'));
  v_in_digits := regexp_replace(p_verify, '\D', '', 'g');
  if v_in_digits like '66%' and length(v_in_digits) = 11 then v_in_digits := '0' || substr(v_in_digits, 3); end if;
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone_digits like '66%' and length(v_phone_digits) = 11 then v_phone_digits := '0' || substr(v_phone_digits, 3); end if;
  return (coalesce(p_name, '') <> '' and v_in_name = lower(regexp_replace(btrim(normalize(p_name, NFC)), '\s+', ' ', 'g')))
      or (length(v_in_digits) >= 9 and v_phone_digits <> '' and v_in_digits = v_phone_digits);
end;
$$;
revoke execute on function public.identity_matches(text, text, text) from public, anon, authenticated;

-- ตรวจตัวตนของออเดอร์ (ใช้ตัวเทียบกลาง + หมดอายุลิงก์ 90 วันหลังส่งมอบ/ยกเลิก)
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
begin
  if p_token is null or length(p_token) < 20 then
    return 'not_found';
  end if;
  select * into v_order from public.orders
   where public_token = p_token and (is_draft = false or order_source = 'customer')
     and not (work_status in ('delivered', 'cancelled') and updated_at < now() - interval '90 days');
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
  if public.identity_matches(v_name, v_phone, p_verify) then
    return 'ok';
  end if;
  perform public.throttle_hit(v_key);
  return 'wrong';
end;
$$;

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
     and (is_draft = false or order_source = 'customer')
     and not (work_status in ('delivered', 'cancelled') and updated_at < now() - interval '90 days');
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

-- ตรวจตัวตนของ Invoice: เทียบกับชื่อ/เบอร์ใน snapshot ของ Invoice เอง (ออเดอร์อาจถูกลบไปแล้ว Invoice ยังอยู่)
create or replace function public.verify_invoice_token(p_token text, p_verify text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snap jsonb;
  v_name text;
  v_phone text;
  v_key text;
begin
  if p_token is null or length(p_token) < 20 then
    return 'not_found';
  end if;
  select i.snapshot into v_snap from public.invoices i
   where i.snapshot -> 'order' ->> 'public_token' = p_token and i.issued_at > now() - interval '30 days'
   order by i.issued_at desc limit 1;
  if v_snap is null then
    return 'not_found';
  end if;
  v_name := v_snap -> 'customer' ->> 'name';
  v_phone := v_snap -> 'customer' ->> 'phone';
  if coalesce(v_name, '') = '' and coalesce(v_phone, '') = '' then
    return 'no_identity';
  end if;
  v_key := 'inv-fail:' || md5(p_token) || ':' || to_char(now() at time zone 'Asia/Bangkok', 'YYYYMMDDHH24');
  if not public.throttle_ok(v_key, 10) then
    return 'locked_out';
  end if;
  if public.identity_matches(v_name, v_phone, p_verify) then
    return 'ok';
  end if;
  perform public.throttle_hit(v_key);
  return 'wrong';
end;
$$;
revoke execute on function public.verify_invoice_token(text, text) from public, anon, authenticated;
grant execute on function public.verify_invoice_token(text, text) to service_role;

drop function if exists public.get_public_invoice(text);
create or replace function public.get_public_invoice(p_token text, p_verify text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.invoices%rowtype;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;
  select * into v_row from public.invoices i
   where i.snapshot -> 'order' ->> 'public_token' = p_token and i.issued_at > now() - interval '30 days'
   order by i.issued_at desc limit 1;
  if not found then
    return null;
  end if;

  if p_verify is null then
    return jsonb_build_object('locked', true, 'invoice_no', v_row.invoice_no, 'shop_name', v_row.snapshot -> 'shop' ->> 'name');
  end if;

  v_status := public.verify_invoice_token(p_token, p_verify);
  if v_status <> 'ok' then
    return jsonb_build_object('locked', true, 'reason', v_status, 'invoice_no', v_row.invoice_no, 'shop_name', v_row.snapshot -> 'shop' ->> 'name');
  end if;
  return jsonb_build_object('invoice_no', v_row.invoice_no, 'issued_at', v_row.issued_at, 'snapshot', v_row.snapshot);
end;
$$;
revoke execute on function public.get_public_invoice(text, text) from public;
grant execute on function public.get_public_invoice(text, text) to anon, authenticated;
