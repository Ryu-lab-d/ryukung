-- สวิตช์เปิด/ปิดระบบแจ้งเตือนภัยพิบัติทั้งระบบ (ตอนนี้มีแค่โมดูลน้ำท่วม แต่ตั้งชื่อ generic ไว้เผื่อเพิ่มภัยพิบัติ
-- ประเภทอื่นในอนาคต) — เจ้าของร้านขอให้ "เก็บระบบนี้ไว้" ช่วงที่ไม่มีเหตุ (ไม่ต้องประกาศ/ไม่โชว์ให้ลูกค้าเห็น) แต่ไม่ลบ
-- โค้ด/ไฟล์ทิ้ง แล้วพอมีภัยพิบัติจริงค่อยเปิดใช้ทันทีผ่านหน้าตั้งค่า ไม่ต้อง deploy ใหม่ — ค่าเริ่มต้นเป็น true เพราะ
-- ตอนสร้าง migration นี้มีสถานการณ์น้ำท่วมจริงอยู่ในกรุงเทพฯ (ดูรายละเอียดใน FloodPage.tsx/FloodAlertBanner.tsx)
alter table public.settings
  add column disaster_mode_enabled boolean not null default true;

create or replace function public.get_public_menu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'shop_name',   (select shop_name from public.settings limit 1),
    'logo_path',   (select logo_path from public.settings limit 1),
    'promptpay',   (select promptpay from public.settings limit 1),
    'line_url',    (select line_url from public.settings limit 1),
    'phone',       (select phone from public.settings limit 1),
    'address',     (select address from public.settings limit 1),
    'faqs',        (select faqs from public.settings limit 1),
    'shipping_lead_days', (select shipping_lead_days from public.settings limit 1),
    'disaster_mode_enabled', (select disaster_mode_enabled from public.settings limit 1),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort_order)
      from public.categories where is_active = true
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'price', price, 'unit', unit, 'image_path', image_path, 'category_id', category_id
      ) order by name)
      from public.products where is_active = true
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.get_public_menu() to anon, authenticated;

-- endpoint เบาๆ แยกต่างหากสำหรับหน้า /flood (standalone route ไม่ได้โหลดผ่าน get_public_menu ที่มี products/
-- categories ติดมาด้วยซึ่งหนักเกินจำเป็นสำหรับแค่เช็คสวิตช์เปิด/ปิด)
create or replace function public.get_disaster_mode()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select disaster_mode_enabled from public.settings limit 1), true);
$$;

revoke execute on function public.get_disaster_mode() from public;
grant execute on function public.get_disaster_mode() to anon, authenticated;

notify pgrst, 'reload schema';
