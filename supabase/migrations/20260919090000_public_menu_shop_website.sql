-- ขยายเมนูสาธารณะ (/menu) ให้มีข้อมูลพอทำเป็นหน้าเว็บร้านเต็มรูปแบบได้ (ไม่ใช่แค่หน้าเลือกสินค้าสั่งซื้อ) —
-- เพิ่มเบอร์โทร/ที่อยู่ร้าน (โชว์ในส่วน hero/footer) และ faqs (ให้แชทบอทน้องริวใช้ตอบคำถามลูกค้าได้เหมือน
-- หน้าติดตามออเดอร์ get_public_order) โค้ดส่วนอื่นเหมือน get_public_menu เดิมทุกตัวอักษร
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
