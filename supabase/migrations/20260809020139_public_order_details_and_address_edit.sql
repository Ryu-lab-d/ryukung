-- ข้อความวิธีชำระเงินที่โชว์ให้ลูกค้าเห็นในหน้าลิงก์สรุปตอนยังไม่จ่าย
-- เก็บในตาราง settings แทนการฝังในโค้ด เพราะเป็นข้อมูลของร้าน (ช่องทางไลน์/ขั้นตอน) ที่ริวคุงต้องแก้ไขเองได้
-- โดยไม่ต้องรอแก้โค้ด (กฎข้อ 13 ในสเปก: ข้อมูลร้านต้องไม่ฝังในโค้ด)
alter table public.settings
  add column if not exists payment_instructions text default
$$แจ้งชำระเงินผ่านไลน์ @ryukung_bakery หรือคลิกลิงก์นี้ https://lin.ee/yscT9fJ
กดเพิ่มเพื่อนแล้วกดปุ่ม "ชำระเงิน" หรือพิมพ์คำว่า "บัญชี" จะมีระบบชำระเงินขึ้นมา
กรุณาชำระให้ตรงตามยอดเป๊ะ แล้วแจ้งชื่อผู้สั่งซื้อในแชท
ทางร้านจะตรวจสอบและอัปเดตสถานะให้ภายใน 1-3 ชั่วโมง (ไม่เกิน 1 วัน)$$;

-- เพิ่มรายละเอียดการส่งของและวิธีชำระเงินเข้าไปในลิงก์สรุปสำหรับลูกค้า
create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_customer_name text;
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

  select jsonb_build_object(
    'shop_name',             (select shop_name from public.settings limit 1),
    'payment_instructions',  (select payment_instructions from public.settings limit 1),
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
    'items_total',            v_order.items_total,
    'discount_amount',        v_order.discount_amount,
    'shipping_fee',           v_order.shipping_fee,
    'grand_total',            v_order.grand_total,
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

revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;

-- อนุญาตให้ลูกค้าแก้ไขที่อยู่จัดส่งเองผ่านลิงก์สรุปได้ แต่จำกัดแค่ตอนงานยังไม่ถึงขั้นแพ็ค
-- (fulfillment_type ต้องไม่ใช่นัดรับ และ work_status ต้องเป็น to_bake หรือ baking เท่านั้น)
-- แก้ได้แค่ 3 คอลัมน์นี้เท่านั้น ไม่ใช่ทั้งแถว กันไม่ให้ลูกค้าไปแก้ยอดเงินหรือข้อมูลอื่นได้
create or replace function public.update_public_order_address(
  p_token text,
  p_recipient_name text,
  p_recipient_phone text,
  p_address_text text
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
    ship_address_text    = p_address_text
  where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.update_public_order_address(text, text, text, text) from public;
grant execute on function public.update_public_order_address(text, text, text, text) to anon, authenticated;
