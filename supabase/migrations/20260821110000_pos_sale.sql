-- ขายหน้าร้าน (POS) — ลูกค้าเดินเข้ามาซื้อแล้วจ่ายจบทันที ไม่ต้องมีข้อมูลลูกค้า
-- ออกแบบเป็นกรณีพิเศษของ "ออเดอร์" เดิม (ไม่สร้างตารางคู่ขนานใหม่) เพื่อได้สรุปยอด/รายงาน/ตัดสต็อกวัตถุดิบ/ระบบใบเสร็จ
-- เดิมมาฟรีทั้งหมด — customer_id null รองรับอยู่แล้วทั้งใน DB และ confirm_order เดิม
create or replace function public.create_pos_sale(
  p_items jsonb,
  p_payment_method text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_no text;
  v_grand_total numeric;
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์ทำรายการนี้';
  end if;

  v_order_no := public.next_order_no();

  -- fulfillment_type='pickup' (ของถึงมือลูกค้าทันทีที่หน้าร้านตรงความหมายเดิมของ pickup พอดี ไม่ต้องเพิ่ม enum ใหม่)
  -- work_status='delivered' ทันที (ไม่ต้องผ่านคิวอบ ไม่ค้างอยู่บนบอร์ดงานครัวปนกับออเดอร์นัดล่วงหน้าจริง —
  -- 'delivered' เป็นค่าที่มีอยู่แล้วในระบบ ไม่ต้องเพิ่ม check constraint ใหม่)
  insert into public.orders (is_draft, order_no, customer_id, fulfillment_type, needed_date, bake_date, work_status)
  values (false, v_order_no, null, 'pickup', current_date, current_date, 'delivered')
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_price, unit_cost, qty)
  select v_order_id, (item->>'product_id')::uuid, item->>'product_name',
         (item->>'unit_price')::numeric, (item->>'unit_cost')::numeric, (item->>'qty')::numeric
  from jsonb_array_elements(p_items) as item;

  -- แทรก order_items แล้ว trigger เดิม (order_items_touch_trg -> orders_compute_trg) คำนวณ grand_total ให้อัตโนมัติ
  perform public.adjust_stock_for_order(v_order_id, 'deduct', 'pos_sale');

  select grand_total into v_grand_total from public.orders where id = v_order_id;

  -- payments.amount ต้อง > 0 (constraint เดิม) ข้ามการบันทึกถ้ายอดเป็น 0 พอดี — orders_compute_trg ตั้ง
  -- payment_status เป็น 'paid' ให้เองอัตโนมัติเมื่อ grand_total <= 0 อยู่แล้ว
  if v_grand_total > 0 then
    insert into public.payments (order_id, amount, method, note)
    values (v_order_id, v_grand_total, p_payment_method, 'ขายหน้าร้าน (POS)');
  end if;

  return v_order_id;
end;
$$;

grant execute on function public.create_pos_sale(jsonb, text) to authenticated;

-- เพิ่มหน้า "pos" เข้าไปในสิทธิ์เต็มเริ่มต้น (เหมือนตอนเพิ่ม withdrawals) กันพนักงานที่ใช้งานอยู่แล้ววันนี้เข้าไม่ได้จู่ๆ
alter table public.staff_members
  alter column allowed_pages set default array[
    'orders','products','customers','costing','summary','expenses','withdrawals','content','ingredients','promo','storage','pos'
  ];
update public.staff_members
  set allowed_pages = array_append(allowed_pages, 'pos')
  where not ('pos' = any(allowed_pages));
