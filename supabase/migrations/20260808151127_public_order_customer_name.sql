-- เพิ่ม customer_name เข้าไปในผลลัพธ์ของ get_public_order เพื่อให้หน้าเว็บใช้ตรวจสอบ
-- ว่าคนที่เปิดลิงก์พิมพ์ชื่อตรงกับชื่อลูกค้าที่บันทึกไว้จริงหรือไม่ (กันคนอื่นเดาชื่อมั่วๆ)
-- ชื่อไม่ใช่ข้อมูลอ่อนไหวเหมือนต้นทุน จึงส่งออกไปได้ตามปกติ
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
    'shop_name',        (select shop_name from public.settings limit 1),
    'order_no',         v_order.order_no,
    'customer_name',    v_customer_name,
    'needed_date',      v_order.needed_date,
    'fulfillment_type', v_order.fulfillment_type,
    'work_status',      v_order.work_status,
    'payment_status',   v_order.payment_status,
    'items_total',      v_order.items_total,
    'discount_amount',  v_order.discount_amount,
    'shipping_fee',     v_order.shipping_fee,
    'grand_total',      v_order.grand_total,
    'carrier',          v_order.carrier,
    'tracking_no',      v_order.tracking_no,
    'note',             v_order.note,
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
