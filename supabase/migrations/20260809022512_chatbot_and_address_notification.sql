-- คำถามที่พบบ่อย (FAQ) สำหรับแชทบอทฝั่งลูกค้า "น้องริว" — เก็บใน settings เพื่อให้ริวคุงแก้ไขเองได้
-- ไม่ต้องแก้โค้ด (กฎข้อ 13) แต่ละข้อมี keywords (คำที่ถ้าลูกค้าพิมพ์มาแล้วตรงจะตอบ) กับ answer (คำตอบ)
alter table public.settings
  add column if not exists faqs jsonb not null default '[
    {"keywords": ["จัดส่ง", "ส่งกี่วัน", "ใช้เวลากี่วัน", "ถึงเมื่อไหร่"], "answer": "ปกติร้านจะแจ้งวันที่ของจะถึงตอนยืนยันออเดอร์ค่ะ ถ้าอยากรู้แน่ชัดสำหรับออเดอร์นี้ ดูได้จากหน้ากำหนดการจัดส่งด้านบนเลยนะคะ"},
    {"keywords": ["ชำระเงิน", "โอนเงิน", "จ่ายเงิน", "บัญชี", "จ่ายยังไง"], "answer": "ชำระเงินได้ตามขั้นตอนในปุ่ม \"ดูวิธีชำระเงิน\" ด้านบนเลยค่ะ ถ้าชำระแล้วรบกวนแจ้งชื่อผู้สั่งซื้อในแชทด้วยนะคะ"},
    {"keywords": ["ยกเลิก", "คืนเงิน", "คืนสินค้า"], "answer": "หากต้องการยกเลิกออเดอร์ รบกวนแจ้งทางร้านโดยเร็วที่สุดก่อนเริ่มทำนะคะ"},
    {"keywords": ["แพ้", "ส่วนผสม", "วัตถุดิบ", "แพ้อาหาร"], "answer": "หากแพ้อาหารชนิดใด รบกวนแจ้งทางร้านโดยตรงเลยนะคะ เพื่อความปลอดภัยของคุณลูกค้าค่ะ"},
    {"keywords": ["ที่อยู่", "แก้ที่อยู่", "เปลี่ยนที่อยู่"], "answer": "แก้ไขที่อยู่จัดส่งได้เองจากปุ่ม \"แก้ไขที่อยู่\" ในการ์ดกำหนดการจัดส่งด้านบนเลยค่ะ (แก้ได้ก่อนร้านเริ่มแพ็คของนะคะ)"}
  ]'::jsonb;

-- ลิงก์ไลน์ร้าน ใช้ตอนแชทบอทตอบไม่ได้แล้วต้องส่งต่อให้พนักงานจริง
alter table public.settings
  add column if not exists line_url text default 'https://lin.ee/yscT9fJ';

-- บันทึกเวลาที่ลูกค้าแก้ไขที่อยู่เองล่าสุดผ่านลิงก์สาธารณะ ใช้แจ้งเตือนฝั่งร้านว่ามีคนแก้ไขที่อยู่
-- ค่าเป็น null แปลว่ายังไม่มีการแก้ไขที่ยังไม่ได้รับทราบ ริวคุงกดรับทราบแล้วจะเซ็ตกลับเป็น null
alter table public.orders
  add column if not exists address_edited_at timestamptz;

-- อัปเดต get_public_order ให้ส่ง faqs และ line_url ไปด้วย สำหรับแชทบอทฝั่งลูกค้า
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
    'faqs',                  (select faqs from public.settings limit 1),
    'line_url',              (select line_url from public.settings limit 1),
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

-- ตั้งเวลาที่ลูกค้าแก้ไขที่อยู่ล่าสุด ทุกครั้งที่แก้ไขที่อยู่สำเร็จผ่านลิงก์สาธารณะ
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
    ship_address_text    = p_address_text,
    address_edited_at     = now()
  where id = v_order.id;

  return true;
end;
$$;

revoke all on function public.update_public_order_address(text, text, text, text) from public;
grant execute on function public.update_public_order_address(text, text, text, text) to anon, authenticated;
