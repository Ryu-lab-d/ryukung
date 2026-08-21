-- ฟังก์ชันช่วย: หา staff_members.id ของคนที่ล็อกอินอยู่ตอนนี้ — แยกเป็นฟังก์ชันเพราะ Postgres ไม่ยอมให้ subquery
-- ตรงๆ อยู่ใน DEFAULT expression ของคอลัมน์ (ต้องเป็น function call แทน)
create or replace function public.current_staff_id() returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.staff_members where user_id = auth.uid()
$$;
grant execute on function public.current_staff_id() to authenticated;

-- บันทึกว่าใครเป็นคน "สร้าง" รายการเบิกของนี้ (อาจไม่ใช่คนเดียวกับ withdrawn_by เช่นเจ้าของร้านสร้างแทน
-- พนักงานที่ออกไปขายจริง) ตั้งค่าอัตโนมัติจากคนที่ล็อกอินอยู่ตอนสร้าง ไม่ต้องเลือกเอง
alter table public.stock_withdrawals
  add column created_by uuid references public.staff_members(id) on delete set null
    default public.current_staff_id();
