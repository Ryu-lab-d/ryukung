-- เจ้าของร้านขอ 2 เรื่อง:
-- 1) เวลาพนักงานปฏิเสธ/ยกเลิกออเดอร์ลูกค้า ให้ลูกค้าเห็นป็อปอัพแจ้งตอนเข้าหน้าติดตามออเดอร์เลย (เดิม
--    get_public_order กรอง work_status <> 'cancelled' ออก ทำให้ลิงก์ติดตามใช้ไม่ได้เลยหลังยกเลิก ลูกค้าเห็นแค่
--    "ไม่พบออเดอร์" เฉยๆ ไม่รู้ด้วยซ้ำว่าถูกยกเลิก) — เอาเงื่อนไขนั้นออก แล้วส่ง cancelled_reason/refund_status
--    กลับไปด้วยให้หน้าเว็บโชว์เหตุผล+ลิงก์แอดไลน์สำหรับกรณีต้องคืนเงิน
-- 2) เวลาพนักงานเลื่อนกำหนดการ (needed_date) ให้ลูกค้าเห็นป็อปอัพแจ้งตอนเข้าหน้าติดตามออเดอร์ด้วย — ใช้ trigger
--    จับการเปลี่ยนแปลงอัตโนมัติ (ไม่ต้องแก้โค้ดฝั่งพนักงานที่แก้ needed_date อยู่หลายจุด) เก็บวันที่เดิมไว้โชว์
--    เทียบกับวันที่ใหม่ แล้วมี flag "เห็นแล้วหรือยัง" ที่ลูกค้ากดรับทราบเพื่อเคลียร์ (ผ่าน RPC เฉพาะ ไม่ใช่แค่
--    ซ่อนฝั่ง client เพราะอยากให้เห็นแค่ครั้งเดียวจริงๆ ไม่ว่าจะเข้าจากอุปกรณ์ไหนก็ตาม)

alter table public.orders
  add column previous_needed_date date,
  add column needed_date_change_seen boolean not null default true;

create or replace function public.track_needed_date_change()
returns trigger
language plpgsql
as $$
begin
  if new.needed_date is distinct from old.needed_date then
    new.previous_needed_date := old.needed_date;
    new.needed_date_change_seen := false;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_track_needed_date_change on public.orders;
create trigger orders_track_needed_date_change
  before update on public.orders
  for each row execute function public.track_needed_date_change();

create or replace function public.acknowledge_needed_date_change(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 20 then
    return;
  end if;

  update public.orders
     set needed_date_change_seen = true
   where public_token = p_token;
end;
$$;

revoke execute on function public.acknowledge_needed_date_change(text) from public;
grant execute on function public.acknowledge_needed_date_change(text) to anon, authenticated;

create or replace function public.get_public_order(p_token text)
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

grant execute on function public.get_public_order(text) to anon, authenticated;

notify pgrst, 'reload schema';
