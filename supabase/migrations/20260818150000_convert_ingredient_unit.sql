-- แปลงหน่วยวัตถุดิบ: อัปเดตจำนวนที่ใช้ในทุกสูตร + สต็อกคงเหลือ + ต้นทุนเฉลี่ย พร้อมกันในทีเดียวแบบ atomic
-- p_factor = "1 หน่วยเดิม เท่ากับกี่หน่วยใหม่" (คำนวณเองถ้าแปลงได้ชัวร์ เช่นกรัม->กิโลกรัม หรือมาจากคำตอบเจ้าของร้าน
-- ถ้าข้ามหมวดหน่วยที่เดาไม่ได้ เช่นกรัม->ฟอง) ตั้งใจไม่บันทึกลง ingredient_stock_movements เพราะสต็อกจริงไม่ได้
-- เปลี่ยน แค่หน่วยที่ใช้เรียกเปลี่ยน ไม่ใช่การเข้า/ออกสต็อกจริง
create or replace function public.convert_ingredient_unit(
  p_ingredient_id uuid,
  p_new_unit text,
  p_factor numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_member() then
    raise exception 'ไม่มีสิทธิ์ทำรายการนี้';
  end if;
  if p_factor <= 0 then
    raise exception 'ตัวคูณแปลงหน่วยต้องมากกว่า 0';
  end if;

  update public.product_ingredients
  set qty_per_unit = qty_per_unit * p_factor
  where ingredient_id = p_ingredient_id;

  update public.ingredients
  set unit = p_new_unit,
      stock_qty = stock_qty * p_factor,
      cost_per_unit = cost_per_unit / p_factor
  where id = p_ingredient_id;
end;
$$;

grant execute on function public.convert_ingredient_unit(uuid, text, numeric) to authenticated;
